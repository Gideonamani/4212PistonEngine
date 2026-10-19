"""Compare two GLB files structurally: do they describe the same model? Standard library only.

"Same model" here means, for every named node: the same parent, the same local transform, the same extras, the same mesh (primitive count, attribute set, vertex
and index counts, vertex positions and normals, position bounds) and the same resolved material (colour, metalness, roughness, alpha mode, double-sidedness);
and, for every animation channel (animation name, target node, path): the same interpolation and the same keyframe times and values. Numbers are compared
within stated tolerances (default: exactly equal). Byte identity of the two files is reported as a separate fact, because it is stronger than this comparison and
Blender's exporter is not guaranteed to give it.

It does not compare what is not in the file (the editable .blend, the render of the model) and it does not judge whether either file is right: two wrong files that
are wrong in the same way compare equal. See docs/animated-study-rig.md for what the regression test built on it proves and what it does not.

    python scripts/compare_glb_structure.py first.glb second.glb [--tolerance 1e-6] [--json report.json]
"""
import argparse, gzip, hashlib, json, struct, sys
from array import array
from pathlib import Path

COMPONENT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}
IDENTITY_TRS = dict(translation=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0, 1.0), scale=(1.0, 1.0, 1.0))


def read_glb(path):
    """(JSON document, binary chunk, file bytes) of a .glb or .glb.gz."""
    raw = Path(path).read_bytes()
    data = gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw
    magic, version, length = struct.unpack('<III', data[:12])
    if magic != 0x46546c67 or version != 2 or length != len(data):
        raise ValueError(f'{path} is not a glTF 2 binary file')
    offset, document, blob = 12, None, b''
    while offset < length:
        size, kind = struct.unpack('<II', data[offset:offset + 8])
        chunk = data[offset + 8:offset + 8 + size]
        if kind == 0x4e4f534a:
            document = json.loads(chunk)
        elif kind == 0x004e4942:
            blob = chunk
        offset += 8 + size
    return document, blob, data


def accessor(document, blob, index):
    """(flat values, components per element) of an accessor, honouring byteStride; sparse accessors are not supported (the exporter writes none)."""
    acc = document['accessors'][index]
    if 'sparse' in acc:
        raise ValueError('sparse accessors are not supported')
    code, size = COMPONENT[acc['componentType']]
    width = WIDTH[acc['type']]
    view = document['bufferViews'][acc['bufferView']]
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = view.get('byteStride') or size * width
    count = acc['count']
    if stride == size * width:
        values = array(code)
        values.frombytes(blob[start:start + count * size * width])
        return values, width
    values = array(code)
    for i in range(count):
        row = array(code)
        row.frombytes(blob[start + i * stride:start + i * stride + size * width])
        values.extend(row)
    return values, width


def max_diff(a, b):
    return max((abs(x - y) for x, y in zip(a, b)), default=0.0)


def local_transform(node):
    if 'matrix' in node:
        return dict(matrix=tuple(node['matrix']))
    return {key: tuple(node.get(key, default)) for key, default in IDENTITY_TRS.items()}


def material_of(document, index):
    if index is None:
        return None
    m = document['materials'][index]
    pbr = m.get('pbrMetallicRoughness', {})
    return dict(baseColor=tuple(pbr.get('baseColorFactor', (1, 1, 1, 1))), metallic=pbr.get('metallicFactor', 1.0), roughness=pbr.get('roughnessFactor', 1.0),
                alphaMode=m.get('alphaMode', 'OPAQUE'), doubleSided=m.get('doubleSided', False), emissive=tuple(m.get('emissiveFactor', (0, 0, 0))),
                extensions=json.dumps(m.get('extensions', {}), sort_keys=True), textures=json.dumps({k: v for k, v in pbr.items() if k.endswith('Texture')}, sort_keys=True))


