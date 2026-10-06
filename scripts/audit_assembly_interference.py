"""Exhaustive interference audit of an exported teaching GLB: rest pose and baked motion.

Two parts may touch; they may not overlap. This audits the file a student actually loads,
independently of FreeCAD and Blender, so it also catches what a hand-picked list of
"collision pairs" misses. Every pair of parts whose bounds meet is intersected exactly
(Manifold boolean, volume in mm^3), at the assembled pose and at sampled times through
each baked animation clip, with the clip's own keys, so a gear that clears at rest but
collides while turning is reported too.

    pip install -r scripts/requirements-audit.txt
    python3 scripts/audit_assembly_interference.py web/accessory-drives.glb.gz \\
        --contract web/accessory-drives-contract.json \\
        --policy cad-studies/accessory-drives/interference-policy.json \\
        --output cad-studies/accessory-drives/interference-audit.json

Exit status is 1 when any overlap is not covered by the policy's known-defect ledger, when a
declared gear mesh loses its minimum clearance, or when a part could not be checked and is not
waived. Touching (zero overlap volume) is always acceptable. Units: glTF metres, reported in mm.
"""
import argparse, gzip, hashlib, itertools, json, math, struct, sys
from pathlib import Path
import numpy as np
import manifold3d as m3d
import trimesh

REPO = Path(__file__).resolve().parents[1]
MM = 1000.0


