"""A remote casting extension must not erase an existing journal support."""
import unittest
import FreeCAD as A
from cad_pipeline.gtsio_core import cylinder
from cad_pipeline.gtsio_static_drive import guest_bores_for_extension
from cad_pipeline.fast_build import build_part
from cad_pipeline.generate import build_part as native
from cad_pipeline.saved_recipe_agreement import compare


class ExtensionSupport(unittest.TestCase):
    def test_web_survives_and_guest_bore_remains_open(self):
        wall=cylinder(40,20,[0,0,0])
        cavity=cylinder(31,20,[0,0,0],op='cut',label='Cam-lobe chamber')
        web=cylinder(40,6,[0,0,0])
        bore=cylinder(15,31,[0,0,0],op='cut',label='Line-bored cam journals')
        base=[wall,cavity,web,bore];extension=cylinder(40,10,[0,0,20])
        part=lambda fs:dict(id='Fixture',label='Fixture',group='fixture',material='steel',evidence='Fixture',features=fs)
        broken=build_part(part(base+[extension,cavity,bore]),{})
        fixed=part(base+[extension]+guest_bores_for_extension(base))
        expected=build_part(fixed,{})
        self.assertFalse(broken.isInside(A.Vector(20,0,3),1e-7,True))
        self.assertTrue(expected.isInside(A.Vector(20,0,3),1e-7,True))
        self.assertFalse(expected.isInside(A.Vector(10,0,25),1e-7,True))
        doc=A.newDocument('ExtensionSupportFixture')
        try:
            doc.addObject('App::FeaturePython','Parameters')
            _,tip=native(doc,fixed,{},0)
            self.assertTrue(compare(tip.Shape,expected,'supported-extension')['passed'])
        finally:A.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
