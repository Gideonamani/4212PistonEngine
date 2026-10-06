"""Wright revision-2 layout checks that need only the standard library, so CI can run them.

Run: python3 scripts/test_wright_layout.py
"""
import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cad_pipeline import wright_motion as motion
from cad_pipeline import wright_seats as seats
from cad_pipeline.wright_bodies import body
from cad_pipeline.wright_chain import layout, pocket_angles, relief_centres

STUDY = Path(__file__).resolve().parents[1] / 'cad-studies/wright-1903/revision-2'
CRANK, CAM = (0.0, 0.0), (350.0, -105.0)
ROLLER, POCKET, DISC_OVER_PITCH = 4.1, 4.3, 3.0


class ChainDrive(unittest.TestCase):
    chain = layout(CRANK, CAM, 6, 12, 38)

    def test_pitch_radii_follow_the_tooth_arc_and_the_chain_closes(self):
        c = self.chain
        self.assertAlmostEqual(c['r2'], 2 * c['r1'], places=9)                          # exactly 2:1
        self.assertAlmostEqual(2 * math.pi * c['r1'] / 6, c['arc_pitch'], places=9)     # tooth arc = roller spacing, both wheels
        self.assertAlmostEqual(2 * math.pi * c['r2'] / 12, c['arc_pitch'], places=9)
        self.assertAlmostEqual(c['links'] * c['arc_pitch'], c['length'], places=9)

    def pockets(self, which, shift=0.0):
        """Pocket centres of a sprocket after the chain has moved `shift` mm along its path."""
        c = self.chain
        r = c['r%d' % which]
        turn = -shift / r                                  # rollers circulate clockwise, so the sprockets turn clockwise
        centre = c['centres'][which - 1]
        return [(centre[0] + r * math.cos(a + turn), centre[1] + r * math.sin(a + turn)) for a in pocket_angles(c, which)]

    def test_every_roller_on_a_wrap_sits_in_a_pocket_at_every_angle_of_rotation(self):
        c = self.chain
        for shift in (0.0, 3.7, 12.6, 25.2556, 41.0, 100.3):
            for k in range(c['links']):
                x, z, _ = c['at'](self._u0() + c['arc_pitch'] * k + shift)
                for which, centre in ((1, CRANK), (2, CAM)):
                    r = math.hypot(x - centre[0], z - centre[1])
                    if abs(r - c['r%d' % which]) < 1e-9:      # this roller is on that sprocket's wrap
                        nearest = min(math.hypot(x - px, z - pz) for px, pz in self.pockets(which, shift))
                        self.assertLess(nearest, 1e-6, f'roller {k} off its pocket by {nearest:.4f} mm at shift {shift}')

    def _u0(self):
        # Roller 0 sits at the cam sprocket's top tangent point, one straight span along the path (see layout()).
        c = self.chain
        d = c['centre_distance']
        phi = math.asin((c['r2'] - c['r1']) / d)
        return d * math.cos(phi)

    def test_rollers_never_touch_a_tooth_while_entering_or_leaving_a_wrap(self):
        c = self.chain
        for shift in (0.0, 2.9, 7.3, 11.1, 18.4, 24.0):
            for which, centre in ((1, CRANK), (2, CAM)):
                r = c['r%d' % which]
                cuts = []
                for px, pz in self.pockets(which, shift):
                    angle = math.atan2(pz - centre[1], px - centre[0])
                    cuts += relief_centres(r, angle, centre)
                for k in range(c['links']):
                    x, z, _ = c['at'](self._u0() + c['arc_pitch'] * k + shift)
                    if math.hypot(x - centre[0], z - centre[1]) > r + DISC_OVER_PITCH + ROLLER:
                        continue                                # clear of the disc altogether
                    for step in range(48):
                        a = 2 * math.pi * step / 48
                        px, pz = x + ROLLER * math.cos(a), z + ROLLER * math.sin(a)
                        if math.hypot(px - centre[0], pz - centre[1]) <= r + DISC_OVER_PITCH:       # inside the disc: must be cut away
                            self.assertTrue(any(math.hypot(px - qx, pz - qz) <= POCKET + 1e-6 for qx, qz in cuts),
                                            f'roller {k} meets a tooth of sprocket {which} at shift {shift}')

    def test_layout_requires_a_whole_tooth_ratio(self):
        with self.assertRaises(ValueError):
            layout(CRANK, CAM, 6, 13, 38)

    def test_recorded_layout_matches_the_derivation(self):
        recorded = json.loads((STUDY / 'chain-layout.json').read_text(encoding='utf8'))
        self.assertAlmostEqual(recorded['arc_pitch_mm'], self.chain['arc_pitch'], places=6)
        self.assertAlmostEqual(recorded['ratio'], 2.0, places=9)
        self.assertEqual(len(recorded['points_xz_mm']), 38)


