"""The shared animated-study contract builder: the Langley and Wright contracts rebuild exactly, and the R10 configuration keeps what was added to its file by hand.

Standard library only, so CI can run it. The Langley and Wright cards are rebuilt from what is committed (part-spec.json, inventory.json and the motion and explode
modules) and compared, text for text, with the contract files in web/. What this proves: the builder, the engine configs and the motion descriptors reproduce the
contracts that are shipped. What it does not prove: that the GLB beside a contract is the one a rebuild would export (that needs Blender; see
scripts/check_rig_equivalence.py and docs/animated-study-rig.md), or that the committed part-spec.json is the geometry the GLB was built from.

Run: python3 scripts/test_study_contract.py
"""
import json
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from cad_pipeline import animated_studies, gtsio_contract, langley_contract, wright_contract
from cad_pipeline.study_contract import AssemblyRules, ComponentTree, StudyConfig, build, diff, dumps


def shipped_text(path):
    """A contract file as git stores it: Windows checkouts may hold CRLF, which is not part of the contract."""
    return (REPO / path).read_bytes().decode('utf-8').replace('\r\n', '\n')


class RebuildsTheShippedContracts(unittest.TestCase):
    """Parts, tree, motions (with the clip stage names), scope, gear meshes and key order, byte for byte."""

    def rebuild(self, study_name, spec, shipped):
        old = json.loads(shipped_text(shipped))
        parts = json.loads((REPO / spec).read_text(encoding='utf-8'))['parts']
        study = animated_studies.get(study_name)(parts)
        new = study.contract(old['asset_sha256'])
        self.assertEqual(diff(old, json.loads(dumps(new))), [], 'field differences')
        self.assertEqual(dumps(new), shipped_text(shipped), 'the text of the file differs (key order or formatting)')
        return old, new

    def test_langley(self):
        old, new = self.rebuild('langley', 'cad-studies/langley-manly-balzer-1903/part-spec.json', 'web/langley-manly-balzer-1903-contract.json')
        self.assertEqual([m['id'] for m in new['motions']], [animated_studies.OPERATING, animated_studies.EXPLODED])
        self.assertEqual(len(new['gearMeshes']), 5)

    def test_wright(self):
        old, new = self.rebuild('wright', 'cad-studies/wright-1903/revision-2/part-spec.json', 'web/wright-1903-reconstruction-contract.json')
        self.assertEqual([m['id'] for m in new['motions']], [animated_studies.OPERATING, animated_studies.EXPLODED])
        self.assertEqual(len(new['gearMeshes']), 1)

    def test_the_old_entry_points_still_build_the_same_thing(self):
        old = json.loads(shipped_text('web/langley-manly-balzer-1903-contract.json'))
        geometry = json.loads((REPO / 'cad-studies/langley-manly-balzer-1903/part-spec.json').read_text(encoding='utf-8'))
        self.assertEqual(langley_contract.build(geometry, old['asset_sha256'], motions=old['motions']), old)
        old = json.loads(shipped_text('web/wright-1903-reconstruction-contract.json'))
        geometry = json.loads((REPO / 'cad-studies/wright-1903/revision-2/part-spec.json').read_text(encoding='utf-8'))
        self.assertEqual(wright_contract.build(geometry, old['asset_sha256'], motions=old['motions']), old)


class FakeMotion:
    """Just enough of gtsio_review_motion.ReviewMotion for the contract: a crank body, a piston body and one fixed part."""
    bodies = {'Crankshaft': 'crank', 'Piston1': 'piston1', 'CrankcaseLeft': 'fixed:CrankcaseLeft', 'Bolt1': 'fixed:Bolt1'}

    def body(self, pid):
        return self.bodies[pid]

    def cycle_visible(self, pid):
        return not self.bodies[pid].startswith('fixed:')

    def explosion(self, pid):
        return (5, (0, 0, 0)) if pid in ('Crankshaft', 'Piston1') else (1, (350, 180, 0))


