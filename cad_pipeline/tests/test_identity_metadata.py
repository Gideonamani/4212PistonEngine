"""Metadata may retain evaluated geometry, never a pending radius edit."""
import math
import unittest
import FreeCAD as A
from cad_pipeline.generate import identify_part


class IdentityMetadata(unittest.TestCase):
    def test_clean_tip_and_dirty_dimension_remain_distinct(self):
        doc=A.newDocument('IdentityMetadataFixture')
        try:
            part=lambda id:dict(id=id,label=id,group='fixture',material='steel',evidence='Fixture')
            clean=doc.addObject('Part::Cylinder','Clean');clean.Radius=2.;clean.Height=5.;doc.recompute()
            identify_part(clean,part('Clean'))
            self.assertNotIn('Touched',clean.State)
            clean.Radius=3.;doc.recompute()
            self.assertAlmostEqual(clean.Shape.Volume,math.pi*9*5,places=8)
            dirty=doc.addObject('Part::Cylinder','Dirty');dirty.Radius=2.;dirty.Height=5.;doc.recompute()
            dirty.Radius=3.;identify_part(dirty,part('Dirty'))
            self.assertIn('Touched',dirty.State)
            doc.recompute();self.assertAlmostEqual(dirty.Shape.Volume,math.pi*9*5,places=8)
        finally:A.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
