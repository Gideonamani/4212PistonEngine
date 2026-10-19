"""The presentation stage may not change geometry: the drift check against a tiny fixture built here (no binary is stored).

The fixture is a frozen tessellation of three parts in CAD millimetres and a GLB written the way Blender writes one: Y up, metres, float32, vertices split per face for flat
shading, a part pivot carried by the node. The check must pass it, and fail every way the export could change a vertex.

Standard library only, so CI can run it.

Run: python3 scripts/test_geometry_drift.py
"""
import copy
import gzip
import json
import struct
import sys
import tempfile
import unittest
from array import array
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_geometry_drift as drift

BOX = ([(0, 0, 0), (40, 0, 0), (40, 30, 0), (0, 30, 0), (0, 0, 20), (40, 0, 20), (40, 30, 20), (0, 30, 20)],
       [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)])
TETRA = ([(100, 100, 100), (130, 100, 100), (100, 130, 100), (100, 100, 130)], [(0, 2, 1), (0, 1, 3), (0, 3, 2), (1, 2, 3)])


def prism(n=8, radius=12.0, height=25.0, centre=(200.0, -50.0, 10.0)):
    import math
    ring = [(centre[0] + radius * math.cos(2 * math.pi * k / n), centre[1] + radius * math.sin(2 * math.pi * k / n)) for k in range(n)]
    vertices = [(x, y, centre[2]) for x, y in ring] + [(x, y, centre[2] + height) for x, y in ring]
    triangles = []
    for k in range(n):
        j = (k + 1) % n
        triangles += [(k, j, n + k), (j, n + j, n + k)]
    for k in range(1, n - 1):
        triangles += [(0, k + 1, k), (n, n + k, n + k + 1)]
    return vertices, triangles


def geometry(parts=None):
    parts = parts or {'Box': BOX, 'Tetra': TETRA, 'Prism': prism()}
    return {'parts': [{'id': pid, 'vertices_mm': [list(v) for v in vs], 'triangles': [list(t) for t in ts]} for pid, (vs, ts) in parts.items()]}


def write_glb(parts, pivots=None, split=True, extra=(), move=None, drop=(), extension=None):
    """Blender-style GLB. `parts` {id: (vertices_mm, triangles)}; `pivots` {id: CAD mm origin carried by the node}; `move` {id: (vertex index, dx, dy, dz mm)}."""
    pivots, move = pivots or {}, move or {}
    document = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': [{}]}
    blob = bytearray()

    def add(values, code, kind, count, target):
        while len(blob) % 4:
            blob.append(0)
        document['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(values) * array(code).itemsize, 'target': target})
        blob.extend(array(code, values).tobytes())
        document['accessors'].append({'bufferView': len(document['bufferViews']) - 1, 'componentType': {'f': 5126, 'H': 5123}[code], 'count': count, 'type': kind})
        return len(document['accessors']) - 1

    for pid, (vertices, triangles) in list(parts.items()) + list(extra):
        if pid in drop:
            continue
        vertices = [list(v) for v in vertices]
        if pid in move:
            i, dx, dy, dz = move[pid]
            vertices[i] = [vertices[i][0] + dx, vertices[i][1] + dy, vertices[i][2] + dz]
        px, py, pz = pivots.get(pid, (0, 0, 0))
        local = [(x - px, y - py, z - pz) for x, y, z in vertices]
        if split:            # three vertices per triangle, as flat shading splits them
            order = [local[i] for t in triangles for i in t]
            indices = list(range(len(order)))
        else:
            order = local
            indices = [i for t in triangles for i in t]
        # CAD mm -> glTF metres, Z up -> Y up
        flat = [c for (x, y, z) in order for c in (x / 1000.0, z / 1000.0, -y / 1000.0)]
        position = add(flat, 'f', 'VEC3', len(order), 34962)
        index = add(indices, 'H', 'SCALAR', len(indices), 34963)
        document['meshes'].append({'primitives': [{'attributes': {'POSITION': position}, 'indices': index}]})
        node = {'name': pid, 'mesh': len(document['meshes']) - 1, 'extras': {'cad_part_id': pid}}
        if pid in pivots:
            node['translation'] = [px / 1000.0, pz / 1000.0, -py / 1000.0]
        document['nodes'].append(node)
        document['scenes'][0]['nodes'].append(len(document['nodes']) - 1)
    document['buffers'][0]['byteLength'] = len(blob)
    if extension:
        document['extensionsUsed'] = [extension]
    body = json.dumps(document, separators=(',', ':')).encode()
    body += b' ' * (-len(body) % 4)
    blob += bytes(-len(blob) % 4)
    return b'glTF' + struct.pack('<II', 2, 28 + len(body) + len(blob)) + struct.pack('<II', len(body), 0x4E4F534A) + body + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)


def run(glb_bytes, geom=None, **kw):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'export.glb'
        path.write_bytes(glb_bytes)
        document, blob = drift.read_glb(path)
        return drift.check(geom or geometry(), document, blob, **kw)


PARTS = {'Box': BOX, 'Tetra': TETRA, 'Prism': prism()}


