"""Behavioural checks for non-warping registration and silhouette discrimination."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('matcher',ROOT/'.agents/skills/image-matcher/scripts/compare_reference.py')
matcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(matcher)


class MatchTest(unittest.TestCase):
    def test_recovers_uniform_transform_and_checks_unfitted_point(self):
        p=np.array([[0,0],[10,0],[0,7],[8,4]],float)
        theta=.4;rotation=np.array([[np.cos(theta),-np.sin(theta)],[np.sin(theta),np.cos(theta)]])
        target=p@rotation.T*2.3+[40,70]
        matrix=matcher.similarity(p[:3],target[:3])
        np.testing.assert_allclose(matcher.points_after(p,matrix)[:,:2],target,atol=1e-10)
        altered=p.copy();altered[3]+=[2,0]
        self.assertGreater(np.linalg.norm(matcher.points_after(altered,matrix)[3,:2]-target[3]),4.5)

    def test_missing_feature_lowers_mask_match(self):
        ref=np.zeros((100,100),bool);ref[20:80,30:60]=True;ref[35:55,60:85]=True
        same=ref.copy();missing=ref.copy();missing[35:55,60:85]=False
        self.assertEqual(matcher.mask_iou(ref,same),1)
        self.assertLess(matcher.mask_iou(ref,missing),.85)
        with self.assertRaises(ValueError):matcher.mask_iou(ref,np.zeros_like(ref))

    def test_does_not_mirror_or_accept_coincident_datums(self):
        p=np.array([[0,0],[10,0],[0,5]],float)
        with self.assertRaises(ValueError):matcher.similarity(p,p*[-1,1])
        with self.assertRaises(ValueError):matcher.similarity([[0,0],[0,0]],[[2,3],[2,3]])

    def test_locked_view_rejects_reference_change_and_preserves_transparency(self):
        temp_base=(ROOT/'.local/image-matcher-tests').resolve();temp_base.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_base) as temp:
            root=Path(temp)
            self.assertTrue(root.resolve().is_relative_to(temp_base))
            reference=Image.new('RGB',(60,60),'white');ImageDraw.Draw(reference).rectangle((10,10,40,40),fill='gray');reference.save(root/'ref.png')
            candidate=Image.new('RGBA',(60,60),(0,0,0,0));ImageDraw.Draw(candidate).rectangle((10,10,40,40),fill='gray');candidate.save(root/'cad.png')
            landmarks={'a':[10,10],'b':[40,10],'c':[10,40]}
            plan=dict(reference=dict(image='ref.png',landmarks=landmarks),candidate=dict(image='cad.png',landmarks=landmarks,camera={'projection':'fixed'}),fit_landmarks=['a','b'],check_landmarks=['c'])
            path=root/'plan.json';path.write_text(json.dumps(plan));first=matcher.run(path,root/'before')
            self.assertEqual(Image.open(root/'before/registered-candidate.png').getpixel((0,0)),(255,255,255))
            self.assertIsNone(first['metrics']['silhouette_iou'])
            plan['lock_from']='before/comparison.json';path.write_text(json.dumps(plan));second=matcher.run(path,root/'after')
            self.assertEqual(first['transform_candidate_crop_to_reference_crop'],second['transform_candidate_crop_to_reference_crop'])
            reference.putpixel((0,0),(0,0,0));reference.save(root/'ref.png')
            with self.assertRaises(ValueError):matcher.run(path,root/'invalid')


if __name__=='__main__':unittest.main()