class R10Configuration(unittest.TestCase):
    PARTS = [dict(id=i, label=i + ' label', group=g, evidence='e') for i, g in
             (('Crankshaft', 'crankshaft'), ('Piston1', 'pistons'), ('CrankcaseLeft', 'crankcase'), ('Bolt1', 'case_fasteners'))]
    HANDOFF = dict(groups=['crankshaft', 'pistons', 'crankcase', 'case_fasteners'], pending_before_animation_acceptance=['gate one', 'gate two'],
                   selected_geometry=dict(path='g', bytes=1, sha256='a'), selected_spec=dict(path='s', bytes=2, sha256='b'))
    SPEC = dict(parameters={name: dict(value=float(i + 1)) for i, name in enumerate(gtsio_contract.PARAMETERS)})

    def contract(self, asset_sha256='f' * 64, **extra):
        return gtsio_contract.build_review_contract(motion=FakeMotion(), handoff=self.HANDOFF, spec=self.SPEC, parts=self.PARTS, asset_file='x.glb', asset_sha256=asset_sha256,
                                                    asset_bytes=10, gzip_bytes=5, blender_version='5.0.1', **extra)

    def test_the_hand_edits_of_the_shipped_file_are_in_the_config(self):
        c = self.contract()
        self.assertEqual(c['display'], gtsio_contract.DISPLAY)
        self.assertEqual(c['display'], dict(rotation_x_deg=90, fit_direction=[1.3, 0.8, 1.55]))
        self.assertEqual(c['release_allowed'], False)
        self.assertEqual(c['complete_engine_acceptance'], False)
        self.assertEqual(list(c), [k for k in gtsio_contract.CONFIG.key_order if k in c])

    def test_parts_groups_and_motions(self):
        c = self.contract()
        self.assertEqual([p['body'] for p in c['parts']], ['crank', 'piston1', 'fixed:CrankcaseLeft', 'fixed:Bolt1'])
        self.assertEqual(c['parts'][0], dict(id='Crankshaft', label='Crankshaft label', group='crankshaft', groups=[], description='Crankshaft label', evidence='e',
                                             shape_status=gtsio_contract.SHAPE_STATUS, body='crank', cycle_visible=True, explosion=dict(stage=5, offset_mm=[0, 0, 0])))
        self.assertEqual([g['label'] for g in c['groups']], ['Crankshaft', 'Pistons', 'Crankcase', 'Case Fasteners'])
        self.assertEqual([m['id'] for m in c['motions']], [gtsio_contract.EXPLODE, gtsio_contract.COLLAPSE, gtsio_contract.CYCLE])
        core = c['motions'][2]['display']
        self.assertEqual(core['ghostPartIds'], gtsio_contract.GHOST_IDS)
        self.assertEqual(core['visiblePartIds'], ['Crankshaft', 'Piston1', 'CrankcaseLeft'], 'moving parts and the ghosted case halves, not the fixed bolt')
        self.assertEqual(c['animated_nodes'], {gtsio_contract.EXPLODE: 2, gtsio_contract.COLLAPSE: 2, gtsio_contract.CYCLE: 2})
        self.assertEqual(c['procedural']['parameters']['case_cam_y'], 1.0)

    def test_an_audit_record_is_written_only_for_the_asset_it_describes(self):
        audited = gtsio_contract.AUDIT_RECORDS[0]
        self.assertEqual(self.contract(audited['asset_sha256'])['pending'], ['gate one', 'gate two', audited['line']])
        self.assertEqual(self.contract('0' * 64)['pending'], ['gate one', 'gate two'], 'a rebuilt or optimised file must not carry an audit it never had')
        self.assertIn(audited['asset_sha256'][:12], audited['line'])
        self.assertRegex(audited['line'], r'not (an )?accept')

    def test_the_shipped_file_agrees_with_the_config(self):
        shipped = json.loads(shipped_text('web/gtsio520-r10-contract.json'))
        self.assertEqual(shipped['display'], gtsio_contract.DISPLAY)
        self.assertEqual(list(shipped), list(gtsio_contract.CONFIG.key_order), 'key order')
        self.assertEqual(shipped['reference'], gtsio_contract.REFERENCE)
        self.assertEqual(shipped['review_visibility'], gtsio_contract.REVIEW_VISIBILITY)
        self.assertEqual(shipped['exclusions'], gtsio_contract.EXCLUSIONS)
        self.assertEqual([m['id'] for m in shipped['motions']], [gtsio_contract.EXPLODE, gtsio_contract.COLLAPSE, gtsio_contract.CYCLE])
        self.assertEqual(shipped['motions'][2]['display']['ghostPartIds'], gtsio_contract.GHOST_IDS)
        for record in gtsio_contract.AUDIT_RECORDS:           # a record is checked against the file only while that file is the one shipped
            if record['asset_sha256'] == shipped['asset_sha256']:
                self.assertIn(record['line'], shipped['pending'])


class Grouping(unittest.TestCase):
    def test_a_part_in_no_assembly_is_an_error(self):
        with self.assertRaises(ValueError):
            AssemblyRules([('a', 's', 'A', r'^A$')]).assembly_of('B')

    def test_a_group_without_a_system_title_is_an_error(self):
        config = StudyConfig(scope='s', reference='r', grouping=ComponentTree(), systems=[('known', 'Known', None)], description='label')
        with self.assertRaises(ValueError):
            build(config, [dict(id='P', label='P', group='unknown', evidence='e', material='steel')], 'h')


class Diff(unittest.TestCase):
    def test_reports_values_keys_and_lengths_but_not_key_order(self):
        a = dict(x=1, y=[1, 2, 3], z=dict(k='v'))
        self.assertEqual(diff(a, dict(z=dict(k='v'), y=[1, 2, 3], x=1)), [])
        rows = diff(a, dict(x=2, y=[1, 2], z=dict(k='v', extra=1)))
        self.assertEqual({r[0]: r[1] for r in rows}, {'/x': 'value', '/y': 'length', '/z/extra': 'only in second'})
        self.assertEqual([r[1] for r in diff(dict(a=1), dict(a=1.5, b=2))], ['value', 'only in second'])


if __name__ == '__main__':
    unittest.main()
