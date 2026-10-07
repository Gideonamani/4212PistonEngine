"""The knowledge store (knowledge/): part cards and metrics must agree with the studies they describe.

Standard library only. Run: python3 scripts/test_knowledge_store.py

Three kinds of test. The cards validate. Each card number that has a counterpart in a study's part-spec.json equals it, so a card cannot
drift from the spec quietly. And the validator is mutation-tested: a card with a deliberate defect must be rejected, because a check that
has never been seen to fail proves nothing.
"""
import copy
import csv
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cad_pipeline.intent import part_card as pc

WS, LS = 'wright-1903/revision-2', 'langley-manly-balzer-1903'

# (variant id, card dimension name, study, part-spec parameter)
SPEC_LINKS = [
    ('piston/domed-two-rib-cast-iron', 'bore', LS, 'bore'),
    ('piston/domed-two-rib-cast-iron', 'diametral clearance at the middle', LS, 'piston_clearance_diametral'),
    ('piston/domed-two-rib-cast-iron', 'gudgeon pin diameter', LS, 'gudgeon_pin_diameter'),
    ('piston/long-trunk-three-ring-cast-iron', 'bore', WS, 'bore'),
    ('piston/long-trunk-three-ring-cast-iron', 'piston length', WS, 'piston_length'),
    ('piston/long-trunk-three-ring-cast-iron', 'crown offset above the pin', WS, 'piston_head_offset'),
    ('piston/long-trunk-three-ring-cast-iron', 'diametral clearance', WS, 'piston_clearance'),
    ('connecting-rod/master-and-link-slipper-shoe', 'rod diameter', LS, 'rod_diameter'),
    ('connecting-rod/master-and-link-slipper-shoe', 'link rod bore', LS, 'link_rod_hole'),
    ('connecting-rod/master-and-link-slipper-shoe', 'crank radius', LS, 'crank_radius'),
    ('connecting-rod/master-and-link-slipper-shoe', 'rod length, gudgeon axis to crank pin axis', LS, 'rod_length'),
    ('connecting-rod/master-and-link-slipper-shoe', 'shoe angular width', LS, 'shoe_angular_width'),
    ('connecting-rod/three-piece-tube-and-bronze-ends', 'rod length', WS, 'rod_length'),
    ('valve/open-cage-separate-head-poppet', 'head diameter', WS, 'valve_diameter'),
    ('valve/open-cage-separate-head-poppet', 'lift', WS, 'valve_lift'),
    ('valve/open-cage-separate-head-poppet', 'valve box radius', WS, 'valve_box_radius'),
    ('valve/open-cage-separate-head-poppet', 'stem radius', WS, 'valve_stem_radius'),
    ('valve/open-cage-separate-head-poppet', 'spring wire diameter', WS, 'spring_wire'),
    ('valve/one-piece-revolved-poppet-automatic-inlet-punch-rod-exhaust', 'punch rod gap at rest', LS, 'punch_rod_gap'),
    ('valve/one-piece-revolved-poppet-automatic-inlet-punch-rod-exhaust', 'valve axis offset from the cylinder axis', LS, 'valve_axis_x'),
    ('cam/separate-lobes-on-hollow-shaft', 'crank sprocket teeth', WS, 'crank_teeth'),
    ('cam/separate-lobes-on-hollow-shaft', 'cam sprocket teeth', WS, 'cam_teeth'),
    ('cam/separate-lobes-on-hollow-shaft', 'lobe base radius', WS, 'cam_base_radius'),
    ('cam/annular-double-lobe-ring-cam', 'speed ratio, cam over crank', LS, 'cam_gear_ratio'),
    ('cam/annular-double-lobe-ring-cam', 'punch rod gap at rest', LS, 'punch_rod_gap'),
    ('cam/annular-double-lobe-ring-cam', 'cam rise', LS, 'cam_rise'),
    ('cam/annular-double-lobe-ring-cam', 'lobe half width', LS, 'cam_lobe_half_width'),
    ('gear/spur-train-solved-ratio', 'cam train net ratio', LS, 'cam_gear_ratio'),
    ('gear/spur-train-solved-ratio', 'cam train module', LS, 'cam_train_module'),
    ('gear/spur-train-solved-ratio', 'sparker cam speed over crank speed', LS, 'ignition_gear_ratios'),
]


