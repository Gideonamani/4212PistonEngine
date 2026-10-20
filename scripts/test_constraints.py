"""The closure-check framework (cad_pipeline/constraints.py): the kinds of check, the four states, the bindings, and the two studies' constraints.json.

Standard library only, so CI can run it. Run: python3 scripts/test_constraints.py
"""
import copy
import json
import math
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from cad_pipeline import constraints as C

LANGLEY = REPO / 'cad-studies/langley-manly-balzer-1903'
GTSIO = REPO / 'cad-studies/gtsio520-h-static'
SRC = [{'source': 's', 'where': 'a page'}]


def doc(*checks, bindings=None, **extra):
    return dict(schema=C.SCHEMA, study='t', sources={'s': {'title': 'a source'}}, bindings=bindings or {}, checks=list(checks), **extra)


def check(kind, cid='c', **kw):
    kw.setdefault('source', SRC)
    return dict(id=cid, kind=kind, title=cid, **kw)


def run_one(c, bindings=None, root=REPO, volumes=None):
    return C.run(doc(c, bindings=bindings), root, volumes)['checks'][0]


# ---------------------------------------------------------------------------------------------------------------------------- legacy reference
# The weight table, densities and arithmetic of scripts/langley_mass_check.py as they stood before B3, frozen here so the generalised runner is tested against what it replaced.
LEGACY_DENSITY = {'steel': 7.85, 'cast iron': 7.2, 'bronze': 8.8, 'brass': 8.5, 'aluminium': 2.70, 'porcelain': 2.4, 'rubber': 1.2}
LEGACY_LINES = [
    ('W01', 5225, r'^(Crankshaft|CrankPlug|CrankOilPipe)$'),
    ('W02', 5070, r'^(MasterRod|MasterSleeveCap|MasterLining\w+|LinkRod\d|LinkShoe\d|WristBush\d|ConeNut\w+|JamNut\w+)$'),
    ('W03', 8260, r'^(Piston\d|PistonRing\d_\d|GudgeonPin\d|PinRetainer\d_\w)$'),
    ('W04', 23524, r'^(CylShell|CylLiner|CylFlange|JacketRing|Jacket|Chamber|ExhaustOutlet|InletSeatNut|InletSeat|InletValve|InletSpringCap|InletSpring|ExhaustSeat|ExhaustValve|ExhaustGuide|ExhaustSpringCollar|ExhaustSpringNut|ExhaustSpring|OilCupTube|OilCup|WaterInletStub|WaterOutletStub)\d$'),
    ('W05', 5225, r'^(PortDrum|PortMainBushing|PortDrumBushingFlange|CamRing|CamPinion|CamGearLarge|CamGearSmall|CamIdler|CamStud|PunchRod\d|PunchRoller\d|PunchGuide\d|PortOilCup|PortOilCupTube)$'),
    ('W06', 3440, r'^(StbdDrum|StbdMainBushing)$'),
    ('W07', 450, r'^(PlugShell|PlugInsulator|PlugElectrode)\d$'),
    ('W08', 450, r'^(WaterOutletRing|WaterOutletConnection\w+)$'),
    ('W09', 360, r'^(WaterInletRing|WaterInletRiser)$'),
    ('W10', 1700, r'^(InletRing\w|InletFlange\w+|CarbConnection|AirValvePipe|AirValveSleeve)$'),
    ('W11', 512, r'^(SparkSleeve|SparkSleeveRing|SparkPinion|SparkGearLarge|SparkerCam|SparkerPawl|SparkerSpring|SparkerBracket|SparkerContact|DistributorDisc|DistributorBrush|CommutatorBody|CommutatorSegment\d|SparkWire\d|SparkTiming\w+)$'),
    ('W12+W13', 2107, r'^(BalanceArm|BalanceBrace\w*)(Port|Stbd)$'),
    ('W14', 3946, r'^Flywheel(Rim|Hub|Spoke)Stbd\d*$'),
    ('W15', 3234, r'^Flywheel(Rim|Hub|Spoke)Port\d*$')]
LEGACY_ENGINE_LINES = {'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12+W13'}


def legacy_mass(parts):
    """The loop of the old script, unchanged: -> (grams per line, part -> line, ungrouped part -> grams)."""
    grams, assigned, other = {k: 0.0 for k, _, _ in LEGACY_LINES}, {}, {}
    for part in parts:
        mass = part['volume_mm3'] / 1000.0 * LEGACY_DENSITY.get(part['material'], 7.85)
        for key, _, pattern in LEGACY_LINES:
            if re.match(pattern, part['id']):
                grams[key] += mass
                assigned[part['id']] = key
                break
        else:
            other[part['id']] = round(mass, 1)
    return grams, assigned, other


def langley_parts():
    """The 358 real Langley part ids and materials with deterministic made-up volumes (the real volumes are build output, not in Git)."""
    spec = json.loads((LANGLEY / 'part-spec.json').read_text())
    return [dict(id=p['id'], material=p['material'], volume_mm3=2000.0 + (i * 7919) % 90000 + i / 7.0) for i, p in enumerate(spec['parts'])]


