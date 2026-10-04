import copy,json,unittest,uuid
from pathlib import Path
from cad_pipeline.research_gate import review

ROOT=Path(__file__).resolve().parents[2]

class ResearchTests(unittest.TestCase):
    def setUp(self):self.inv=json.loads((ROOT/'cad-studies/wright-1903/revision-2/inventory.json').read_text())
    def test_missing_source_callout_rejected(self):
        self.inv['components']=[c for c in self.inv['components'] if c['id']!='39']
        with self.assertRaises(ValueError):review(self.inv)
    def test_inventory_cannot_claim_absent_geometry(self):
        ids={p for c in self.inv['components'] for p in c['part_ids']};ids.remove('IgnitionDrivePin')
        with self.assertRaises(ValueError):review(self.inv,ids)
    def test_fundamental_gap_blocks_generation(self):
        self.inv['gaps'][0]['blocks_selected_scope']=True
        with self.assertRaises(ValueError):review(self.inv)

class NativeFeatures(unittest.TestCase):
    def test_reopened_sketch_and_spring_regenerate(self):
        import FreeCAD as A
        from cad_pipeline.generate import build
        params={n:dict(value=v,unit='mm',status='inferred',source_ids=[],rationale='Native feature regression fixture') for n,v in [('width',15),('coil_radius',6)]}
        spec=dict(schema_version=1,model_id='native-features',units='mm',input_mode='text',scope='Native feature regression fixture',sources={},parameters=params,parts=[
          dict(id='Profile',label='Profile',group='test',evidence='Fixture',features=[dict(primitive='prism',operation='add',height=10,points=[[0,0],['width',0],['width',8],[4,12],[0,8]],axis=[0,1,0])]),
          dict(id='Spring',label='Spring',group='test',evidence='Fixture',features=[dict(primitive='helix',operation='add',radius='coil_radius',wire_radius=1,pitch=4,height=12,origin=[30,0,0])])])
        output=ROOT/'build/cad-tests'/str(uuid.uuid4());build(spec,output)
        doc=A.openDocument(str(output/'native-features.FCStd'));doc.recompute()
        try:
            objects={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')};old=objects['Spring'].Shape.Volume
            records={p['id']:p for p in json.loads((output/'cad-validation.json').read_text())['parts']}
            for id,obj in objects.items():
                box=obj.Shape.optimalBoundingBox(False,False);actual=[[box.XMin,box.YMin,box.ZMin],[box.XMax,box.YMax,box.ZMax]]
                self.assertLess(max(abs(actual[j][i]-records[id]['bounds_mm'][j][i]) for j in range(2) for i in range(3)),1e-5)
            doc.Parameters.width=22;doc.Parameters.coil_radius=8;doc.recompute()
            self.assertAlmostEqual(objects['Profile'].Shape.BoundBox.XLength,22)
            self.assertGreater(objects['Spring'].Shape.Volume,old)
            for o in objects.values():self.assertTrue(o.Shape.isValid());self.assertEqual(len(o.Shape.Solids),1)
            self.assertTrue(any(o.TypeId=='Sketcher::SketchObject' and o.FullyConstrained for o in doc.Objects))
        finally:A.closeDocument(doc.Name)
