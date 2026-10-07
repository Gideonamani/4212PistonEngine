"""Langley / Manly-Balzer research checks that need only the standard library, so CI can run them.

They test that the documented numbers close against each other (displacement, power, weight table, cam and firing order,
ignition ratios, shoe clearance) and that the research inventory is complete, before any CAD exists.

Run: python3 scripts/test_langley_research.py
"""
import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cad_pipeline import langley_research as lr
from cad_pipeline.research_gate import review

STUDY = Path(__file__).resolve().parents[1] / 'cad-studies/langley-manly-balzer-1903'
IN = 25.4
BORE, STROKE = 5 * IN, 5.5 * IN


def firing_closure(cam_ratio, lobes=2, cylinders=5):
    """Do the exhaust events of the documented firing order meet a cam lobe? cam_ratio is cam speed over crank speed."""
    step = 720 / cylinders                                    # crank degrees between firing events
    pos = lambda k: 360 / cylinders * k                       # cylinder k, numbered in the direction of crank rotation
    # cylinder k fires when the crank angle is pos(k) + 360 e (mod 720): the sequence steps round the ring by one firing step
    order = []
    for m in range(cylinders):
        t = step * m
        k = [k for k in range(cylinders) if (pos(k) - t) % 360 < 1e-9][0]
        order.append(k)
    pitch = 360 / lobes
    # the lobe must be under the follower of cylinder k at the exhaust time t + d: pos(k) = alpha0 + cam_ratio * (t + d) (mod pitch)
    offsets = [(pos(k) - cam_ratio * step * m) % pitch for m, k in enumerate(order)]
    spread = max(min(abs(o - offsets[0]) % pitch, pitch - abs(o - offsets[0]) % pitch) for o in offsets)
    return [k + 1 for k in order], spread


def min_rod_separation(r_over_l):
    """Smallest angle between two rods 72 degrees apart over the whole revolution."""
    low = 1e9
    for i in range(7200):
        th = math.radians(i / 10)
        beta = lambda phi: -math.asin(r_over_l * math.sin(th - phi))
        low = min(low, 72 + math.degrees(beta(math.radians(72)) - beta(0.0)))
    return low


class Numbers(unittest.TestCase):
    def test_displacement_closes(self):
        litres = 5 * math.pi / 4 * BORE ** 2 * STROKE / 1e6
        self.assertAlmostEqual(litres, 8.848, places=3)
        self.assertAlmostEqual(litres / 0.016387064, 539.96, delta=0.05)           # the Annals print 540.2 cu in

    def test_documented_power_follows_from_the_test_record(self):
        hp = 2 * math.pi * 950 * (267 * 13 / 12) / 33000
        self.assertAlmostEqual(hp, 52.4, delta=0.15)
        area, stroke_ft = math.pi / 4 * 25, 5.5 / 12
        bmep = 52.4 * 33000 / (stroke_ft * area * 5 * 950 / 2)
        self.assertTrue(75 <= bmep <= 85)                                           # Manly expected 75-80 psi (A1 p. 93)

    def test_weight_table_total_has_exactly_the_recorded_misprint(self):
        inv = json.loads((STUDY / 'inventory.json').read_text())
        info = lr.check_weight_coverage(inv)
        self.assertEqual(info['misprint_grams'], 65)                                # 5,005 printed for the rods, 5,070 needed
        self.assertAlmostEqual(56323 / 453.59237, 124.17, places=2)
        engine = sum(w[2] for w in lr.WEIGHT_TABLE if w[3])
        flywheels = sum(w[2] for w in lr.WEIGHT_TABLE if w[0] in ('W14', 'W15'))
        self.assertEqual(lr.PRINTED_TOTALS['engine'] + flywheels, lr.PRINTED_TOTALS['engine_and_flywheels'])
        accessories = sum(w[2] for w in lr.WEIGHT_TABLE if w[0] not in [x[0] for x in lr.WEIGHT_TABLE if x[3]] + ['W14', 'W15'])
        self.assertEqual(lr.PRINTED_TOTALS['engine_and_flywheels'] + accessories, lr.PRINTED_TOTALS['power_plant'])
        self.assertEqual(engine + 65, lr.PRINTED_TOTALS['engine'])
        self.assertAlmostEqual(52.4 / 124.17, 0.42, places=2)


class Motion(unittest.TestCase):
    def test_reverse_quarter_speed_two_lobe_cam_closes_with_firing_order_1_3_5_2_4(self):
        order, spread = firing_closure(-0.25)
        self.assertEqual(order, [1, 3, 5, 2, 4])
        self.assertLess(spread, 1e-6)

    def test_a_forward_cam_does_not_close(self):
        _, spread = firing_closure(+0.25)
        self.assertGreater(spread, 10)

    def test_a_half_speed_cam_is_not_the_documented_one(self):
        self.assertGreater(firing_closure(-0.5)[1], 10)

    def test_ignition_ratios_close_with_the_firing_interval(self):
        breaks_per_two_revolutions = 2.5 * 2 * 1                                    # 2.5x crank speed, one lobe
        self.assertEqual(breaks_per_two_revolutions, 5)
        self.assertEqual(720 / breaks_per_two_revolutions, 720 / 5)                 # 144 degrees, the firing interval
        self.assertEqual(0.5 * 720, 360)                                            # the distributor turns half a turn per cycle
        # the distributor shifts one commutator section per firing event: 360 degrees / 5 per 144 crank degrees = 0.5 x
        self.assertAlmostEqual((360 / 5) / 144, 0.5)

    def test_shoe_clearance_bounds_the_rod_length(self):
        self.assertAlmostEqual(min_rod_separation(0.15), 61.88, places=1)
        self.assertAlmostEqual(min_rod_separation(0.25), 55.10, places=1)
        self.assertAlmostEqual(min_rod_separation(0.30), 51.69, places=1)
        r = STROKE / 2
        # a 59 degree shoe needs r/L under about 0.193: L over 360 mm, which the 37 in (470 mm radius) envelope makes doubtful
        self.assertGreater(r / 0.193, 360)
        self.assertLess(min_rod_separation(r / 363), 59.1)


