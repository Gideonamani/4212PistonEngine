"""Full volume coverage and late-sector negative controls, no per-tile waiver."""
import math
import unittest
import FreeCAD as A
import Part
from cad_pipeline.partitioned_material import differences


class PartitionedMaterial(unittest.TestCase):
    def test_identity_and_small_hole_in_last_sector(self):
        ring=Part.makeCylinder(20,2).cut(Part.makeCylinder(10,2))
        same=differences(ring,ring.copy(),count=12)
        self.assertTrue(same['passed']);self.assertEqual(same['partition']['completed'],12)
        angle=math.radians(355);tool=Part.makeCylinder(.2,4,A.Vector(15*math.cos(angle),15*math.sin(angle),-1))
        changed=ring.cut(tool)
        result=differences(ring,changed,count=12)
        self.assertFalse(result['passed']);self.assertEqual(result['partition']['completed'],12)
        self.assertAlmostEqual(result['original_solid_difference_mm3'][0],math.pi*.2**2*2,places=6)
        self.assertLess(result['original_solid_difference_mm3'][1],1e-5)

    def test_other_axis_and_total_tolerance(self):
        a=Part.makeBox(2,20,20);b=a.copy()
        result=differences(a,b,count=8)
        self.assertTrue(result['passed']);self.assertEqual(result['partition']['axis'],[1,0,0])
        b=a.cut(Part.makeCylinder(.01,4,A.Vector(-1,10,10),A.Vector(1,0,0)))
        result=differences(a,b,count=8,tolerance=.0001)
        self.assertFalse(result['passed'])


if __name__=='__main__':unittest.main()
