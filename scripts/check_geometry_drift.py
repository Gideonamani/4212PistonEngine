"""Did the presentation stage change any geometry? Compare the frozen tessellation of a study with the GLB that Blender exported, part by part.

FreeCAD owns geometry; Blender may change normals, materials, lighting and labels, never a vertex (docs/freecad-blender-boundary.md). This check is the enforcement:
for every part it maps the exported vertices back into the CAD frame (millimetres) and compares them with the frozen tessellation in `geometry.json`.

    python scripts/check_geometry_drift.py build/<study>/development/geometry.json build/<study>/<export>.glb [--classes cad-studies/<study>/fidelity-classes.json]

A part passes when, within the bound (default 0.001 mm, about 17 times the float32 rounding of a glTF coordinate near half a metre):
  - every exported vertex has a frozen vertex that close, and every frozen vertex an exported one (so nothing moved, was added by a skin or subdivision, or was merged away);
  - the triangle count is unchanged;
  - the signed volume agrees to what the bound allows (surface area x bound), so a reconnected or flipped triangle shows even when every vertex position is kept.
Exported meshes with no part in the geometry (overlays, labels) fail unless `--allow-extra REGEX` names them. A compressed or quantised export is refused: check the Blender
export, before the optimiser. The bound may differ by class (`--class-bound visual-structure=0.05`); release 1 uses one bound for all, because Blender edits no geometry.

Standard library only. Exit status 1 on any failure. Use `check()` from a test.
"""
import argparse
import gzip
import json
import math
import re
import struct
import sys
from array import array
from pathlib import Path

DEFAULT_BOUND_MM = 0.001          # the existing file check measures about 0.000052 mm at rest for R10: this leaves a wide margin and still catches any real edit
CLASSES = ('engineering', 'visual-structure', 'cosmetic')
COMPONENT_FORMATS = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
AXES = {
    # glTF (x, y, z) in metres from CAD (x, y, z) in millimetres: Blender's glTF exporter turns Z up into Y up, so y = z and z = -y.
    'blender-gltf': (lambda g: (g[0] * 1000.0, -g[2] * 1000.0, g[1] * 1000.0)),
    'identity': (lambda g: (g[0] * 1000.0, g[1] * 1000.0, g[2] * 1000.0)),
}


def read_glb(path):
    raw = Path(path).read_bytes()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    if raw[:4] != b'glTF':
        raise ValueError('not a GLB file')
    offset, document, blob = 12, None, b''
    while offset < len(raw):
        length, kind = struct.unpack('<II', raw[offset:offset + 8])
        body = raw[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:
            document = json.loads(body)
        elif kind == 0x004E4942:
            blob = body
        offset += 8 + length
    required = set(document.get('extensionsRequired', [])) | set(document.get('extensionsUsed', []))
    if required & {'EXT_meshopt_compression', 'KHR_mesh_quantization', 'KHR_draco_mesh_compression'}:
        raise ValueError('compressed or quantised GLB: check the Blender export, before the optimiser')
    return document, blob


def accessor(document, blob, index):
    spec = document['accessors'][index]
    if 'sparse' in spec:
        raise ValueError('sparse accessors are not supported')
    view = document['bufferViews'][spec['bufferView']]
    code, size = COMPONENT_FORMATS[spec['componentType']]
    width = WIDTH[spec['type']]
    start, count = view.get('byteOffset', 0) + spec.get('byteOffset', 0), spec['count']
    stride = view.get('byteStride') or size * width
    if stride == size * width:
        values = array(code)
        values.frombytes(blob[start:start + count * width * size])
        return values, width
    values = array(code)
    for i in range(count):
        values.frombytes(blob[start + i * stride:start + i * stride + width * size])
    return values, width


def matmul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def local_matrix(node):
    if 'matrix' in node:
        m = node['matrix']
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    x, y, z, w = node.get('rotation', (0, 0, 0, 1))
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    sx, sy, sz = node.get('scale', (1, 1, 1))
    tx, ty, tz = node.get('translation', (0, 0, 0))
    return [[(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y - z * w) * sy, 2 * (x * z + y * w) * sz, tx],
            [2 * (x * y + z * w) * sx, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z - x * w) * sz, ty],
            [2 * (x * z - y * w) * sx, 2 * (y * z + x * w) * sy, (1 - 2 * (x * x + y * y)) * sz, tz],
            [0, 0, 0, 1]]


