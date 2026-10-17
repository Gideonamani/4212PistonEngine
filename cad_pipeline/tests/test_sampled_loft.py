"""Smooth sampled profiles retain their saved native scale and STEP solids."""
import copy
from pathlib import Path
import unittest
import uuid
from cad_pipeline.spec import validate_spec


def fixture():
    rows=[]
    for x in [2,3,4]:
        points=[[x,-1,-1],[x,-.8,0],[x,-.5,1],[x,.5,1],[x,.8,0],[x,1,-1]]
        rows.append([[str(v)+'*module' for v in point] for point in points])
    feature=dict(primitive='loft',operation='add',sections=rows,
                 profile_spline_runs=[[0,2],[3,5]],scale_parameter='module',origin=[10,0,0])
    return dict(schema_version=1,model_id='sampled-fixture',units='mm',input_mode='text',
                scope='Interpolated profile and live scale fixture',sources={},
                parameters=dict(module=dict(value=2.,unit='mm',status='inferred',rationale='Fixture scale')),
                parts=[dict(id='Tool',label='Sampled loft',group='fixture',evidence='Fixture',features=[feature])])


class SampledLoft(unittest.TestCase):
    def test_bounded_bezier_fit_against_analytic_volume(self):
        import FreeCAD as A
        import Part
        from cad_pipeline.fast_build import feature_shape
        from cad_pipeline.generate import build
        spec=fixture();f=spec['parts'][0]['features'][0]
        rows=[]
        for x in [2,3,4]:
            left=[];right=[]
            for i in range(9):
                z=-1+i/4;w=1+.05*z*z+.03*z*z*z
                left.append([x,-w,z]);right.append([x,w,z])
            rows.append([[str(v)+'*module' for v in p] for p in left+list(reversed(right))])
        f.update(sections=rows,profile_spline_runs=[[0,8],[9,17]],profile_curve_mode='bezier_fit',profile_curve_degree=5,profile_parameterization='uniform_levels')
        validate_spec(spec);shape=feature_shape(f,spec['parameters'])
        expected=(4+4*.05/3)*2*2**3
        self.assertAlmostEqual(shape.Volume,expected,places=6)
        out=Path('build/cad-tests/bezier-'+uuid.uuid4().hex);build(spec,out)
        doc=A.openDocument(str(out/'sampled-fixture.FCStd'));doc.recompute()
        try:
            tip=next(o for o in doc.Objects if getattr(o,'StablePartID',None)=='Tool')
            self.assertAlmostEqual(tip.Shape.Volume,expected,places=6)
            doc.Parameters.module=2.1;doc.recompute()
            self.assertAlmostEqual(tip.Shape.Volume,expected*(2.1/2)**3,places=6)
        finally:A.closeDocument(doc.Name)
        self.assertAlmostEqual(Part.read(str(out/'sampled-fixture.step')).Volume,expected,places=6)

    def test_copied_scale_link_rebinds_and_survives_source_close(self):
        import FreeCAD as A
        import Part
        from cad_pipeline.generate import build
        from cad_pipeline.graft_native_history import copy_history
        from cad_pipeline.fast_build import feature_shape
        from cad_pipeline.saved_recipe_agreement import compare
        old=fixture();new=copy.deepcopy(old);new['model_id']='sampled-target'
        new['parts'].append(dict(id='Fixed',label='Fixed',group='fixture',evidence='Fixture',features=[dict(primitive='box',operation='add',length=1,width=1,height=1,origin=[100,0,0])]))
        root=Path('build/cad-tests/sampled-graft-'+uuid.uuid4().hex)
        build(old,root/'source');build(new,root/'target',only=['Fixed'])
        source=A.openDocument(str(root/'source/sampled-fixture.FCStd'));target=A.openDocument(str(root/'target/sampled-target.FCStd'))
        try:
            copied=copy_history(target,source,old['parts'][0],old,new)
            self.assertTrue(copied['material_agreement']['passed'])
            file=root/'grafted.FCStd';target.saveAs(str(file));A.closeDocument(source.Name);source=None
            A.closeDocument(target.Name);target=A.openDocument(str(file))
            target.Parameters.module=2.1;target.recompute()
            tip=next(o for o in target.Objects if getattr(o,'StablePartID',None)=='Tool')
            params=copy.deepcopy(old['parameters']);params['module']['value']=2.1
            self.assertTrue(compare(tip.Shape,feature_shape(old['parts'][0]['features'][0],params),'Copied module edit')['passed'])
            step=root/'grafted.step';Part.export([tip],str(step))
            exported=Part.read(str(step));self.assertEqual(len(exported.Solids),1);self.assertTrue(exported.isValid())
        finally:
            if source is not None:A.closeDocument(source.Name)
            A.closeDocument(target.Name)

    def test_bad_controls_and_rejected_c0_representation(self):
        spec=fixture();validate_spec(spec)
        for value in ['module*module','1/module','2+module','other','1/(module-3)']:
            bad=copy.deepcopy(spec);bad['parts'][0]['features'][0]['sections'][0][0][0]=value
            with self.assertRaises((ValueError,KeyError)):validate_spec(bad)
        bad=copy.deepcopy(spec);bad['parts'][0]['features'][0]['profile_spline_runs']=[[0,3],[2,5]]
        with self.assertRaises(ValueError):validate_spec(bad)
        bad=copy.deepcopy(spec);bad['parts'][0]['features'][0]['bilinear_patches']=[0,2,3,5]
        with self.assertRaisesRegex(ValueError,'failed full-cutter'):validate_spec(bad)

    def test_saved_native_reopen_edit_and_step(self):
        import FreeCAD as A
        import Part
        from cad_pipeline.fast_build import feature_shape
        from cad_pipeline.generate import build
        from cad_pipeline.saved_recipe_agreement import compare
        spec=fixture();f=spec['parts'][0]['features'][0];params=spec['parameters']
        direct=feature_shape(f,params)
        out=Path('build/cad-tests/sampled-'+uuid.uuid4().hex);build(spec,out)
        doc=A.openDocument(str(out/'sampled-fixture.FCStd'));doc.recompute()
        try:
            tip=next(o for o in doc.Objects if getattr(o,'StablePartID',None)=='Tool')
            self.assertEqual(tip.TypeId,'Part::Compound')
            self.assertEqual(tip.Links[0].TypeId,'App::Link')
            self.assertTrue(compare(tip.Shape,direct,'Saved sampled loft')['passed'])
            doc.Parameters.module=2.1;doc.recompute()
            self.assertTrue(tip.Shape.isValid());self.assertEqual(len(tip.Shape.Solids),1)
            changed=copy.deepcopy(params);changed['module']['value']=2.1
            reference=feature_shape(f,changed)
            self.assertTrue(compare(tip.Shape,reference,'Changed saved module')['passed'])
            self.assertAlmostEqual(tip.Shape.BoundBox.XMin,10+2*2.1,places=7)
        finally:A.closeDocument(doc.Name)
        step=Part.read(str(out/'sampled-fixture.step'))
        self.assertTrue(step.isValid());self.assertEqual(len(step.Solids),1)
        self.assertTrue(compare(step,direct,'Sampled STEP')['passed'])


if __name__=='__main__':unittest.main()
