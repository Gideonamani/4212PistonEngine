"""A copied native history must retain the destination controller after reopen."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.generate import build
from cad_pipeline.gtsio_core import cylinder,box
from cad_pipeline.graft_native_history import copy_history
from cad_pipeline.fast_build import build_part
from cad_pipeline.saved_recipe_agreement import compare

class GraftHistory(unittest.TestCase):
    def test_extension_manifest_survives_checkpoint_resume(self):
        from cad_pipeline.extend_saved_native import extend
        from cad_pipeline.saved_native_stock import file_sha
        parameter=dict(value=3.,unit='mm',status='inferred',source_ids=[],rationale='Fixture')
        part=lambda id,x:dict(id=id,label=id,group='fixture',material='steel',evidence='Fixture',features=[cylinder('radius',8,[x,0,0])])
        old=dict(schema_version=1,model_id='base-graft-fixture',units='mm',input_mode='text',scope='Fixture',sources={},parameters={'radius':parameter},parts=[part('Fixed',20)])
        new=copy.deepcopy(old);new['model_id']='extended-graft-fixture';new['parts'] += [part('Imported',40),part('NewFirst',60),part('NewLast',80)]
        with tempfile.TemporaryDirectory(dir=str(Path('build').resolve())) as temporary:
            root=Path(temporary);build(old,root/'base');build(new,root/'donor',only=['Imported'])
            spec_file=root/'donor-spec.json';spec_file.write_text(json.dumps(new),encoding='utf-8');native=root/'donor/extended-graft-fixture.FCStd'
            doc=A.openDocument(str(native));doc.recompute();obj=next(o for o in doc.Objects if hasattr(o,'StablePartID'))
            agreement=compare(obj.Shape,build_part(new['parts'][1],new['parameters']),'Imported');A.closeDocument(doc.Name)
            checks=root/'checks.json';checks.write_text(json.dumps(dict(passed=agreement['passed'],native_sha256=file_sha(native),spec_sha256=file_sha(spec_file),agreements=[agreement],step_solids=1)),encoding='utf-8')
            manifest=root/'sources.json';manifest.write_text(json.dumps(dict(sources=[dict(package=str(root/'donor'),spec=str(spec_file),checks=str(checks),part_ids=['Imported'])])),encoding='utf-8')
            stopped=extend(root/'base',new,root/'target',checkpoint_every=1,stop_after=1,preserve_unchanged=True,native_sources=manifest)
            self.assertFalse(stopped['complete_spec'])
            result=extend(root/'base',new,root/'target',checkpoint_every=1,resume=True,preserve_unchanged=True,native_sources=manifest)
            self.assertEqual([r['id'] for r in result['incremental_native_build']['grafted_native_histories']],['Imported'])
            self.assertEqual(result['part_count'],4)
            doc=A.openDocument(str(root/'target/extended-graft-fixture.FCStd'));doc.Parameters.radius=3.2;doc.recompute()
            changed=copy.deepcopy(new['parameters']);changed['radius']['value']=3.2
            try:
                shapes={o.StablePartID:o.Shape for o in doc.Objects if hasattr(o,'StablePartID')}
                self.assertTrue(all(compare(shapes[p['id']],build_part(p,changed),p['id'])['passed'] for p in new['parts']))
            finally:A.closeDocument(doc.Name)
            step=Part.read(str(root/'target/extended-graft-fixture.step'));self.assertTrue(step.isValid());self.assertEqual(len(step.Solids),4)

    def test_linked_loft_pattern_keeps_one_master_and_live_vectors(self):
        from cad_pipeline.tests.test_polar_pattern import fixture
        existing=set(A.listDocuments());old=fixture()
        old['parts'][0]['features'][1]['tool_clip']=dict(primitive='box',operation='add',length='30*size',width='30*size',height='5.5*size',origin=['-15*size','-15*size','-2*size'])
        new=copy.deepcopy(old);new['model_id']='pattern-graft-target'
        fixed=dict(id='FixedPart',label='Fixed',group='fixture',material='steel',evidence='Fixture',features=[box(2,3,4,[30,0,0])]);new['parts'].append(fixed)
        with tempfile.TemporaryDirectory(dir=str(Path('build').resolve())) as temporary:
            root=Path(temporary);build(old,root/'source');build(new,root/'target',only=['FixedPart'])
            source=A.openDocument(str(root/'source/pattern-fixture.FCStd'));target=A.openDocument(str(root/'target/pattern-graft-target.FCStd'))
            try:
                copy_history(target,source,old['parts'][0],old,new)
                copies=[o for o in target.Objects if o.Name.startswith('Plate_F2_Copy')]
                self.assertEqual(len(copies),8);self.assertEqual(len({o.Links[0].Name for o in copies}),1)
                file=root/'pattern-grafted.FCStd';target.saveAs(str(file));A.closeDocument(source.Name);A.closeDocument(target.Name)
                target=A.openDocument(str(file));target.Parameters.size=1.05;target.recompute()
                tip=next(o for o in target.Objects if getattr(o,'StablePartID',None)=='Plate');parameters=copy.deepcopy(old['parameters']);parameters['size']['value']=1.05
                self.assertTrue(compare(tip.Shape,build_part(old['parts'][0],parameters),'Grafted live loft pattern')['passed'])
                step=root/'pattern-grafted.step';Part.export([tip],str(step));shape=Part.read(str(step));self.assertTrue(shape.isValid());self.assertEqual(len(shape.Solids),1)
            finally:
                for name in set(A.listDocuments())-existing:A.closeDocument(name)

    def test_copy_rebind_reopen_edit_and_step(self):
        existing=set(A.listDocuments())
        parameter=lambda value:dict(value=value,unit='mm',status='inferred',source_ids=[],rationale='Fixture')
        part=dict(id='GraftedPart',label='Grafted part',group='fixture',material='steel',evidence='Fixture',features=[cylinder('radius',8,[0,0,0]),cylinder('hole',10,[0,0,-1],op='cut')])
        old=dict(schema_version=1,model_id='source-history-fixture',units='mm',input_mode='text',scope='Fixture',sources={},parameters={'radius':parameter(3.),'hole':parameter(1.)},parts=[part])
        new=copy.deepcopy(old);new['model_id']='target-history-fixture';new['parameters']['unused']=parameter(7.)
        fixed=dict(id='FixedPart',label='Fixed',group='fixture',material='steel',evidence='Fixture',features=[box(2,3,4,[20,0,0])]);new['parts'].insert(0,fixed)
        with tempfile.TemporaryDirectory(dir=str(Path('build').resolve())) as temporary:
            root=Path(temporary);build(old,root/'source');build(new,root/'target',only=['FixedPart'])
            source=A.openDocument(str(root/'source/source-history-fixture.FCStd'));target=A.openDocument(str(root/'target/target-history-fixture.FCStd'))
            try:
                target.Parameters.radius=3.1
                with self.assertRaisesRegex(ValueError,'Actual controller'):copy_history(target,source,part,old,new)
                self.assertIsNone(target.getObject('GraftedPart'));target.Parameters.radius=3.;target.recompute()
                result=copy_history(target,source,part,old,new);self.assertEqual(result['rebound_controllers'],1)
                self.assertFalse(any(o.Name.startswith('Parameters0') for o in target.Objects))
                file=root/'grafted.FCStd';target.saveAs(str(file));A.closeDocument(source.Name);A.closeDocument(target.Name)
                target=A.openDocument(str(file));target.recompute();tip=next(o for o in target.Objects if getattr(o,'StablePartID',None)=='GraftedPart')
                self.assertTrue(compare(tip.Shape,build_part(part,new['parameters']),'Copied baseline')['passed'])
                target.Parameters.radius=3.2;target.recompute();changed=copy.deepcopy(new['parameters']);changed['radius']['value']=3.2
                self.assertTrue(compare(tip.Shape,build_part(part,changed),'Destination controller edit')['passed'])
                step=root/'grafted.step';Part.export([tip],str(step));shape=Part.read(str(step));self.assertTrue(shape.isValid());self.assertEqual(len(shape.Solids),1)
            finally:
                for name in set(A.listDocuments())-existing:A.closeDocument(name)

if __name__=='__main__':unittest.main()
