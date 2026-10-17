"""Cache transport tests; dummy BREP bytes are never interpreted as geometry."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cad_pipeline.fast_build import part_key
from cad_pipeline.spec import deflection_for
from cad_pipeline.reuse_direct_snapshot import reuse


class SnapshotReuseTest(unittest.TestCase):
    def setUp(self):
        self.temp_parent=(Path(__file__).resolve().parents[1]/'build/cache-transport-tests').resolve()
        self.temp_parent.mkdir(parents=True,exist_ok=True)
        self.tmp=tempfile.TemporaryDirectory(dir=self.temp_parent);self.root=Path(self.tmp.name).resolve()
        self.spec={
            'schema_version':1,
            'units':'mm',
            'model_id':'snapshot-reuse-fixture',
            'scope':'Cache transport test fixture',
            'input_mode':'mixed',
            'sources':{'manual':{'path':'Notes/gtsio520_series.pdf'}},
            'parameters':{
                'StarterShaftGear_x':{'value':75.6,'unit':'mm','status':'inferred','source_ids':['manual'],'rationale':'Fixture'},
                'StarterShaftGear_y':{'value':0.0,'unit':'mm','status':'inferred','source_ids':['manual'],'rationale':'Fixture'},
                'starter_front_bearing_outer':{'value':13.0,'unit':'mm','status':'inferred','source_ids':['manual'],'rationale':'Fixture'},
            },
            'tessellation':{'default_mm':0.1,'groups':{'starter_drive':0.06}},
            'parts':[{
                'id':'StarterRearBearing',
                'label':'Simplified starter rear bearing ring',
                'group':'starter_drive',
                'material':'steel',
                'features':[{'primitive':'tube','operation':'add','radius':13.0,'height':10.0,'origin':['StarterShaftGear_x','StarterShaftGear_y',-153.0],'axis':[0,0,1],'label':'','inner_radius':9.525}],
                'evidence':'X-30045A A-4-15:32',
                'source_callouts':['A-4-15:32'],
                'boolean_refine':True,
            }],
        }
        p=self.spec['parts'][0];self.key=part_key(p,self.spec['parameters'],deflection_for(self.spec,p))
        self.src=self.root/'source'
        for name in ('part-cache','brep-cache'):(self.src/name).mkdir(parents=True)
        self.json=self.src/'part-cache/StarterRearBearing.json'
        self.brep=self.src/'brep-cache'/('StarterRearBearing-'+self.key+'.brep')
        self.brep.write_bytes(b'immutable transport test, not CAD')
        self.json.write_text(json.dumps(dict(key=self.key,record=dict(id='StarterRearBearing',solids=1,valid=True,volume_mm3=10))))
    def tearDown(self):
        if not self.root.is_relative_to(self.temp_parent):raise ValueError('Unexpected fixture cleanup path')
        self.tmp.cleanup()
    def test_independent_json_and_unchanged_brep(self):
        out=self.root/'out';r=reuse(self.spec,self.src,out)
        self.assertEqual(len(r['reused']),1)
        (out/'part-cache/StarterRearBearing.json').write_text('changed destination metadata')
        self.assertEqual(json.loads(self.json.read_text())['key'],self.key)
        self.assertEqual((out/'brep-cache'/self.brep.name).read_bytes(),self.brep.read_bytes())
        with self.assertRaises(ValueError):reuse(self.spec,self.src,self.src)
    def test_changed_geometry_and_parameter_not_reused(self):
        for n,kind in enumerate(('geometry','parameter','tessellation')):
            s=copy.deepcopy(self.spec)
            if kind=='geometry':s['parts'][0]['features'][0]['height']=11.
            elif kind=='parameter':s['parameters']['starter_front_bearing_outer']['value']+=1
            else:s['tessellation']['groups']['starter_drive']=.031
            r=reuse(s,self.src,self.root/str(n));self.assertEqual(r['reused'],[])
            self.assertEqual(r['rebuild'],['StarterRearBearing'])
    def test_invalid_or_misidentified_record_not_reused(self):
        original=json.loads(self.json.read_text())
        for n,(field,value) in enumerate([('id','AnotherPart'),('valid',False),('solids',2),('volume_mm3',0)]):
            data=copy.deepcopy(original);data['record'][field]=value;self.json.write_text(json.dumps(data))
            self.assertEqual(reuse(self.spec,self.src,self.root/str(n))['reused'],[])


if __name__=='__main__':unittest.main()
