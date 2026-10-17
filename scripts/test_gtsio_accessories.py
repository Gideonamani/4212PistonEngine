"""Calculated drive closure, source backlash and full-tooth-pitch interference checks."""
import copy
import json
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from accessory_gears import solve_gtsio_accessory_drive,GTSIO_ACCESSORY_MESHES
from gear_geometry import mesh_clearance


class AccessoryDriveTest(unittest.TestCase):
    def test_documented_ratios_and_estimate_boundaries(self):
        g=solve_gtsio_accessory_drive()
        for id in ('LeftMagnetoGear','RightMagnetoGear'):self.assertAlmostEqual(g[id]['rate'],1.5)
        for id in ('OilPumpDriver','ScavengePumpDriver'):self.assertAlmostEqual(g[id]['rate'],-.5)
        self.assertEqual(g['StarterShaftGear']['driver'],'CrankshaftGear')
        self.assertFalse(any('Vacuum' in id or 'Worm' in id for id in g))
        for driver,driven in GTSIO_ACCESSORY_MESHES:
            a,b=g[driver],g[driven]
            self.assertAlmostEqual(math.dist(a['centre'],b['centre']),a['r_pitch']+b['r_pitch'])
            self.assertAlmostEqual(a['rate']*a['teeth'],-b['rate']*b['teeth'])
            engagement=min(a['z']+a['width'],b['z']+b['width'])-max(a['z'],b['z'])
            self.assertGreaterEqual(engagement,.9*min(a['width'],b['width']))
        self.assertAlmostEqual(min(g['IdlerGear']['z']+12,g['LeftMagnetoGear']['z']+12)-max(g['IdlerGear']['z'],g['LeftMagnetoGear']['z']),11)

    def test_source_pair_backlash(self):
        g=solve_gtsio_accessory_drive()
        limits=[(.0028,.0089),(.0081,.0146),(.0081,.0146),(.0037,.0078),(.0087,.0127),(.014,.0218),(.014,.0218)]
        for (a,b),(lo,hi) in zip(GTSIO_ACCESSORY_MESHES,limits):
            # Each profile gives up half its own declared allowance.
            backlash=(g[a]['backlash_mm']+g[b]['backlash_mm'])/2
            self.assertGreaterEqual(backlash,lo*25.4);self.assertLessEqual(backlash,hi*25.4)

    def test_flanks_and_wrong_phase_mutation(self):
        g=solve_gtsio_accessory_drive()
        for a,b in GTSIO_ACCESSORY_MESHES:
            gap=mesh_clearance(g[a],g[b],steps=48)
            self.assertGreater(gap,.02,a+'/'+b)
            wrong=copy.deepcopy(g[b]);wrong['phase']+=math.pi/wrong['teeth']
            self.assertLess(mesh_clearance(g[a],wrong,steps=1),0,a+'/'+b+' failed to detect phase mutation')
            print('ACCESSORY_MESH',a,b,'minimum sampled gap mm',gap,flush=True)

    def test_source_depth_and_clearance(self):
        g=solve_gtsio_accessory_drive()
        depth=2.62425*25.4
        gap=depth-g['OilPumpDriver']['width']
        self.assertTrue(.0019*25.4<=gap<=.0044*25.4)
        self.assertAlmostEqual(g['OilPumpDriver']['width'],g['OilPumpDriven']['width'])
        self.assertGreater(g['OilPumpDriver']['width'],60)

if __name__=='__main__':unittest.main()