def exported_parts(document, blob, axes):
    """{part id: {'vertices': [(x, y, z) mm CAD frame], 'triangles': n, 'volume': mm3}} for every mesh node, posed at the file's rest transforms."""
    nodes = document['nodes']
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    to_cad = AXES[axes]
    found = {}
    for index, node in enumerate(nodes):
        if 'mesh' not in node:
            continue
        chain, cursor = [], index
        while cursor is not None:
            chain.append(cursor)
            cursor = parent.get(cursor)
        world = [[float(i == j) for j in range(4)] for i in range(4)]
        for n in reversed(chain):
            world = matmul(world, local_matrix(nodes[n]))
        pid = (node.get('extras') or {}).get('cad_part_id') or node.get('name') or f'node{index}'
        vertices, triangles, volume = [], 0, 0.0
        for primitive in document['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                continue
            positions, _ = accessor(document, blob, primitive['attributes']['POSITION'])
            points = []
            for i in range(0, len(positions), 3):
                x, y, z = positions[i], positions[i + 1], positions[i + 2]
                points.append(to_cad((world[0][0] * x + world[0][1] * y + world[0][2] * z + world[0][3],
                                      world[1][0] * x + world[1][1] * y + world[1][2] * z + world[1][3],
                                      world[2][0] * x + world[2][1] * y + world[2][2] * z + world[2][3])))
            if 'indices' in primitive:
                indices, _ = accessor(document, blob, primitive['indices'])
            else:
                indices = range(len(points))
            volume += signed_volume(points, indices)
            triangles += len(indices) // 3
            vertices += points
        found[pid] = dict(vertices=vertices, triangles=triangles, volume=volume)
    return found


def signed_volume(points, indices):
    total = 0.0
    for i in range(0, len(indices), 3):
        (ax, ay, az), (bx, by, bz), (cx, cy, cz) = points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]
        total += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
    return total / 6.0


