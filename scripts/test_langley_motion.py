"""Checks on the Langley operating motion that need only the standard library: python3 scripts/test_langley_motion.py

The motion (cad_pipeline/langley_motion.py) must agree with the geometry it moves (same context), close its kinematic loops, keep the documented ratios and the
firing order, and stay continuous between the one-degree keys the rig samples.
"""
import math, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cad_pipeline import langley_cam as C, langley_explode as E, langley_motion as M
from cad_pipeline.langley_bodies import body
from cad_pipeline.langley_v1 import build

SP = build()
PARTS = [p['id'] for p in SP.parts]
SPRINGS = ('exhaustspring', 'inletspring', 'pawlspring')


class RestPose(unittest.TestCase):
    def test_every_part_is_in_place_at_theta_zero(self):
        for pid in PARTS:
            m = M.matrix(pid, 0.0)
            for i in range(4):
                for j in range(4):
                    self.assertAlmostEqual(m[i][j], 1.0 if i == j else 0.0, places=9, msg=pid)

    def test_every_part_has_a_motion_or_is_static(self):
        for pid in PARTS:
            M.matrix(pid, 123.0)                                   # raises for a body with no motion
        moving = {body(p) for p in PARTS} - {'static'}
        self.assertEqual(len([b for b in moving if b.startswith('rod')]), 5)
        self.assertEqual(len([b for b in moving if b.startswith('piston')]), 5)
        self.assertEqual(len([b for b in moving if b.startswith('punch')]), 5)


class Kinematics(unittest.TestCase):
    def test_rods_join_crank_pin_to_gudgeon_pin(self):
        c = M.ctx()
        for k in range(5):
            for theta in (17.0, 90.0, 133.0, 250.0, 301.0, 477.0, 611.0, 700.0):
                z0, z1 = M.slider(k, 0.0), M.slider(k, theta)
                a = M.alpha(k)
                g0 = (0.0, -z0 * math.sin(a), z0 * math.cos(a))
                g1 = (0.0, -z1 * math.sin(a), z1 * math.cos(a))
                self.assertLess(math.dist(M.apply(M.rod_matrix(k, theta), g0), g1), 1e-6)
                self.assertLess(math.dist(M.apply(M.piston_matrix(k, theta), g0), g1), 1e-6)
                p = M.pin(theta)
                self.assertAlmostEqual(math.dist((p[0], p[1]), (g1[1], g1[2])), c.L, places=6)    # constant rod length from the crank-pin centre

    def test_stroke_is_five_and_a_half_inches(self):
        for k in range(5):
            tops = [M.slider(k, th) for th in range(0, 720)]
            self.assertAlmostEqual(max(tops) - min(tops), 139.7, delta=0.01)

    def test_pistons_reach_top_dead_centre_at_their_power_stroke_angles(self):
        top = max(M.slider(0, th) for th in range(720))
        for cyl, theta in C.POWER_TDC.items():
            self.assertAlmostEqual(M.slider(cyl - 1, theta), top, places=6, msg=cyl)

    def test_firing_order_follows_the_sparks(self):
        order = [cyl for _, cyl in sorted((C.spark_theta(cyl), cyl) for cyl in range(1, 6))]
        start = order.index(1)
        self.assertEqual(order[start:] + order[:start], list(C.FIRING_ORDER))
        for a, b in zip(sorted(C.spark_theta(c) for c in range(1, 6)), sorted(C.spark_theta(c) for c in range(1, 6))[1:]):
            self.assertAlmostEqual(b - a, 144.0)


class Valves(unittest.TestCase):
    def test_exhaust_valve_peaks_mid_exhaust_stroke_and_stays_shut_on_the_power_stroke(self):
        for cyl in range(1, 6):
            lifts = [M.exhaust_lift(cyl - 1, float(th)) for th in range(720)]
            peak = max(range(720), key=lambda th: lifts[th])
            self.assertLess(abs(((peak - C.exhaust_peak(cyl) + 360) % 720) - 360), 1.5, msg=cyl)
            self.assertAlmostEqual(max(lifts), 12.0, delta=0.05)
            for rel in range(0, 160):                                # power stroke: the valve opens only some 20 degrees before bottom dead centre
                self.assertEqual(lifts[int((C.POWER_TDC[cyl] + rel) % 720)], 0.0, msg=(cyl, rel))

    def test_each_exhaust_valve_is_open_once_per_cycle(self):
        for k in range(5):
            lifts = [M.exhaust_lift(k, float(th)) > 0 for th in range(721)]
            edges = sum(1 for a, b in zip(lifts, lifts[1:]) if a != b)
            self.assertEqual(edges, 2, msg=k)

    def test_exhaust_lift_is_continuous(self):
        for k in range(5):
            prev = M.exhaust_lift(k, 0.0)
            for th in range(1, 721):
                cur = M.exhaust_lift(k, float(th))
                self.assertLess(abs(cur - prev), 0.6, msg=(k, th))     # at most 0.6 mm between keys: the roller follows the polygon cam, so steps would mean a missed contact
                prev = cur

    def test_inlet_valves_open_only_in_the_intake_stroke(self):
        for cyl in range(1, 6):
            for th in range(720):
                if M.inlet_lift(cyl - 1, float(th)) > 0:
                    rel = (th - C.POWER_TDC[cyl]) % 720
                    self.assertTrue(360 < rel < 540, msg=(cyl, th))
        self.assertEqual([M.inlet_lift(k, 0.0) for k in range(5)], [0.0] * 5)    # the rest pose has every inlet closed

    def test_cam_polygon_is_the_one_the_motion_rides(self):
        c = M.ctx()
        self.assertEqual(len(c.cam.polygon()), 180)
        self.assertAlmostEqual(c.cam.phase, 157.5)
        for h, rise in zip(c.cam_h, (M.exhaust_rise(k, 0.0) for k in range(5))):
            self.assertAlmostEqual(h, rise, places=9)


