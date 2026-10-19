"""Known-answer tests for scripts/compare_glb_structure.py, on small GLB files written by the test.

Standard library only, so CI can run it. Each test changes one thing in a copy of a reference model and says what the comparison must report.

Run: python3 scripts/test_glb_compare.py
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
from compare_glb_structure import compare

TRIANGLE = [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
NORMALS = [0.0, 0.0, 1.0] * 3


def model(parts=None, times=None, track=None, colour=(0.5, 0.5, 0.5, 1.0), metallic=0.9, translation=(0.0, 0.0, 0.0), extras=None, generator='Test 1'):
    """A glTF binary: a root with one child node per part, each a triangle with a material, and one animation moving the first part."""
    parts = parts or ['PartA', 'PartB']
    animated = 'PartA' if 'PartA' in parts else parts[0]
    times = times or [0.0, 0.5, 1.0]
    track = track or [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 2.0, 0.0]
    blob, views, accessors = bytearray(), [], []

    def add(values, code, kind, count, target=None, lo=None, hi=None):
        data = array(code, values).tobytes()
        views.append(dict(buffer=0, byteOffset=len(blob), byteLength=len(data)))
        blob.extend(data + b'\0' * (-len(data) % 4))
        entry = dict(bufferView=len(views) - 1, componentType={'f': 5126, 'H': 5123}[code], count=count, type=kind)
        if lo is not None:
            entry.update(min=lo, max=hi)
        accessors.append(entry)
        return len(accessors) - 1

    nodes, meshes = [dict(name='Root', children=list(range(1, len(parts) + 1)))], []
    for i, name in enumerate(parts):
        position = add(TRIANGLE, 'f', 'VEC3', 3, lo=[0, 0, 0], hi=[1, 1, 0])
        normal = add(NORMALS, 'f', 'VEC3', 3)
        index = add([0, 1, 2], 'H', 'SCALAR', 3)
        meshes.append(dict(name=name, primitives=[dict(attributes=dict(POSITION=position, NORMAL=normal), indices=index, material=0)]))
        node = dict(name=name, mesh=i)
        if name == 'PartA':
            node['translation'] = list(translation)
        if extras:
            node['extras'] = extras
        nodes.append(node)
    sampler_in, sampler_out = add(times, 'f', 'SCALAR', len(times), lo=[times[0]], hi=[times[-1]]), add(track, 'f', 'VEC3', len(track) // 3)
    document = dict(asset=dict(version='2.0', generator=generator), scene=0, scenes=[dict(nodes=[0])], nodes=nodes, meshes=meshes,
                    materials=[dict(name='M', pbrMetallicRoughness=dict(baseColorFactor=list(colour), metallicFactor=metallic, roughnessFactor=0.4))],
                    animations=[dict(name='Clip', samplers=[dict(input=sampler_in, output=sampler_out, interpolation='LINEAR')],
                                     channels=[dict(sampler=0, target=dict(node=1 + parts.index(animated), path='translation'))])],
                    accessors=accessors, bufferViews=views, buffers=[dict(byteLength=len(blob))])
    return glb(document, bytes(blob))


def glb(document, blob):
    text = json.dumps(document, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    blob += b'\0' * (-len(blob) % 4)
    body = struct.pack('<II', len(text), 0x4e4f534a) + text + struct.pack('<II', len(blob), 0x004e4942) + blob
    return struct.pack('<III', 0x46546c67, 2, 12 + len(body)) + body


class CompareGlb(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.count = 0

    def write(self, data, gz=False):
        self.count += 1
        path = Path(self.dir.name) / f'm{self.count}.glb{".gz" if gz else ""}'
        path.write_bytes(gzip.compress(data, mtime=0) if gz else data)
        return path

    def run_compare(self, a, b, **kw):
        return compare(self.write(a), self.write(b), **kw)

    def failing(self, report):
        return sorted(name for name, s in report['sections'].items() if s['mismatches'])

    def test_identical_files_are_byte_identical_and_equivalent(self):
        r = self.run_compare(model(), model())
        self.assertTrue(r['byte_identical'] and r['equivalent'])
        self.assertGreater(r['sections']['animation values']['checked'], 0)
        self.assertEqual(self.failing(r), [])

    def test_a_gz_and_a_plain_file_compare_equal(self):
        r = compare(self.write(model()), self.write(model(), gz=True))
        self.assertTrue(r['byte_identical'] and r['equivalent'])

    def test_a_different_generator_string_is_equivalent_but_not_byte_identical(self):
        r = self.run_compare(model(), model(generator='Test 2'))
        self.assertFalse(r['byte_identical'])
        self.assertTrue(r['equivalent'])

    def test_a_moved_node_is_found_and_a_tolerance_accepts_a_small_move(self):
        r = self.run_compare(model(), model(translation=(0.001, 0.0, 0.0)))
        self.assertEqual(self.failing(r), ['transforms'])
        self.assertAlmostEqual(r['sections']['transforms']['max_abs_diff'], 0.001, places=9)
        self.assertTrue(self.run_compare(model(), model(translation=(0.001, 0.0, 0.0)), tolerance=0.002)['equivalent'])
        self.assertFalse(self.run_compare(model(), model(translation=(0.003, 0.0, 0.0)), tolerance=0.002)['equivalent'])

    def test_a_changed_material_is_found(self):
        self.assertEqual(self.failing(self.run_compare(model(), model(colour=(0.6, 0.5, 0.5, 1.0)))), ['materials'])
        self.assertEqual(self.failing(self.run_compare(model(), model(metallic=0.5))), ['materials'])

    def test_a_changed_animation_value_or_time_is_found(self):
        self.assertEqual(self.failing(self.run_compare(model(), model(track=[0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 2.5, 0.0]))), ['animation values'])
        self.assertEqual(self.failing(self.run_compare(model(), model(times=[0.0, 0.4, 1.0]))), ['animation times'])

    def test_a_different_key_count_is_a_sampler_mismatch(self):
        r = self.run_compare(model(), model(times=[0.0, 1.0], track=[0.0, 0.0, 0.0, 0.0, 2.0, 0.0]))
        self.assertIn('animation samplers', self.failing(r))

    def test_a_missing_or_renamed_part_is_found(self):
        r = self.run_compare(model(), model(parts=['PartA', 'PartC']))
        self.assertIn('node names', self.failing(r))

    def test_extras_are_compared(self):
        self.assertEqual(self.failing(self.run_compare(model(extras={'cad_part_id': 'A'}), model(extras={'cad_part_id': 'B'}))), ['extras'])

    def test_node_order_is_reported_separately_from_content(self):
        r = self.run_compare(model(), model(parts=['PartB', 'PartA']))
        self.assertEqual(self.failing(r), ['node order'], 'the same nodes, meshes, materials and animation, listed in another order')
        self.assertEqual(r['sections']['transforms']['mismatches'], 0)

    def test_a_file_that_is_not_a_glb_is_refused(self):
        with self.assertRaises(ValueError):
            compare(self.write(b'not a glb at all, but long enough to unpack'), self.write(model()))


if __name__ == '__main__':
    unittest.main()
