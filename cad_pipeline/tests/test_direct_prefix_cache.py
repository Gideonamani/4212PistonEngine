"""Direct prefix reuse needs both exact source identity and safe dependencies."""
import copy
import tempfile
import unittest
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.fast_build import build_part, part_key
from cad_pipeline.direct_prefix_cache import seed
from cad_pipeline.spec import deflection_for
from cad_pipeline.saved_native_stock import file_sha
from cad_pipeline.saved_recipe_agreement import compare
from cad_pipeline.gtsio_core import cylinder


class DirectPrefix(unittest.TestCase):
    def test_hash_dependency_guard_and_independent_result(self):
        parameter=lambda v:dict(value=v,unit='mm',status='inferred',source_ids=[],rationale='Fixture')
        old=dict(parameters={'radius':parameter(5.)},parts=[dict(id='Shaft',label='Shaft',group='fixture',material='steel',evidence='Fixture',features=[cylinder('radius',20,[0,0,0])])])
        new=copy.deepcopy(old)
        new['parts'][0]['features'] += [cylinder(7,5,[0,0,5]),cylinder(1.5,22,[0,0,-1],op='cut')]
        base=Path('build').resolve();base.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=str(base)) as temporary:
            root=Path(temporary);part=old['parts'][0]
            source=root/(part['id']+'-'+part_key(part,old['parameters'],deflection_for(old,part))+'.brep')
            build_part(part,old['parameters']).exportBrep(str(source))
            digest=file_sha(source)
            with self.assertRaisesRegex(ValueError,'identity/hash'):
                seed(old,new,'Shaft',source,'0'*64,root/'bad-hash')
            changed=copy.deepcopy(new);changed['parameters']['radius']['value']=5.1
            with self.assertRaisesRegex(ValueError,'dependencies changed'):
                seed(old,changed,'Shaft',source,digest,root/'bad-dependency')
            report=seed(old,new,'Shaft',source,digest,root/'valid')
            target=next((root/'valid/brep-cache').glob('*.brep'))
            self.assertEqual(report['source_brep_sha256'],digest)
            self.assertEqual(report['appended_features'],2)
            self.assertTrue(compare(Part.read(str(target)),build_part(new['parts'][0],new['parameters']),'independent-prefix')['passed'])
            self.assertFalse((root/'bad-hash').exists())
            self.assertFalse((root/'bad-dependency').exists())


if __name__=='__main__':unittest.main()
