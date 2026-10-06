"""Gear-train checks that need only the standard library, so CI can run them.

Run: python3 scripts/test_gear_geometry.py
"""
import ast
import json
import math
import unittest
from pathlib import Path
from unittest import mock

import accessory_gears as train
import accessory_paths as paths
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


class StarterWorm(unittest.TestCase):
    def gap(self, axis_y):
        """Clearance between the wheel's tooth tips and the worm's thread crest for a worm axis at `axis_y`."""
        wheel = train.GEARS['WormWheel']
        return abs(wheel['centre'][1] - axis_y) - (wheel['r'] + train.ADDENDUM) - (train.WORM_CORE_R + train.WORM_WIRE_R)

    def test_worm_axis_is_derived_so_the_crest_clears_the_wheel_tips(self):
        self.assertAlmostEqual(self.gap(train.worm_axis_y()), train.WORM_CLEARANCE, places=9)
        self.assertGreater(train.WORM_CLEARANCE, 0)
        self.assertLess(train.WORM_CLEARANCE, 1.0)

    def test_the_old_worm_axis_would_cut_into_the_wheel(self):
        self.assertLess(self.gap(-30.0), 0)       # 30 mm from the wheel axis: crest 1.8 mm inside the tooth tips


def held_still_partners(turning):
    """Declared links (mesh, shared shaft, spline) with exactly one side turning: teeth driven through a still part."""
    links = [*train.MESHES, *train.COAXIAL, *train.SPLINED_TO.items()]
    return [(a, b) for a, b in links if (a in turning) != (b in turning)]


class FocusClipsKeepLinkedPartsTurning(unittest.TestCase):
    """A focus clip animates one highlighted power path. A turning gear whose neighbour is held still drives its
    teeth through it (the CamGear/CrankGear, CrankGear/IdlerGear, CrankGear/StarterShaftGear, IdlerGear/RightMagGear
    and CamCluster/OilTachShaft overlaps the audit found in the 'Focus:' clips). The rig is Blender-only, so this
    checks the helper it uses and that it uses it."""
    CONTRACT = Path(__file__).resolve().parents[1] / 'web/accessory-drives-contract.json'
    RIG = Path(__file__).resolve().parent / 'rig_accessory_study.py'

    @classmethod
    def path_part_sets(cls):
        """{(source, path id): parts the path highlights}: its power edges, and the parts the rig publishes for it."""
        sets = {('edges', pid): {part for edge in edges for part in edge} for pid, edges in paths.EDGES.items()}
        for path in json.loads(cls.CONTRACT.read_text(encoding='utf8'))['powerPaths']:
            sets[('contract', path['id'])] = set(path['parts'])
        return sets

    def test_every_path_turns_the_gears_that_mesh_with_its_turning_gears(self):
        for (source, pid), parts in self.path_part_sets().items():
            turning = train.turning_with(parts)
            for a, b in train.MESHES:
                self.assertEqual(a in turning, b in turning, f'{source} {pid}: {a} meshes {b}, but only one of them turns')

    def test_every_path_turns_gears_on_one_shaft_and_parts_splined_to_a_turning_gear(self):
        for (source, pid), parts in self.path_part_sets().items():
            turning = train.turning_with(parts)
            for a, b in train.COAXIAL:
                self.assertEqual(a in turning, b in turning, f'{source} {pid}: {a} and {b} share a shaft, but only one turns')
            for part, host in train.SPLINED_TO.items():
                self.assertEqual(part in turning, host in turning, f'{source} {pid}: {part} is splined to {host}, but only one turns')

    def test_the_paths_alone_would_leave_those_gears_still(self):
        # Guards the test above against passing vacuously: the highlighted parts alone do break the rule.
        raw = {pid: held_still_partners(parts) for (source, pid), parts in self.path_part_sets().items() if source == 'edges'}
        for pair in [('CrankGear', 'CamGear'), ('CrankGear', 'IdlerGear'), ('CrankGear', 'StarterShaftGear')]:
            self.assertIn(pair, raw['alternator'])
        self.assertIn(('IdlerGear', 'RightMagGear'), raw['vacuum'])
        self.assertIn(('OilTachShaft', 'CamGear'), raw['governor'])
        self.assertIn(('CamGear', 'CamCluster'), raw['governor'])
        self.assertTrue(all(held_still_partners(train.turning_with(parts)) == [] for parts in self.path_part_sets().values()))

    def test_expansion_only_adds_linked_parts_and_is_closed(self):
        linked = {part for pair in [*train.MESHES, *train.COAXIAL, *train.SPLINED_TO.items()] for part in pair}
        for key, parts in self.path_part_sets().items():
            turning = train.turning_with(parts)
            self.assertTrue(parts <= turning, key)
            self.assertLessEqual(turning - parts, linked, key)
            self.assertEqual(train.turning_with(turning), turning, key)
        self.assertEqual(train.turning_with({'CrankShaft'}), {'CrankShaft'})      # not a gear: nothing meshes with it

    def test_expansion_follows_a_chain_of_links_in_either_direction(self):
        with mock.patch.object(train, 'MESHES', [('A', 'B'), ('B', 'C')]), mock.patch.object(train, 'COAXIAL', [('C', 'D')]), \
                mock.patch.object(train, 'SPLINED_TO', {'E': 'D'}):
            for start in ('A', 'C', 'E'):
                self.assertEqual(train.turning_with({start}), {'A', 'B', 'C', 'D', 'E'}, start)
            self.assertEqual(train.turning_with({'Z'}), {'Z'})

    def test_rig_decides_which_parts_turn_with_the_expansion(self):
        # The rig needs Blender, so check its source: the focus clips must use turning_with, not a path-only rule.
        tree = ast.parse(self.RIG.read_text(encoding='utf8'))
        calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and getattr(n.func, 'id', None) == 'turning_with']
        self.assertTrue(calls, 'rig_accessory_study.py must hold only parts outside accessory_gears.turning_with(path parts)')
        self.assertFalse([n for n in ast.walk(tree) if isinstance(n, ast.Name) and n.id == 'SPLINED_TO'],
                         'the rig must not re-implement the spline rule; it belongs to accessory_gears.turning_with')


class DeclarationMatchesPublishedContract(unittest.TestCase):
    CONTRACT = Path(__file__).resolve().parents[1] / 'web/accessory-drives-contract.json'

    def test_rates_and_positions_equal_the_contract(self):
        parts = {p['id']: p for p in json.loads(self.CONTRACT.read_text(encoding='utf8'))['parts']}
        for gear_id, g in train.solve().items():
            self.assertAlmostEqual(parts[gear_id]['rate'], g['rate'], places=9, msg=gear_id)
            self.assertEqual(parts[gear_id]['pivot_mm'], [*g['centre'], train.GEARS[gear_id]['z']], gear_id)

    def test_starter_worm_axis_equals_the_contract(self):
        parts = {p['id']: p for p in json.loads(self.CONTRACT.read_text(encoding='utf8'))['parts']}
        self.assertAlmostEqual(parts['StarterWorm']['pivot_mm'][1], train.worm_axis_y(), places=9)

    def test_contract_meshes_once_present_equal_the_declaration(self):
        contract = json.loads(self.CONTRACT.read_text(encoding='utf8'))
        if 'gearMeshes' not in contract:
            self.skipTest('published model predates the gear-train declaration')
        self.assertEqual([(m['driver'], m['driven']) for m in contract['gearMeshes']], train.MESHES)
        for published, declared in zip(contract['gearMeshes'], train.mesh_records()):
            self.assertEqual(published, declared)


if __name__ == '__main__':
    unittest.main()