class LangleyMassSameAnswers(unittest.TestCase):
    """Plan B3: Langley runs through the generic runner with the same result as langley_mass_check.py had."""
    doc = C.load(LANGLEY / 'constraints.json')
    check = next(c for c in doc['checks'] if c['id'] == 'mass-by-weight-line')

    def test_the_table_the_densities_and_the_engine_lines_are_the_old_ones(self):
        self.assertEqual([(g['id'], g['published']['value'], g['patterns'][0]) for g in self.check['groups']], LEGACY_LINES)
        self.assertEqual(self.check['densities_g_cm3'], LEGACY_DENSITY)
        self.assertEqual(self.check['default_density_g_cm3'], 7.85)
        self.assertEqual(set(self.check['totals'][0]['groups']), LEGACY_ENGINE_LINES)
        self.assertEqual(self.check['totals'][0]['published'], {'value': 56323, 'unit': 'g'})

    def test_per_line_grams_and_ungrouped_parts_equal_the_old_loop_exactly(self):
        parts = langley_parts()
        grams, assigned, other = legacy_mass(parts)
        rep = C.mass_report(self.check, parts)
        self.assertEqual(rep['grams'], grams)
        self.assertEqual(rep['assigned'], assigned)
        self.assertEqual(rep['unassigned_g'], other)
        self.assertGreater(len(other), 30)                       # the bed plates, starter, pump drive, coupling flanges, stubs and bolts are outside the table

    def test_the_old_command_line_gives_the_same_json_and_console_lines(self):
        parts = langley_parts()
        grams, _, other = legacy_mass(parts)
        engine = sum(grams[k] for k in sorted(LEGACY_ENGINE_LINES))
        with tempfile.TemporaryDirectory() as d:
            geometry, out = Path(d, 'geometry.json'), Path(d, 'out.json')
            geometry.write_text(json.dumps(dict(parts=parts)))
            run = subprocess.run([sys.executable, str(REPO / 'scripts/langley_mass_check.py'), str(geometry), '--json', str(out)], capture_output=True, text=True, check=True)
            got = json.loads(out.read_text())
        self.assertEqual([x['line'] for x in got['lines']], [k for k, _, _ in LEGACY_LINES])
        for x, (k, target, _) in zip(got['lines'], LEGACY_LINES):
            self.assertEqual((x['model_g'], x['table_g'], x['ratio']), (round(grams[k], 1), target, round(grams[k] / target, 3)))
        self.assertAlmostEqual(got['engine_g'], round(engine, 1), delta=0.15)                # the old script summed a set, so only the last bit can differ
        self.assertEqual(got['unassigned_g'], other)
        self.assertIn('engine', run.stdout)
        self.assertIn('not in the table (g):', run.stdout)

    def test_fidelity_still_reads_the_same_lines_from_the_old_module(self):
        sys.path.insert(0, str(REPO / 'scripts'))
        import langley_mass_check as old
        self.assertEqual(old.LINES, LEGACY_LINES)
        self.assertEqual(old.ENGINE_LINES, LEGACY_ENGINE_LINES)
        self.assertEqual(old.DENSITY, LEGACY_DENSITY)

    def test_every_real_part_id_lands_where_the_recorded_run_put_it(self):
        """The committed mass-check.json is the real run (63.5 kg); its ungrouped list must be exactly the ids that match no line, and its lines the table."""
        record = json.loads((LANGLEY / 'mass-check.json').read_text())
        _, assigned, other = legacy_mass(langley_parts())
        self.assertEqual(set(record['unassigned_g']), set(other))
        self.assertEqual([x['line'] for x in record['lines']], [k for k, _, _ in LEGACY_LINES])
        self.assertEqual([x['table_g'] for x in record['lines']], [g for _, g, _ in LEGACY_LINES])
        for x in record['lines']:
            self.assertAlmostEqual(x['ratio'], x['model_g'] / x['table_g'], delta=0.0006)
        self.assertAlmostEqual(record['engine_g'], sum(x['model_g'] for x in record['lines'] if x['line'] in LEGACY_ENGINE_LINES), delta=0.5)
        self.assertEqual(len(assigned) + len(other), 358)

    def test_the_recorded_run_passes_through_the_runner_with_its_known_deviations_accepted(self):
        r = C.run(self.doc, REPO)
        mass = next(x for x in r['checks'] if x['id'] == 'mass-by-weight-line')
        self.assertEqual(mass['state'], 'accepted')
        self.assertEqual(mass['values']['basis'], 'recorded')
        states = {k: v['state'] for k, v in mass['values'].items() if isinstance(v, dict) and 'state' in v}
        self.assertEqual({k for k, s in states.items() if s == 'accepted'}, {'W01', 'W02', 'W05', 'W07', 'W11'})
        self.assertEqual(states['total:engine'], 'pass')
        self.assertAlmostEqual(mass['values']['total:engine']['ratio'], 1.128, places=3)

    def test_a_worse_line_than_the_accepted_band_fails_and_a_better_one_makes_the_acceptance_stale(self):
        record = json.loads((LANGLEY / 'mass-check.json').read_text())

        def run_with(edit):
            rec = copy.deepcopy(record)
            edit(rec)
            with tempfile.TemporaryDirectory() as d:
                (Path(d) / 'rec.json').write_text(json.dumps(rec))
                c = copy.deepcopy(self.check)
                c['volumes'] = {'record': 'rec.json'}
                return C.run(dict(self.doc, checks=[c]), Path(d))['checks'][0]

        def heavier(rec):
            next(x for x in rec['lines'] if x['line'] == 'W11')['model_g'] = 920.0           # 1.797 > 1.76
        def lighter(rec):
            next(x for x in rec['lines'] if x['line'] == 'W11')['model_g'] = 560.0           # 1.09: inside 15 percent, so the acceptance is stale
        self.assertEqual(run_with(heavier)['state'], 'fail')
        stale = run_with(lighter)
        self.assertEqual(stale['state'], 'fail')
        self.assertIn('stale `accepted` record', stale['detail'])