def surface_area(points, indices):
    total = 0.0
    for i in range(0, len(indices), 3):
        a, b, c = points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]
        u, v = (b[0] - a[0], b[1] - a[1], b[2] - a[2]), (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        total += math.sqrt((u[1] * v[2] - u[2] * v[1]) ** 2 + (u[2] * v[0] - u[0] * v[2]) ** 2 + (u[0] * v[1] - u[1] * v[0]) ** 2) / 2
    return total


def frozen_parts(geometry):
    found = {}
    for p in geometry['parts']:
        points, indices = [tuple(v) for v in p['vertices_mm']], [i for t in p['triangles'] for i in t]
        found[p['id']] = dict(vertices=points, triangles=len(p['triangles']), volume=signed_volume(points, indices), area=surface_area(points, indices))
    return found


def one_sided_error(source, target, bound):
    """Largest distance from a vertex of `source` to the nearest vertex of `target`, or inf when one has none within 10 bounds. Exact below 10 bounds."""
    cell = bound * 10.0
    grid = {}
    for p in target:
        grid.setdefault((int(p[0] // cell), int(p[1] // cell), int(p[2] // cell)), []).append(p)
    seen, worst = set(), 0.0
    for p in source:
        key = (round(p[0], 5), round(p[1], 5), round(p[2], 5))
        if key in seen:
            continue
        seen.add(key)
        cx, cy, cz = int(p[0] // cell), int(p[1] // cell), int(p[2] // cell)
        best = math.inf
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for q in grid.get((cx + dx, cy + dy, cz + dz), ()):
                        d = math.dist(p, q)
                        if d < best:
                            best = d
        worst = max(worst, best)
        if worst == math.inf:
            return worst
    return worst


def bounds_error(a, b):
    lo_a, hi_a = [min(v[i] for v in a) for i in range(3)], [max(v[i] for v in a) for i in range(3)]
    lo_b, hi_b = [min(v[i] for v in b) for i in range(3)], [max(v[i] for v in b) for i in range(3)]
    return max(abs(x - y) for x, y in zip(lo_a + hi_a, lo_b + hi_b))


def check(geometry, document, blob, axes='blender-gltf', bound_mm=DEFAULT_BOUND_MM, classes=None, class_bounds=None, allow_extra=(), only=None):
    """Compare a geometry.json dict with a parsed GLB. Returns a report dict; report['passed'] is the verdict."""
    frozen, exported = frozen_parts(geometry), exported_parts(document, blob, axes)
    class_of = {r['id']: r['class'] for r in (classes or {}).get('parts', [])}
    limits = {c: (class_bounds or {}).get(c, bound_mm) for c in CLASSES}
    patterns = [re.compile(p) for p in allow_extra]
    rows, failures = [], []
    for pid, f in frozen.items():
        if only and pid not in only:
            continue
        cls = class_of.get(pid, 'engineering' if classes is None else 'visual-structure')
        limit = limits[cls]
        e = exported.get(pid)
        if e is None:
            failures.append(f'{pid}: missing from the export')
            rows.append(dict(id=pid, **{'class': cls}, bound_mm=limit, passed=False))
            continue
        vertex = max(one_sided_error(e['vertices'], f['vertices'], limit), one_sided_error(f['vertices'], e['vertices'], limit))
        reasons = []
        if vertex > limit:
            reasons.append(f'vertex moved, added or removed: {"more than %.4f" % (limit * 10) if vertex == math.inf else "%.5f" % vertex} mm against a bound of {limit} mm')
        if e['triangles'] != f['triangles']:
            reasons.append(f'triangle count {f["triangles"]} -> {e["triangles"]}')
        volume = abs(e['volume'] - f['volume'])
        allowed = f['area'] * limit               # moving every surface point by the bound changes the volume by at most this
        if volume > allowed:
            reasons.append(f'volume differs by {volume:.3f} mm3, more than the {allowed:.3f} mm3 that a {limit} mm bound allows')
        rows.append(dict(id=pid, **{'class': cls}, bound_mm=limit, vertex_error_mm=None if vertex == math.inf else round(vertex, 6),
                         bounds_error_mm=round(bounds_error(e['vertices'], f['vertices']), 6) if e['vertices'] and f['vertices'] else None,
                         triangles=f['triangles'], volume_error_mm3=round(volume, 6), passed=not reasons))
        failures += [f'{pid}: {r}' for r in reasons]
    extras = sorted(set(exported) - set(frozen))
    for pid in extras:
        if not any(p.fullmatch(pid) for p in patterns):
            failures.append(f'{pid}: exported mesh with no part in the geometry (name it with --allow-extra if it is an overlay)')
    measured = [r['vertex_error_mm'] for r in rows if r.get('vertex_error_mm') is not None]
    return dict(passed=not failures, parts_checked=len(rows), exported_meshes=len(exported), extra_meshes=extras, failures=failures,
                max_vertex_error_mm=max(measured) if measured else None, max_bounds_error_mm=max((r['bounds_error_mm'] or 0 for r in rows if 'bounds_error_mm' in r), default=None),
                bounds_mm=limits, axes=axes,
                by_class={c: dict(parts=sum(1 for r in rows if r['class'] == c), failed=sum(1 for r in rows if r['class'] == c and not r['passed'])) for c in CLASSES}, parts=rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('geometry', help='the frozen tessellation, geometry.json')
    parser.add_argument('glb', help='the GLB Blender exported (.glb or .glb.gz), not an optimised copy')
    parser.add_argument('--axes', choices=sorted(AXES), default='blender-gltf')
    parser.add_argument('--bound-mm', type=float, default=DEFAULT_BOUND_MM)
    parser.add_argument('--classes', help="the study's fidelity-classes.json, to report and bound by class")
    parser.add_argument('--class-bound', action='append', default=[], metavar='CLASS=MM')
    parser.add_argument('--allow-extra', action='append', default=[], metavar='REGEX')
    parser.add_argument('--part', action='append', help='check only this part id')
    parser.add_argument('--output', help='write the report as JSON')
    args = parser.parse_args()
    geometry = json.loads(Path(args.geometry).read_text(encoding='utf-8'))
    document, blob = read_glb(args.glb)
    classes = json.loads(Path(args.classes).read_text(encoding='utf-8')) if args.classes else None
    bounds = {}
    for item in args.class_bound:
        name, value = item.split('=')
        if name not in CLASSES:
            parser.error(f'unknown class {name}')
        bounds[name] = float(value)
    report = check(geometry, document, blob, args.axes, args.bound_mm, classes, bounds, args.allow_extra, set(args.part) if args.part else None)
    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    for failure in report['failures'][:40]:
        print('FAIL', failure)
    print(f'{report["parts_checked"]} parts, {report["exported_meshes"]} exported meshes; largest vertex error {report["max_vertex_error_mm"]} mm, largest bounds error {report["max_bounds_error_mm"]} mm')
    print('PASSED: the export holds the frozen geometry' if report['passed'] else f'FAILED: {len(report["failures"])} problem(s)')
    sys.exit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