class Bodies(unittest.TestCase):
    def test_parts_of_one_mechanism_share_a_body(self):
        self.assertEqual(body('BigBoltA3'), body('BigCap3'))
        self.assertEqual(body('Ring2_1'), body('Piston2'))
        self.assertEqual(body('ChainPlate7_A'), body('ChainRoller7'))
        self.assertNotEqual(body('Piston1'), body('Piston2'))
        self.assertEqual(body('Crankcase'), 'static')
        self.assertEqual(body('CamSprocket'), body('Camshaft'))


class OperatingMotion(unittest.TestCase):
    def test_the_igniter_springs_are_shown_fixed_and_the_lever_and_contact_swing_together(self):
        self.assertEqual(body('IgnitionMainSpring2'), 'static')
        self.assertEqual(body('IgnitionInterSpring3'), 'static')
        self.assertEqual({body('IgniterLever2'), body('MovingContact2')}, {'igniter2'})

    def test_a_part_that_turns_about_one_fixed_axis_keeps_that_axis_in_place(self):
        for part in ('Crankshaft', 'CamSprocket', 'IgnitionShaft', 'MagnetoDriveWheel'):
            x, y, z = motion.pivot(part)
            for theta in (0.0, 13.0, 181.5, 359.0, 700.25):
                m = motion.matrix(part, theta)
                moved = [sum(m[r][c] * v for c, v in enumerate((x, y, z, 1.0))) for r in range(3)]
                for got, want in zip(moved, (x, y, z)):
                    self.assertAlmostEqual(got, want, places=9, msg=f'{part} at {theta}')
        for part in ('Piston1', 'RodTube3', 'RockerLeft2', 'TripLever4', 'IgniterLever1', 'ChainRoller5', 'Crankcase'):
            self.assertIsNone(motion.pivot(part), part)

    def test_each_trip_lever_stays_clear_of_its_cam_over_the_whole_cycle(self):
        # The lever's whole underside, not only its nose, must stay NOSE_GAP above the cam strip and hub, and it rests exactly at theta = 0.
        for cyl in (1, 2, 3, 4):
            self.assertEqual(motion.trip_angle(cyl, 0.0), 0.0)
            under = motion._underside(motion.trip_rest(cyl))
            for k in range(0, 481):
                theta = k * 1.5
                turn = motion.ignition_crest_angle(cyl, theta) - math.pi / 2
                strip = [motion.rotate_point(p, motion.IGNITION_AXIS, turn) for p in motion.STRIP]
                e = motion.trip_angle(cyl, theta)
                for point in under:
                    x, z = motion.rotate_point(point, motion.TRIP_PIVOT, e)
                    top = motion._cam_top(cyl, theta, x, strip)
                    if top is not None:
                        self.assertGreaterEqual(z - top, motion.NOSE_GAP - 1e-3, f'trip lever {cyl} at {theta} degrees, x {x:.2f}')


