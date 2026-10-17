import copy
import unittest
from cad_pipeline.part_retirement import digest,validate


class RetirementTests(unittest.TestCase):
    def setUp(self):
        self.old=dict(parts=[dict(id='Stub1',features=[1]),dict(id='Stub2',features=[2]),dict(id='Drive',features=[3])])
        self.new=dict(parts=[dict(id='Shaft',features=[4]),dict(id='Drive',features=[3])])
        self.manifest=dict(schema_version=1,source_spec_sha256=digest(self.old),target_spec_sha256=digest(self.new),
            source_native_sha256='frozen',authorization='User permitted bank rework',decision='Two ends replaced by one shaft',
            retired=[dict(id=p['id'],source_recipe_sha256=digest(p),reason='Replaced short stub',successor_ids=['Shaft']) for p in self.old['parts'][:2]])

    def test_exact_replacement_and_default_protection(self):
        self.assertEqual(validate(self.old,self.new,self.manifest),['Stub1','Stub2'])
        with self.assertRaises(ValueError):validate(self.old,self.new)
        self.assertEqual(validate(self.old,self.old),[])

    def test_manifest_cannot_suppress_unrelated_or_changed_identity(self):
        for mutation in ['missing','duplicate','recipe','successor','target','source','authorization']:
            m=copy.deepcopy(self.manifest)
            if mutation=='missing':m['retired'].pop()
            elif mutation=='duplicate':m['retired'][1]=m['retired'][0]
            elif mutation=='recipe':m['retired'][0]['source_recipe_sha256']='changed'
            elif mutation=='successor':m['retired'][0]['successor_ids']=['Unknown']
            elif mutation=='target':m['target_spec_sha256']='other'
            elif mutation=='source':m['source_spec_sha256']='other'
            else:m['authorization']=''
            with self.subTest(mutation=mutation),self.assertRaises(ValueError):validate(self.old,self.new,m)
        dependent=copy.deepcopy(self.new);dependent['parts'][0]['geometry_instance_of']='Stub1'
        m=copy.deepcopy(self.manifest);m['target_spec_sha256']=digest(dependent)
        with self.assertRaises(ValueError):validate(self.old,dependent,m)


if __name__=='__main__':unittest.main()
