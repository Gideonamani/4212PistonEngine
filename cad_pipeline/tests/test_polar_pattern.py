"""Native pattern tools retain live master dimensions after save/reopen."""
import copy
import json
import unittest
from pathlib import Path
import uuid
from cad_pipeline.spec import validate_spec


def fixture():
    parameter=dict(value=1.,unit='mm',status='inferred',source_ids=[],rationale='Pattern method fixture')
    return dict(schema_version=1,model_id='pattern-fixture',units='mm',input_mode='text',scope='Pattern fixture',sources={},parameters={'size':parameter},parts=[dict(id='Plate',label='Plate',group='fixture',material='steel',evidence='Fixture',features=[
        dict(primitive='cylinder',operation='add',radius='12*size',height='3*size'),
        dict(primitive='polar_pattern',operation='cut',count=8,pattern_feature=dict(primitive='loft',operation='add',sections=[[[f'{x}*size',f'{y}*size',f'{z}*size'] for x,y in [(7,-.7),(9,-.7),(9,.7),(7,.7)]] for z in [-1,4]]))])])


class PolarPattern(unittest.TestCase):
    def test_linked_tool_clip_controls_pocket_depth(self):
        import FreeCAD as A
        import Part
        from cad_pipeline.generate import build
        from cad_pipeline.fast_build import build_part
        spec=fixture();part=spec['parts'][0]
        part['features'][1]['tool_clip']=dict(primitive='box',operation='add',length='30*size',width='30*size',height='3*size',origin=['-15*size','-15*size','-size'])
        validate_spec(spec);out=Path('build/cad-tests/clip-'+uuid.uuid4().hex);build(spec,out)
        doc=A.openDocument(str(out/'pattern-fixture.FCStd'));doc.recompute()
        try:
            tip=next(o for o in doc.Objects if getattr(o,'StablePartID',None)=='Plate')
            self.assertAlmostEqual(tip.Shape.Volume,build_part(part,spec['parameters']).Volume,places=6)
            self.assertFalse(tip.Shape.isInside(A.Vector(8,0,1),1e-7,True))
            self.assertTrue(tip.Shape.isInside(A.Vector(8,0,2.5),1e-7,True))
            self.assertEqual(doc.getObject('Plate_F2_LimitedMaster').TypeId,'Part::Common')
            doc.Parameters.size=1.1;doc.recompute()
            self.assertTrue(tip.Shape.isInside(A.Vector(8.8,0,2.75),1e-7,True))
            params=copy.deepcopy(spec['parameters']);params['size']['value']=1.1
            self.assertAlmostEqual(tip.Shape.Volume,build_part(part,params).Volume,places=6)
        finally:A.closeDocument(doc.Name)
        self.assertEqual(len(Part.read(str(out/'pattern-fixture.step')).Solids),1)

    def test_partial_window_leaves_opposite_quadrant_solid(self):
        import FreeCAD as A
        from cad_pipeline.generate import build_part
        from cad_pipeline.fast_build import build_part as direct
        from cad_pipeline.saved_recipe_agreement import compare
        spec=fixture();pattern=spec['parts'][0]['features'][1]
        pattern.update(count=3,step_degrees=90,roll=-90);validate_spec(spec)
        doc=A.newDocument('PartialPatternFixture')
        try:
            controller=doc.addObject('App::FeaturePython','Parameters');controller.addProperty('App::PropertyFloat','size');controller.size=1.
            _,tip=build_part(doc,spec['parts'][0],spec['parameters'],0)
            self.assertTrue(compare(tip.Shape,direct(spec['parts'][0],spec['parameters']),'partial')['passed'])
            for point in [(8,0,1),(0,8,1),(0,-8,1)]:self.assertFalse(tip.Shape.isInside(A.Vector(*point),1e-7,True))
            self.assertTrue(tip.Shape.isInside(A.Vector(-8,0,1),1e-7,True))
        finally:A.closeDocument(doc.Name)

    def test_unsupported_nested_pattern_rejected(self):
        spec=fixture();spec['parts'][0]['features'][1]['pattern_feature']=copy.deepcopy(spec['parts'][0]['features'][1])
        with self.assertRaises(ValueError):validate_spec(spec)
        spec=fixture();spec['parts'][0]['features'][1]['count']=1
        with self.assertRaises(ValueError):validate_spec(spec)

    def test_saved_master_edit_and_step(self):
        import FreeCAD as A
        import Part
        from cad_pipeline.generate import build
        from cad_pipeline.fast_build import build_part
        from cad_pipeline.saved_recipe_agreement import compare
        spec=fixture();validate_spec(spec)
        root=Path('build/cad-tests')/str(uuid.uuid4());build(spec,root)
        doc=A.openDocument(str(root/'pattern-fixture.FCStd'));doc.recompute()
        try:
            tip=next(o for o in doc.Objects if hasattr(o,'StablePartID'))
            self.assertTrue(compare(tip.Shape,build_part(spec['parts'][0],spec['parameters']),'pattern')['passed'])
            copies=[o for o in doc.Objects if o.Name.startswith('Plate_F2_Copy')]
            self.assertEqual(len(copies),8)
            self.assertEqual(len({o.Links[0].Name for o in copies}),1)
            doc.Parameters.size=1.1;doc.recompute();edited=copy.deepcopy(spec['parameters']);edited['size']['value']=1.1
            self.assertTrue(compare(tip.Shape,build_part(spec['parts'][0],edited),'edit')['passed'])
            step=root/'edited.step';Part.export([tip],str(step));shape=Part.read(str(step))
            self.assertTrue(shape.isValid());self.assertEqual(len(shape.Solids),1)
            self.assertLess(abs(shape.Volume-tip.Shape.Volume)/shape.Volume,1e-6)
        finally:A.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