# ----------------------------------------------------------------------- glTF reading
class Glb:
    """Minimal GLB reader: node hierarchy, triangle meshes and TRS animation channels."""
    DTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

    def __init__(self, path):
        raw = Path(path).read_bytes()
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        self.sha256 = hashlib.sha256(raw).hexdigest()
        self.bytes = len(raw)
        if raw[:4] != b'glTF':
            raise ValueError('not a GLB file')
        offset, self.bin = 12, b''
        while offset < len(raw):
            length, kind = struct.unpack('<II', raw[offset:offset + 8])
            body = raw[offset + 8:offset + 8 + length]
            if kind == 0x4E4F534A:
                self.json = json.loads(body)
            elif kind == 0x004E4942:
                self.bin = body
            offset += 8 + length
        if 'EXT_meshopt_compression' in self.json.get('extensionsRequired', []):
            raise ValueError('compressed GLB; audit the uncompressed export')
        self.nodes = self.json['nodes']
        self.parent = {}
        for index, node in enumerate(self.nodes):
            for child in node.get('children', []):
                self.parent[child] = index

    def accessor(self, index):
        spec = self.json['accessors'][index]
        view = self.json['bufferViews'][spec['bufferView']]
        dtype = np.dtype(self.DTYPES[spec['componentType']])
        width = self.WIDTHS[spec['type']]
        stride = view.get('byteStride') or dtype.itemsize * width
        start = view.get('byteOffset', 0) + spec.get('byteOffset', 0)
        count = spec['count']
        if stride == dtype.itemsize * width:
            data = np.frombuffer(self.bin, dtype=dtype, count=count * width, offset=start).reshape(count, width)
        else:
            rows = np.frombuffer(self.bin, dtype=np.uint8, count=(count - 1) * stride + dtype.itemsize * width, offset=start)
            data = np.stack([np.frombuffer(rows[i * stride:i * stride + dtype.itemsize * width].tobytes(), dtype=dtype)
                             for i in range(count)])
        return data

    def part_id(self, index):
        node = self.nodes[index]
        return (node.get('extras') or {}).get('cad_part_id') or node.get('name') or f'node{index}'

    def local_matrix(self, index, override=None):
        node = self.nodes[index]
        if 'matrix' in node and not override:
            return np.array(node['matrix'], dtype=float).reshape(4, 4).T
        t = (override or {}).get('translation', node.get('translation', [0, 0, 0]))
        q = (override or {}).get('rotation', node.get('rotation', [0, 0, 0, 1]))
        s = (override or {}).get('scale', node.get('scale', [1, 1, 1]))
        return trs_matrix(t, q, s)

    def world_matrix(self, index, overrides=None):
        chain, cursor = [], index
        while cursor is not None:
            chain.append(cursor)
            cursor = self.parent.get(cursor)
        matrix = np.eye(4)
        for node in reversed(chain):
            matrix = matrix @ self.local_matrix(node, (overrides or {}).get(node))
        return matrix

    def mesh_nodes(self):
        return [i for i, n in enumerate(self.nodes) if 'mesh' in n]

    def local_geometry(self, index):
        """Welded, hole-filled triangle mesh in node-local metres."""
        vertices, faces, base = [], [], 0
        for primitive in self.json['meshes'][self.nodes[index]['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                continue
            position = self.accessor(primitive['attributes']['POSITION']).astype(np.float64)
            indices = (self.accessor(primitive['indices']).reshape(-1) if 'indices' in primitive
                       else np.arange(len(position))).reshape(-1, 3).astype(np.int64)
            vertices.append(position)
            faces.append(indices + base)
            base += len(position)
        mesh = trimesh.Trimesh(np.concatenate(vertices), np.concatenate(faces), process=False)
        mesh.merge_vertices(digits_vertex=7)
        mesh.update_faces(mesh.nondegenerate_faces())
        mesh.remove_unreferenced_vertices()
        if not mesh.is_watertight:
            trimesh.repair.fill_holes(mesh)
        return mesh

    def clips(self):
        return {a['name']: a for a in self.json.get('animations', [])}

    def clip_tracks(self, clip):
        """{node: {'translation'|'rotation'|'scale': (times, values)}} for one animation."""
        tracks = {}
        for channel in clip['channels']:
            sampler = clip['samplers'][channel['sampler']]
            mode = sampler.get('interpolation', 'LINEAR')
            if mode not in ('LINEAR', 'STEP'):
                raise ValueError(f'{mode} animation samplers are not audited')
            tracks.setdefault(channel['target']['node'], {})[channel['target']['path']] = (
                self.accessor(sampler['input']).reshape(-1), self.accessor(sampler['output']).astype(np.float64), mode)
        return tracks


def trs_matrix(t, q, s):
    x, y, z, w = q
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    rot = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    matrix = np.eye(4)
    matrix[:3, :3] = rot * np.array(s)[None, :]
    matrix[:3, 3] = t
    return matrix


def sample_track(times, values, t, mode='LINEAR'):
    t = min(max(t, times[0]), times[-1])
    k = int(np.searchsorted(times, t, side='right') - 1)
    if mode == 'STEP':
        return values[min(max(k, 0), len(values) - 1)]
    k = min(max(k, 0), len(times) - 2)
    span = times[k + 1] - times[k]
    f = 0.0 if span <= 0 else (t - times[k]) / span
    a, b = values[k], values[k + 1]
    if len(a) == 4:                                  # quaternion: shortest-arc normalised lerp
        if np.dot(a, b) < 0:
            b = -b
        out = a * (1 - f) + b * f
        return out / (np.linalg.norm(out) or 1.0)
    return a * (1 - f) + b * f


# --------------------------------------------------------------------- audit machinery
class Part:
    """One mesh node: a welded solid built once in node-local millimetres, posed per sample."""

    def __init__(self, glb, index):
        self.index, self.id = index, glb.part_id(index)
        self.local = glb.local_geometry(index)
        self.faces = np.asarray(self.local.faces, dtype=np.uint32)
        self.vertices_mm = np.asarray(self.local.vertices, dtype=np.float64) * MM
        solid = m3d.Manifold(m3d.Mesh(vert_properties=self.vertices_mm.astype(np.float32), tri_verts=self.faces))
        self.base = solid if solid.status() == m3d.Error.NoError else None
        self.status = 'ok' if self.base is not None else 'unverified'
        self._bvh = None

    @staticmethod
    def affine(world):
        matrix = np.array(world[:3, :4], dtype=np.float64)
        matrix[:, 3] *= MM
        return matrix

    def posed(self, world):
        """(Manifold, bounds_min, bounds_max) in world millimetres, or None if unverifiable."""
        if self.base is None:
            return None
        solid = self.base.transform(self.affine(world).astype(np.float32))
        box = solid.bounding_box()
        return solid, np.array(box[:3]), np.array(box[3:])

    def bvh(self, fcl):
        if self._bvh is None:
            model = fcl.BVHModel()
            model.beginModel(len(self.vertices_mm), len(self.faces))
            model.addSubModel(self.vertices_mm, self.faces.astype(np.int64))
            model.endModel()
            self._bvh = model
        return self._bvh


def overlaps(parts, glb, overrides=None, only_moving=None, static_cache=None, margin_mm=0.0, unchanged=None):
    """Intersection (volume mm^3, thickness mm) for every pair whose bounds meet: {(a, b): (volume, thickness)}.

    `unchanged(a, b)` is true for two parts that cannot move relative to each other (the same animation tracks, or neither moves); the
    rest-pose check already covers that pair, so it is skipped."""
    posed = {}
    for part in parts:
        if static_cache is not None and part.id in static_cache:
            built = static_cache[part.id]
        else:
            built = part.posed(glb.world_matrix(part.index, overrides))
            if static_cache is not None and only_moving is not None and part.id not in only_moving:
                static_cache[part.id] = built
        if built is not None:
            posed[part.id] = built
    result = {}
    for a, b in itertools.combinations(sorted(posed), 2):
        if only_moving is not None and a not in only_moving and b not in only_moving:
            continue
        if unchanged is not None and unchanged(a, b):
            continue
        (ma, lo_a, hi_a), (mb, lo_b, hi_b) = posed[a], posed[b]
        if np.any(hi_a < lo_b - margin_mm) or np.any(hi_b < lo_a - margin_mm):
            continue
        shared = ma ^ mb
        volume, area = max(0.0, shared.volume()), shared.surface_area()
        # Thickness of the overlapping slab (2V/S): ~0 for a sliver on a curved seat, millimetres for a collision.
        result[(a, b)] = (volume, 2 * volume / area if area > 0 else 0.0)
    return result


def pose_at(glb, tracks, t):
    return {node: {path: sample_track(times, values, t, mode) for path, (times, values, mode) in channels.items()}
            for node, channels in tracks.items()}


def moving_ids(glb, tracks):
    moving = set()
    for node, channels in tracks.items():
        for times, values, _ in channels.values():
            if np.ptp(values, axis=0).max() > 1e-9:
                moving.add(glb.part_id(node))
    return moving


def track_signatures(glb, tracks):
    """{part id: signature} where equal signatures mean identical motion (one rigid body); parts with no track are absent."""
    signatures = {}
    for node, channels in tracks.items():
        signatures[glb.part_id(node)] = tuple((path, times.tobytes(), values.tobytes(), mode) for path, (times, values, mode) in sorted(channels.items()))
    return signatures


def clip_span(tracks):
    start = min(c[0][0] for ch in tracks.values() for c in ch.values())
    end = max(c[0][-1] for ch in tracks.values() for c in ch.values())
    return start, end


def min_distance(fcl, part_a, part_b, glb, overrides):
    """Minimum distance (mm) between two rigidly posed parts; negative when their surfaces cross."""
    objects = []
    for part in (part_a, part_b):
        world = glb.world_matrix(part.index, overrides)
        rotation = world[:3, :3]
        if not np.allclose(rotation @ rotation.T, np.eye(3), atol=1e-6):
            raise ValueError(f'{part.id}: non-rigid pose; clearance needs a rigid transform')
        objects.append(fcl.CollisionObject(part.bvh(fcl), fcl.Transform(rotation, world[:3, 3] * MM)))
    request, result = fcl.DistanceRequest(enable_nearest_points=False), fcl.DistanceResult()
    return float(fcl.distance(objects[0], objects[1], request, result))


def audit(path, contract=None, policy=None, samples=41, dense=96, include_exploded=False, rest_only=False, log=print):
    glb = Glb(path)
    policy = policy or {}
    tolerance = policy.get('volume_tolerance_mm3', 1e-3)
    thickness_limit = policy.get('max_penetration_mm', .05)   # mesh tessellation allowance
    parts = [Part(glb, i) for i in glb.mesh_nodes()]
    by_id = {p.id: p for p in parts}
    unverified = sorted(p.id for p in parts if p.status != 'ok')
    log(f'{len(parts)} parts, {len(unverified)} cannot be intersected exactly: {unverified}')
    ledger = {frozenset((e['a'], e['b'])): e for e in policy.get('known_defects', [])}
    findings = {}

    def record(pair, volume, thickness, where):
        key = frozenset(pair)
        item = findings.setdefault(key, dict(a=pair[0], b=pair[1], max_overlap_mm3=0.0, max_thickness_mm=0.0,
                                             first_seen=where, poses=[]))
        item['max_overlap_mm3'] = max(item['max_overlap_mm3'], volume)
        item['max_thickness_mm'] = max(item['max_thickness_mm'], thickness)
        if where not in item['poses'] and len(item['poses']) < 6:
            item['poses'].append(where)

    rest = overlaps(parts, glb)
    interferes = lambda volume, thickness: volume > tolerance and thickness > thickness_limit
    touching = sum(1 for v, t in rest.values() if not interferes(v, t))
    for pair, (volume, thickness) in rest.items():
        if interferes(volume, thickness):
            record(pair, volume, thickness, 'rest')
    log(f'rest pose: {len(rest)} neighbouring pairs, {touching} touching only, {len(findings)} overlapping')

    clip_reports = {}
    gear_meshes = (contract or {}).get('gearMeshes', [])
    fcl = None
    try:
        import fcl
    except ImportError:
        log('python-fcl missing: gear clearance (minimum gap) is not measured')
    min_gap = {}
    for name, clip in ({} if rest_only else glb.clips()).items():
        if not include_exploded and name in ('Exploded overview', 'Reassembly overview'):
            continue
        tracks = glb.clip_tracks(clip)
        moving = moving_ids(glb, tracks)
        signatures = track_signatures(glb, tracks)
        unchanged = lambda a, b: signatures.get(a) == signatures.get(b)         # same tracks, or neither animated
        start, end = clip_span(tracks)
        # Uniform samples across the clip, plus a dense window over its first tenth: a gear mesh repeats every
        # tooth pitch of its driver, and that window spans at least one pitch of every declared gear pair.
        times = sorted(set([start + (end - start) * k / (samples - 1) for k in range(samples)]
                           + [start + (end - start) * 0.1 * k / dense for k in range(dense)]))
        before, cache = len(findings), {}
        for t in times:
            pose = pose_at(glb, tracks, t)
            for pair, (volume, thickness) in overlaps(parts, glb, pose, only_moving=moving, static_cache=cache, unchanged=unchanged).items():
                if interferes(volume, thickness):
                    record(pair, volume, thickness, f'{name} @ {t:.3f}s')
            if fcl is not None and name.startswith('Operating mechanism'):          # also 'Operating mechanism (illustrative)'
                for mesh in gear_meshes:
                    gap = min_distance(fcl, by_id[mesh['driver']], by_id[mesh['driven']], glb, pose)
                    key = (mesh['driver'], mesh['driven'])
                    min_gap[key] = min(min_gap.get(key, math.inf), gap)
        clip_reports[name] = dict(moving_parts=len(moving), poses=len(times), new_overlaps=len(findings) - before)
        log(f'clip {name!r}: {len(moving)} moving parts, {len(times)} poses, {len(findings) - before} new overlapping pairs')

    min_required = policy.get('min_gear_clearance_mm', 0.02)
    gear_report = [dict(driver=a, driven=b, min_gap_mm=gap, required_mm=min_required, ok=gap >= min_required)
                   for (a, b), gap in sorted(min_gap.items())]
    violations, known = [], []
    for key, item in sorted(findings.items(), key=lambda kv: -kv[1]['max_overlap_mm3']):
        entry = ledger.get(key)
        if entry and item['max_overlap_mm3'] <= entry['max_mm3'] * 1.05 + tolerance:
            known.append(dict(item, ledger=entry.get('reason')))
        else:
            violations.append(dict(item, ledger='over the recorded ledger limit' if entry else 'not in ledger'))
    stale = [dict(a=e['a'], b=e['b'], note='no longer observed: remove it from known_defects')
             for key, e in ledger.items() if key not in findings]
    waived = {w['part'] for w in policy.get('unverified_waivers', [])}
    unwaived = [u for u in unverified if u not in waived]
    report = dict(
        asset_sha256=glb.sha256, asset_bytes=glb.bytes, parts=len(parts), tolerance_mm3=tolerance,
        max_penetration_mm=thickness_limit,
        method='All bound-meeting pairs intersected exactly (Manifold boolean) at the rest pose and at sampled times '
               'of each baked animation clip. Touching is allowed, overlap is not; an overlap thinner than '
               'max_penetration_mm is treated as mesh tessellation noise on a touching face.',
        rest_neighbouring_pairs=len(rest), rest_touching_only=touching,
        clips=clip_reports, gear_meshes=gear_report,
        unverified_parts=unverified, unverified_not_waived=unwaived, stale_ledger_entries=stale,
        overlaps_total=len(findings), known_defects=known, new_violations=violations)
    report['clean'] = not findings and not unwaived and all(g['ok'] for g in gear_report)
    report['passed'] = not violations and not unwaived and not stale and all(g['ok'] for g in gear_report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('glb')
    parser.add_argument('--contract')
    parser.add_argument('--policy')
    parser.add_argument('--output')
    parser.add_argument('--samples', type=int, default=41, help='uniform poses per clip')
    parser.add_argument('--dense', type=int, default=96, help='extra poses in the first tenth of each clip')
    parser.add_argument('--rest-only', action='store_true', help='audit only the assembled pose (large models)')
    parser.add_argument('--include-exploded', action='store_true',
                        help='also sweep the exploded/reassembly clips (parts are nested, so transient overlaps are expected)')
    args = parser.parse_args()
    contract = json.loads(Path(args.contract).read_text(encoding='utf8')) if args.contract else None
    policy = json.loads(Path(args.policy).read_text(encoding='utf8')) if args.policy else None
    report = audit(args.glb, contract, policy, args.samples, args.dense, args.include_exploded, args.rest_only)
    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    for item in report['new_violations']:
        print(f"VIOLATION {item['a']} / {item['b']}: {item['max_overlap_mm3']:.3f} mm3, {item['max_thickness_mm']:.2f} mm thick ({item['first_seen']}) {item['ledger']}")
    for item in report['stale_ledger_entries']:
        print(f"STALE LEDGER {item['a']} / {item['b']}: {item['note']}")
    for item in report['known_defects']:
        print(f"known     {item['a']} / {item['b']}: {item['max_overlap_mm3']:.3f} mm3, {item['max_thickness_mm']:.2f} mm thick")
    for gear in report['gear_meshes']:
        print(f"gear mesh {gear['driver']} / {gear['driven']}: min gap {gear['min_gap_mm']:.3f} mm {'ok' if gear['ok'] else 'TOO TIGHT'}")
    print('CLEAN' if report['clean'] else 'PASSED (known defects remain)' if report['passed'] else 'FAILED')
    sys.exit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