# ---------------------------------------------------------------------------------------------------------------------------- the kinds of check

class Displacement(unittest.TestCase):
    def c(self, stated, **tol):
        return check('displacement', cylinders=6, bore={'value': 5.25, 'unit': 'in'}, stroke={'value': 4.0, 'unit': 'in'}, stated={'value': stated, 'unit': 'cu in'}, tolerance=tol)

    def test_gtsio_numbers_close(self):
        r = run_one(self.c(520, abs=0.5))
        self.assertEqual(r['state'], 'pass')
        self.assertAlmostEqual(r['values']['computed'], 6 * math.pi / 4 * 5.25 ** 2 * 4, places=6)

    def test_a_wrong_stated_figure_fails(self):
        self.assertEqual(run_one(self.c(540, abs=0.5))['state'], 'fail')

    def test_units_convert(self):
        c = check('displacement', cylinders=6, bore={'value': 133.35, 'unit': 'mm'}, stroke={'value': 10.16, 'unit': 'cm'}, stated={'value': 8.5139, 'unit': 'L'}, tolerance={'abs': 0.0005, 'unit': 'L'})
        self.assertEqual(run_one(c)['state'], 'pass')


class Power(unittest.TestCase):
    def test_plank_forward_matches_the_textbook_formula(self):
        psi, bore_in, stroke_in, n, rpm = 120.0, 5.0, 5.5, 5, 950.0
        hp = psi * (stroke_in / 12) * (math.pi / 4 * bore_in ** 2) * (rpm / 2) * n / 33000          # P L A N K / 33,000
        c = check('power', cylinders=n, bore={'value': bore_in, 'unit': 'in'}, stroke={'value': stroke_in, 'unit': 'in'}, speed={'value': rpm, 'unit': 'rpm'},
                  pressure={'value': psi, 'unit': 'psi'}, stated_power={'value': hp, 'unit': 'hp'}, tolerance={'rel': 1e-9})
        self.assertEqual(run_one(c)['state'], 'pass')
        c['stated_power'] = {'value': hp * 1.02, 'unit': 'hp'}
        self.assertEqual(run_one(c)['state'], 'fail')

    def test_langley_implied_pressure_is_about_81_psi(self):
        r = next(x for x in C.run(C.load(LANGLEY / 'constraints.json'), REPO)['checks'] if x['id'] == 'power-plank-pressure')
        self.assertEqual(r['state'], 'pass')
        self.assertAlmostEqual(r['values']['implied_pressure'], 80.9, delta=0.1)

    def test_with_no_sourced_pressure_the_figure_is_reported_and_the_state_is_unknown(self):
        r = next(x for x in C.run(C.load(GTSIO / 'constraints.json'), REPO)['checks'] if x['id'] == 'power-plank-pressure')
        self.assertEqual(r['state'], 'unknown')
        self.assertRegex(r['detail'], r'implied mean effective pressure 168')


class Ratios(unittest.TestCase):
    def test_signed_rates_give_magnitude_and_direction(self):
        c = check('ratio', actual=-0.5, expected=0.5, direction='against', tolerance={'rel': 1e-6})
        self.assertEqual(run_one(c)['state'], 'pass')
        self.assertEqual(run_one(dict(c, actual=0.5))['state'], 'fail')              # right speed, wrong way round
        self.assertEqual(run_one(dict(c, actual=-0.6))['state'], 'fail')


