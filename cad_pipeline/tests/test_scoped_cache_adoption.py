"""A checked native subset cannot authorize caches for unbuilt parts."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.generate import build as native
from cad_pipeline.fast_build import build as direct,build_part
from cad_pipeline.saved_recipe_agreement import compare
from cad_pipeline.saved_native_stock import file_sha
from cad_pipeline.adopt_direct_cache import adopt
from cad_pipeline.gtsio_core import cylinder


class ScopedAdoption(unittest.TestCase):
    def test_unbuilt_part_is_excluded_even_with_a_direct_cache(self):
        parameter=dict(value=1.,unit='mm',status='inferred',source_ids=[],rationale='Fixture')
        part=lambda id,x:dict(id=id,label=id,group='fixture',material='steel',evidence='Fixture',features=[cylinder(2,5,[x,0,0])])
        old=dict(schema_version=1,model_id='scoped-fixture',units='mm',input_mode='text',scope='Fixture',sources={},parameters={'unused':parameter},parts=[part('Checked',0),part('Peer',10),part('Unbuilt',20)])
        new=copy.deepcopy(old);new['parameters']['another_unused']=copy.deepcopy(parameter)
        base=Path('build').resolve()
        with tempfile.TemporaryDirectory(dir=str(base)) as temporary:
            root=Path(temporary);spec_file=root/'old.json';spec_file.write_text(json.dumps(old),encoding='utf-8')
            native(old,root/'native',only=['Checked','Peer']);direct(old,root/'direct',jobs=1)
            file=root/'native/scoped-fixture.FCStd';doc=A.openDocument(str(file));doc.recompute()
            agreements=[compare(o.Shape,build_part(next(p for p in old['parts'] if p['id']==o.StablePartID),old['parameters']),o.StablePartID) for o in doc.Objects if hasattr(o,'StablePartID')]
            A.closeDocument(doc.Name)
            checks=root/'checks.json';checks.write_text(json.dumps(dict(passed=True,native_sha256=file_sha(file),spec_sha256=file_sha(spec_file),agreements=agreements)),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'complete base'):adopt(old,new,root/'direct',root/'native',checks,root/'denied')
            result=adopt(old,new,root/'direct',root/'native',checks,root/'adopted',allow_subset=True,source_spec_path=spec_file)
            self.assertEqual({r['id'] for r in result['adopted']},{'Checked','Peer'})
            self.assertFalse(result['source_complete_spec'])
            self.assertFalse((root/'adopted/part-cache/Unbuilt.json').exists())
            selected=adopt(old,new,root/'direct',root/'native',checks,root/'selected',allow_subset=True,source_spec_path=spec_file,only=['Checked'],manifest_name='checked-only.json')
            self.assertEqual([r['id'] for r in selected['adopted']],['Checked'])
            self.assertFalse((root/'selected/part-cache/Peer.json').exists())
            self.assertTrue((root/'selected/checked-only.json').exists())
            for ids in [['Unbuilt'],['Checked','Checked']]:
                with self.assertRaisesRegex(ValueError,'unique checked unchanged'):
                    adopt(old,new,root/'direct',root/'native',checks,root/'invalid-selection',allow_subset=True,source_spec_path=spec_file,only=ids)
            cache=next((root/'direct/brep-cache').glob('Checked-*.brep'))
            changed=Part.read(str(cache));changed.translate(A.Vector(1,0,0));changed.exportBrep(str(cache))
            with self.assertRaisesRegex(ValueError,'actual checked native solid'):
                adopt(old,new,root/'direct',root/'native',checks,root/'tampered',allow_subset=True,source_spec_path=spec_file)


if __name__=='__main__':unittest.main()