def variants():
    return {v['id']: v for card in pc.load_cards() for v in card['variants']}


def spec_parameters(study):
    return json.loads((ROOT / 'cad-studies' / study / 'part-spec.json').read_text(encoding='utf-8'))['parameters']


class SeedCards(unittest.TestCase):
    def test_every_card_validates(self):
        self.assertEqual(pc.validate_all(), [])

    def test_the_five_seed_families_exist_and_every_variant_has_an_instance(self):
        families = {c['family'] for c in pc.load_cards()}
        self.assertTrue({'piston', 'connecting-rod', 'valve', 'cam', 'gear'} <= families)
        for v in variants().values():
            self.assertTrue(v['instances'], v['id'])

    def test_card_numbers_equal_the_study_spec(self):
        vs = variants()
        for vid, name, study, parameter in SPEC_LINKS:
            dim = next(d for d in vs[vid]['dimensions'] if d['name'] == name)
            spec = spec_parameters(study)[parameter]
            self.assertAlmostEqual(dim['value'], spec['value'], places=6, msg=f'{vid}: {name} against {parameter}')
            allowed = {spec['status']} | ({'derived', 'illustrative'} if spec['status'] == 'inferred' else set())
            self.assertIn(dim['status'], allowed, f'{vid}: {name} is {dim["status"]} but the spec says {spec["status"]}')

    def test_the_gear_recipe_exists_and_is_the_shared_module(self):
        for vid in ('gear/ignition-spur-pair-sliding-sleeve', 'gear/spur-train-solved-ratio'):
            recipe = variants()[vid]['recipe']
            self.assertEqual((recipe['status'], recipe['path']), ('extracted', 'scripts/gear_geometry.py'))

    def test_gallery_lists_every_variant(self):
        self.assertEqual(len(pc.gallery()), len(variants()))


class ValidatorRejectsDefects(unittest.TestCase):
    """Each case breaks one thing in a copy of a real card and requires the validator to say so."""

    def card(self, family='piston'):
        return copy.deepcopy(json.loads((pc.CARDS / f'{family}.json').read_text(encoding='utf-8')))

    def errors(self, card):
        return '\n'.join(pc.validate_card(card, {}))

    def test_unknown_part_id(self):
        card = self.card()
        card['variants'][0]['instances'][0]['part_ids'].append('Piston99')
        self.assertIn('Piston99', self.errors(card))

    def test_part_id_outside_the_named_component(self):
        card = self.card()
        card['variants'][0]['instances'][0]['part_ids'].append('InletValve1')      # a real part, but not in L09
        self.assertIn('not in the named components', self.errors(card))

    def test_unknown_inventory_component(self):
        card = self.card()
        card['variants'][0]['instances'][0]['components'] = ['L99']
        self.assertIn('L99', self.errors(card))

    def test_unknown_study(self):
        card = self.card()
        card['variants'][0]['instances'][0]['study'] = 'no-such-study'
        self.assertIn('unknown study', self.errors(card))

    def test_unknown_source_id(self):
        card = self.card()
        card['variants'][0]['dimensions'][0]['evidence'][0]['source'] = 'Z9'
        self.assertIn("'Z9'", self.errors(card))

    def test_specified_dimension_without_evidence(self):
        card = self.card()
        del card['variants'][0]['dimensions'][0]['evidence']
        self.assertIn('evidence must be a non-empty list', self.errors(card))

    def test_inferred_dimension_without_basis(self):
        card = self.card()
        dims = card['variants'][1]['dimensions']
        inferred = next(d for d in dims if d['status'] == 'inferred')
        del inferred['basis']
        self.assertIn('needs a basis', self.errors(card))

    def test_unknown_dimension_status(self):
        card = self.card()
        card['variants'][0]['dimensions'][0]['status'] = 'probably'
        self.assertIn('is not one of', self.errors(card))

    def test_unknown_primitive(self):
        card = self.card()
        card['variants'][0]['construction'][1]['primitive'] = 'blob'
        self.assertIn("primitive 'blob'", self.errors(card))

    def test_first_construction_step_must_add(self):
        card = self.card()
        card['variants'][0]['construction'][0]['operation'] = 'cut'
        self.assertIn('first step must add material', self.errors(card))

    def test_unknown_interface_kind(self):
        card = self.card()
        card['variants'][0]['function']['interfaces'][0]['kind'] = 'glued'
        self.assertIn("kind 'glued'", self.errors(card))

    def test_variant_id_must_start_with_the_family(self):
        card = self.card()
        card['variants'][0]['id'] = 'valve/domed-two-rib-cast-iron'
        self.assertIn('id must start with "piston/"', self.errors(card))

    def test_recipe_path_must_exist(self):
        card = self.card('gear')
        card['variants'][0]['recipe']['path'] = 'scripts/no_such_module.py'
        self.assertIn('does not exist', self.errors(card))

    def test_variant_needs_an_instance(self):
        card = self.card()
        card['variants'][0]['instances'] = []
        self.assertIn('built at least once', self.errors(card))

    def test_duplicate_variant_ids_across_files_are_rejected(self):
        a = self.card('piston')
        b = copy.deepcopy(a)
        b['family'] = 'piston'
        self.assertIn('duplicate variant id', '\n'.join(pc.validate_card({**a, 'variants': a['variants'] + b['variants']}, {})))


