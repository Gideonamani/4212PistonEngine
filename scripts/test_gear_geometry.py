"""Gear-train checks that need only the standard library, so CI can run them.

Run: python3 scripts/test_gear_geometry.py
"""
import json
import math
import unittest
from pathlib import Path
from unittest import mock

import accessory_gears as train
import gear_geometry as G


def signed_area(points):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1])) / 2


def clearance(driver, driven, steps=16, phase_error=0.0, centre_error=0.0):
    """Minimum signed gap over one tooth pitch, with optional deliberate misalignment."""
    solved = train.solve()
    a, b = dict(solved[driver]), dict(solved[driven])
    b['phase'] += phase_error
    if centre_error:
        ax, ay = a['centre']
        bx, by = b['centre']
        d = math.hypot(bx - ax, by - ay)
        b['centre'] = (ax + (bx - ax) * (d + centre_error) / d, ay + (by - ay) * (d + centre_error) / d)
    return G.mesh_clearance(a, b, steps)


class GearProfiles(unittest.TestCase):
    def test_every_gear_is_a_valid_counter_clockwise_outline_within_its_radii(self):
        for gear_id, g in train.solve().items():
            form = G.tooth_form(g['teeth'], g['r_pitch'], g['addendum'], **g['form'])
            points = G.profile(g['teeth'], g['r_pitch'], g['addendum'], g['phase'], **g['form'])
            radii = [math.hypot(x, y) for x, y in points]
            self.assertGreater(signed_area(points), 0, gear_id)
            self.assertAlmostEqual(min(radii), form['r_root'], places=6, msg=gear_id)
            self.assertAlmostEqual(max(radii), form['r_tip'], places=6, msg=gear_id)
            self.assertGreater(form['backlash'], 0, gear_id)

    def test_tooth_is_thinner_than_half_a_pitch_by_the_backlash_share(self):
        form = G.tooth_form(24, 30, 1.8, backlash_factor=.05)
        self.assertAlmostEqual(form['thickness'], math.pi * 2.5 / 2 - .05 * 2.5 / 2)


class MeshingGears(unittest.TestCase):
    def test_declared_train_is_consistent(self):
        solved = train.solve()
        self.assertEqual(set(solved), set(train.GEARS))
        for a, b in train.MESHES:
            self.assertAlmostEqual(solved[b]['rate'] * train.GEARS[b]['teeth'], -solved[a]['rate'] * train.GEARS[a]['teeth'])

    def test_every_mesh_touches_but_never_overlaps_through_a_full_pitch(self):
        for a, b in train.MESHES:
            gap = clearance(a, b)
            self.assertGreater(gap, .04, f'{a}/{b}: {gap:.3f} mm')   # separated by the backlash
            self.assertLess(gap, 1.0, f'{a}/{b}: gap {gap:.3f} mm is not a working mesh')

    def test_wrong_tooth_phase_is_detected_as_interference(self):
        for a, b in train.MESHES:
            half_pitch = math.pi / train.GEARS[b]['teeth']
            self.assertLess(clearance(a, b, steps=6, phase_error=half_pitch), 0, f'{a}/{b}: tooth-on-tooth not detected')

    def test_gear_moved_closer_is_detected_as_interference(self):
        for a, b in train.MESHES:
            self.assertLess(clearance(a, b, steps=8, centre_error=-.6), 0, f'{a}/{b}: 0.6 mm closer not detected')

    def test_gear_pulled_apart_loses_the_mesh(self):
        # The check must report real clearance growth too, not only overlap.
        for a, b in train.MESHES:
            self.assertGreater(clearance(a, b, steps=8, centre_error=.6), clearance(a, b, steps=8))

    def test_solver_rejects_mismatched_modules_centres_and_loops(self):
        gears = {k: dict(v) for k, v in train.GEARS.items()}
        gears['IdlerGear']['teeth'] = 25
        with mock.patch.object(train, 'GEARS', gears):
            with self.assertRaises(ValueError):
                train.solve()
        gears = {k: dict(v) for k, v in train.GEARS.items()}
        gears['CamGear']['centre'] = (0, -91)
        with mock.patch.object(train, 'GEARS', gears):
            with self.assertRaises(ValueError):
                train.solve()
        with mock.patch.object(train, 'MESHES', train.MESHES + [('IdlerGear', 'StarterShaftGear')]):
            with self.assertRaises(ValueError):
                train.solve()


class DeclarationMatchesPublishedContract(unittest.TestCase):
    CONTRACT = Path(__file__).resolve().parents[1] / 'web/accessory-drives-contract.json'

    def test_rates_and_positions_equal_the_contract(self):
        parts = {p['id']: p for p in json.loads(self.CONTRACT.read_text(encoding='utf8'))['parts']}
        for gear_id, g in train.solve().items():
            self.assertAlmostEqual(parts[gear_id]['rate'], g['rate'], places=9, msg=gear_id)
            self.assertEqual(parts[gear_id]['pivot_mm'], [*g['centre'], train.GEARS[gear_id]['z']], gear_id)

    def test_contract_meshes_once_present_equal_the_declaration(self):
        contract = json.loads(self.CONTRACT.read_text(encoding='utf8'))
        if 'gearMeshes' not in contract:
            self.skipTest('published model predates the gear-train declaration')
        self.assertEqual([(m['driver'], m['driven']) for m in contract['gearMeshes']], train.MESHES)
        for published, declared in zip(contract['gearMeshes'], train.mesh_records()):
            self.assertEqual(published, declared)


if __name__ == '__main__':
    unittest.main()
