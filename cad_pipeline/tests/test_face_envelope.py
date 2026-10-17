"""Sampling refinement and retained land checks for the face method."""
import unittest
from face_gear_geometry import envelope_sections,face_features


class FaceEnvelope(unittest.TestCase):
    def test_clearance_allowance_retains_finite_tooth_land(self):
        _,method=face_features(contact_window=True)
        self.assertGreater(min(r['minimum_tooth_land_module'] for r in method['sampled_tooth_land_after_allowance']),.15)
        with self.assertRaises(ValueError):face_features(lateral_allowance=2.)

    def test_refining_rolling_samples_preserves_land_and_converges(self):
        coarse,a=envelope_sections(poses=49)
        fine,b=envelope_sections(poses=97)
        error=max(abs(v-w) for x,y in zip(coarse,fine) for p,q in zip(x,y) for v,w in zip(p,q))
        self.assertLess(error,.02)
        self.assertGreater(min(r['minimum_tooth_land_module'] for r in b['sampled_tooth_land']),.20)
        self.assertEqual(a['sampled_interval_max_gap'],0)
        self.assertEqual(b['sampled_interval_max_gap'],0)


if __name__=='__main__':unittest.main()