class Metrics(unittest.TestCase):
    COLUMNS = ['study', 'recorded', 'parts', 'native_features', 'cold_build_minutes', 'rest_pairs_audited', 'clip_poses_audited',
               'overlaps_in_final_audit', 'parameters_specified', 'parameters_measured', 'parameters_inferred', 'reuse_ratio',
               'rung9_residual', 'mass_vs_weight_table', 'notes']

    def rows(self):
        with open(ROOT / 'knowledge' / 'metrics.csv', encoding='utf-8', newline='') as f:
            return list(csv.DictReader(f))

    def test_columns_and_baseline_studies(self):
        with open(ROOT / 'knowledge' / 'metrics.csv', encoding='utf-8', newline='') as f:
            self.assertEqual(next(csv.reader(f)), self.COLUMNS)
        self.assertEqual({r['study'] for r in self.rows()}, {WS, LS})

    def test_numbers_match_the_study_records(self):
        for row in self.rows():
            base = ROOT / 'cad-studies' / row['study']
            audit = json.loads((base / 'interference-audit.json').read_text(encoding='utf-8'))
            spec = json.loads((base / 'part-spec.json').read_text(encoding='utf-8'))
            self.assertEqual(int(row['parts']), len(spec['parts']), row['study'])
            self.assertEqual(int(row['parts']), audit['parts'], row['study'])
            self.assertEqual(int(row['rest_pairs_audited']), audit['rest_neighbouring_pairs'], row['study'])
            self.assertEqual(int(row['overlaps_in_final_audit']), audit['overlaps_total'], row['study'])
            self.assertEqual(int(row['clip_poses_audited']), sum(c['poses'] for c in audit['clips'].values()), row['study'])
            counts = {}
            for p in spec['parameters'].values():
                counts[p['status']] = counts.get(p['status'], 0) + 1
            for status in ('specified', 'measured', 'inferred'):
                self.assertEqual(int(row[f'parameters_{status}']), counts.get(status, 0), f'{row["study"]} {status}')

    def test_blank_cells_are_blank_not_zero(self):
        for row in self.rows():
            self.assertEqual(row['reuse_ratio'], '', 'no recipes existed when these studies were built')
            self.assertEqual(row['rung9_residual'], '')


if __name__ == '__main__':
    unittest.main()
