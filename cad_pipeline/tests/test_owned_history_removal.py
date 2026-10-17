"""Removing a replaced part must remove owned Body children, while retaining shared geometry."""
import unittest
import FreeCAD as A
from cad_pipeline.generate import remove_part


class OwnedHistoryRemovalTest(unittest.TestCase):
    def test_owned_nested_objects_removed_and_external_link_preserved(self):
        doc=A.newDocument('OwnedRemovalFixture')
        try:
            external=doc.addObject('Part::Box','ExternalMaster')
            group=doc.addObject('App::DocumentObjectGroup','ReplacedPart')
            body=doc.addObject('PartDesign::Body','ReplacedPartBody');group.addObject(body)
            child=doc.addObject('PartDesign::Feature','ReplacedPartTip');body.addObject(child)
            child.addProperty('App::PropertyString','StablePartID');child.StablePartID='ReplacedPart'
            linked=doc.addObject('Part::Compound','ReplacedPartLink');linked.Links=[external];group.addObject(linked)
            doc.recompute();remove_part(doc,group)
            self.assertIsNone(doc.getObject('ReplacedPart'))
            self.assertIsNone(doc.getObject('ReplacedPartBody'))
            self.assertIsNone(doc.getObject('ReplacedPartTip'))
            self.assertIsNone(doc.getObject('ReplacedPartLink'))
            self.assertIsNotNone(doc.getObject('ExternalMaster'))
            self.assertFalse([o for o in doc.Objects if hasattr(o,'StablePartID')])
        finally:A.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