def describe(path):
    """Everything the comparison reads from one file, keyed by names so that file order does not matter."""
    document, blob, data = read_glb(path)
    nodes = document.get('nodes', [])
    names = [n.get('name', f'#{i}') for i, n in enumerate(nodes)]
    parent = {}
    for i, n in enumerate(nodes):
        for child in n.get('children', []):
            parent[child] = i
    described = {}
    for i, node in enumerate(nodes):
        entry = dict(parent=names[parent[i]] if i in parent else None, children=sorted(names[c] for c in node.get('children', [])), transform=local_transform(node),
                     extras=json.dumps(node.get('extras', {}), sort_keys=True), mesh=None)
        if 'mesh' in node:
            mesh = document['meshes'][node['mesh']]
            primitives = []
            for prim in mesh['primitives']:
                attrs = prim['attributes']
                position, _ = accessor(document, blob, attrs['POSITION'])
                pa = document['accessors'][attrs['POSITION']]
                primitives.append(dict(
                    attributes=sorted(attrs), mode=prim.get('mode', 4), vertices=pa['count'], position=position, bounds=(tuple(pa.get('min', ())), tuple(pa.get('max', ()))),
                    normal=accessor(document, blob, attrs['NORMAL'])[0] if 'NORMAL' in attrs else None,
                    indices=document['accessors'][prim['indices']]['count'] if 'indices' in prim else None,
                    index_values=accessor(document, blob, prim['indices'])[0] if 'indices' in prim else None,
                    material=material_of(document, prim.get('material'))))
            entry['mesh'] = dict(name=mesh.get('name'), primitives=primitives, extras=json.dumps(mesh.get('extras', {}), sort_keys=True))
        described[names[i]] = entry
    animations = {}
    for animation in document.get('animations', []):
        channels = {}
        for channel in animation['channels']:
            sampler = animation['samplers'][channel['sampler']]
            key = (names[channel['target']['node']], channel['target']['path'])
            if key in channels:
                raise ValueError(f'{path}: animation {animation.get("name")!r} has two channels for {key}')
            times, _ = accessor(document, blob, sampler['input'])
            values, width = accessor(document, blob, sampler['output'])
            channels[key] = dict(interpolation=sampler.get('interpolation', 'LINEAR'), times=times, values=values, width=width)
        animations[animation.get('name')] = channels
    return dict(sha256=hashlib.sha256(data).hexdigest(), bytes=len(data), nodes=described, animations=animations, order=names, scenes=len(document.get('scenes', [])),
                counts=dict(nodes=len(nodes), meshes=len(document.get('meshes', [])), materials=len(document.get('materials', [])), accessors=len(document.get('accessors', [])),
                            bufferViews=len(document.get('bufferViews', [])), animations=len(document.get('animations', [])), skins=len(document.get('skins', []))),
                generator=document.get('asset', {}).get('generator'))


class Report:
    def __init__(self):
        self.sections = {}

    def section(self, name):
        return self.sections.setdefault(name, dict(checked=0, mismatches=[], max_abs_diff=0.0))

    def check(self, name, ok, detail=None, diff=None):
        s = self.section(name)
        s['checked'] += 1
        if diff is not None:
            s['max_abs_diff'] = max(s['max_abs_diff'], diff)
        if not ok:
            s['mismatches'].append(detail)

    def to_dict(self, limit=8):
        return {name: dict(checked=s['checked'], mismatches=len(s['mismatches']), first_mismatches=s['mismatches'][:limit], max_abs_diff=s['max_abs_diff'])
                for name, s in self.sections.items()}


