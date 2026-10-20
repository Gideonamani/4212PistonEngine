"""Fidelity classes: the schema field, the derivation rules, and the rule that no engineering part is left without a gate.

Standard library only, so CI can run it.

Run: python3 scripts/test_fidelity_classes.py
"""
import copy
import json
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from cad_pipeline import fidelity as fc
from cad_pipeline import fidelity_report as report
from cad_pipeline.spec import validate_spec

SHA = 'a' * 64
OTHER_SHA = 'b' * 64


def inputs(**kw):
    base = dict(parts=[{'id': p} for p in ('Shaft', 'Gear1', 'Gear2', 'Cover', 'Bolt', 'Housing')], moving={'Shaft', 'Gear1', 'Gear2'},
                gear={'Gear1': ['Gear1/Gear2'], 'Gear2': ['Gear1/Gear2']}, ledger=set(), mass={}, paths={'Housing': ['load']}, features={}, declared={}, overrides=[])
    base.update(kw)
    return base


def by_id(result):
    return {r['id']: r for r in result['parts']}


def audit_record(parts, sha=SHA, clip_moving=0, meshes=(), unverified=()):
    return {'name': 'fixture', 'audit': dict(asset_sha256=sha, parts=parts, unverified_parts=list(unverified),
                                              clips={'Operating': dict(moving_parts=clip_moving, poses=5, new_overlaps=0)} if clip_moving else {},
                                              gear_meshes=[dict(driver=a, driven=b, min_gap_mm=.1, required_mm=.02, ok=ok) for a, b, ok in meshes])}


class Schema(unittest.TestCase):
    spec = json.loads((REPO / 'cad-studies/langley-manly-balzer-1903/part-spec.json').read_text(encoding='utf-8'))
    schema = json.loads((REPO / 'cad_pipeline/schemas/part_spec.schema.json').read_text(encoding='utf-8'))

    def test_schema_names_the_three_classes_on_part_feature_and_dressup(self):
        defs = self.schema['$defs']
        self.assertEqual(set(defs['fidelity_class']['enum']), set(fc.CLASSES))
        for place in ('part', 'feature', 'dressup'):
            self.assertEqual(defs[place]['properties']['class'], {'$ref': '#/$defs/fidelity_class'}, place)

    def small(self):
        spec = copy.deepcopy(self.spec)
        spec['parts'] = spec['parts'][:3]
        return spec

    def test_validate_spec_accepts_declared_classes(self):
        spec = self.small()
        spec['parts'][0]['class'] = 'engineering'
        spec['parts'][0]['features'][0]['class'] = 'visual-structure'
        validate_spec(spec)

    def test_validate_spec_refuses_an_unknown_class(self):
        spec = self.small()
        spec['parts'][0]['class'] = 'critical'
        with self.assertRaisesRegex(ValueError, 'Unknown fidelity class'):
            validate_spec(spec)

    def test_a_part_cannot_be_less_critical_than_its_feature(self):
        spec = self.small()
        spec['parts'][0]['class'] = 'cosmetic'
        spec['parts'][0]['features'][0]['class'] = 'engineering'
        with self.assertRaisesRegex(ValueError, 'lower than the class'):
            validate_spec(spec)

    def test_the_tracked_specs_still_validate(self):
        validate_spec(self.spec)


