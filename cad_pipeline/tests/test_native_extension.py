"""Prove retained histories, changed dependencies and interrupted native recovery."""
import copy
import json
import math
import time
import unittest
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.generate import build
from cad_pipeline.fast_build import build_part as direct_part
from cad_pipeline.extend_saved_native import extend, rebuild_plan, file_hash, last_checkpoint


class NativeExtensionTest(unittest.TestCase):
    def fixture(self):
        root = Path(__file__).resolve().parents[2]
        spec = json.loads((root / 'cad_pipeline/examples/bearing-housing.json').read_text())
        spec.update(model_id='native-extension-fixture', scope='Illustrative recovery-method fixture',
                    parameters={'width': dict(value=3, unit='mm', status='inferred', rationale='Method fixture')})
        fixed = dict(id='Fixed', label='Retained native solid', evidence='Method fixture', group='fixture', material='steel',
                     features=[dict(primitive='box', operation='add', length=10, width=10, height=5)])
        master = dict(id='Master', label='Changed shared master', evidence='Method fixture', group='fixture', material='steel',
                      placement=dict(origin=[20, 0, 0], rotation_quaternion=[0, 0, 0, 1]),
                      features=[dict(primitive='box', operation='add', length=10, width='width', height=5)])
        instance = copy.deepcopy(master)
        instance.update(id='Copy', label='Dependent instance', geometry_instance_of='Master')
        instance['placement']['origin'] = [40, 0, 0]
        spec['parts'] = [fixed, master, instance]
        return spec

    def test_parameter_and_shared_master_dependencies(self):
        old = self.fixture()
        new = copy.deepcopy(old)
        new['parameters']['width']['value'] = 4
        self.assertEqual(rebuild_plan(old, new)['rebuild'], ['Master', 'Copy'])
        derived = copy.deepcopy(old)
        derived['parameters']['span'] = dict(value=6, expression='2 * width', unit='mm',
                                            status='inferred', rationale='Derived fixture')
        derived['parameters']['half_span'] = dict(value=3, expression='span / 2', unit='mm',
                                                 status='inferred', rationale='Transitive fixture')
        derived['parts'][1]['features'][0]['width'] = 'half_span'
        updated = copy.deepcopy(derived)
        updated['parameters']['width']['value'] = 4
        plan = rebuild_plan(derived, updated)
        self.assertEqual(plan['rebuild'], ['Master', 'Copy'])
        self.assertEqual(plan['changed_parameters'], ['half_span', 'span', 'width'])
        new = copy.deepcopy(old)
        new['parts'][1]['features'][0]['height'] = 6
        new['parts'][2]['features'][0]['height'] = 6
        self.assertEqual(rebuild_plan(old, new)['reused'], ['Fixed'])
        new = copy.deepcopy(old)
        new['parts'] = new['parts'][1:]
        with self.assertRaisesRegex(ValueError, 'Part deletion'):
            rebuild_plan(old, new)

    def test_saved_interruption_resume_and_parameter_edit(self):
        old = self.fixture()
        root = Path(__file__).resolve().parents[2] / 'build/method-fixtures' / ('native-extension-%d' % time.time_ns())
        source, output = root / 'source', root / 'extended'
        build(old, source)
        base_hash = file_hash(source / (old['model_id'] + '.FCStd'))
        new = copy.deepcopy(old)
        new['parameters']['width']['value'] = 4
        new['parameters']['bore'] = dict(value=1, unit='mm', status='inferred', rationale='Method fixture')
        new['parts'].append(dict(id='Added', label='Added hollow component', evidence='Method fixture', group='fixture', material='steel',
                                features=[dict(primitive='tube', operation='add', radius=3, inner_radius='bore', height=5, origin=[60, 0, 0])]))
        stopped = extend(source, new, output, checkpoint_every=1, stop_after=1)
        self.assertFalse(stopped['complete_spec'])
        self.assertFalse((output / 'cad-validation.json').exists())
        # A half-written newest save must not conceal the earlier intact record.
        broken = output / 'checkpoints' / 'parts-999999'
        broken.mkdir()
        record = json.loads(next((output / 'checkpoints').glob('*/checkpoint.json')).read_text())
        record['built_part_ids'] = ['Fixed', 'Master', 'Copy', 'Added']
        (broken / 'construction.FCStd').write_bytes(b'interrupted file')
        (broken / 'checkpoint.json').write_text(json.dumps(record))
        report = extend(source, new, output, checkpoint_every=1, resume=True)
        self.assertTrue(report['complete_spec'])
        self.assertEqual(report['part_count'], 4)
        self.assertEqual(report['incremental_native_build']['plan']['reused'], ['Fixed'])
        self.assertEqual(base_hash, file_hash(source / (old['model_id'] + '.FCStd')))
        doc = A.openDocument(str(output / (new['model_id'] + '.FCStd')))
        try:
            doc.recompute()
            tips = {o.StablePartID: o for o in doc.Objects if hasattr(o, 'StablePartID')}
            self.assertEqual(set(tips), {'Fixed', 'Master', 'Copy', 'Added'})
            self.assertIs(tips['Master'].Links[0], tips['Copy'].Links[0])
            for part in new['parts']:
                native, direct = tips[part['id']].Shape, direct_part(part, new['parameters'])
                self.assertTrue(native.isValid())
                self.assertEqual(len(native.Solids), 1)
                self.assertLess(abs(native.Volume - direct.Volume) / native.Volume, 1e-6)
            step = Part.read(str(output / (new['model_id'] + '.step')))
            self.assertTrue(step.isValid())
            self.assertEqual(len(step.Solids), 4)
            self.assertLess(abs(step.Volume - sum(o.Shape.Volume for o in tips.values())) / step.Volume, 1e-5)
            doc.Parameters.width = 5
            doc.Parameters.bore = 1.5
            doc.recompute()
            self.assertAlmostEqual(tips['Master'].Shape.Volume, 250)
            self.assertAlmostEqual(tips['Copy'].Shape.Volume, 250)
            self.assertAlmostEqual(tips['Added'].Shape.Volume, math.pi * (9 - 1.5 ** 2) * 5, places=7)
            doc.saveAs(str(root / 'edited.FCStd'))
        finally:
            A.closeDocument(doc.Name)
        doc = A.openDocument(str(root / 'edited.FCStd'))
        try:
            doc.recompute()
            self.assertAlmostEqual(next(o for o in doc.Objects if getattr(o, 'StablePartID', None) == 'Copy').Shape.Volume, 250)
            Part.export([o for o in doc.Objects if hasattr(o, 'StablePartID')], str(root / 'edited.step'))
        finally:
            A.closeDocument(doc.Name)
        edited = Part.read(str(root / 'edited.step'))
        self.assertTrue(edited.isValid())
        self.assertEqual(len(edited.Solids), 4)
        self.assertAlmostEqual(edited.Volume, 1000 + math.pi * (9 - 1.5 ** 2) * 5, places=6)
        # Refresh one retained primitive from the same recipe without treating
        # its previous mesh/mass record as a numerical waiver.
        state={k:report['incremental_native_build'][k] for k in ('spec_sha256','base_native_sha256','batch_runs')}
        native_checkpoint,_=last_checkpoint(output,state)
        refreshed=root/'refreshed';adopted=refreshed/'checkpoints/adopted';adopted.mkdir(parents=True)
        for name in ('construction.FCStd','checkpoint.json'):
            (adopted/name).write_bytes((native_checkpoint.parent/name).read_bytes())
        refreshed_report=extend(source,new,refreshed,resume=True,refresh=['Fixed'])
        self.assertEqual(refreshed_report['incremental_native_build']['refreshed_part_ids'],['Fixed'])
        self.assertEqual(refreshed_report['part_count'],4)
        refreshed_parts={p['id']:p for p in refreshed_report['parts']}
        self.assertAlmostEqual(refreshed_parts['Fixed']['volume_mm3'],500)
        self.assertEqual(base_hash,file_hash(source/(old['model_id']+'.FCStd')))
        (root / 'method-checks.json').write_text(json.dumps(dict(passed=True, freecad_version=A.Version(),
            interrupted_then_resumed=True, incomplete_checkpoint_not_published_as_package=True,
            invalid_newest_checkpoint_skipped=True, original_native_unchanged=True,
            parameter_change_and_addition=True, shared_master_relinked=True, retained_parts=1,
            native_direct_agreement=True, step_solids=4, edited_saved_reopened=True,
            explicit_same_recipe_refresh=True), indent=2) + '\n')
        print('METHOD_FIXTURE', root, flush=True)


if __name__ == '__main__':
    unittest.main()
