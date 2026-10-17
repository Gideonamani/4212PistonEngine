"""Adoption fixture: opposite winding, native/direct agreement and saved edits."""
import json
import unittest
from pathlib import Path
import FreeCAD as App
from cad_pipeline.generate import build
from cad_pipeline.fast_build import build_part


class HelixAdoptionTest(unittest.TestCase):
    def test_saved_opposite_hand_sweeps(self):
        root=Path(__file__).resolve().parents[2]
        spec=json.loads((root/'cad_pipeline/examples/bearing-housing.json').read_text())
        spec['model_id']='opposite-hand-spring-fixture'
        spec['scope']='Illustrative software-method adoption fixture only'
        spec['parameters']={name:dict(value=value,unit='mm',status='inferred',rationale='Software-method test dimension') for name,value in [('radius',10),('wire',1),('pitch',5),('height',20)]}
        spec['parts']=[]
        for left in (False,True):
            spec['parts'].append(dict(id='Left' if left else 'Right',label='Helix fixture',group='springs',material='steel',evidence='Method fixture',features=[dict(primitive='helix',operation='add',radius='radius',wire_radius='wire',pitch='pitch',height='height',origin=[30 if left else 0,0,0],axis=[0,0,1],left_handed=left)]))
        output=root/'build/method-fixtures/opposite-hand-springs';output.mkdir(parents=True,exist_ok=True)
        build(spec,output)
        doc=App.openDocument(str(output/(spec['model_id']+'.FCStd')));doc.recompute()
        try:
            native={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')}
            samples=[]
            for part in spec['parts']:
                shape=native[part['id']].Shape;direct=build_part(part,spec['parameters'])
                self.assertTrue(shape.isValid());self.assertEqual(len(shape.Solids),1)
                self.assertLess(abs(shape.Volume-direct.Volume)/shape.Volume,1e-6)
                spine=doc.getObject(part['id']+'_F1_Spine');edge=spine.Shape.Edges[0]
                sample=edge.valueAt(edge.FirstParameter+(edge.LastParameter-edge.FirstParameter)/16)
                samples.append(sample.y)
            self.assertGreater(samples[0]*samples[1]*-1,1.)
            before=native['Left'].Shape.Volume;doc.Parameters.wire=1.2;doc.recompute()
            self.assertTrue(native['Left'].Shape.isValid());self.assertGreater(native['Left'].Shape.Volume,before)
            doc.saveAs(str(output/'edited.FCStd'))
        finally:App.closeDocument(doc.Name)
        doc=App.openDocument(str(output/'edited.FCStd'));doc.recompute()
        try:
            for obj in doc.Objects:
                if hasattr(obj,'StablePartID'):self.assertTrue(obj.Shape.isValid());self.assertEqual(len(obj.Shape.Solids),1)
        finally:App.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
