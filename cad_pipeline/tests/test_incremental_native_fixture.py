"""Complete small extension proves retained shapes, live appended history and export."""
import copy
import unittest
import uuid
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.generate import build
from cad_pipeline.extend_saved_native import extend
from cad_pipeline.fast_build import build_part
from cad_pipeline.saved_recipe_agreement import compare
from cad_pipeline.gtsio_core import cylinder


class IncrementalNative(unittest.TestCase):
    def test_full_extension_preserves_prefix_and_later_source_edits(self):
        parameter=lambda v:dict(value=v,unit='mm',status='inferred',source_ids=[],rationale='Incremental fixture')
        part=lambda id,features:dict(id=id,label=id,group='fixture',material='steel',evidence='Fixture',features=features)
        old=dict(schema_version=1,model_id='old-fixture',units='mm',input_mode='text',scope='Incremental fixture',sources={},parameters={'radius':parameter(5.)},
            parts=[part('Shaft',[cylinder('radius',20,[0,0,0])]),part('Unchanged',[cylinder(3,5,[20,0,0])])])
        new=copy.deepcopy(old);new['model_id']='extended-fixture';new['parameters']['bore']=parameter(1.5)
        new['parts'][0]['features'] += [cylinder('radius+2',5,[0,0,5]),cylinder('bore',22,[0,0,-1],op='cut')]
        new['parts'].append(part('Added',[cylinder('bore',4,[30,0,0])]))
        root=Path('build/cad-tests')/str(uuid.uuid4());base=root/'base';out=root/'extended'
        build(old,base)
        report=extend(base,new,out,append_histories=True,preserve_unchanged=True,checkpoint_every=1)
        self.assertEqual(report['part_count'],3)
        self.assertEqual(report['incremental_native_build']['plan']['appended'],['Shaft'])
        self.assertEqual(report['incremental_native_build']['plan']['reused'],['Unchanged'])
        self.assertEqual(len(list((out/'checkpoints').glob('parts-000003*/checkpoint.json'))),1)
        doc=A.openDocument(str(out/'extended-fixture.FCStd'));doc.recompute()
        try:
            self.assertEqual(doc.Shaft_F1.TypeId,'Part::Cylinder')
            tips={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')}
            for p in new['parts']:self.assertTrue(compare(tips[p['id']].Shape,build_part(p,new['parameters']),p['id'])['passed'])
            doc.Parameters.radius=5.2;doc.recompute();changed=copy.deepcopy(new['parameters']);changed['radius']['value']=5.2
            self.assertTrue(compare(tips['Shaft'].Shape,build_part(new['parts'][0],changed),'old live prefix edit')['passed'])
            step=Part.read(str(out/'extended-fixture.step'));self.assertTrue(step.isValid());self.assertEqual(len(step.Solids),3)
        finally:A.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