class Formula(unittest.TestCase):
    def test_range_equals_and_true(self):
        self.assertEqual(run_one(check('formula', vars={'a': 2275, 'b': 0.667}, expr='a / b', expect={'min': 3375, 'max': 3425}))['state'], 'pass')
        self.assertEqual(run_one(check('formula', vars={'a': 2, 'b': 0.25}, expr='a * b', expect={'equals': 0.5}, tolerance={'abs': 1e-9}))['state'], 'pass')
        self.assertEqual(run_one(check('formula', vars={'v': [1, 2, 3]}, expr='mean(v) > 2', expect={'true': True}))['state'], 'fail')

    def test_only_arithmetic_and_the_listed_functions_are_evaluated(self):
        for bad in ("__import__('os').getcwd()", 'open("x")', '(1).real', '[x for x in range(3)]', 'lambda: 1', 'a.b'):
            with self.assertRaises((C.ConstraintError, C.Unresolved), msg=bad):
                C.safe_eval(bad, {'a': 1})
        self.assertEqual(C.safe_eval('sqrt(16) + max(1, 2)', {}), 6.0)

    def test_an_unknown_name_is_a_malformed_file(self):
        with self.assertRaises(C.ConstraintError):
            run_one(check('formula', expr='zzz + 1', expect={'min': 0}))


class Sequences(unittest.TestCase):
    def test_order_must_match_in_every_implementation(self):
        c = check('sequence', expected={'value': [1, 4, 5, 2, 3, 6]}, actuals={'a': [1, 4, 5, 2, 3, 6], 'b': [1, 6, 3, 2, 5, 4]})
        r = run_one(c)
        self.assertEqual(r['state'], 'fail')
        self.assertIn('b: [1, 6, 3, 2, 5, 4] !=', r['detail'])

    def test_even_intervals_and_the_cycle_may_start_anywhere(self):
        base = dict(cylinders=6, strokes_per_cycle=4, order={'value': [1, 4, 5, 2, 3, 6]}, tolerance={'abs': 1e-6})
        good = {1: 0, 4: 120, 5: 240, 2: 360, 3: 480, 6: 600}
        self.assertEqual(run_one(check('firing-intervals', phases=good, **base))['state'], 'pass')
        shifted = {k: (v + 200) % 720 for k, v in good.items()}
        self.assertEqual(run_one(check('firing-intervals', phases=shifted, **base))['state'], 'pass')
        uneven = dict(good, **{'5': 250})
        self.assertEqual(run_one(check('firing-intervals', phases=uneven, **base))['state'], 'fail')
        reversed_order = {1: 0, 6: 120, 3: 240, 2: 360, 5: 480, 4: 600}
        self.assertEqual(run_one(check('firing-intervals', phases=reversed_order, **base))['state'], 'fail')
        self.assertEqual(run_one(check('firing-intervals', step_deg=120, **base))['state'], 'pass')


# A flat six described by plain numbers, to test the geometric kinds without any repository file. The pins and banks are the GTSIO's.
PIN_ANGLES = [0, 180, 240, 60, 120, 300]
BANK = [0, 180, 0, 180, 0, 180]


def xy(deg, r=1.0):
    return [r * math.cos(math.radians(deg)), r * math.sin(math.radians(deg)), 0.0]


