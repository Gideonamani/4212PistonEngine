"""An exception cannot hide changed files, extra failed parts or distortion."""
import copy
import unittest
from cad_pipeline.step_roundtrip import accept_boundary_exception


class StepExceptionTests(unittest.TestCase):
    def test_review_is_bound_to_files_scope_and_boundary_measurement(self):
        hashes={'model.FCStd':'native-hash','model.step':'step-hash'}
        policy=dict(source_hashes=hashes,reviewed_part_ids=['ValveBox1'],reason='Reviewed numerical discrepancy')
        pairs=[dict(native_id='ValveBox1',relative_error=1.9e-4)]
        evidence=dict(source_hashes=hashes,sampling_method='all_vertices_and_projected_face_centroids_bidirectional',parts=[dict(id='ValveBox1',relative_volume_error=1.9e-4,optimal_bounds_error_mm=0,sampled_boundary_error_mm=1e-11,native_vertices=112,step_vertices=112,native_faces=50,step_faces=50)])
        self.assertEqual(accept_boundary_exception(pairs,evidence,policy,hashes)['reviewed_part_ids'],['ValveBox1'])
        with self.assertRaises(ValueError):accept_boundary_exception(pairs,evidence,policy,{'model.FCStd':'changed','model.step':'step-hash'})
        with self.assertRaises(ValueError):accept_boundary_exception(pairs+[dict(native_id='UnreviewedPart',relative_error=1.1e-4)],evidence,policy,hashes)
        distorted=copy.deepcopy(evidence);distorted['parts'][0]['sampled_boundary_error_mm']=0.01
        with self.assertRaises(ValueError):accept_boundary_exception(pairs,distorted,policy,hashes)
        with self.assertRaises(ValueError):accept_boundary_exception([dict(native_id='ValveBox1',relative_error=3e-4)],evidence,policy,hashes)


if __name__=='__main__':unittest.main()