class Rules(unittest.TestCase):
    def test_each_gate_signal_makes_a_part_engineering(self):
        rows = by_id(fc.classify(inputs(ledger={'Cover'}, mass={'Bolt': 'W09'})))
        self.assertEqual({k: r['class'] for k, r in rows.items()}, {'Shaft': 'engineering', 'Gear1': 'engineering', 'Gear2': 'engineering', 'Cover': 'engineering',
                                                                      'Bolt': 'engineering', 'Housing': 'engineering'})
        self.assertEqual(rows['Gear1']['why'], ['motion', 'gear'])
        self.assertEqual(rows['Cover']['why'], ['ledger'])
        self.assertEqual(rows['Bolt']['why'], ['mass:W09'])
        self.assertEqual(rows['Housing']['why'], ['path:load'])

    def test_a_part_no_gate_depends_on_is_visual_structure(self):
        rows = by_id(fc.classify(inputs()))
        self.assertEqual((rows['Cover']['class'], rows['Cover']['why']), ('visual-structure', ['default']))

    def test_an_interface_feature_makes_its_part_engineering(self):
        rows = by_id(fc.classify(inputs(features={'Cover': [{'label': 'Rib'}, {'label': 'Stud bore'}]})))
        self.assertEqual((rows['Cover']['class'], rows['Cover']['why'], rows['Cover']['features']), ('engineering', ['feature'], 'VE'))

    def test_a_rib_on_a_static_engineering_part_stays_visual_but_not_on_a_moving_one(self):
        rows = by_id(fc.classify(inputs(features={'Housing': [{'label': 'Reinforcing rib'}, {'label': ''}], 'Shaft': [{'label': 'Reinforcing rib'}]})))
        self.assertEqual(rows['Housing']['features'], 'VE')
        self.assertEqual(rows['Shaft']['features'], 'E', 'every outer surface of a moving part is in a clearance')

    def test_a_label_naming_a_chamfer_or_a_blend_is_cosmetic(self):
        rows = by_id(fc.classify(inputs(features={'Cover': [{'label': 'Edge break'}, {'label': 'Lettering'}, {'label': 'Rib'}]})))
        self.assertEqual((rows['Cover']['class'], rows['Cover']['features']), ('visual-structure', 'CCV'))

    def test_a_declared_class_lower_than_the_derived_one_is_a_conflict(self):
        result = fc.classify(inputs(declared={'Shaft': 'cosmetic'}))
        self.assertEqual(by_id(result)['Shaft']['class'], 'engineering')
        self.assertTrue(any('Shaft' in c for c in result['conflicts']))

    def test_a_declared_class_higher_than_the_derived_one_stands(self):
        result = fc.classify(inputs(declared={'Cover': 'engineering'}))
        self.assertEqual((by_id(result)['Cover']['class'], result['conflicts']), ('engineering', []))

    def test_an_override_can_raise_a_part_and_lower_one_no_gate_binds(self):
        result = fc.classify(inputs(overrides=[{'parts': ['Cover'], 'class': 'engineering', 'reason': 'it seals the oil gallery'},
                                               {'parts': ['Housing'], 'class': 'visual-structure', 'reason': 'path membership is incidental here'}]))
        rows = by_id(result)
        self.assertEqual((rows['Cover']['class'], rows['Housing']['class']), ('engineering', 'visual-structure'))
        self.assertEqual(len(result['overrides_applied']), 2)

    def test_an_override_cannot_lower_a_part_bound_to_a_gate(self):
        for part in ('Shaft', 'Gear1'):
            with self.assertRaisesRegex(ValueError, 'cannot lower'):
                fc.classify(inputs(overrides=[{'parts': [part], 'class': 'visual-structure', 'reason': 'nothing'}]))
        with self.assertRaisesRegex(ValueError, 'cannot lower'):
            fc.classify(inputs(ledger={'Cover'}, overrides=[{'parts': ['Cover'], 'class': 'cosmetic', 'reason': 'nothing'}]))

    def test_a_feature_override_follows_the_same_rule(self):
        up = fc.classify(inputs(features={'Cover': [{'label': 'Rib'}]}, overrides=[{'parts': ['Cover'], 'feature': 0, 'class': 'engineering', 'reason': 'locates the cover'}]))
        self.assertEqual((by_id(up)['Cover']['class'], by_id(up)['Cover']['features']), ('engineering', 'E'))
        with self.assertRaisesRegex(ValueError, 'cannot lower'):
            fc.classify(inputs(features={'Shaft': [{'label': ''}]}, overrides=[{'parts': ['Shaft'], 'feature': 0, 'class': 'cosmetic', 'reason': 'x'}]))

    def test_overrides_are_checked(self):
        ids = {'Cover', 'Bolt'}
        self.assertEqual(fc.check_overrides([{'parts': ['Cover'], 'class': 'engineering', 'reason': 'ok'}, {'match': 'Bol.', 'class': 'cosmetic', 'reason': 'ok'}], ids), [])
        problems = ' | '.join(fc.check_overrides([{'parts': ['Nope'], 'class': 'engineering', 'reason': 'x'}, {'parts': ['Cover'], 'class': 'big', 'reason': ''},
                                                  {'match': 'Zzz', 'class': 'cosmetic', 'reason': 'x'}, {'class': 'cosmetic', 'reason': 'x'}], ids))
        for fragment in ('unknown part Nope', 'class must be one of', 'a reason is required', 'matches no part', 'give either parts or match'):
            self.assertIn(fragment, problems)