class CrankGeometry(unittest.TestCase):
    def tdc(self, pins, banks, probe_sign=1, order=(1, 4, 5, 2, 3, 6)):
        phases = {c: k * 120 for k, c in enumerate(order)}
        return check('tdc', cylinders=6, strokes_per_cycle=4, order={'value': list(order)}, phases=phases, pins_at_zero=[xy(a) for a in pins], bore_points=[xy(a, 5) for a in banks],
                     pin_at_zero=xy(0), pin_at_probe=xy(probe_sign * 10), tolerance={'abs': 0.001})

    def test_the_gtsio_pins_and_banks_close_with_the_manuals_order_when_the_crank_turns_positively(self):
        r = run_one(self.tdc(PIN_ANGLES, BANK))
        self.assertEqual(r['state'], 'pass', r['detail'])

    def test_the_same_crank_turned_the_other_way_gives_the_reverse_order_and_fails(self):
        r = run_one(self.tdc(PIN_ANGLES, BANK, probe_sign=-1))
        self.assertEqual(r['state'], 'fail')
        self.assertEqual(run_one(self.tdc(PIN_ANGLES, BANK, probe_sign=-1, order=(1, 6, 3, 2, 5, 4)))['state'], 'pass')      # IO-520 order

    def test_the_mirror_image_engine_keeps_the_firing_order(self):
        """Reflect pins and banks about the Y axis and reverse the rotation: every top-centre angle is unchanged. This is why the R10 bank-side finding does not touch the order."""
        mirrored_pins = [(180 - a) % 360 for a in PIN_ANGLES]
        mirrored_banks = [(180 - a) % 360 for a in BANK]
        self.assertEqual(run_one(self.tdc(mirrored_pins, mirrored_banks, probe_sign=-1))['state'], 'pass')
        self.assertEqual(run_one(self.tdc(mirrored_pins, mirrored_banks, probe_sign=+1))['state'], 'fail')

    def test_pins_that_do_not_match_the_order_fail(self):
        swapped = list(PIN_ANGLES)
        swapped[2], swapped[4] = swapped[4], swapped[2]
        self.assertEqual(run_one(self.tdc(swapped, BANK))['state'], 'fail')

    def numbering(self, banks, stations=(85, 141, 267, 323, 449, 505), forward=(0, 0, 1), up=(0, 1, 0), odd='right'):
        return check('numbering', forward=list(forward), up=list(up), bore_points=[xy(a, 5) for a in banks], stations=list(stations), expect={'odd_side': odd, 'numbered_from': 'rear'})

    def test_odd_cylinders_at_plus_x_are_on_the_left_in_a_right_handed_frame_with_z_forward_and_y_up(self):
        r = run_one(self.numbering(BANK))
        self.assertEqual(r['state'], 'fail')
        self.assertIn('odd cylinders on the left', r['detail'])
        self.assertEqual(run_one(self.numbering(BANK, odd='left'))['state'], 'pass')
        self.assertEqual(run_one(self.numbering([180 - b for b in BANK]))['state'], 'pass')      # mirrored: odd at -X is on the right
        self.assertEqual(run_one(self.numbering(BANK, forward=(0, 0, -1), stations=(-85, -141, -267, -323, -449, -505)))['state'], 'pass')      # with the nose on -Z the hand flips

    def test_numbering_from_the_front_is_caught(self):
        self.assertEqual(run_one(self.numbering([180 - b for b in BANK], stations=(505, 449, 323, 267, 141, 85)))['state'], 'fail')

    def rotation(self, sign, anchor='clockwise', meshes=1):
        return check('rotation', model=dict(pin_at_zero=xy(0), pin_at_probe=xy(sign * 10), axis=[0, 0, 1], forward=[0, 0, 1]), anchor=dict(part='propeller', direction=anchor),
                     chain=[{'link': 'rigid'}] + [{'link': 'external-mesh'}] * meshes)

    def test_rotation_about_plus_z_is_clockwise_looking_forward(self):
        r = run_one(self.rotation(+1, anchor='clockwise', meshes=1))        # the GTSIO's case: a clockwise propeller through one external mesh needs a counterclockwise crank
        self.assertEqual(r['state'], 'fail')
        self.assertIn('model crank turns clockwise looking forward', r['detail'])
        self.assertIn('so the crank must turn counterclockwise', r['detail'])
        self.assertEqual(run_one(self.rotation(+1, anchor='counterclockwise', meshes=1))['state'], 'pass')
        self.assertEqual(run_one(self.rotation(+1, anchor='clockwise', meshes=0))['state'], 'pass')          # a direct drive
        self.assertEqual(run_one(self.rotation(+1, anchor='counterclockwise', meshes=0))['state'], 'fail')
        self.assertEqual(run_one(self.rotation(-1, anchor='clockwise', meshes=1))['state'], 'pass')          # the mirror image


# ---------------------------------------------------------------------------------------------------------------------------- states, bindings, validation

class States(unittest.TestCase):
    failing = dict(vars={'a': 1}, expr='a > 2', expect={'true': True})

    def test_accepted_reports_a_failure_without_failing_the_run(self):
        r = C.run(doc(check('formula', accepted={'reason': 'known'}, **self.failing)), REPO)
        self.assertEqual((r['checks'][0]['state'], r['ok']), ('accepted', True))
        self.assertIn('known', r['checks'][0]['detail'])

    def test_a_stale_acceptance_fails_the_run(self):
        r = C.run(doc(check('formula', accepted={'reason': 'known'}, vars={'a': 3}, expr='a > 2', expect={'true': True})), REPO)
        self.assertEqual((r['checks'][0]['state'], r['ok']), ('fail', False))

    def test_unknown_is_a_legal_state_with_a_reason_and_does_not_fail_the_run(self):
        r = C.run(doc(check('compare', unknown='no source states it')), REPO)
        self.assertEqual((r['checks'][0]['state'], r['ok']), ('unknown', True))

    def test_evaluate_shows_the_computed_figure_but_stays_unknown(self):
        r = run_one(check('formula', unknown='disputed', evaluate=True, **self.failing))
        self.assertEqual(r['state'], 'unknown')
        self.assertIn('computed anyway: a > 2 -> False [fail]', r['detail'])

    def test_requires_makes_a_check_unknown_when_its_premise_is_not_a_pass(self):
        a, b = check('formula', 'a', **self.failing), check('formula', 'b', requires=['a'], vars={'a': 3}, expr='a > 2', expect={'true': True})
        r = C.run(doc(a, b), REPO)
        self.assertEqual([x['state'] for x in r['checks']], ['fail', 'unknown'])
        self.assertIn('depends on a, which is fail', r['checks'][1]['detail'])

    def test_a_binding_that_no_longer_resolves_fails_unless_it_is_optional(self):
        b = {'x': {'kind': 'json', 'path': 'nope/nowhere.json', 'select': 'a', 'locator': 'l'}, 'y': {'kind': 'python', 'module': 'no_such_module_b3', 'attr': 'z', 'locator': 'l'},
             'z': {'kind': 'json', 'path': 'nope/nowhere.json', 'select': 'a', 'locator': 'l', 'optional': True}}
        for name, state in (('x', 'fail'), ('y', 'fail'), ('z', 'unknown')):          # drift fails; a build output that Git does not hold is unknown
            r = run_one(check('formula', vars={'v': {'bind': name}}, expr='v', expect={'min': 0}), bindings=b)
            self.assertEqual(r['state'], state, name)
            self.assertIn('binding ' + name, r['detail'])


