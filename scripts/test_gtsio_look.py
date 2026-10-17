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
    def test_canonical_materials_and_aliases(self):
        for mat in R10_MATERIALS:
            self.assertIn(look.canonical_material(mat), look.MATERIALS)
        self.assertEqual(look.canonical_material('aluminum'), 'aluminium')
        self.assertEqual(look.canonical_material('cast iron'), 'cast_iron')
        for bad in ('unobtainium', '', None):
            with self.assertRaises(ValueError):
                look.canonical_material(bad)

    def test_role_subfinishes_and_variation(self):
        barrel_key, _, barrel_met, barrel_rough = look.part_finish('steel', part_id='CylinderBarrel1', vary=True)
        cover_key, _, _, _ = look.part_finish('steel', part_id='IntakeRockerCover1', vary=True)
        pin_key, _, pin_met, pin_rough = look.part_finish('steel', part_id='PistonPin1', vary=True)
        self.assertTrue(barrel_key.startswith('steel_barrel_t'))
        self.assertTrue(cover_key.startswith('steel_cover_gold_t'))
        self.assertTrue(pin_key.startswith('steel_polished_t'))
        self.assertGreater(pin_met, barrel_met)
        self.assertLess(pin_rough, barrel_rough)

    def test_apply_smooth_by_angle(self):
        mesh = _DummyMesh(poly_count=4)
        look.apply_smooth_by_angle(mesh, 30.0)
        self.assertEqual(mesh.polygons.smooth_values, [True] * 4)
        self.assertAlmostEqual(mesh.sharp_angle, math.radians(30.0))
        with self.assertRaises(ValueError):
            look.apply_smooth_by_angle(mesh, 0.0)


if __name__ == '__main__':
    unittest.main()


