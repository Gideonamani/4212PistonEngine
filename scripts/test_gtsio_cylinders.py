"""Source/packaging contracts for the static cylinder expansion."""
import unittest
from cad_pipeline.gtsio_static import build
from cad_pipeline.gtsio_layout import StaticEngineLayout
from cad_pipeline.spec import evaluate
from cad_pipeline import gtsio_valve_layout as vl


class CylinderContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.spec,cls.inventory,cls.review=build(('dampers','case','cylinders'))

    def test_ring_sweep_inside_barrel_datum(self):
        k=StaticEngineLayout(complete_cylinders=True);p=self.spec['parameters'];start=p['cylinder_open']['value'];end=p['barrel_end']['value']
        for n in range(1,7):
            for theta in range(721):
                wrist=abs(k.pose(n,theta)['wrist'][0])
                for _,station,width,_ in k.RING_DATA:
                    self.assertGreater(wrist+station-width/2,start)
                    self.assertLess(wrist+station+width/2,end)

    def test_six_cylinders_source_fasteners_and_hand(self):
        for n in range(1,7):
            for name in ('Intake','Exhaust'):
                screws=[p for p in self.spec['parts'] if p['id'] in [name+'CoverScrew'+str(i)+str(n) for i in range(1,6)]]
                self.assertEqual(len(screws),5)
                outer=next(p for p in self.spec['parts'] if p['id']==name+'OuterSpring'+str(n));inner=next(p for p in self.spec['parts'] if p['id']==name+'InnerSpring'+str(n))
                self.assertTrue(outer['features'][0]['left_handed']);self.assertFalse(inner['features'][0]['left_handed'])
                self.assertEqual(outer['placement']['mirror_normal'],[0,0,1])
        self.assertTrue(self.review['coverage_checked'])
        mapped={id for c in self.inventory['components'] for id in c['part_ids']}
        self.assertEqual(mapped,{p['id'] for p in self.spec['parts']})

    def test_pilot_and_plug_crowns_are_real_cuts(self):
        p=self.spec['parameters']
        for part in self.spec['parts']:
            if part['id'].startswith('PinPlug'):
                self.assertEqual(part['features'][-1]['operation'],'cut')
                self.assertEqual(part['features'][-1]['primitive'],'tube')
                self.assertEqual(part['features'][-1]['inner_radius'],'pin_length/2')
            if part['id'] in ('CrankcaseLeft','CrankcaseRight'):
                for f in part['features']:
                    if f.get('label')=='Open cylinder pilot seat':
                        self.assertLess(abs(evaluate(f['origin'][0],p)),p['cylinder_open']['value'])

    def test_bank_placement_preserves_top_induction(self):
        for n in range(1,7):
            head=next(p for p in self.spec['parts'] if p['id']=='CylinderHead'+str(n))
            ports={f.get('label'):f for f in head['features'] if 'crossing port' in f.get('label','')}
            self.assertEqual(ports['Intake crossing port']['axis'],[0,1,0])
            self.assertEqual(ports['Exhaust crossing port']['axis'],[0,-1,0])
            self.assertEqual(head['placement']['rotation_quaternion'],[0,1,0,0] if n%2==0 else [0,0,0,1])
            barrel=next(p for p in self.spec['parts'] if p['id']=='CylinderBarrel'+str(n))
            self.assertEqual(barrel['features'][-1]['label'],'Restore continuous bore after base flange addition')
            self.assertEqual(barrel['features'][-1]['radius'],'fitted_bore/2')

    def test_straight_pushrod_plan_and_spring_envelope(self):
        k=StaticEngineLayout(complete_cylinders=True);p=self.spec['parameters'];lines=[]
        for n in range(1,7):
            for name in ('Intake','Exhaust'):
                a,b=vl.pushrod_line(name,n,p,k);lines.append((a,b))
                self.assertLess(b[1],-60.)
                for x in range(94,247):
                    sign=1 if n%2 else -1;t=(sign*x-a[0])/(b[0]-a[0]);y=a[1]+t*(b[1]-a[1]);z=a[2]+t*(b[2]-a[2])-k.station(n)
                    self.assertGreater((y*y+z*z)**.5,88.,'Housing envelope must clear the steel barrel/fins')
        for i,(a,b) in enumerate(lines):
            for c,d in lines[i+1:]:self.assertGreater(vl.segment_distance(a,b,c,d),16.)
        for wire in (2.,1.4):
            pitch=(p['spring_installed']['value']-2*wire-vl.ILLUSTRATIVE_VALVE_LIFT_ENVELOPE)/6
            self.assertGreater(pitch,2*wire)


if __name__=='__main__':unittest.main()