class Bindings(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'spec.json').write_text(json.dumps(dict(parameters=dict(bore=dict(value=5.25)), parts=[
            dict(id='A', group='g', features=[dict(label='Pin 1', origin=[1, 2, 3]), dict(label='Pin 2', origin=[4, 5, 6]), dict(label='Other')]),
            dict(id='B', group='g', features=[dict(label='Pin 3', origin=[7, 8, 9])]), dict(id='C', group='h', features=[dict(label='Pin 4', origin=[0, 0, 0])])])))
        (self.root / 'motion.mjs').write_text('const FIRING_ORDER = [1, 4, 5, 2, 3, 6];\nconst K = 2.5 * INCH;\nstep(theta - phase + 180);\n')
        (self.root / 'pkg').mkdir()
        (self.root / 'pkg' / '__init__.py').write_text('')
        (self.root / 'pkg' / 'mod_b3.py').write_text('ORDER = (3, 1, 2)\nPHASE = {1: 0, 2: 120}\ndef pose(n, theta=0):\n    return dict(pin=(n * 10.0 + theta, 0.0))\n')

    def tearDown(self):
        self.tmp.cleanup()

    def value(self, binding):
        ctx = C.Context(doc(check('compare'), bindings={'x': dict(binding, locator='l')}, python_path=['.']), self.root)
        return ctx.bound('x')

    def test_json_select_by_field_prefix_and_all(self):
        self.assertEqual(self.value(dict(kind='json', path='spec.json', select='parameters/bore/value')), 5.25)
        self.assertEqual(self.value(dict(kind='json', path='spec.json', select='parts[id=B]/features/0/origin')), [7, 8, 9])
        self.assertEqual(self.value(dict(kind='json', path='spec.json', select='parts[id=A]/features[label^=Pin ]/origin')), [[1, 2, 3], [4, 5, 6]])
        self.assertEqual(self.value(dict(kind='json', path='spec.json', select='parts[group==g]/features/origin')), [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9]]])      # per part, per feature; features without the key are skipped
        self.assertEqual(self.value(dict(kind='json', path='spec.json', select='parts/id')), ['A', 'B', 'C'])

    def test_regex_parses_lists_and_numbers(self):
        self.assertEqual(self.value(dict(kind='regex', path='motion.mjs', pattern=r'FIRING_ORDER = \[([0-9, ]+)\]', parse='int-list')), [1, 4, 5, 2, 3, 6])
        self.assertEqual(self.value(dict(kind='regex', path='motion.mjs', pattern=r'K = ([0-9.]+) \* INCH', parse='float')), 2.5)
        with self.assertRaises(C.Unresolved):
            self.value(dict(kind='regex', path='motion.mjs', pattern=r'NO_SUCH = (\d+)', parse='int'))

    def test_python_attribute_call_and_foreach(self):
        self.assertEqual(self.value(dict(kind='python', module='pkg.mod_b3', attr='ORDER')), [3, 1, 2])
        self.assertEqual(self.value(dict(kind='python', module='pkg.mod_b3', attr='PHASE')), {'1': 0, '2': 120})
        self.assertEqual(self.value(dict(kind='python', module='pkg.mod_b3', attr='pose', args=[2, 5], path='pin')), [25.0, 0.0])
        self.assertEqual(self.value(dict(kind='python', module='pkg.mod_b3', attr='pose', foreach=[1, 2], args=['$', 0], path='pin')), [[10.0, 0.0], [20.0, 0.0]])

    def test_an_anchor_that_stopped_matching_fails_the_check(self):
        c = check('formula', vars={'a': 3}, expr='a > 2', expect={'true': True}, anchors=[{'path': 'motion.mjs', 'pattern': r'theta - phase \+ 180'}])
        self.assertEqual(run_one(c, root=self.root)['state'], 'pass')
        (self.root / 'motion.mjs').write_text('step(theta - phase);\n')
        r = run_one(c, root=self.root)
        self.assertEqual(r['state'], 'fail')
        self.assertIn('no longer matches', r['detail'])