class Gates(unittest.TestCase):
    parts = [{'id': p} for p in ('Shaft', 'Gear1', 'Gear2', 'Cover', 'Bolt', 'Housing')]
    moving = {'Shaft', 'Gear1', 'Gear2'}
    meshed = {'Gear1': [('Gear1', 'Gear2')], 'Gear2': [('Gear1', 'Gear2')]}

    def rows(self):
        return fc.classify(inputs())['parts']

    def run_gaps(self, audits, waivers=()):
        cover, notes = fc.gate_coverage(self.parts, self.moving, self.meshed, audits, SHA)
        return cover, notes, fc.coverage_gaps(self.rows(), cover, self.moving, self.meshed, list(waivers), SHA)

    def test_an_engineering_part_without_a_gate_is_an_open_gap(self):
        _, _, (open_, waived, _) = self.run_gaps([])
        gaps = set(open_)
        self.assertIn(('Shaft', 'rest'), gaps)
        self.assertIn(('Shaft', 'clip'), gaps)
        self.assertIn(('Gear1', 'gear'), gaps)
        self.assertIn(('Housing', 'rest'), gaps)
        self.assertNotIn(('Cover', 'rest'), gaps, 'a visual-structure part needs no gate')
        self.assertNotIn(('Housing', 'clip'), gaps, 'a static part needs no swept audit')
        self.assertEqual(waived, [])

    def test_a_complete_current_audit_closes_every_gap(self):
        audits = [audit_record(6, clip_moving=3, meshes=[('Gear1', 'Gear2', True)])]
        _, notes, (open_, waived, expired) = self.run_gaps(audits)
        self.assertEqual((open_, waived, expired, notes), ([], [], [], []))

    def test_an_audit_of_another_file_does_not_count(self):
        _, notes, (open_, _, _) = self.run_gaps([audit_record(6, sha=OTHER_SHA, clip_moving=3, meshes=[('Gear1', 'Gear2', True)])])
        self.assertTrue(open_)
        self.assertIn('different file', notes[0])

    def test_an_audit_of_fewer_parts_does_not_count(self):
        _, notes, (open_, _, _) = self.run_gaps([audit_record(5, clip_moving=3)])
        self.assertTrue(open_)
        self.assertIn('audited 5 parts', notes[0])

    def test_a_part_the_audit_could_not_intersect_is_not_covered(self):
        audits = [audit_record(6, clip_moving=3, meshes=[('Gear1', 'Gear2', True)], unverified=['Housing'])]
        _, _, (open_, _, _) = self.run_gaps(audits)
        self.assertEqual(open_, [('Housing', 'rest')])

    def test_a_clip_that_moved_fewer_parts_than_the_motion_declares_does_not_count(self):
        audits = [audit_record(6, clip_moving=2, meshes=[('Gear1', 'Gear2', True)])]
        _, notes, (open_, _, _) = self.run_gaps(audits)
        self.assertEqual({g for _, g in open_}, {'clip'})
        self.assertIn('fewer parts', notes[0])

    def test_a_gear_mesh_below_its_minimum_clearance_does_not_count(self):
        _, _, (open_, _, _) = self.run_gaps([audit_record(6, clip_moving=3, meshes=[('Gear1', 'Gear2', False)])])
        self.assertEqual(set(open_), {('Gear1', 'gear'), ('Gear2', 'gear')})

    def waiver(self, **kw):
        return dict({'gate': 'rest', 'parts': 'all', 'asset_sha256': SHA, 'reason': 'audit pending', 'clears_when': 'the audit lands'}, **kw)

    def test_a_waiver_for_the_present_asset_accepts_only_its_gate(self):
        _, _, (open_, waived, expired) = self.run_gaps([], [self.waiver()])
        self.assertEqual({g for _, g in open_}, {'clip', 'gear'})
        self.assertEqual({g for _, g in waived}, {'rest'})
        self.assertEqual(expired, [])

    def test_a_waiver_expires_when_the_asset_changes(self):
        _, _, (open_, waived, expired) = self.run_gaps([], [self.waiver(asset_sha256=OTHER_SHA)])
        self.assertIn(('Shaft', 'rest'), open_)
        self.assertEqual((waived, len(expired)), ([], 1))

    def test_a_waiver_can_name_parts(self):
        _, _, (open_, waived, _) = self.run_gaps([], [self.waiver(parts=['Housing'])])
        self.assertEqual(waived, [('Housing', 'rest')])
        self.assertIn(('Shaft', 'rest'), open_)

    def test_waivers_are_checked(self):
        self.assertEqual(fc.check_waivers([self.waiver()]), [])
        problems = ' | '.join(fc.check_waivers([self.waiver(gate='clipp'), self.waiver(asset_sha256='abc'), self.waiver(parts=[]), self.waiver(reason=''), self.waiver(clears_when=' ')]))
        for fragment in ('gate must be one of', 'asset_sha256 must be', 'parts must be', 'reason is required', 'clears_when is required'):
            self.assertIn(fragment, problems)