class Drift(unittest.TestCase):
    def test_a_faithful_export_passes_at_float32_rounding(self):
        report = run(write_glb(PARTS, pivots={'Prism': (200, -50, 10)}))
        self.assertTrue(report['passed'], report['failures'])
        self.assertEqual(report['parts_checked'], 3)
        self.assertLess(report['max_vertex_error_mm'], 1e-4, 'float32 rounding only')
        self.assertLess(report['max_bounds_error_mm'], 1e-4)

    def test_welded_and_split_vertices_are_the_same_geometry(self):
        self.assertTrue(run(write_glb(PARTS, split=False))['passed'])

    def test_a_gzipped_export_is_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'export.glb.gz'
            path.write_bytes(gzip.compress(write_glb(PARTS)))
            document, blob = drift.read_glb(path)
            self.assertTrue(drift.check(geometry(), document, blob)['passed'])

    def test_one_vertex_moved_by_ten_microns_fails(self):
        report = run(write_glb(PARTS, move={'Box': (6, 0.01, 0, 0)}))
        self.assertFalse(report['passed'])
        self.assertTrue(any(f.startswith('Box:') and 'vertex moved' in f for f in report['failures']), report['failures'])
        self.assertEqual([r['id'] for r in report['parts'] if not r['passed']], ['Box'])

    def test_a_shift_just_inside_the_bound_passes(self):
        self.assertTrue(run(write_glb(PARTS, move={'Box': (6, 0.0006, 0, 0)}))['passed'])

    def test_a_subdivided_triangle_fails(self):
        vertices, triangles = TETRA
        centre = tuple(sum(v[i] for v in vertices[:3]) / 3 + (5 if i == 2 else 0) for i in range(3))
        skinned = (vertices + [centre], [(0, 2, 4), (2, 1, 4), (1, 0, 4)] + triangles[1:])
        report = run(write_glb(dict(PARTS, Tetra=skinned)))
        self.assertFalse(report['passed'])
        self.assertTrue(any('Tetra: triangle count' in f for f in report['failures']))

    def test_a_decimated_part_fails_even_when_every_remaining_vertex_is_exact(self):
        vertices, triangles = prism()
        kept = [t for t in triangles if 3 not in t]            # drops a vertex and the faces around it
        report = run(write_glb(dict(PARTS, Prism=(vertices, kept))))
        self.assertFalse(report['passed'])
        self.assertTrue(any(f.startswith('Prism:') for f in report['failures']))

    def test_a_reconnected_quad_that_keeps_every_vertex_fails_on_volume(self):
        vertices, triangles = BOX
        flipped = list(triangles)
        flipped[0], flipped[1] = (0, 3, 1), (3, 2, 1)           # the base quad's other diagonal, but non-planar after the next line
        bent = (vertices[:3] + [(0, 30, 6)] + vertices[4:], flipped)       # lift one base corner: the diagonal now matters
        original = (bent[0], list(triangles))
        geom = geometry(dict(PARTS, Box=original))
        report = run(write_glb(dict(PARTS, Box=bent)), geom)
        self.assertFalse(report['passed'])
        self.assertEqual([f.split(':')[0] for f in report['failures']], ['Box'])
        self.assertIn('volume differs', report['failures'][0], 'every vertex and the triangle count are unchanged, so only the volume can show it')

    def test_a_missing_part_fails(self):
        report = run(write_glb(PARTS, drop=('Tetra',)))
        self.assertIn('Tetra: missing from the export', report['failures'])

    def test_an_overlay_mesh_fails_unless_it_is_named(self):
        overlay = [('Label_Box', (BOX[0], BOX[1]))]
        self.assertFalse(run(write_glb(PARTS, extra=overlay))['passed'])
        self.assertTrue(run(write_glb(PARTS, extra=overlay), allow_extra=['Label_.*'])['passed'])

    def test_a_compressed_or_quantised_export_is_refused(self):
        for extension in ('EXT_meshopt_compression', 'KHR_mesh_quantization'):
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / 'export.glb'
                path.write_bytes(write_glb(PARTS, extension=extension))
                with self.assertRaisesRegex(ValueError, 'compressed or quantised'):
                    drift.read_glb(path)

    def test_the_bound_follows_the_class_and_release_one_gives_every_class_the_same(self):
        classes = {'parts': [{'id': 'Box', 'class': 'cosmetic'}, {'id': 'Tetra', 'class': 'engineering'}, {'id': 'Prism', 'class': 'visual-structure'}]}
        moved = write_glb(PARTS, move={'Box': (6, 0.02, 0, 0)})
        self.assertFalse(run(moved, classes=classes)['passed'], 'one bound for every class')
        self.assertTrue(run(moved, classes=classes, class_bounds={'cosmetic': 0.05})['passed'], 'a stated cosmetic envelope would admit it')
        moved_engineering = write_glb(PARTS, move={'Tetra': (1, 0.02, 0, 0)})
        self.assertFalse(run(moved_engineering, classes=classes, class_bounds={'cosmetic': 0.05, 'visual-structure': 0.05})['passed'], 'engineering stays at the tight bound')
        report = run(write_glb(PARTS), classes=classes)
        self.assertEqual(report['by_class'], {'engineering': {'parts': 1, 'failed': 0}, 'visual-structure': {'parts': 1, 'failed': 0}, 'cosmetic': {'parts': 1, 'failed': 0}})

    def test_the_axes_mapping_is_the_inverse_of_the_exporters(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'e.glb'
            path.write_bytes(write_glb(PARTS))
            document, blob = drift.read_glb(path)
        self.assertFalse(drift.check(geometry(), document, blob, axes='identity')['passed'], 'the wrong axes must not pass')


if __name__ == '__main__':
    unittest.main()
