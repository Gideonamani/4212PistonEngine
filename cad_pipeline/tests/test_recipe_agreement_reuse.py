import copy,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from cad_pipeline.recipe_agreement_reuse import eligible
from cad_pipeline.atomic_reports import write_json


class ReuseTests(unittest.TestCase):
    def setUp(self):
        self.old={'A':dict(id='A',bounds_error_mm=0,relative_volume_error=0,boundary_difference_mm3=None)}
        self.adopted={'A':dict(brep_sha256='direct')}
    def result(self,native='native',direct='direct'):
        return eligible(self.old,'A',native,direct,{'A':'native'},self.adopted)
    def test_exact_identities_and_completed_measurements(self):
        self.assertTrue(self.result()['passed'])
        self.assertIsNone(self.result(native='changed'))
        self.assertIsNone(self.result(direct='changed'))
        self.old['A']['relative_volume_error']=.00004
        self.assertIsNone(self.result())
    def test_failed_or_missing_certificate_recomputed(self):
        self.old['A']['passed']=False;self.assertIsNone(self.result())
        self.old['A']['passed']=True;self.old['A']['boundary_difference_mm3']=[.008,0];self.assertIsNone(self.result())
        self.adopted.clear();self.assertIsNone(self.result())
        self.old['A']['boundary_difference_mm3']=None
        self.old['A']['direct_brep_sha256']='direct';self.assertTrue(self.result()['passed'])
        self.assertIsNone(self.result(direct='changed'))
    def test_transient_lock_retries_preserve_atomic_replace(self):
        with tempfile.TemporaryDirectory(dir='build') as d:
            target=Path(d)/'checkpoint.json';target.write_text('old')
            original=Path.replace;calls=[]
            def replace(path,destination):
                calls.append(1)
                if len(calls)<3:raise PermissionError('transient test lock')
                return original(path,destination)
            with patch.object(Path,'replace',replace),patch('cad_pipeline.atomic_reports.time.sleep'):
                write_json(target,{'completed':100})
            self.assertIn('100',target.read_text());self.assertEqual(len(calls),3)
    def test_permanent_lock_keeps_previous_checkpoint(self):
        with tempfile.TemporaryDirectory(dir='build') as d:
            target=Path(d)/'checkpoint.json';target.write_text('old')
            with patch.object(Path,'replace',side_effect=PermissionError('persistent test lock')),patch('cad_pipeline.atomic_reports.time.sleep'):
                with self.assertRaises(PermissionError):write_json(target,{'completed':100})
            self.assertEqual(target.read_text(),'old')


if __name__=='__main__':unittest.main()
