import json,math,uuid,unittest
from pathlib import Path
from cad_pipeline.spec import evaluate,validate_spec
from cad_pipeline.fit_mesh import fit_circle
import numpy as np

R=Path(__file__).resolve().parents[1]

class SpecTests(unittest.TestCase):
    def setUp(self):self.spec=json.loads((R/'examples/bearing-housing.json').read_text())
    def test_reject_executable_expression(self):
        for value in ["__import__('os').system('echo unsafe')",'bore.__class__','[bore][0]']:
            with self.assertRaises(ValueError):evaluate(value,self.spec['parameters'])
    def test_evidence_reference_required(self):
        self.spec['parameters']['bore']['source_ids']=['nonexistent']
        with self.assertRaises(ValueError):validate_spec(self.spec)
    def test_unknown_cannot_drive_geometry(self):
        self.spec['parameters']['bore']['status']='unknown';self.spec['parameters']['bore']['value']=None
        with self.assertRaises((ValueError,TypeError)):validate_spec(self.spec)
    def test_circle_fit_translation_and_radius(self):
        t=np.linspace(0,2*math.pi,100,endpoint=False);pts=np.column_stack((12+7*np.cos(t),-4+7*np.sin(t)));result=fit_circle(pts)
        np.testing.assert_allclose(result['center'],[12,-4],atol=1e-9);self.assertAlmostEqual(result['radius'],7);self.assertLess(result['rms'],1e-9)
    def test_degenerate_circle_rejected(self):
        with self.assertRaises(ValueError):fit_circle(np.column_stack((np.arange(20),np.zeros(20))))

class CADTests(unittest.TestCase):
    def test_saved_housing_features_and_dimension_regeneration(self):
        import FreeCAD as A
        from cad_pipeline.generate import build
        spec=json.loads((R/'examples/bearing-housing.json').read_text())
        directory=R.parent/'build/cad-tests'/str(uuid.uuid4());directory.mkdir(parents=True)
        build(spec,directory);doc=A.openDocument(str(directory/'bearing-housing.FCStd'));doc.recompute()
        try:
            body=[o for o in doc.Objects if hasattr(o,'StablePartID')][0]
            circles=[f.Surface.Radius for f in body.Shape.Faces if f.Surface.__class__.__name__=='Cylinder']
            self.assertEqual(sum(abs(r-4)<1e-7 for r in circles),4);self.assertEqual(sum(abs(r-15)<1e-7 for r in circles),1)
            volume=body.Shape.Volume;doc.Parameters.bore=40;doc.Parameters.length=120;doc.recompute()
            circles=[f.Surface.Radius for f in body.Shape.Faces if f.Surface.__class__.__name__=='Cylinder']
            self.assertTrue(body.Shape.isValid());self.assertEqual(len(body.Shape.Solids),1);self.assertAlmostEqual(body.Shape.BoundBox.XLength,120)
            self.assertTrue(any(abs(r-20)<1e-7 for r in circles));self.assertNotAlmostEqual(volume,body.Shape.Volume)
            mounting_centers=sorted({round(f.Surface.Center.x,6) for f in body.Shape.Faces if f.Surface.__class__.__name__=='Cylinder' and abs(f.Surface.Radius-4)<1e-7})
            self.assertEqual(mounting_centers,[10,110])
        finally:A.closeDocument(doc.Name)

if __name__=='__main__':unittest.main()
