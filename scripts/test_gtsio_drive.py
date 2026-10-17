"""Check the researched static-drive relationships and actual sampled flank clearance."""
import copy
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
from accessory_gears import solve_gtsio_static_drive,GTSIO_STATIC_DRIVE_MESHES,gtsio_cam_rate
from gear_geometry import mesh_clearance,tooth_form
from cad_pipeline.gtsio_drive_layout import parameters,through_bolts


class StaticDriveTest(unittest.TestCase):
    def test_ratios_and_declared_mesh_closure(self):
        gears=solve_gtsio_static_drive()
        self.assertEqual(gears['CamshaftGear']['rate'],gtsio_cam_rate())
        self.assertAlmostEqual(gears['PropellerShaft']['rate'],-2/3)
        self.assertLess(abs(abs(gears['PropellerShaft']['rate'])-.667),.0005)
        for a,b in GTSIO_STATIC_DRIVE_MESHES:
            self.assertAlmostEqual(math.dist(gears[a]['centre'],gears[b]['centre']),gears[a]['r_pitch']+gears[b]['r_pitch'])

    def test_flanks_clear_over_one_complete_tooth_pitch(self):
        gears=solve_gtsio_static_drive()
        for a,b in GTSIO_STATIC_DRIVE_MESHES:
            gap=mesh_clearance(gears[a],gears[b],steps=48)
            self.assertGreater(gap,.02)
            wrong=copy.deepcopy(gears[b]);wrong['phase']+=math.pi/wrong['teeth']
            self.assertLess(mesh_clearance(gears[a],wrong,steps=1),0.)
            print('MESH_CLEARANCE',a,b,gap,flush=True)

    def test_complete_axial_stacks_and_source_fits(self):
        p=parameters();v=lambda k:p[k]['value']
        prop=v('propeller_collar_z')-(v('propeller_slinger_z')+2)-v('propeller_front_bearing_width')-2*v('propeller_thrust_width')
        reduction=v('reduction_collar_z')-v('drive_gear_end')-v('reduction_bearing_width')
        self.assertAlmostEqual(prop,.254)
        self.assertTrue(.006*25.4<=prop<=.0152*25.4)
        self.assertTrue(.0055*25.4<=reduction<=.0115*25.4)
        gap=v('transfer_receiving_id')-v('transfer_tube_diameter')
        self.assertTrue(.0008*25.4<=gap<=.0020*25.4)
        free_press=v('transfer_sleeve_free_od')-v('transfer_sleeve_hole_diameter')
        self.assertTrue(.0005*25.4<=free_press<=.0025*25.4)
        self.assertLess(v('propeller_rear_bearing_z')+v('propeller_rear_bearing_width'),v('drive_gear_z')-2)

    def test_full_fastener_envelopes_and_seating_lands(self):
        bolts=through_bolts(parameters())
        for a,b in [(bolts[2],bolts[4]),(bolts[3],bolts[5])]:
            self.assertGreater(math.hypot(a['y']-b['y'],a['z']-b['z']),2*8.5+2.)
        for b in bolts[:2]:self.assertGreaterEqual(b['half_width'],48.+8.)


if __name__=='__main__':unittest.main()
