"""Unit tests for cad_pipeline.look material table, aliases, tone variation, and smooth-by-angle helper."""
import json
import math
from pathlib import Path
import sys
import unittest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from cad_pipeline import look
R10_MATERIALS = (
    'steel', 'bronze', 'rubber', 'aluminium', 'cast_iron',
    'gasket', 'babbitt', 'copper', 'insulator', 'aluminum',
)


class _DummyPolygons:
    def __init__(self, count):
        self.count = count
        self.smooth_values = None

    def __len__(self):
        return self.count

    def foreach_set(self, attr, values):
        assert attr == 'use_smooth'
        self.smooth_values = list(values)


class _DummyMesh:
    def __init__(self, poly_count=12):
        self.polygons = _DummyPolygons(poly_count)
        self.sharp_angle = None
        self.updated = False

    def set_sharp_from_angle(self, *, angle):
        self.sharp_angle = angle

    def update(self):
        self.updated = True


class LookTest(unittest.TestCase):
    def test_r10_and_committed_specs_resolve_without_fallback(self):
        for mat in R10_MATERIALS:
            canon = look.canonical_material(mat)
            self.assertIn(canon, look.MATERIALS)
            spec = look.material_spec(mat)
            self.assertEqual(len(spec['base_color']), 4)
            self.assertTrue(0.0 <= spec['metallic'] <= 1.0)
            self.assertTrue(0.0 <= spec['roughness'] <= 1.0)

        spec_files = list(REPO.glob('cad-studies/**/part-spec.json'))
        r10_spec = REPO / 'build/gtsio520-case-contours-r10/part-spec.json'
        if r10_spec.exists():
            spec_files.append(r10_spec)
        self.assertGreaterEqual(len(spec_files), 5)
        for path in spec_files:
            data = json.loads(path.read_text(encoding='utf-8'))
            for part in data.get('parts', []):
                canon = look.canonical_material(part['material'])
                self.assertIn(canon, look.MATERIALS, f'{path}: {part["id"]} -> {part["material"]}')

    def test_aliases_normalize_and_unknown_materials_raise(self):
        self.assertEqual(look.canonical_material('aluminum'), 'aluminium')
        self.assertEqual(look.canonical_material('  Aluminum '), 'aluminium')
        self.assertEqual(look.canonical_material('cast iron'), 'cast_iron')
        for bad in ('unobtainium', 'plastic', '', '   ', None):
            with self.assertRaises(ValueError):
                look.canonical_material(bad)

    def test_deterministic_tone_variation_is_bounded(self):
        base = look.MATERIALS['steel']['base_color']
        seen_keys = set()
        for idx in range(200):
            pid = f'Part_{idx}'
            key, color, metallic, roughness = look.part_finish('steel', part_id=pid, vary=True)
            seen_keys.add(key)
            for c, b in zip(color[:3], base[:3]):
                self.assertGreaterEqual(c, round(b * (1.0 - look.DEFAULT_VARIATION), 4) - 1e-4)
                self.assertLessEqual(c, round(b * (1.0 + look.DEFAULT_VARIATION), 4) + 1e-4)
            self.assertEqual(color[3], 1.0)
            self.assertEqual(key, look.part_finish('steel', part_id=pid, vary=True)[0])
        self.assertGreater(len(seen_keys), 1)
        self.assertLessEqual(len(seen_keys), look.DEFAULT_TONE_BUCKETS)

        unvaried_key, unvaried_color, _, _ = look.part_finish('aluminum', part_id='Piston1', vary=False)
        self.assertEqual(unvaried_key, 'aluminium')
        self.assertEqual(unvaried_color, look.MATERIALS['aluminium']['base_color'])

        barrel_key, _, barrel_met, barrel_rough = look.part_finish('steel', part_id='CylinderBarrel1', vary=True)
        cover_key, _, _, _ = look.part_finish('steel', part_id='IntakeRockerCover1', vary=True)
        pin_key, _, pin_met, pin_rough = look.part_finish('steel', part_id='PistonPin1', vary=True)
        rod_key, _, _, _ = look.part_finish('steel', part_id='ConnectingRod1', vary=True)
        self.assertTrue(barrel_key.startswith('steel_barrel_t'))
        self.assertTrue(cover_key.startswith('steel_cover_gold_t'))
        self.assertTrue(pin_key.startswith('steel_polished_t'))
        self.assertTrue(rod_key.startswith('steel_forged_t'))
        self.assertGreater(pin_met, barrel_met)
        self.assertLess(pin_rough, barrel_rough)

    def test_apply_smooth_by_angle_validates_and_updates_mesh(self):
        mesh = _DummyMesh(poly_count=8)
        look.apply_smooth_by_angle(mesh, 30.0)
        self.assertEqual(mesh.polygons.smooth_values, [True] * 8)
        self.assertAlmostEqual(mesh.sharp_angle, math.radians(30.0))
        self.assertTrue(mesh.updated)
        for bad_angle in (0.0, -15.0, 180.0, 210.0):
            with self.assertRaises(ValueError):
                look.apply_smooth_by_angle(mesh, bad_angle)

    def test_blender_scripts_share_look_without_duplicate_tables_or_steel_fallback(self):
        for rel in (
            'cad_pipeline/present.py',
            'cad_pipeline/review_gtsio_r10.py',
            'cad_pipeline/rig_wright.py',
            'cad_pipeline/rig_langley.py',
            'cad_pipeline/rig_gtsio_review.py',
        ):
            src = (REPO / rel).read_text(encoding='utf-8')
            self.assertIn('cad_pipeline.look', src, rel)
            self.assertNotIn("mats['steel']", src, rel)
            self.assertNotIn("materials['steel']", src, rel)

    def test_procedural_review_contract_and_reference_poses(self):
        from cad_pipeline.gtsio_review_motion import (
            CYCLE,
            ReviewMotion,
            build_reference_poses,
            build_review_contract,
        )
        handoff = json.loads((REPO / 'cad-studies/gtsio520-h-static/crankcase-contours/animation-handoff.json').read_text(encoding='utf-8'))
        sample_spec = {
            'parameters': {
                'case_cam_y': {'value': -78.0},
                'head_seat': {'value': 157.0},
                'valve_offset': {'value': 25.0},
                'intake_angle': {'value': 18.0},
                'exhaust_angle': {'value': 20.0},
                'intake_valve_length': {'value': 124.206},
                'exhaust_valve_length': {'value': 124.714},
            }
        }
        sample_parts = [
            {'id': 'Crankshaft', 'label': 'Crankshaft', 'group': 'crankshaft', 'evidence': 'test', 'bounds_mm': [[-50, -50, 0], [50, 50, 500]]},
            {'id': 'Piston1', 'label': 'Piston 1', 'group': 'pistons', 'evidence': 'test', 'bounds_mm': [[100, -50, 50], [200, 50, 120]]},
            {'id': 'CrankcaseLeft', 'label': 'Crankcase Left', 'group': 'crankcase', 'evidence': 'test', 'bounds_mm': [[-150, -150, 0], [0, 150, 500]]},
            {'id': 'CaseThruBolt1', 'label': 'Case Bolt 1', 'group': 'case_fasteners', 'evidence': 'test', 'bounds_mm': [[-100, -100, 10], [100, -90, 20]]},
        ]
        motion = ReviewMotion(sample_spec, sample_parts, handoff['rigid_body_seeds'])
        contract = build_review_contract(
            motion=motion,
            handoff=handoff,
            spec=sample_spec,
            parts=sample_parts,
            asset_file='gtsio520-r10-static.glb',
            asset_sha256='0' * 64,
            asset_bytes=100,
            gzip_bytes=50,
            blender_version='5.0.1',
        )
        self.assertEqual(contract['asset_file'], 'gtsio520-r10-static.glb')
        self.assertFalse(contract['release_allowed'])
        self.assertFalse(contract['complete_engine_acceptance'])
        cycle_motion = next(m for m in contract['motions'] if m['id'] == CYCLE)
        self.assertEqual(cycle_motion['degrees'], 720)
        self.assertEqual(cycle_motion['display']['defaultViewMode'], 'core')
        self.assertTrue(cycle_motion['display']['allowAssembled'])
        self.assertIn('CrankcaseLeft', cycle_motion['display']['ghostPartIds'])
        self.assertIn('CrankcaseLeft', cycle_motion['display']['visiblePartIds'])
        self.assertIn('Crankshaft', cycle_motion['display']['visiblePartIds'])
        self.assertNotIn('CaseThruBolt1', cycle_motion['display']['visiblePartIds'])
        poses = build_reference_poses(motion, sample_parts)
        self.assertIn('Crankshaft', poses)
        self.assertIn('Piston1', poses)
        self.assertNotIn('CrankcaseLeft', poses)


if __name__ == '__main__':
    unittest.main()