class Studies(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.results = {}
        for name in fc.STUDIES:
            result = fc.derive(name)
            result['coverage'] = report.coverage(result)
            cls.results[name] = result

    def test_every_part_of_a_study_is_classified_once(self):
        for name, result in self.results.items():
            contract = json.loads((REPO / fc.STUDIES[name]['contract']).read_text(encoding='utf-8'))
            self.assertEqual([r['id'] for r in result['parts']], [p['id'] for p in contract['parts']], name)
            self.assertTrue(all(r['class'] in fc.CLASSES for r in result['parts']), name)

    def test_the_committed_classes_are_what_the_records_derive(self):
        for name, result in self.results.items():
            committed = json.loads((REPO / fc.STUDIES[name]['classes']).read_text(encoding='utf-8'))
            self.assertEqual(committed, json.loads(fc.sidecar_text(name, result)), f'{name}: run python scripts/derive_fidelity_classes.py --write')

    def test_no_derived_class_conflicts_with_a_declared_one(self):
        for name, result in self.results.items():
            self.assertEqual(result['conflicts'], [], name)

    def test_whatever_a_gate_depends_on_is_engineering(self):
        for name, result in self.results.items():
            inp, rows = result['inputs'], by_id(result)
            for pid in inp['moving'] | set(inp['gear']) | inp['ledger'] | set(inp['mass']):
                self.assertEqual(rows[pid]['class'], 'engineering', f'{name}: {pid}')

    def test_every_engineering_part_has_the_gates_it_needs_or_a_waiver_for_this_asset(self):
        """The rule of B11: an engineering part with no gate coverage fails the build. A gap is accepted only by a waiver bound to the present asset."""
        for name, result in self.results.items():
            cov = result['coverage']
            self.assertEqual(cov['open'], [], f'{name}: {len(cov["open"])} engineering part/gate pairs have no current audit and no waiver for asset {result["inputs"]["asset_sha256"][:12]}. '
                             f'Audit this asset (record its interference-audit.json beside the study), or accept the gap on purpose with a coverage_waivers entry in {fc.STUDIES[name]["overrides"]} '
                             f'(a reason, what clears it, and this asset SHA-256). List them: python scripts/derive_fidelity_classes.py --gaps. First: {cov["open"][:6]}')

    def test_a_waiver_is_never_left_behind_for_a_gap_that_an_audit_has_closed(self):
        for name, result in self.results.items():
            cov = result['coverage']
            waived = {gate for _, gate in cov['waived']}
            for waiver in result['inputs']['waivers']:
                if waiver['asset_sha256'] == result['inputs']['asset_sha256']:
                    self.assertIn(waiver['gate'], waived, f'{name}: the {waiver["gate"]} waiver covers no open gap; remove it')

    def test_langley_is_fully_covered_without_waivers(self):
        cov = self.results['langley-manly-balzer-1903']['coverage']
        self.assertEqual((cov['open'], cov['waived'], cov['expired']), ([], [], []))
        eng = cov['table']['engineering']
        self.assertEqual((eng['rest'], eng['clip'], eng['gear']), (eng['parts'], eng['moving'], eng['meshed']))

    def test_r10_gaps_are_the_ones_the_review_found(self):
        cov = self.results['gtsio520-h-r10']['coverage']
        eng = cov['table']['engineering']
        # The exported-file audit of the shipped asset (cad-studies/gtsio520-h-static/shipped-r10: assembled pose, plus the cycle posed through the sampler)
        # covers the rest and clip gates. No audit measures the declared gear meshes, so only that gap stays waived.
        self.assertEqual((eng['rest'], eng['clip']), (eng['parts'], eng['moving']))
        self.assertEqual(eng['gear'], 0, 'no audit measures the gear clearances yet; if one has, remove the gear waiver')
        self.assertEqual({gate for _, gate in cov['waived']}, {'gear'})
        self.assertTrue(all('different file' in n for n in cov['notes']))

    def test_the_lesson_map_is_the_committed_draft(self):
        fresh = report.lesson_map(self.results['gtsio520-h-r10'])
        committed = json.loads((REPO / 'data/gtsio520-lesson-fidelity-map.json').read_text(encoding='utf-8'))
        self.assertEqual(committed, json.loads(report.lesson_map_text(fresh)), 'run python scripts/derive_fidelity_classes.py --write')
        self.assertEqual(committed['status'], 'draft')
        self.assertEqual([l['lesson'] for l in committed['lessons']], list(range(1, 19)))
        self.assertTrue(all(l['focus'] in ('operate', 'identify', 'concept') for l in committed['lessons']), 'every lesson has a focus')

    def test_the_lesson_map_only_names_real_parts_kinds(self):
        from cad_pipeline.intent import part_store
        definitions = {d['id'] for d in part_store.load_store()['definitions']}
        committed = json.loads((REPO / 'data/gtsio520-lesson-fidelity-map.json').read_text(encoding='utf-8'))
        for lesson in committed['lessons']:
            for entry in lesson['needs']:
                self.assertIn(entry['definition'], definitions)


if __name__ == '__main__':
    unittest.main()
