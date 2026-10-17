"""Cache provenance/eligibility tests; file stubs do not establish CAD validity."""
import copy
import json
import uuid
import unittest
from pathlib import Path
from cad_pipeline.adopt_direct_cache import adopt
from cad_pipeline.extend_saved_native import file_hash, spec_hash
from cad_pipeline.fast_build import part_key
from cad_pipeline.spec import deflection_for


class CacheAdoptionTests(unittest.TestCase):
    def setUp(self):
        self.root=Path(__file__).resolve().parents[2]/'build/method-fixtures'/('cache-adoption-'+uuid.uuid4().hex)
        self.root.mkdir(parents=True)
        self.base=self.root/'base';self.base.mkdir()
        self.cache=self.root/'cache'
        for name in ('part-cache','brep-cache'):(self.cache/name).mkdir(parents=True)
        self.old=json.loads((Path(__file__).resolve().parents[1]/'examples/bearing-housing.json').read_text())
        master=copy.deepcopy(self.old['parts'][0]);master['id']='Master'
        master['features']=[dict(primitive='box',operation='add',length='length',width=8,height=6,origin=[0,0,0])]
        master['placement']=dict(origin=[0,0,0],rotation_quaternion=[0,0,0,1])
        fixed=copy.deepcopy(master);fixed['id']='Fixed';fixed['features'][0]['length']=12
        instance=dict(id='Instance',label='Instance',group='housing',material='aluminium',
                      evidence='Cache metadata fixture',geometry_instance_of='Master',
                      features=copy.deepcopy(master['features']),
                      placement=dict(origin=[0,30,0],rotation_quaternion=[0,0,0,1]))
        self.old['parts']=[master,fixed,instance]
        self.new=copy.deepcopy(self.old)
        self.native=self.base/'bearing-housing.FCStd';self.native.write_bytes(b'Native file hash fixture only')
        self.step=self.base/'bearing-housing.step';self.step.write_bytes(b'STEP file hash fixture only')
        self.report=dict(model_id='bearing-housing',complete_spec=True,spec_sha256=spec_hash(self.old),
                         files={p.name:dict(sha256=file_hash(p)) for p in (self.native,self.step)})
        self.checks=self.root/'checks.json'
        self.checks.write_text(json.dumps(dict(passed=True,native_sha256=file_hash(self.native))))
        self.write_report()
        for part in self.old['parts']:
            key=part_key(part,self.old['parameters'],deflection_for(self.old,part))
            (self.cache/'part-cache'/(part['id']+'.json')).write_text(json.dumps(dict(
                key=key,record=dict(id=part['id'],solids=1,valid=True,volume_mm3=576))))
            (self.cache/'brep-cache'/(part['id']+'-'+key+'.brep')).write_bytes(b'BREP provenance fixture only')
        agreement=[dict(id=part['id'],passed=True,direct_brep_sha256=file_hash(self.cache/'brep-cache'/(part['id']+'-'+part_key(part,self.old['parameters'],deflection_for(self.old,part))+'.brep'))) for part in self.old['parts']]
        self.checks.write_text(json.dumps(dict(passed=True,native_sha256=file_hash(self.native),agreement=agreement)))

    def write_report(self):
        (self.base/'cad-validation.json').write_text(json.dumps(self.report))

    def run_adoption(self):
        return adopt(self.old,self.new,self.cache,self.base,self.checks,self.root/'output')

    def test_changed_control_rebuilds_master_and_instances_but_rekeys_fixed(self):
        self.new['parameters']['length']['value']=110
        result=self.run_adoption()
        self.assertEqual([p['id'] for p in result['adopted']],['Fixed'])
        record=result['adopted'][0]
        self.assertNotEqual(record['old_key'],record['new_key'])
        copied=self.root/'output/brep-cache'/('Fixed-'+record['new_key']+'.brep')
        self.assertEqual(file_hash(copied),record['brep_sha256'])
        self.assertFalse((self.root/'output/part-cache/Master.json').exists())

    def test_changed_package_is_rejected_before_cache_writes(self):
        self.step.write_bytes(b'Changed STEP')
        with self.assertRaisesRegex(ValueError,'Base package changed'):self.run_adoption()
        self.assertFalse((self.root/'output').exists())

    def test_incomplete_and_wrong_spec_are_rejected(self):
        self.report['complete_spec']=False;self.write_report()
        with self.assertRaisesRegex(ValueError,'complete base'):self.run_adoption()
        self.report['complete_spec']=True;self.report['spec_sha256']='wrong';self.write_report()
        with self.assertRaisesRegex(ValueError,'old specification'):self.run_adoption()

    def test_missing_or_wrong_key_cache_is_not_adopted(self):
        (self.cache/'part-cache/Master.json').unlink()
        path=self.cache/'part-cache/Fixed.json';data=json.loads(path.read_text());data['key']='wrong';path.write_text(json.dumps(data))
        result=self.run_adoption()
        self.assertEqual(result['missing_cache'],['Master','Fixed'])
        self.assertEqual([p['id'] for p in result['adopted']],['Instance'])

    def test_modified_brep_is_rejected_even_when_metadata_key_matches(self):
        file=next((self.cache/'brep-cache').glob('Fixed-*.brep'));file.write_bytes(b'Changed cache with unchanged recipe metadata')
        with self.assertRaisesRegex(ValueError,'Direct cache changed since passed agreement'):self.run_adoption()


if __name__=='__main__':unittest.main()