class Mass(unittest.TestCase):
    def mass(self, **kw):
        base = dict(densities_g_cm3={'steel': 7.85, 'aluminium': 2.7}, tolerance={'rel': 0.1},
                    groups=[dict(id='g1', published={'value': 100, 'unit': 'g'}, patterns=['^A'], tolerance={'rel': 0.1}), dict(id='g2', patterns=['^B'], at_most={'value': 1, 'unit': 'lb'})])
        base.update(kw)
        return check('mass', **base)

    def run_with(self, parts, **kw):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / 'g.json').write_text(json.dumps(dict(parts=parts)))
            return C.run(doc(self.mass(volumes={'geometry': 'g.json'}, **kw)), Path(d))['checks'][0]

    def test_groups_within_tolerance_and_an_upper_bound(self):
        r = self.run_with([dict(id='A1', material='steel', volume_mm3=12000), dict(id='B1', material='aluminium', volume_mm3=100000), dict(id='Z', material='steel', volume_mm3=1000)])
        self.assertEqual(r['state'], 'pass', r['detail'])                                    # 94.2 g against 100 g; 270 g against 453.6 g
        self.assertEqual(r['values']['unassigned_g'], {'Z': round(1000 / 1000.0 * 7.85, 1)})

    def test_an_overweight_group_and_an_overweight_bound_fail(self):
        self.assertEqual(self.run_with([dict(id='A1', material='steel', volume_mm3=20000)])['state'], 'fail')
        self.assertEqual(self.run_with([dict(id='A1', material='steel', volume_mm3=12000), dict(id='B1', material='steel', volume_mm3=70000)])['state'], 'fail')

    def test_an_unpriced_material_makes_an_upper_bound_unknown(self):
        r = self.run_with([dict(id='A1', material='steel', volume_mm3=12000), dict(id='B1', material='gasket', volume_mm3=500)])
        self.assertEqual(r['state'], 'unknown')
        self.assertIn('gasket (1 parts)', r['detail'])

    def test_without_volumes_or_a_record_the_check_is_unknown_and_says_why(self):
        r = C.run(doc(self.mass(volumes={'geometry': 'absent.json'})), REPO)['checks'][0]
        self.assertEqual(r['state'], 'unknown')
        self.assertIn('not in Git', r['detail'])

    def test_volumes_on_the_command_line_win_over_the_declared_file(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / 'cli.json').write_text(json.dumps(dict(parts=[dict(id='A1', material='steel', volume_mm3=12000)])))
            r = C.run(doc(self.mass(volumes={'geometry': 'absent.json'}, groups=[dict(id='g1', published={'value': 100, 'unit': 'g'}, patterns=['^A'], tolerance={'rel': 0.1})])), Path(d), 'cli.json')['checks'][0]
        self.assertEqual(r['state'], 'pass')


class Validation(unittest.TestCase):
    def errors(self, d):
        return C.validate(d)

    def test_a_minimal_document_is_valid(self):
        self.assertEqual(self.errors(doc(check('compare', unknown='x'))), [])

    def test_every_check_needs_a_source_locator_and_a_tolerance_unless_unknown(self):
        bad = doc(dict(id='c', kind='displacement', title='t'))
        e = ' '.join(self.errors(bad))
        self.assertIn('source locator missing', e)
        self.assertIn('tolerance missing', e)
        ok = doc(dict(id='c', kind='displacement', title='t', source=SRC, unknown='nothing to read'))
        self.assertEqual(self.errors(ok), [])

    def test_the_locator_must_name_a_declared_source_and_say_where(self):
        e = ' '.join(self.errors(doc(check('compare', unknown='x', source=[{'source': 'nope', 'where': ''}]))))
        self.assertIn("'nope' is not declared", e)
        self.assertIn('needs `where`', e)

    def test_duplicate_ids_unknown_requires_empty_reasons_and_unlocated_bindings(self):
        d = doc(check('compare', 'a', unknown='x'), check('compare', 'a', unknown=' '), check('compare', 'b', unknown='x', requires=['zz']), bindings={'v': {'kind': 'json', 'path': 'p'}})
        e = ' '.join(self.errors(d))
        for want in ('duplicate check ids', '`unknown` must give the reason', "requires unknown check 'zz'", 'binding v: locator missing'):
            self.assertIn(want, e)

    def test_run_refuses_a_malformed_file(self):
        with self.assertRaises(C.ConstraintError):
            C.run(doc(dict(id='c', kind='nonsense', title='t', source=SRC)), REPO)


# ---------------------------------------------------------------------------------------------------------------------------- the committed studies