class Seats(unittest.TestCase):
    params = {'r': dict(value=5.0)}

    def test_a_cylinder_is_grown_by_the_clearance_on_every_side(self):
        f = dict(primitive='cylinder', radius=4, height=10, origin=[1, 2, 3], axis=[0, 1, 0], operation='add')
        tool = seats.grow(f, {}, .15, 'x')
        self.assertEqual((tool['primitive'], tool['operation']), ('cylinder', 'cut'))
        self.assertAlmostEqual(tool['radius'], 4.15)
        self.assertAlmostEqual(tool['height'], 10.3)
        self.assertEqual(tool['origin'], [1, 1.85, 3])

    def test_a_box_is_grown_and_a_tube_is_cleared_as_its_solid_outline(self):
        box = seats.grow(dict(primitive='box', length=2, width=3, height=4, origin=[0, 0, 0], operation='add'), {}, .1, 'x')
        self.assertEqual((box['length'], box['width'], box['height'], box['origin']), (2.2, 3.2, 4.2, [-.1, -.1, -.1]))
        tube = seats.grow(dict(primitive='tube', radius=6, inner_radius=4, height=5, origin=[0, 0, 0], operation='add'), {}, .1, 'x')
        self.assertEqual(tube['primitive'], 'cylinder')
        self.assertAlmostEqual(tube['radius'], 6.1)

    def test_a_polygon_grows_outward(self):
        square = [(0, 0), (10, 0), (10, 10), (0, 10)]
        grown = seats._offset_polygon(square, 1)
        self.assertEqual([(round(x, 6), round(y, 6)) for x, y in grown], [(-1, -1), (11, -1), (11, 11), (-1, 11)])
        clockwise = seats._offset_polygon(square[::-1], 1)
        self.assertEqual(sorted((round(x, 6), round(y, 6)) for x, y in clockwise), sorted([(-1, -1), (11, -1), (11, 11), (-1, 11)]))

    def test_cuts_inside_a_guest_are_not_part_of_its_outline(self):
        self.assertIsNone(seats.grow(dict(primitive='cylinder', radius=1, height=1, origin=[0, 0, 0], operation='cut'), {}, .1, 'x'))

    @staticmethod
    def stepped_part(part_id, steps, sides=36, axis=(391.0, -68.0)):
        """A closed stack of coaxial cylinders about `axis` (parallel to y): steps = [(radius, y_lo, y_hi), ...]."""
        vertices, triangles = [], []
        for radius, lo, hi in steps:
            base = len(vertices)
            for y in (lo, hi):
                vertices += [[axis[0] + radius * math.cos(2 * math.pi * k / sides), y, axis[1] + radius * math.sin(2 * math.pi * k / sides)] for k in range(sides)]
            for k in range(sides):
                a, b = base + k, base + (k + 1) % sides
                triangles += [[a, b, base + sides + b - base], [a, base + sides + b - base, base + sides + k]]
        return dict(id=part_id, vertices_mm=vertices, triangles=triangles)

    def test_a_sliding_gear_with_a_sleeve_sweeps_a_thin_disc_and_a_narrow_tube_not_one_big_cylinder(self):
        geometry = dict(parts=[self.stepped_part('IgnitionGear', [(30.0, -59.5, -52.5), (10.0, -52.5, -18.5)])])
        swept = seats.swept_envelope('IgnitionGear', geometry)
        self.assertEqual(swept['axis'], [391.0, -68.0])
        self.assertEqual([(b['radius'], b['y']) for b in swept['bands']], [(30.0, [-59.5, -52.5]), (10.0, [-52.5, -18.5])])

    def test_radii_are_rounded_up_and_slivers_are_folded_into_a_neighbour(self):
        geometry = dict(parts=[self.stepped_part('IgnitionGear', [(7.8, 0.0, 10.0), (8.0, 10.0, 10.2), (7.6, 10.2, 20.0)])])
        bands = seats.swept_envelope('IgnitionGear', geometry)['bands']
        self.assertEqual(len(bands), 1)                                    # the 0.2 mm band is not left to cut a sliver
        self.assertEqual((bands[0]['radius'], bands[0]['y']), (8.0, [0.0, 20.0]))
        self.assertGreaterEqual(bands[0]['radius'], 7.8)                   # never smaller than the part

    def test_a_body_with_no_fixed_axis_has_no_revolution_envelope(self):
        self.assertIsNone(seats.swept_envelope('Piston1', dict(parts=[])))

    def test_each_band_becomes_one_cut_in_the_host_and_an_older_single_band_record_still_applies(self):
        host = dict(id='H', label='host', features=[])
        guest = dict(id='G', label='guest', features=[])
        banded = dict(host='H', guest='G', swept=dict(axis=[1.0, 2.0], bands=[dict(radius=5.0, y=[0.0, 3.0]), dict(radius=2.0, y=[3.0, 9.0])]))
        seats.apply_seats([host, guest], {}, [banded], 0.15)
        self.assertEqual([(f['radius'], f['height']) for f in host['features']], [(5.15, 3.3), (2.15, 6.3)])
        old = dict(id='H2', label='host', features=[])
        seats.apply_seats([old, guest], {}, [dict(host='H2', guest='G', swept=dict(axis=[1.0, 2.0], radius=5.0, y=[0.0, 3.0]))], 0.15)
        self.assertEqual([(f['radius'], f['height']) for f in old['features']], [(5.15, 3.3)])

    def test_the_static_part_holds_a_moving_one_and_connectors_are_never_hosts(self):
        group = {'Crankcase': 'crankcase', 'Piston1': 'pistons', 'OilFeedHose': 'lubrication', 'Sleeve1': 'cylinders', 'BigBoltA1': 'rods', 'BigCap1': 'rods'}
        volume = {k: 1.0 for k in group}
        self.assertEqual(seats.host_of('Crankcase', 'Piston1', group, volume), 'Crankcase')
        self.assertIsNone(seats.host_of('OilFeedHose', 'Piston1', group, volume))          # a hose through a piston is a routing fault
        self.assertEqual(seats.host_of('OilFeedHose', 'Sleeve1', group, volume), 'Sleeve1')
        self.assertEqual(seats.host_of('BigBoltA1', 'BigCap1', group, volume), 'BigCap1')  # one rigid body: the bolt is the guest

    def test_two_different_moving_bodies_have_no_host(self):
        group = {'Piston1': 'pistons', 'BigEnd1': 'rods'}
        self.assertIsNone(seats.host_of('Piston1', 'BigEnd1', group, {'Piston1': 2.0, 'BigEnd1': 1.0}))

    def test_every_recorded_seat_names_real_parts_and_never_a_mechanism_fault(self):
        spec = json.loads((STUDY / 'part-spec.json').read_text(encoding='utf8'))
        ids = {p['id'] for p in spec['parts']}
        recorded = json.loads((STUDY / 'seats.json').read_text(encoding='utf8'))
        self.assertGreater(len(recorded['seats']), 0)
        for s in recorded['seats']:
            self.assertTrue({s['host'], s['guest']} <= ids, s)
            ba, bb = body(s['host']), body(s['guest'])
            self.assertTrue(ba == bb or 'static' in (ba, bb), f"{s['host']} / {s['guest']} move relative to each other")
        self.assertGreaterEqual(recorded['clearance_mm'], .15)


if __name__ == '__main__':
    unittest.main()
