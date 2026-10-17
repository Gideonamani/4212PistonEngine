"""Independent geometric closure of the inferred static valve-train skeleton."""
import math,unittest
from cad_pipeline import gtsio_valvetrain_pose as p
from cad_pipeline.gtsio_layout import StaticEngineLayout
from cad_pipeline.gtsio_static import build

class ValveTrainClosure(unittest.TestCase):
    def test_total_rocker_endplay_includes_both_thrust_washers(self):
        self.assertGreaterEqual(p.rocker_endplay(),.005*25.4)
        self.assertLessEqual(p.rocker_endplay(),.035*25.4)

    @classmethod
    def setUpClass(cls):
        cls.params=build(('dampers','case','cylinders'))[0]['parameters'];cls.layout=StaticEngineLayout(True)

    def test_cam_envelope_curvature_and_follower_coverage(self):
        r=25.38095/2
        for i in range(3001):
            s,ds,dds=p.lift_law(-math.pi+2*math.pi*i/3000)
            self.assertGreater(p.BASE_RADIUS+s+dds,0)
            self.assertLess(math.hypot(ds,p.LOBE_WIDTH/2),r)
        self.assertLess(max(math.hypot(*x) for x in p.profile(0)),31)

    def test_nine_lobes_twelve_followers_and_firing_peaks(self):
        lobes=p.lobes(self.layout);self.assertEqual(len(lobes),9)
        self.assertEqual(sum(len(x['followers']) for x in lobes),12)
        for n in range(1,7):
            for name,offset in [('Intake',450),('Exhaust',270)]:
                st=p.pose(name,n,self.params,self.layout,self.layout.FIRING_PHASE[n]+offset)
                self.assertAlmostEqual(st['cam_rise'],p.CAM_LIFT,places=8)

    def test_rod_closure_and_rounded_pad_contact(self):
        for angle in range(0,721,20):
            for n in range(1,7):
                for name in ['Intake','Exhaust']:
                    st=p.pose(name,n,self.params,self.layout,angle)
                    self.assertAlmostEqual(math.dist(st['socket'],st['cup']),st['rod_length'],places=7)
                    self.assertGreaterEqual(st['valve_lift'],-1e-9);self.assertLess(st['valve_lift'],14)
                    self.assertLess(abs(st['raw_pad'][1]),self.params['valve_stem']['value']/2)
                    self.assertGreater((self.params['spring_installed']['value']-st['valve_lift']-4)/6,4)

    def test_sampled_cam_stays_behind_each_support_plane(self):
        for lobe in p.lobes(self.layout):
            points=p.profile(lobe['phase'])
            for sign in [-1,1]:
                gamma=0 if sign>0 else math.pi
                lift,_,_=p.lift_law(gamma-lobe['phase']);support=p.BASE_RADIUS+lift
                self.assertLessEqual(max(sign*x for x,y in points),support+1e-8)
                self.assertLess(support-max(sign*x for x,y in points),.002)

if __name__=='__main__':unittest.main()
