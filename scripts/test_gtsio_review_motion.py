"""The R10 review motion's fitted bodies (which parts turn with a shaft or gear in the Assembled view, and that the Core view stays as it was) and its
handedness (the export is the reflection x -> -x of the CAD frame: cad_pipeline/gtsio_layout.py EXPORT_MIRROR_X, docs/r10-handedness.md).

Run: python scripts/test_gtsio_review_motion.py. Standard library only (the motion module imports the stdlib-only layout and pose modules).
The viewer's evaluator has the same maths (scripts/test_gtsio_spin_body.mjs); scripts/check_gtsio_review.mjs compares the two on the whole file.
"""
import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'scripts'))
from cad_pipeline import gtsio_review_motion as grm  # noqa: E402
import accessory_gears as gears  # noqa: E402

CONTRACT = json.loads((ROOT / 'web/gtsio520-r10-contract.json').read_text(encoding='utf-8'))
PARTS = [{'id': p['id'], 'group': p['group'], 'bounds_mm': [[0, 0, 0], [1, 1, 1]]} for p in CONTRACT['parts']]
PARAMETERS = {name: {'value': CONTRACT['procedural']['parameters'][name]} for name in
              ('case_cam_y', 'head_seat', 'valve_offset', 'intake_angle', 'exhaust_angle', 'intake_valve_length', 'exhaust_valve_length')}
# the rigid-body seeds (crank, cam, six rods, six pistons) of the frozen animation handoff, which is committed
SEEDS = json.loads((ROOT / 'cad-studies/gtsio520-h-static/crankcase-contours/animation-handoff.json').read_text(encoding='utf-8'))['rigid_body_seeds']


def rotate(point, centre, axis, angle):
    n = math.sqrt(sum(a * a for a in axis))
    k = [a / n for a in axis]
    v = [p - c for p, c in zip(point, centre)]
    dot = sum(a * b for a, b in zip(k, v))
    cross = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
    return [c + vi * math.cos(angle) + ci * math.sin(angle) + ki * dot * (1 - math.cos(angle)) for c, vi, ci, ki in zip(centre, v, cross, k)]


def apply(matrix, point):
    homogeneous = list(point) + [1]
    return [sum(matrix[i][j] * homogeneous[j] for j in range(4)) for i in range(3)]


def reflect(point):
    return [-point[0], point[1], point[2]]


# the export frame is the reflection of the CAD frame the declarations are written in: a centre or axis changes x, a turning rate changes sign
MIRROR = grm.EXPORT_MIRROR_X
SENSE = -1.0 if MIRROR else 1.0


class FittedBodies(unittest.TestCase):
    def setUp(self):
        self.motion = grm.ReviewMotion({'parameters': PARAMETERS}, PARTS, SEEDS)
        self.ids = {p['id'] for p in PARTS}

    def test_every_fitted_part_exists_and_turns(self):
        fitted = set(grm.CRANK_FITTED) | set(grm.CAM_FITTED) | set(grm.spinning_bodies())
        self.assertEqual(sorted(fitted - self.ids), [], 'a fitted part is not in the R10 contract')
        for pid in fitted | {p['id'] for p in PARTS if p['group'] in grm.CRANK_FITTED_GROUPS}:
            self.assertFalse(self.motion.body(pid).startswith('fixed:'), pid)

    def test_the_whole_damper_system_follows_the_crank(self):
        dampers = [p['id'] for p in PARTS if p['group'] == 'dampers']
        self.assertEqual(len(dampers), 102)
        self.assertTrue(all(self.motion.body(pid) == 'crank' for pid in dampers))

    def test_the_core_view_is_unchanged(self):
        # a part the Assembled view only now turns stays hidden in the Core view; the shipped contract says which parts the Core view shows
        shipped = {p['id']: p['cycle_visible'] for p in CONTRACT['parts']}
        wrong = [pid for pid in self.ids if self.motion.cycle_visible(pid) != shipped[pid]]
        self.assertEqual(wrong, [])

    def test_gear_rates_and_centres_are_the_declared_ones(self):
        declared = {**gears.solve_gtsio_accessory_drive(), **gears.gtsio_h_accessory_development()}
        bodies = grm.spinning_bodies()
        for gear, fitted in grm.SPINNING_GEARS.items():
            for pid in fitted:
                x = [float(v) for v in bodies[pid][5:].split(',')]
                self.assertAlmostEqual(x[0], -declared[gear]['centre'][0] if MIRROR else declared[gear]['centre'][0], places=5)
                self.assertAlmostEqual(x[1], declared[gear]['centre'][1], places=5)
                self.assertEqual(x[3:6], [0.0, 0.0, 1.0])
                self.assertAlmostEqual(x[6], SENSE * declared[gear]['rate'], places=8)
        # the bevel and pinion pairs use the declared apex, axis and rate of their driven side, reflected into the export frame
        governor = gears.gtsio_governor_development()
        x = [float(v) for v in bodies['GovernorDrivenShaftGear'][5:].split(',')]
        apex, axis = list(map(float, governor['apex'])), list(map(float, governor['driven']['axis']))
        self.assertEqual((x[:3], x[3:6]), (reflect(apex) if MIRROR else apex, reflect(axis) if MIRROR else axis))
        self.assertAlmostEqual(x[6], SENSE * governor['driven']['rate'], places=8)
        alternator = gears.gtsio_alternator_installation_development()
        x = [float(v) for v in bodies['AlternatorKeyedHub'][5:].split(',')]
        start, axis = list(map(float, alternator['pinion_start'])), list(map(float, alternator['pinion_axis']))
        self.assertEqual((x[:3], x[3:6], x[6]), (reflect(start) if MIRROR else start, reflect(axis) if MIRROR else axis, SENSE * float(alternator['pinion_rate'])))

    def test_the_matrix_turns_a_point_by_rate_times_the_crank_angle(self):
        for pid, point in (('IdlerGear', [12., 150., 20.]), ('PropellerShaft', [30., 150., 640.]), ('GovernorDrivenShaftGear', [-60., -100., 640.]), ('AlternatorKeyedHub', [50., 12., 630.])):
            x = [float(v) for v in self.motion.body(pid)[5:].split(',')]
            for theta in (0., 90., 137., 719.):
                expected = rotate(point, x[:3], x[3:6], math.radians(theta) * x[6])
                got = apply(self.motion.matrix(pid, theta), point)
                self.assertTrue(all(abs(a - b) < 1e-9 for a, b in zip(got, expected)), (pid, theta))

    def test_crank_and_cam_fitted_parts_turn_like_the_crank_and_cam(self):
        self.assertEqual(self.motion.body('QuillShaft'), 'crank')
        self.assertEqual(self.motion.body('GovernorCamKey'), 'cam')
        # the export turns the other way about +Z (counterclockwise looking forward) because it is the mirror image of the CAD frame
        got = apply(self.motion.matrix('QuillShaft', 90.), [10., 20., 600.])
        expected = rotate([10., 20., 600.], [0., 0., 0.], [0., 0., 1.], SENSE * math.radians(90.))
        self.assertTrue(all(abs(a - b) < 1e-9 for a, b in zip(got, expected)))
        got = apply(self.motion.matrix('GovernorCamKey', 90.), [10., -126., 600.])
        expected = rotate([10., -126., 600.], [0., -126., 0.], [0., 0., 1.], SENSE * math.radians(90.) * gears.gtsio_cam_rate())
        self.assertTrue(all(abs(a - b) < 1e-9 for a, b in zip(got, expected)))


