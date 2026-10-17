"""Adoption fixture: linked local solid, native assembly placement and saved edits."""
import json
import copy
import math
import unittest
from pathlib import Path
import FreeCAD as App
import Part
from cad_pipeline.generate import build
from cad_pipeline.fast_build import build_part


class NativePlacementTest(unittest.TestCase):
    def test_retry_can_force_sequential_despite_part_policy(self):
        from cad_pipeline.generate import build_part as native_part
        doc=App.newDocument('SequentialRetryFixture')
        try:
            part=dict(id='Retry',label='Boolean retry fixture',group='fixture',evidence='Method fixture',boolean_batch_runs=6,
                      features=[dict(primitive='box',operation='add',length=20,width=14,height=5)]+[dict(primitive='cylinder',operation='cut',radius=1,height=7,origin=[2+3*i,7,-1]) for i in range(6)])
            _,tip=native_part(doc,part,{},6,force_sequential=True);doc.recompute()
            self.assertTrue(tip.Shape.isValid());self.assertEqual(len(tip.Shape.Solids),1)
            self.assertAlmostEqual(tip.Shape.Volume,1400-6*math.pi*5,places=6)
            self.assertFalse(any(o.TypeId=='Part::MultiFuse' for o in doc.Objects))
        finally:App.closeDocument(doc.Name)

    def test_shared_local_geometry_keeps_identities_and_edits(self):
        root=Path(__file__).resolve().parents[2]
        spec=json.loads((root/'cad_pipeline/examples/bearing-housing.json').read_text())
        spec['model_id']='shared-local-geometry-fixture';spec['scope']='Illustrative native shared-geometry method fixture'
        spec['parameters']={n:dict(value=v,unit='mm',status='inferred',rationale='Fixture') for n,v in [('length',20),('height',5)]}
        master=dict(id='Master',label='Master local geometry',group='fixture',material='steel',evidence='Method fixture',placement=dict(origin=[0,0,20],rotation_quaternion=[0,0,0,1],mirror_normal=[0,0,1]),features=[dict(primitive='box',operation='add',length='length',width=12,height='height'),dict(primitive='cylinder',operation='cut',radius=2,height='height+.2',origin=[10,6,-.1])])
        instance=copy.deepcopy(master);instance.update(id='Copy',label='Placed shared casting',geometry_instance_of='Master');instance['placement'].update(origin=[0,0,100],rotation_quaternion=[0,1,0,0])
        spec['parts']=[master,instance];out=root/'build/method-fixtures/shared-local';build(spec,out)
        doc=App.openDocument(str(out/(spec['model_id']+'.FCStd')));doc.recompute()
        try:
            tips={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')}
            self.assertEqual(set(tips),{'Master','Copy'});self.assertIs(tips['Master'].Links[0],tips['Copy'].Links[0])
            self.assertEqual(tips['Copy'].GeometryMasterID,'Master')
            self.assertAlmostEqual(tips['Copy'].Shape.Volume,build_part(instance,spec['parameters']).Volume,places=6)
            doc.Parameters.length=30;doc.Parameters.height=7;doc.recompute()
            self.assertAlmostEqual(tips['Master'].Shape.BoundBox.XMax,30);self.assertAlmostEqual(tips['Copy'].Shape.BoundBox.XMin,-30)
            self.assertAlmostEqual(tips['Copy'].Shape.BoundBox.ZMax,107)
            doc.saveAs(str(out/'edited.FCStd'));Part.export(list(tips.values()),str(out/'edited.step'))
        finally:App.closeDocument(doc.Name)
        doc=App.openDocument(str(out/'edited.FCStd'));doc.recompute()
        try:
            tips=[o for o in doc.Objects if hasattr(o,'StablePartID')];step=Part.read(str(out/'edited.step'))
            self.assertEqual(len(tips),2);self.assertEqual(len(step.Solids),2);self.assertTrue(step.isValid())
            self.assertLess(abs(sum(o.Shape.Volume for o in tips)-step.Volume)/step.Volume,1e-6)
        finally:App.closeDocument(doc.Name)
        from cad_pipeline.spec import validate_spec
        invalid=copy.deepcopy(spec);invalid['parts'][1]['features'][0]['width']=13
        with self.assertRaisesRegex(ValueError,'differs from master'):validate_spec(invalid)

    def test_saved_mirror_then_rigid_placement(self):
        root=Path(__file__).resolve().parents[2]
        spec=json.loads((root/'cad_pipeline/examples/bearing-housing.json').read_text());spec['model_id']='mirrored-placement-fixture';spec['scope']='Illustrative method fixture'
        spec['parameters']={n:dict(value=v,unit='mm',status='inferred',rationale='Fixture') for n,v in [('height',5),('station',300)]}
        part=dict(id='MirrorPlaced',label='Mirrored placed solid',group='fixture',material='steel',evidence='Method fixture',placement=dict(origin=[0,0,'station'],rotation_quaternion=[0,1,0,0],mirror_normal=[0,0,1]),features=[dict(primitive='box',operation='add',length=20,width=10,height='height',origin=[0,0,0])])
        spec['parts']=[part];out=root/'build/method-fixtures/mirror-placement';out.mkdir(parents=True,exist_ok=True);build(spec,out)
        doc=App.openDocument(str(out/(spec['model_id']+'.FCStd')));doc.recompute()
        try:
            obj=next(o for o in doc.Objects if hasattr(o,'StablePartID'));direct=build_part(part,spec['parameters'])
            self.assertTrue(obj.Shape.isValid());self.assertEqual(len(obj.Shape.Solids),1)
            self.assertLess(abs(obj.Shape.Volume-direct.Volume)/obj.Shape.Volume,1e-6)
            self.assertAlmostEqual(obj.Shape.BoundBox.XMin,-20);self.assertAlmostEqual(obj.Shape.BoundBox.ZMin,300);self.assertAlmostEqual(obj.Shape.BoundBox.ZMax,305)
            doc.Parameters.height=7;doc.recompute();self.assertAlmostEqual(obj.Shape.BoundBox.ZMax,307)
            doc.saveAs(str(out/'edited.FCStd'));Part.export([obj],str(out/'edited.step'))
        finally:App.closeDocument(doc.Name)
        doc=App.openDocument(str(out/'edited.FCStd'));doc.recompute()
        try:
            shape=next(o.Shape for o in doc.Objects if hasattr(o,'StablePartID'));step=Part.read(str(out/'edited.step'))
            self.assertTrue(shape.isValid());self.assertTrue(step.isValid());self.assertEqual(len(step.Solids),1)
            self.assertLess(abs(step.Volume-shape.Volume)/shape.Volume,1e-6)
        finally:App.closeDocument(doc.Name)

    def test_linked_compound_placement_reopens_and_propagates(self):
        root=Path(__file__).resolve().parents[2]
        spec=json.loads((root/'cad_pipeline/examples/bearing-housing.json').read_text())
        spec['model_id']='local-solid-placement-fixture';spec['scope']='Illustrative placement method fixture'
        spec['parameters']={n:dict(value=v,unit='mm',status='inferred',rationale='Method fixture') for n,v in [('length',20),('station',300)]}
        part=dict(id='PlacedSolid',label='Linked placed solid',group='fixture',material='steel',evidence='Method fixture',placement=dict(origin=[0,0,'station'],rotation_quaternion=[0,1,0,0]),features=[dict(primitive='box',operation='add',length='length',width=10,height=5,origin=[0,0,0]),dict(primitive='cylinder',operation='cut',radius=3,height=7,origin=[10,5,-1])])
        spec['parts']=[part];out=root/'build/method-fixtures/part-placement';out.mkdir(parents=True,exist_ok=True)
        build(spec,out);doc=App.openDocument(str(out/(spec['model_id']+'.FCStd')));doc.recompute()
        try:
            obj=next(o for o in doc.Objects if hasattr(o,'StablePartID'));shape=obj.Shape;direct=build_part(part,spec['parameters'])
            self.assertEqual(obj.TypeId,'Part::Compound');self.assertEqual(len(obj.Links),1)
            self.assertEqual(len(shape.Solids),1);self.assertTrue(shape.isValid())
            self.assertLess(abs(shape.Volume-direct.Volume)/shape.Volume,1e-6)
            for measured,target in [(shape.BoundBox.XMin,-20),(shape.BoundBox.XMax,0),(shape.BoundBox.YMin,0),(shape.BoundBox.YMax,10),(shape.BoundBox.ZMin,295),(shape.BoundBox.ZMax,300)]:self.assertAlmostEqual(measured,target,places=7)
            doc.Parameters.length=25;doc.Parameters.station=364;doc.recompute()
            self.assertAlmostEqual(obj.Shape.BoundBox.XMin,-25,places=7);self.assertAlmostEqual(obj.Shape.BoundBox.ZMax,364,places=7)
            self.assertAlmostEqual(obj.Shape.Volume,25*10*5-math.pi*9*5,places=7)
            self.assertFalse(obj.Shape.isInside(App.Vector(-10,5,361),1e-6,True))
            doc.saveAs(str(out/'edited.FCStd'));Part.export([obj],str(out/'edited.step'))
        finally:App.closeDocument(doc.Name)
        doc=App.openDocument(str(out/'edited.FCStd'));doc.recompute()
        try:
            shape=next(o.Shape for o in doc.Objects if hasattr(o,'StablePartID'));step=Part.read(str(out/'edited.step'))
            self.assertTrue(step.isValid());self.assertEqual(len(step.Solids),1)
            self.assertLess(abs(step.Volume-shape.Volume)/shape.Volume,1e-6)
            self.assertAlmostEqual(step.BoundBox.ZMax,364,places=7)
        finally:App.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