class Inventory(unittest.TestCase):
    inv = lr.build()

    def test_gate_passes_and_every_weight_table_line_has_a_component(self):
        self.assertTrue(review(self.inv)['passed'])
        lr.check_weight_coverage(self.inv)

    def test_engine_proper_lines_are_modelled_or_simplified(self):
        for w in lr.WEIGHT_TABLE:
            comps = [c for c in self.inv['components'] if w[0] in c['covers']]
            self.assertTrue(comps, w[0])
            if w[3]:
                self.assertTrue(any(c['disposition'] in ('modelled', 'simplified') for c in comps), w[0])
            else:
                self.assertTrue(all(c['disposition'] in ('deferred', 'outside_scope', 'simplified', 'modelled') for c in comps), w[0])
                if w[0] in ('W14', 'W15'):                                          # flywheels are in scope (user decision, 6 October 2026)
                    self.assertTrue(any(c['disposition'] == 'modelled' for c in comps), w[0])

    def test_part_ids_are_unique(self):
        ids = [p for c in self.inv['components'] for p in c['part_ids']]
        self.assertEqual(len(ids), len(set(ids)))

    def test_committed_inventory_is_current(self):
        # The hashes of the local source copies (build/langley-research, ignored) exist only on the machine that holds the PDFs.
        def portable(inventory):
            inventory = json.loads(json.dumps(inventory))
            for source in inventory['sources'].values():
                source.pop('local_files', None)
            return inventory
        committed = json.loads((STUDY / 'inventory.json').read_text())
        self.assertEqual(portable(committed), portable(self.inv))

    def test_mechanisms_name_documented_ratios(self):
        text = json.dumps(self.inv['mechanisms'])
        for token in ('-1/4', '2.5x', '0.5x', '1/64', '1-3-5-2-4', '3x'):
            self.assertIn(token, text, token)


class Grouping(unittest.TestCase):
    """The viewer's tree: seven systems, each with a few assemblies, then the parts (cad_pipeline/langley_contract.py)."""

    @classmethod
    def setUpClass(cls):
        from cad_pipeline import langley_contract as lc
        cls.lc = lc
        cls.parts = [p['id'] for p in json.loads((STUDY / 'part-spec.json').read_text())['parts']]

    def test_every_part_matches_exactly_one_assembly_rule(self):
        for part in self.parts:
            hits = [aid for aid, _, pattern in self.lc._ASSEMBLY_RULES if pattern.match(part)]
            self.assertEqual(len(hits), 1, f'{part}: {hits}')

    def test_seven_systems_and_no_empty_assembly(self):
        self.assertEqual([sid for sid, _, _ in self.lc.SYSTEMS], ['structure', 'power', 'gas', 'ignition', 'cooling', 'lubrication', 'output'])
        used = {self.lc.assembly_of(part)[1] for part in self.parts}
        self.assertEqual(used, {aid for aid, _, _, _ in self.lc.ASSEMBLIES}, 'every assembly holds a part')
        self.assertLessEqual(len(self.lc.ASSEMBLIES), 32)
        self.assertEqual({sid for _, sid, _, _ in self.lc.ASSEMBLIES}, {sid for sid, _, _ in self.lc.SYSTEMS})

    def test_released_contract_tree_is_current(self):
        released = json.loads((STUDY.parents[1] / 'web/langley-manly-balzer-1903-contract.json').read_text())
        geometry = json.loads((STUDY / 'part-spec.json').read_text())
        rebuilt = self.lc.build(geometry, released['asset_sha256'], motions=released['motions'])
        self.assertEqual(released['groups'], json.loads(json.dumps(rebuilt['groups'])))
        self.assertEqual([(p['id'], p['group'], p['groups']) for p in released['parts']], [(p['id'], p['group'], p['groups']) for p in rebuilt['parts']])

    def test_the_story_chains_sit_together(self):
        place = lambda part: self.lc.assembly_of(part)
        self.assertEqual(place('ExhaustValve3')[0], place('PunchRod3')[0], 'valve and punch rod are in one system')
        self.assertEqual(place('InletValve1')[0], 'gas')
        self.assertEqual(place('Crankshaft')[0], 'power')
        self.assertEqual(place('WaterInletRing')[0], 'cooling')
        self.assertEqual(place('PumpBevelGear')[0], 'cooling')
        self.assertEqual(place('WormWheel')[0], 'output')
        self.assertEqual(place('CrankOilPipe')[0], 'lubrication')


if __name__ == '__main__':
    unittest.main()