class Handedness(unittest.TestCase):
    """The export frame is the reflection x -> -x of the CAD frame: every body is the mirror image of its CAD-frame self at every crank angle."""

    def setUp(self):
        self.motion = grm.ReviewMotion({'parameters': PARAMETERS}, PARTS, SEEDS)

    def test_a_posed_point_is_the_reflection_of_the_cad_frame_posed_point(self):
        bodies = ('Crankshaft', 'Piston1', 'Piston2', 'ConnectingRod3', 'ConnectingRod6', 'GovernorCamKey', 'IntakeValve1', 'ExhaustRocker4', 'IntakePushrod5',
                  'LifterIntake3', 'ExhaustInnerSpring2')
        ids = {p['id'] for p in PARTS}
        point = [37., -12., 144.]
        checked = 0
        for pid in bodies:
            if pid not in ids:
                continue
            checked += 1
            for theta in (0., 33., 137., 360., 515.):
                export = apply(self.motion.matrix(pid, theta), reflect(point) if MIRROR else point)
                cad = apply(self.motion.cad_matrix(pid, theta), point)
                cad = reflect(cad) if MIRROR else cad
                self.assertTrue(all(abs(a - b) < 1e-9 for a, b in zip(export, cad)), (pid, theta))
        self.assertGreater(checked, 5)

    def test_odd_cylinders_are_on_the_right_and_the_crank_turns_counterclockwise_looking_forward(self):
        if not MIRROR:
            self.skipTest('the CAD frame is the export frame')
        # right = forward x up = (0,0,1) x (0,1,0) = -X
        for n in range(1, 7):
            wrist = grm.LAYOUT.pose(n)['wrist']
            self.assertEqual(wrist[0] < 0, n % 2 == 1, n)

        def angle(p):
            return math.degrees(math.atan2(p[1], p[0])) % 360
        a0, a1 = angle(grm.LAYOUT.pose(1, 0)['pin']), angle(grm.LAYOUT.pose(1, 10)['pin'])
        self.assertAlmostEqual((a1 - a0 + 180) % 360 - 180, -10, places=6)     # the pin angle falls as the crank angle rises: omega_z = -1

    def test_the_contract_carries_the_one_handedness_parameter_and_the_spin_bodies_of_the_export_frame(self):
        self.assertIs(CONTRACT['procedural']['mirror_x'], MIRROR)
        spinning = grm.spinning_bodies()
        in_contract = {p['id']: p['body'] for p in CONTRACT['parts'] if p['body'].startswith('spin:')}
        self.assertEqual(in_contract, spinning)
        # the default camera looks from the side of the odd cylinders and the alternator, which is -X after the reflection
        self.assertEqual(CONTRACT['display']['fit_direction'][0] < 0, MIRROR)

    def test_the_explosion_is_the_mirror_image_of_the_cad_frame_layout(self):
        checked = 0
        for pid in ('Crankshaft', 'IntakeValve1', 'ExhaustRocker4', 'Piston2'):
            if pid not in self.motion.parts:
                continue
            checked += 1
            (stage, offset), (cad_stage, cad_offset) = self.motion.explosion(pid), self.motion.cad_explosion(pid)
            self.assertEqual(stage, cad_stage)
            self.assertEqual(list(offset), [-cad_offset[0] if MIRROR else cad_offset[0], cad_offset[1], cad_offset[2]])
        self.assertGreater(checked, 1)


if __name__ == '__main__':
    unittest.main()
