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
from cad_pipeline.intent import part_store as ps

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


class PartStore(unittest.TestCase):
    """The part store (knowledge/part-cards/parts, docs/part-store.md): it validates, nothing is left unmapped, and the old register is accounted for."""

    @classmethod
    def setUpClass(cls):
        cls.loaded = ps.load_store()
        cls.part_ids = {doc['model']: ps.model_part_ids(doc) for doc in cls.loaded['instances']}

    def test_the_store_validates(self):
        self.assertEqual(ps.validate_store_data(self.loaded), [])

    def test_the_committed_store_carries_no_catalogue_rows_or_part_numbers(self):
        self.assertEqual(ps.committed_text_problems(), [])

    def test_lesson_mentions_are_current(self):
        self.assertEqual(ps.stale_lessons(self.loaded), [], 'run: python -m cad_pipeline.intent.part_store --refresh-lessons')

    def test_every_part_of_both_models_maps_to_one_definition(self):
        self.assertEqual({m: len(ids) for m, ids in self.part_ids.items()}, {'cylinder': 61, 'gtsio520-h-r10-mechanism-study': 1396})
        for doc in self.loaded['instances']:
            hits, unmatched, ambiguous = ps.resolve_instances(doc, self.part_ids[doc['model']])
            self.assertEqual((unmatched, ambiguous), ([], []), doc['model'])
            self.assertEqual(len(hits), len(self.part_ids[doc['model']]))
        components = json.loads((ROOT / 'web' / 'components.json').read_text(encoding='utf-8'))
        self.assertEqual(sorted(self.part_ids['cylinder']), sorted(p['cad_stable_id'] for p in components['parts']))

    def test_every_value_of_the_retired_table_is_accounted_for(self):
        legacy = [(v['part'], v['field'], v) for d in self.loaded['definitions'] for v in d['engineering'].get('legacyValues', [])]
        self.assertEqual(len(legacy), 56, '28 parts x material and operating conditions')
        self.assertEqual(len({(part, field) for part, field, _ in legacy}), 56)
        self.assertEqual({field for _, field, _ in legacy}, {'material', 'operatingConditions'})
        self.assertEqual(len({part for part, _, _ in legacy}), 28)
        for part, field, value in legacy:
            self.assertIn(value['disposition'], ('kept', 'dropped'))
            self.assertIn(value['status'], ps.ENGINEERING_STATUS, f'{part}.{field}')
            if value['status'] == 'unsourced':
                self.assertEqual(value['disposition'], 'dropped', f'{part}.{field}: an unsourced value must not reach a learner')
        # The cylinder's learner text uses none of the unsourced values.
        ours = {part for part, _, v in legacy if v['status'] == 'unsourced'}
        self.assertTrue(ours, 'most of the old table was unsourced')

    def test_the_two_models_share_one_set_of_definitions_and_a_definition_is_in_one_set(self):
        self.assertEqual(len(self.loaded['definitions']), len({d['id'] for d in self.loaded['definitions']}))
        self.assertEqual(len(self.loaded['definitions']), 191)

    def test_systems_are_flat(self):
        for system in self.loaded['store']['systems']:
            self.assertEqual(set(system), {'id', 'label', 'question'}, system.get('id'))

    def test_a_dropped_value_is_never_quoted_in_what_a_learner_reads(self):
        dropped = [v['text'] for d in self.loaded['definitions'] for v in d['engineering'].get('legacyValues', []) if v['disposition'] == 'dropped']
        learner = [t for d in self.loaded['definitions'] for t in ps._all_text(d['student'])]
        learner += [t for doc in self.loaded['instances'] for row in doc.get('parts', []) for t in ps._all_text(row.get('claims', {}))]
        for text in dropped:
            self.assertNotIn(text, learner)