class Studies(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reports = {d.name: C.run(C.load(d / 'constraints.json'), REPO) for d in (LANGLEY, GTSIO)}

    def states(self, study):
        return {c['id']: c['state'] for c in self.reports[study]['checks']}

    def test_the_schema_file_lists_the_runners_kinds_and_states(self):
        schema = json.loads((REPO / 'cad_pipeline/schemas/constraints.schema.json').read_text())
        self.assertEqual(schema['$defs']['check']['properties']['kind']['enum'], list(C.KINDS))
        self.assertEqual(schema['properties']['schema']['const'], C.SCHEMA)

    def test_both_studies_run_clean(self):
        for name, r in self.reports.items():
            self.assertTrue(r['ok'], f'{name}: {[c for c in r["checks"] if c["state"] == "fail"]}')

    def test_every_check_carries_a_source_locator_and_a_checked_figure_or_a_reason(self):
        for name, r in self.reports.items():
            for c in r['checks']:
                self.assertTrue(c['source'], f'{name}/{c["id"]}')
                if c['state'] == 'unknown':
                    self.assertGreater(len(c['detail']), 30, f'{name}/{c["id"]}')

    def test_gtsio_published_figures_close(self):
        s = self.states('gtsio520-h-static')
        for cid in ('displacement-from-bore-stroke', 'propeller-rpm-to-engine-rpm', 'spec-bore-vs-manual', 'spec-stroke-vs-manual', 'spec-rod-length-vs-manual', 'viewer-throw-is-half-stroke',
                    'viewer-rod-length-vs-manual', 'cam-speed-closes-with-four-stroke-cycle', 'ratio-cam-half-crank-speed', 'ratio-propeller-reduction', 'ratio-magneto-left',
                    'ratio-magneto-right', 'ratio-governor', 'ratio-tachometer', 'ratio-alternator'):
            self.assertEqual(s[cid], 'pass', cid)

    def test_gtsio_motion_code_is_consistent_with_the_manuals_firing_order(self):
        """The worked first check: manual order, the viewer's order and the Python layout's order agree; the intervals are 120 degrees; each cylinder's top centre, from the spec's
        crank pins, the banks and the crank direction, falls where the order has it fire."""
        s = self.states('gtsio520-h-static')
        for cid in ('firing-order-in-motion-code', 'firing-intervals-python', 'firing-intervals-viewer', 'crankpin-k-belongs-to-cylinder-k', 'motion-pins-match-spec-crank',
                    'frame-up-is-plus-y', 'frame-forward-is-plus-z', 'tdc-vs-crank-pins'):
            self.assertEqual(s[cid], 'pass', cid)
        tdc = next(c for c in self.reports['gtsio520-h-static']['checks'] if c['id'] == 'tdc-vs-crank-pins')
        self.assertIn('crank turns anticlockwise about +Z', tdc['detail'])

    def test_gtsio_numbering_is_from_the_rear_but_the_banks_are_mirrored_and_that_is_accepted_and_reported(self):
        s = self.states('gtsio520-h-static')
        self.assertEqual(s['numbering-bank-side'], 'accepted')
        c = next(c for c in self.reports['gtsio520-h-static']['checks'] if c['id'] == 'numbering-bank-side')
        self.assertIn('odd cylinders on the left', c['detail'])
        self.assertIn('numbered from the rear', c['detail'])

    def test_gtsio_crank_direction_is_shown_but_not_judged(self):
        c = next(c for c in self.reports['gtsio520-h-static']['checks'] if c['id'] == 'crank-rotation-direction')
        self.assertEqual(c['state'], 'unknown')
        self.assertIn('model crank turns clockwise looking forward', c['detail'])

    def test_gtsio_unknowns_are_the_ones_with_no_readable_source_or_no_committed_input(self):
        unknown = {k for k, v in self.states('gtsio520-h-static').items() if v == 'unknown'}
        self.assertEqual(unknown, {'power-plank-pressure', 'mass-model-against-dry-weight', 'mass-by-group', 'ratio-vacuum-pump', 'ratio-starter', 'crank-rotation-direction',
                                   'compression-ratio-from-chamber'})

    def test_gtsio_mass_check_says_what_it_could_not_use(self):
        c = next(c for c in self.reports['gtsio520-h-static']['checks'] if c['id'] == 'mass-model-against-dry-weight')
        self.assertIn('not in Git', c['detail'])
        doc_ = C.load(GTSIO / 'constraints.json')
        mass = next(x for x in doc_['checks'] if x['id'] == 'mass-model-against-dry-weight')
        self.assertEqual(mass['groups'][0]['at_most'], {'value': 550.39, 'unit': 'lb'})
        self.assertAlmostEqual(550.39 * 453.59237, 249652.9, delta=0.5)

    def test_langley_states(self):
        s = self.states('langley-manly-balzer-1903')
        self.assertEqual({k: v for k, v in s.items() if k != 'mass-by-weight-line'}, {k: 'pass' for k in s if k != 'mass-by-weight-line'})
        self.assertEqual(s['mass-by-weight-line'], 'accepted')

    def test_the_cli_runs_every_study_and_exits_zero(self):
        run = subprocess.run([sys.executable, str(REPO / 'scripts/check_constraints.py'), '--all', '--quiet'], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertIn('gtsio520-h-static', run.stdout)
        self.assertIn('langley-manly-balzer-1903', run.stdout)

    def test_the_cli_fails_on_a_failing_check(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d, 'c.json')
            p.write_text(json.dumps(doc(check('formula', vars={'a': 1}, expr='a > 2', expect={'true': True}))))
            run = subprocess.run([sys.executable, str(REPO / 'scripts/check_constraints.py'), str(p)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 1)
        self.assertIn('FAIL', run.stdout)


if __name__ == '__main__':
    unittest.main()