def compare(first, second, tolerance=0.0, time_tolerance=None, value_tolerance=None):
    """Compare two GLBs (paths). Returns a dict: `equivalent` (every check passed within tolerance), `byte_identical`, per-section counts and the largest differences."""
    time_tolerance = tolerance if time_tolerance is None else time_tolerance
    value_tolerance = tolerance if value_tolerance is None else value_tolerance
    a, b = describe(first), describe(second)
    r = Report()
    r.check('file', True)
    for key in a['counts']:
        r.check('counts', a['counts'][key] == b['counts'][key], f"{key}: {a['counts'][key]} != {b['counts'][key]}")
    r.check('node names', set(a['nodes']) == set(b['nodes']), dict(only_first=sorted(set(a['nodes']) - set(b['nodes']))[:5], only_second=sorted(set(b['nodes']) - set(a['nodes']))[:5]))
    r.check('node order', a['order'] == b['order'], 'nodes appear in a different order')
    for name in sorted(set(a['nodes']) & set(b['nodes'])):
        x, y = a['nodes'][name], b['nodes'][name]
        r.check('hierarchy', x['parent'] == y['parent'] and x['children'] == y['children'], f'{name}: parent/children differ')
        r.check('extras', x['extras'] == y['extras'], f'{name}: node extras differ')
        if x['transform'].keys() != y['transform'].keys():
            r.check('transforms', False, f'{name}: one uses a matrix, the other TRS')
        else:
            d = max(max_diff(x['transform'][k], y['transform'][k]) for k in x['transform'])
            r.check('transforms', d <= tolerance, f'{name}: transform differs by {d:.3g}', d)
        if (x['mesh'] is None) != (y['mesh'] is None):
            r.check('meshes', False, f'{name}: only one has a mesh')
            continue
        if x['mesh'] is None:
            continue
        px, py = x['mesh']['primitives'], y['mesh']['primitives']
        r.check('meshes', x['mesh']['name'] == y['mesh']['name'] and len(px) == len(py), f"{name}: mesh name or primitive count differs ({x['mesh']['name']!r} {len(px)} / {y['mesh']['name']!r} {len(py)})")
        for i, (u, v) in enumerate(zip(px, py)):
            same = (u['attributes'], u['mode'], u['vertices'], u['indices']) == (v['attributes'], v['mode'], v['vertices'], v['indices'])
            r.check('accessor counts', same, f"{name}[{i}]: attributes/vertices/indices {u['attributes']} {u['vertices']} {u['indices']} != {v['attributes']} {v['vertices']} {v['indices']}")
            if not same:
                continue
            d = max_diff(u['position'], v['position'])
            r.check('vertex positions', d <= tolerance, f'{name}[{i}]: positions differ by {d:.3g}', d)
            bounds = max(max_diff(u['bounds'][0], v['bounds'][0]), max_diff(u['bounds'][1], v['bounds'][1]))
            r.check('position bounds', bounds <= tolerance, f'{name}[{i}]: bounds differ by {bounds:.3g}', bounds)
            if u['normal'] is not None:
                d = max_diff(u['normal'], v['normal'])
                r.check('vertex normals', d <= tolerance, f'{name}[{i}]: normals differ by {d:.3g}', d)
            if u['index_values'] is not None:
                r.check('indices', u['index_values'] == v['index_values'], f'{name}[{i}]: index values differ')
            mu, mv = u['material'], v['material']
            same_material = (mu is None) == (mv is None) and (mu is None or (
                mu['alphaMode'] == mv['alphaMode'] and mu['doubleSided'] == mv['doubleSided'] and mu['extensions'] == mv['extensions'] and mu['textures'] == mv['textures']
                and max(max_diff(mu['baseColor'], mv['baseColor']), abs(mu['metallic'] - mv['metallic']), abs(mu['roughness'] - mv['roughness']), max_diff(mu['emissive'], mv['emissive'])) <= tolerance))
            r.check('materials', same_material, f'{name}[{i}]: material differs: {_material_text(mu)} / {_material_text(mv)}')
    r.check('animation names', set(a['animations']) == set(b['animations']), dict(first=sorted(map(str, a['animations'])), second=sorted(map(str, b['animations']))))
    for title in sorted(set(a['animations']) & set(b['animations']), key=str):
        ca, cb = a['animations'][title], b['animations'][title]
        r.check('animation channels', set(ca) == set(cb), f'{title}: channel targets differ ({len(ca)} / {len(cb)}); first only: {sorted(set(ca) - set(cb))[:3]}; second only: {sorted(set(cb) - set(ca))[:3]}')
        for key in sorted(set(ca) & set(cb)):
            x, y = ca[key], cb[key]
            r.check('animation samplers', (x['interpolation'], len(x['times']), len(x['values']), x['width']) == (y['interpolation'], len(y['times']), len(y['values']), y['width']),
                    f'{title} {key}: interpolation/key count differs')
            if len(x['times']) == len(y['times']):
                d = max_diff(x['times'], y['times'])
                r.check('animation times', d <= time_tolerance, f'{title} {key}: times differ by {d:.3g}', d)
            if len(x['values']) == len(y['values']):
                d = max_diff(x['values'], y['values'])
                r.check('animation values', d <= value_tolerance, f'{title} {key}: values differ by {d:.3g}', d)
    sections = r.to_dict()
    return dict(first=dict(path=str(first), sha256=a['sha256'], bytes=a['bytes'], generator=a['generator'], counts=a['counts']),
                second=dict(path=str(second), sha256=b['sha256'], bytes=b['bytes'], generator=b['generator'], counts=b['counts']),
                byte_identical=a['sha256'] == b['sha256'], tolerance=dict(positions_transforms=tolerance, times=time_tolerance, values=value_tolerance),
                equivalent=all(s['mismatches'] == 0 for s in sections.values()), sections=sections)


def _material_text(m):
    return None if m is None else f"colour {tuple(round(c, 4) for c in m['baseColor'])} metallic {m['metallic']:.3g} roughness {m['roughness']:.3g}"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('first')
    parser.add_argument('second')
    parser.add_argument('--tolerance', type=float, default=0.0, help='largest allowed absolute difference of positions, normals, transforms and colours (default: exact)')
    parser.add_argument('--time-tolerance', type=float)
    parser.add_argument('--value-tolerance', type=float)
    parser.add_argument('--json', type=Path, help='write the report here')
    args = parser.parse_args()
    report = compare(args.first, args.second, args.tolerance, args.time_tolerance, args.value_tolerance)
    if args.json:
        args.json.write_text(json.dumps(report, indent=2) + '\n')
    print(f"byte identical: {report['byte_identical']}  |  structurally equivalent: {report['equivalent']}")
    for name, s in report['sections'].items():
        print(f"  {name:20s} checked {s['checked']:>8}  mismatches {s['mismatches']:>6}  largest difference {s['max_abs_diff']:.3g}")
        for detail in s['first_mismatches'][:3]:
            print('      ', detail)
    return 0 if report['equivalent'] else 1


if __name__ == '__main__':
    sys.exit(main())
