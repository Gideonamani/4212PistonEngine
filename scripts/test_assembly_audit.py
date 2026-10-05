"""Known-answer tests for the interference audit, on synthetic gear trains with baked rotation clips.

The audit must pass gears that mesh and fail every way a mesh can be wrong. Needs
numpy, trimesh, manifold3d, networkx and python-fcl (see audit_assembly_interference.py).

Run: python3 scripts/test_assembly_audit.py
"""
import json, math, struct, sys, tempfile, unittest
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import manifold3d as m3d
import accessory_gears as train
import audit_assembly_interference as audit
import gear_geometry as G

TRAIN = ['CrankGear', 'IdlerGear', 'LeftMagGear']          # two real meshes: crank/idler and idler/magneto
DURATION, KEYS = 20.0, 121


def legacy_profile(r, teeth):
    """The previous generator: straight flanks, zero backlash, tip r+1.8 / root r-1.8, phase never solved."""
    out = []
    for k in range(teeth * 8):
        a = 2 * math.pi * k / (teeth * 8)
        rad = r + 1.8 if k % 8 in (2, 3, 4, 5) else r - 1.8
        out.append((rad * math.cos(a), rad * math.sin(a)))
    return out


def solid(outline):
    section = m3d.CrossSection([np.asarray(outline, dtype=np.float64)])
    mesh = m3d.Manifold.extrude(section, train.FACE_WIDTH).to_mesh()
    return np.asarray(mesh.vert_properties, dtype=np.float64)[:, :3], np.asarray(mesh.tri_verts, dtype=np.uint32)


def write_glb(path, gears):
    """gears: id -> dict(centre, z, rate, outline). Rotation about z, baked like the Blender rig does."""
    chunks, views, accessors, meshes, nodes, samplers, channels = bytearray(), [], [], [], [], [], []

    def add(array, kind, count, target=None, extra=None):
        while len(chunks) % 4:
            chunks.append(0)
        views.append(dict(buffer=0, byteOffset=len(chunks), byteLength=array.nbytes))
        chunks.extend(array.tobytes())
        spec = dict(bufferView=len(views) - 1, componentType=5126 if array.dtype == np.float32 else 5125,
                    count=count, type=kind)
        spec.update(extra or {})
        accessors.append(spec)
        return len(accessors) - 1

    times = np.linspace(0, DURATION, KEYS).astype(np.float32)
    time_accessor = add(times, 'SCALAR', KEYS, extra=dict(min=[0.0], max=[DURATION]))
    for index, (gear_id, g) in enumerate(gears.items()):
        vertices, faces = solid(g['outline'])
        position = add((vertices / 1000).astype(np.float32), 'VEC3', len(vertices),
                       extra=dict(min=(vertices.min(0) / 1000).tolist(), max=(vertices.max(0) / 1000).tolist()))
        indices = add(faces.reshape(-1).astype(np.uint32), 'SCALAR', faces.size)
        meshes.append(dict(primitives=[dict(attributes=dict(POSITION=position), indices=indices, mode=4)]))
        angle = 4 * math.pi * (times / DURATION) * g['rate']
        quats = np.stack([np.zeros(KEYS), np.zeros(KEYS), np.sin(angle / 2), np.cos(angle / 2)], axis=1).astype(np.float32)
        rotation = add(quats, 'VEC4', KEYS)
        nodes.append(dict(name=gear_id, mesh=index, translation=[g['centre'][0] / 1000, g['centre'][1] / 1000, g['z'] / 1000],
                          extras=dict(cad_part_id=gear_id)))
        samplers.append(dict(input=time_accessor, output=rotation, interpolation='LINEAR'))
        channels.append(dict(sampler=index, target=dict(node=index, path='rotation')))
    body = json.dumps(dict(asset=dict(version='2.0'), scene=0, scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes,
                           meshes=meshes, accessors=accessors, bufferViews=views, buffers=[dict(byteLength=len(chunks))],
                           animations=[dict(name='Operating mechanism', samplers=samplers, channels=channels)]),
                      separators=(',', ':')).encode()
    body += b' ' * (-len(body) % 4)
    blob = bytes(chunks) + b'\0' * (-len(chunks) % 4)
    Path(path).write_bytes(b'glTF' + struct.pack('<II', 2, 28 + len(body) + len(blob)) +
                           struct.pack('<II', len(body), 0x4E4F534A) + body + struct.pack('<II', len(blob), 0x004E4942) + blob)


def run_audit(variant, tmp):
    solved = train.solve()
    gears = {}
    for gear_id in TRAIN:
        s = dict(solved[gear_id])
        if variant == 'legacy':
            outline = legacy_profile(s['r_pitch'], s['teeth'])
        else:
            phase = s['phase']
            if variant == 'wrong-phase' and gear_id == 'IdlerGear':
                phase += math.pi / s['teeth']
            outline = G.profile(s['teeth'], s['r_pitch'], s['addendum'], phase, **s['form'])
        centre = s['centre']
        if variant == 'too-close' and gear_id == 'IdlerGear':
            centre = (centre[0], centre[1] - .5)
        gears[gear_id] = dict(centre=centre, z=s['z'], rate=s['rate'], outline=outline)
    path = Path(tmp) / f'{variant}.glb'
    write_glb(path, gears)
    contract = dict(gearMeshes=[dict(driver=a, driven=b) for a, b in train.MESHES if a in TRAIN and b in TRAIN])
    return audit.audit(path, contract, dict(min_gear_clearance_mm=.02), samples=5, dense=48, log=lambda *_: None)


class AuditKnownAnswers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.reports = {v: run_audit(v, cls.tmp.name) for v in ('conjugate', 'legacy', 'wrong-phase', 'too-close')}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_conjugate_gears_touch_within_backlash_and_never_overlap_while_turning(self):
        report = self.reports['conjugate']
        self.assertEqual(report['overlaps_total'], 0, report['new_violations'])
        self.assertTrue(report['clean'])
        self.assertEqual(len(report['gear_meshes']), 2)
        for mesh in report['gear_meshes']:
            self.assertGreaterEqual(mesh['min_gap_mm'], .02, mesh)
            self.assertLess(mesh['min_gap_mm'], 1.0, mesh)       # a real mesh, not gears pulled apart

    def test_legacy_square_teeth_are_caught_in_motion(self):
        report = self.reports['legacy']
        self.assertFalse(report['passed'])
        pairs = {frozenset((v['a'], v['b'])): v for v in report['new_violations']}
        self.assertIn(frozenset(('CrankGear', 'IdlerGear')), pairs)
        self.assertGreater(pairs[frozenset(('CrankGear', 'IdlerGear'))]['max_overlap_mm3'], 100)
        self.assertTrue(all(not m['ok'] for m in report['gear_meshes']))

    def test_wrong_tooth_phase_is_caught(self):
        report = self.reports['wrong-phase']
        self.assertFalse(report['passed'])
        self.assertTrue({'CrankGear', 'IdlerGear'} in [{v['a'], v['b']} for v in report['new_violations']])

    def test_gear_moved_half_a_millimetre_closer_is_caught(self):
        report = self.reports['too-close']
        self.assertFalse(report['passed'])
        self.assertTrue(report['new_violations'])


if __name__ == '__main__':
    unittest.main()
