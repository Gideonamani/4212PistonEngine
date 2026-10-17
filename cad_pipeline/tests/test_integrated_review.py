"""Final review must not accept a stale or partially bound face-pair study."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from cad_pipeline.build_integrated_review import finalize
from cad_pipeline.saved_native_stock import file_sha


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(dir='build')
        self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name)
        self.spec=dict(model_id='engine',scope='Synthetic acceptance fixture',
            parameters={'oil_lifter_boss_wall':{},'bearing_web_profile_scale':{}},
            parts=[{'id':'AlternatorFaceGear'},{'id':'AlternatorDrivenGear'}])
        self.put('part-spec.json',self.spec)
        for name in ['engine.FCStd','engine.step','geometry.json']:
            self.put('cad/'+name,'fixture '+name)
        files={name:dict(sha256=file_sha(self.root/'cad'/name))
               for name in ['engine.FCStd','engine.step','geometry.json']}
        self.put('cad/cad-validation.json',dict(files=files))
        self.native_sha=files['engine.FCStd']['sha256']
        common=dict(passed=True,native_sha256=self.native_sha,
                    spec_sha256=file_sha(self.root/'part-spec.json'))
        for name in ['reopen-validation','interface-checks','saved-shape-checks',
                     'integrated-drive-checks','gallery-checks','bearing-support-checks']:
            data=dict(common,checks=[],pairs=1,source=dict(native_sha256=self.native_sha))
            self.put('cad/'+name+'.json',data)
        self.put('views/view-plan-source.json',dict(spec_sha256=common['spec_sha256'],all_parts=2))
        for kind in ['full','internal']:
            self.put('views/'+kind+'-plan.json',{})
            self.put('views/'+kind+'/candidate.png','fixture image')
            self.put('views/'+kind+'/comparison-view.blend','fixture scene')
            self.put('views/'+kind+'/render.json',dict(
                geometry_sha256=files['geometry.json']['sha256'],
                image_sha256=file_sha(self.root/'views'/kind/'candidate.png'),
                plan_sha256=file_sha(self.root/'views'/(kind+'-plan.json'))))
        self.put('views/full/development-diagnostic.glb','fixture export')
        self.put('views/full/interference-audit.json',dict(clean=True,parts=2,
            rest_neighbouring_pairs=1,
            asset_sha256=file_sha(self.root/'views/full/development-diagnostic.glb')))
        face=dict(self.spec,model_id='face')
        self.put('face-pair-r3/source-part-spec.json',face)
        self.put('face-pair-r3/native/face.FCStd','fixture face native')
        self.put('face-pair-r3/native/face.step','fixture face STEP')
        self.put('face-pair-r3/direct-checks.json',dict(passed=True))
        self.put('face-pair-r3/native-checks.json',dict(passed=True,
            native_sha256=file_sha(self.root/'face-pair-r3/native/face.FCStd'),
            step_sha256=file_sha(self.root/'face-pair-r3/native/face.step'),
            spec_sha256=file_sha(self.root/'face-pair-r3/source-part-spec.json')))
        normalized=lambda spec:hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest()
        self.put('development/face-cache-adoption.json',dict(
            base_native_sha256=file_sha(self.root/'face-pair-r3/native/face.FCStd'),
            base_spec_sha256=normalized(face),new_spec_sha256=normalized(self.spec),
            adopted=self.spec['parts'],
            scoped_direct_agreements=[dict(p,passed=True) for p in self.spec['parts']]))

    def put(self,name,data):
        file=self.root/name;file.parent.mkdir(parents=True,exist_ok=True)
        file.write_text(data if isinstance(data,str) else json.dumps(data),encoding='utf-8')

    def mutate(self,name,**changes):
        data=json.loads((self.root/name).read_text());data.update(changes);self.put(name,data)

    def rejects(self):
        with self.assertRaises(ValueError):finalize(self.root)
        self.assertFalse((self.root/'review-provenance.json').exists())

    def test_complete_evidence_is_bound_for_the_next_session(self):
        finalize(self.root)
        provenance=json.loads((self.root/'review-provenance.json').read_text())
        evidence=provenance['evidence']
        for name in ['cad/gallery-checks.json','face-pair-r3/native-checks.json',
                     'views/full/development-diagnostic.glb','views/internal/comparison-view.blend']:
            self.assertEqual(evidence[name]['sha256'],file_sha(self.root/name))
        self.assertIn('face-pair-r3/native-checks.json',(self.root/'review.html').read_text())

    def test_changed_face_native_is_rejected(self):
        self.put('face-pair-r3/native/face.FCStd','changed geometry');self.rejects()

    def test_failed_pitch_gate_is_rejected(self):
        self.mutate('face-pair-r3/native-checks.json',passed=False);self.rejects()

    def test_adoption_to_another_engine_is_rejected(self):
        self.mutate('development/face-cache-adoption.json',new_spec_sha256='stale');self.rejects()

    def test_one_missing_component_agreement_is_rejected(self):
        self.mutate('development/face-cache-adoption.json',
                    scoped_direct_agreements=[dict(id='AlternatorFaceGear',passed=True)])
        self.rejects()

    def test_changed_actual_export_is_rejected(self):
        self.put('views/full/development-diagnostic.glb','changed mesh');self.rejects()


if __name__=='__main__':unittest.main()