class GearTrains(unittest.TestCase):
    def test_cam_turns_minus_a_quarter_through_three_meshes(self):
        for theta in (45.0, 360.0, 720.0):
            self.assertAlmostEqual(M.cam_train_angles(theta)['C'], C.CAM_SPEED * theta, places=9)

    def test_ignition_ratios(self):
        for theta in (45.0, 360.0):
            a = M.ignition_angles(theta)
            self.assertAlmostEqual(a['L'], -0.5 * theta)
            self.assertAlmostEqual(a['S'], 2.5 * theta)

    def test_meshes_are_tangent_at_the_pitch_circles(self):
        from cad_pipeline.langley_contract import gear_meshes
        for mesh in gear_meshes():
            self.assertAlmostEqual(mesh['centre_distance_mm'], mesh['module_mm'] * sum(mesh['teeth']) / 2, places=3, msg=mesh['driver'])

    def test_brush_reaches_each_segment_at_its_spark(self):
        c = M.ctx()
        centre = c.ign_train['centres']['L']
        segments = {p['id']: p for p in SP.parts if p['id'].startswith('CommutatorSegment')}
        for cyl in range(1, 6):
            f = segments[f'CommutatorSegment{cyl}']['features'][0]
            y, z = f['origin'][1] - centre[0], f['origin'][2] - centre[1]
            at_segment = math.degrees(math.atan2(z, y)) % 360.0
            brush = (0.0 + M.ignition_angles(C.spark_theta(cyl))['L']) % 360.0           # the brush is built on the +Y side of the disc axis
            self.assertLess(abs(((brush - at_segment + 180) % 360) - 180), 1e-6, msg=cyl)

    def test_sparker_lobe_is_under_the_axle_at_every_spark(self):
        s = M.ctx().sparker
        for cyl in range(1, 6):
            crest = (s['crest_0'] + M.ignition_angles(C.spark_theta(cyl))['S']) % 360.0
            self.assertLess(abs(((crest - 270.0 + 180) % 360) - 180), 1e-6, msg=cyl)

    def test_pawl_is_pushed_down_only_while_a_lobe_is_over_it(self):
        drops = [M.sparker_pawl_drop(float(th)) for th in range(0, 721)]
        self.assertEqual(drops[0], 0.0)
        self.assertGreater(max(drops), 4.0)
        self.assertLess(max(drops), 7.0)
        peaks = sum(1 for a, b, c in zip(drops, drops[1:], drops[2:]) if b > a and b >= c and b > 3.0)
        self.assertEqual(peaks, 5)                                  # five sparks in two crank turns


class Continuity(unittest.TestCase):
    def test_no_part_jumps_between_keys(self):
        probe = (30.0, 40.0, 350.0)
        bodies = {}
        for pid in PARTS:
            bodies.setdefault(body(pid), pid)
        for name, pid in bodies.items():
            if name == 'static':
                continue
            prev = M.apply(M.matrix(pid, 0.0), probe)
            for th in range(1, 721):
                cur = M.apply(M.matrix(pid, float(th)), probe)
                self.assertLess(math.dist(prev, cur), 20.0, msg=(name, th))             # the probe lies 350 mm out: 1 degree is 6 mm, and the sparker cam turns 2.5 degrees
                prev = cur

    def test_rigid_bodies_stay_rigid(self):
        for pid in PARTS:
            b = body(pid)
            if b == 'static' or b.startswith(SPRINGS):
                continue
            m = M.matrix(pid, 217.0)
            for i in range(3):
                for j in range(3):
                    self.assertAlmostEqual(sum(m[i][k] * m[j][k] for k in range(3)), 1.0 if i == j else 0.0, places=9, msg=pid)


class ExplodedView(unittest.TestCase):
    def test_nothing_moves_when_assembled_and_the_crankshaft_never_moves(self):
        for pid in PARTS:
            self.assertEqual(E.offset(pid, '', 0.0), (0.0, 0.0, 0.0))
        self.assertEqual(E.offset('Crankshaft', '', 1.0), (0.0, 0.0, 0.0))

    def test_every_rule_matches_a_part(self):
        for pattern, *_ in E._RULES:
            self.assertTrue(any(pattern.match(pid) for pid in PARTS), msg=pattern)

    def test_unmoved_parts_are_the_running_gear(self):
        unmoved = sorted(pid for pid in PARTS if E.placement(pid) is None)
        for pid in unmoved:
            self.assertRegex(pid, r'^(Crankshaft|CrankPlug|CrankOilPipe|MasterRod|MasterSleeveCap|MasterLining(Upper|Lower)|LinkRod\d|LinkShoe\d|WristBush\d|ConeNut(Port|Stbd)|JamNut(Port|Stbd))$')

    def test_cylinder_parts_leave_along_their_own_axis(self):
        o = E.offset('CylShell2', '', 1.0)
        a = 72.0 * math.pi / 180.0
        self.assertAlmostEqual(o[1], -330.0 * math.sin(a), places=6)
        self.assertAlmostEqual(o[2], 330.0 * math.cos(a), places=6)


if __name__ == '__main__':
    unittest.main()