class PartStoreRejectsDefects(unittest.TestCase):
    """Each case breaks one thing in a copy of the real store and requires the validator to say so (a check never seen to fail proves nothing)."""

    @classmethod
    def setUpClass(cls):
        cls.loaded = ps.load_store()
        cls.part_ids = {doc['model']: ps.model_part_ids(doc) for doc in cls.loaded['instances']}
        cls.variants = ps._family_variants()

    def errors(self, mutate):
        loaded = copy.deepcopy(self.loaded)
        mutate(loaded)
        return '\n'.join(ps.validate_store_data(loaded, self.part_ids, variants=self.variants))

    @staticmethod
    def definition(loaded, did):
        return next(d for d in loaded['definitions'] if d['id'] == did)

    @staticmethod
    def instance(loaded, model):
        return next(doc for doc in loaded['instances'] if doc['model'] == model)

    def row(self, loaded, pid):
        return next(row for row in self.instance(loaded, 'cylinder')['parts'] if row['id'] == pid)

    def rejects(self, mutate, expected):
        self.assertIn(expected, self.errors(mutate))

    # --- claims
    def test_an_unknown_status(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['function'].update(status='verified'), 'is not one of')

    def test_a_learner_claim_may_not_be_unsourced(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['function'].update(status='unsourced'), 'is not one of')

    def test_a_specified_claim_without_a_source(self):
        def mutate(s):
            claim = self.definition(s, 'compression-ring')['student']['function']
            claim['status'] = 'specified'
            claim.pop('source', None)
        self.rejects(mutate, 'needs a source')

    def test_an_inferred_claim_without_a_basis(self):
        def mutate(s):
            claim = self.definition(s, 'compression-ring')['student']['madeOf']
            claim['status'] = 'inferred'
            claim.pop('source', None)
            claim.pop('basis', None)
        self.rejects(mutate, 'needs a basis')

    def test_a_claim_with_both_a_source_and_a_basis(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['function'].update(basis='because'), 'both a source and a basis')

    def test_a_part_number_in_learner_text(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['function'].update(text='Seals the gas, part 12345A.'), 'text matches')

    def test_a_specification_in_learner_text(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['madeOf'].update(text='AMS 4130 steel'), 'text matches')

    def test_placeholder_text_is_refused_everywhere(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['sits'].update(text='to be written'), 'text matches')

    def test_a_catalogue_number_in_a_source(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['function'].update(source='IO-520 catalogue item 654321'), 'cites a part number')

    def test_too_many_words(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['title'].update(text='A very long title indeed'), 'words, limit 4')

    def test_a_digit_in_a_title(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student']['title'].update(text='Ring 2'), 'sizes and specifications go in the catalogue line')

    def test_a_look_for_prompt_must_be_illustrative(self):
        def mutate(s):
            claim = self.definition(s, 'compression-ring')['student']['lookFor']
            claim.update(status='inferred', basis='a guess')
            claim.pop('source', None)
        self.rejects(mutate, 'must be illustrative')

    # --- names, links and systems
    def test_a_shared_title_needs_a_context(self):
        loaded = copy.deepcopy(self.loaded)
        counts = {}
        for d in loaded['definitions']:
            counts[d['student']['title']['text']] = counts.get(d['student']['title']['text'], 0) + 1
        shared = next(t for t, n in counts.items() if n > 1)
        victim = next(d for d in loaded['definitions'] if d['student']['title']['text'] == shared)
        victim['student'].pop('context', None)
        self.assertIn('is shared, so it needs a context', '\n'.join(ps.validate_store_data(loaded, self.part_ids, variants=self.variants)))

    def test_a_unique_title_must_not_have_a_context(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student'].update(context='top'), 'its title is unique')

    def test_works_with_needs_one_to_six_known_other_definitions(self):
        works = lambda s: self.definition(s, 'compression-ring')['student']['worksWith']
        self.rejects(lambda s: works(s).update(ids=[]), 'needs one to six ids')
        self.rejects(lambda s: works(s).update(ids=['piston'] * 7), 'needs one to six ids')
        self.rejects(lambda s: works(s).update(ids=['no-such-part']), 'unknown definition')
        self.rejects(lambda s: works(s).update(ids=['compression-ring']), 'lists itself')

    def test_a_definition_in_no_system(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['student'].update(system='nowhere'), 'is not one of the store systems')

    def test_systems_stay_flat(self):
        self.rejects(lambda s: s['store']['systems'][0].update(parent='power'), 'must be flat')

    def test_a_duplicate_definition_id(self):
        self.rejects(lambda s: s['sets'][0]['definitions'].append(copy.deepcopy(self.definition(s, 'crankshaft'))) or s['definitions'].append(copy.deepcopy(self.definition(s, 'crankshaft'))), 'duplicate definition id')

    def test_an_unknown_variant(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['engineering'].update(variant='piston/no-such-variant'), 'is not a variant')

    # --- engineering block and the older register
    def test_the_catalogue_rows_stay_out_of_the_committed_store(self):
        for key in ('ipcIo520', 'gtsioOnlineIpcH1b', 'priorData', 'note'):
            self.rejects(lambda s, key=key: self.definition(s, 'compression-ring')['engineering'].update({key: []}), 'must not be in the committed store')

    def test_alignment_must_agree_with_the_manual_keys(self):
        self.rejects(lambda s: self.definition(s, 'compression-ring')['engineering'].update(gtsioManual=[]), 'there is no GTSIO manual reference')
        self.rejects(lambda s: self.definition(s, 'compression-ring')['engineering']['alignment'].update(result='probably'), 'alignment')

    def test_a_retired_value_needs_its_evidence_and_a_fate(self):
        def legacy(s):
            d = next(d for d in s['definitions'] if d['engineering'].get('legacyValues'))
            return d['engineering']['legacyValues'][0]
        self.rejects(lambda s: legacy(s).update(disposition='maybe'), 'disposition must be kept or dropped')
        self.rejects(lambda s: legacy(s).update(status='unsourced') or legacy(s).pop('basis', None), 'needs a basis')
        self.rejects(lambda s: legacy(s).update(status='specified') or legacy(s).pop('source', None), 'needs a source')
        self.rejects(lambda s: legacy(s).update(status='made-up'), 'is not one of')

    # --- review gates
    def test_a_reviewed_record_needs_a_reviewer_and_a_date(self):
        self.rejects(lambda s: self.definition(s, 'crankshaft').update(review='reviewed'), 'needs reviewed_by')
        self.rejects(lambda s: self.definition(s, 'crankshaft').update(review='reviewed', reviewed_by='A. Instructor', reviewed_on='yesterday'), 'YYYY-MM-DD')

    def test_a_properly_reviewed_definition_is_accepted(self):
        self.assertEqual(self.errors(lambda s: self.definition(s, 'crankshaft').update(review='reviewed', reviewed_by='A. Instructor', reviewed_on='2026-10-20')), '')

    def test_a_reviewed_record_may_not_keep_an_unsourced_value(self):
        def mutate(s):
            d = next(d for d in s['definitions'] if any(v['status'] == 'unsourced' for v in d['engineering'].get('legacyValues', [])))
            d.update(review='reviewed', reviewed_by='A. Instructor', reviewed_on='2026-10-20')
        self.rejects(mutate, 'may not keep unsourced values')

    def test_an_instance_may_not_be_reviewed_under_a_draft_definition(self):
        self.rejects(lambda s: self.row(s, 'PistonRing1').update(review='reviewed', reviewed_by='A. Instructor', reviewed_on='2026-10-20'), 'is a draft')

    def test_own_wording_under_a_reviewed_definition_needs_its_own_review(self):
        def mutate(s):
            self.definition(s, 'compression-ring').update(review='reviewed', reviewed_by='A. Instructor', reviewed_on='2026-10-20')
            self.row(s, 'PistonRing1').pop('review')
        self.rejects(mutate, 'needs a review state of its own')

    # --- instances
    def test_a_part_with_no_definition(self):
        self.rejects(lambda s: self.instance(s, 'cylinder')['parts'].pop(0), 'map to no definition')

    def test_a_part_with_two_definitions(self):
        self.rejects(lambda s: self.instance(s, 'gtsio520-h-r10-mechanism-study')['rules'].append(copy.deepcopy(self.instance(s, 'gtsio520-h-r10-mechanism-study')['rules'][0])), 'map to several definitions')

    def test_a_rule_that_matches_nothing(self):
        self.rejects(lambda s: self.instance(s, 'gtsio520-h-r10-mechanism-study')['rules'].append({'definition': 'crankshaft', 'match': ['NoSuchPartAnywhere']}), 'matches no part of the model')

    def test_an_explicit_row_must_name_a_part_and_a_definition(self):
        self.rejects(lambda s: self.row(s, 'PistonRing1').update(definition='no-such-definition'), 'unknown definition')
        self.rejects(lambda s: self.instance(s, 'cylinder')['parts'].append({'id': 'NoSuchPart', 'definition': 'piston'}), 'not a part id of the model')

    def test_a_part_may_have_only_one_explicit_row(self):
        self.rejects(lambda s: self.instance(s, 'cylinder')['parts'].append(copy.deepcopy(self.row(s, 'PistonRing1'))), 'two explicit rows')

    def test_a_row_may_override_only_function_made_of_and_sits(self):
        self.rejects(lambda s: self.row(s, 'PistonRing1')['claims'].update(lookFor={'text': 'Look at it.', 'status': 'illustrative', 'basis': 'a prompt'}), 'claims may override only')

    def test_a_row_in_no_known_system(self):
        self.rejects(lambda s: self.row(s, 'PistonRing1').update(system='nowhere'), 'is not one of the store systems')

    def test_a_bad_projection_schema(self):
        self.rejects(lambda s: self.instance(s, 'cylinder')['projection'].update(schema='cylinder'), 'must end in -parts')

    def test_two_instance_files_for_one_model(self):
        self.rejects(lambda s: s['instances'].append(copy.deepcopy(self.instance(s, 'cylinder'))), 'two instance files for one model')

    def test_a_definition_no_model_uses(self):
        def mutate(s):
            orphan = copy.deepcopy(self.definition(s, 'crankshaft'))
            orphan['id'] = 'orphan-part'
            orphan['student']['title']['text'] = 'Orphan part'
            orphan['student'].pop('context', None)
            s['sets'][0]['definitions'].append(orphan)
            s['definitions'].append(orphan)
        self.rejects(mutate, 'orphan-part: no model uses this definition')


if __name__ == '__main__':
    unittest.main()
