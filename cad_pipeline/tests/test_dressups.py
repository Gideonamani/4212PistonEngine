"""Saved, linked fillets preserve radius/source edits; ambiguous picks fail."""
import copy
import unittest
import uuid
from pathlib import Path
from cad_pipeline.spec import validate_spec

ROOT=Path(__file__).resolve().parents[2]


def fixture():
    parameter=lambda v:dict(value=v,unit='mm',status='inferred',source_ids=[],rationale='Fillet regression fixture')
    return dict(schema_version=1,model_id='fillet-test',units='mm',input_mode='text',scope='Linked fillet fixture',sources={},
                parameters={'journal_radius':parameter(10.),'root_radius':parameter(1.5)},
                parts=[dict(id='Shaft',label='Shoulder shaft',group='test',evidence='Fixture',material='steel',
                    features=[dict(primitive='cylinder',operation='add',radius='journal_radius',height=30),
                              dict(primitive='cylinder',operation='add',radius=13,height=5,origin=[0,0,-5])],
                    dressups=[dict(type='fillet',radius='root_radius',selectors=[dict(curve='circle',center=[0,0,0],radius='journal_radius')])])])


class DressupTest(unittest.TestCase):
    def test_derived_parameter_cycles_and_disagreement_rejected(self):
        spec=fixture();spec['parameters']['root_radius']['expression']='journal_radius*0.15';validate_spec(spec)
        spec['parameters']['root_radius']['value']=2.
        with self.assertRaises(ValueError):validate_spec(spec)
        spec=fixture();spec['parameters']['journal_radius']['expression']='journal_radius'
        with self.assertRaises(ValueError):validate_spec(spec)

    def test_geometric_selection_rejects_missing_or_duplicate_circle(self):
        from cad_pipeline.dressups import circle_edges
        import Part
        shape=Part.makeCylinder(10,30);spec=fixture();sel=spec['parts'][0]['dressups'][0]['selectors']
        with self.assertRaises(ValueError):circle_edges(shape,[dict(sel[0],center=[0,0,12])],spec['parameters'])
        with self.assertRaises(ValueError):circle_edges(shape,sel+sel,spec['parameters'])

    def test_saved_radius_and_source_edits_propagate(self):
        import FreeCAD as App
        import Part
        from cad_pipeline.generate import build
        from cad_pipeline.fast_build import build_part
        spec=fixture();out=ROOT/'build/cad-tests'/str(uuid.uuid4());build(spec,out)
        doc=App.openDocument(str(out/'fillet-test.FCStd'));doc.recompute()
        try:
            tip=next(o for o in doc.Objects if getattr(o,'StablePartID',None)=='Shaft')
            self.assertEqual(tip.TypeId,'PartDesign::Fillet');self.assertTrue(tip.ExpressionEngine)
            self.assertEqual(doc.Shaft_DressupBody.BaseFeature.TypeId,'Part::Fuse')
            before=tip.Shape.Volume
            self.assertAlmostEqual(before,build_part(spec['parts'][0],spec['parameters']).Volume,places=6)
            doc.Parameters.root_radius=2.;doc.recompute()
            self.assertTrue(tip.Shape.isValid());self.assertEqual(len(tip.Shape.Solids),1)
            self.assertAlmostEqual(tip.Radius.Value,2.,places=8);self.assertGreater(tip.Shape.Volume,before)
            altered=copy.deepcopy(spec['parameters']);altered['root_radius']['value']=2.
            self.assertAlmostEqual(tip.Shape.Volume,build_part(spec['parts'][0],altered).Volume,places=6)
            doc.Parameters.journal_radius=10.1;doc.recompute()
            self.assertTrue(tip.Shape.isValid())
            self.assertTrue(any(isinstance(f.Surface,Part.Cylinder) and abs(f.Surface.Radius-10.1)<1e-7 for f in tip.Shape.Faces))
        finally:App.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
