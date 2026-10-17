"""Guarded native execution reuse must retain live edits and exclude mutations."""
import copy
import unittest
import uuid
from pathlib import Path
import FreeCAD as A
import cad_pipeline.tests.test_append_native_history as append_fixture
from cad_pipeline.generate import build_part
from cad_pipeline.append_native_history import append
from cad_pipeline.preserve_native_prefixes import preserve
from cad_pipeline.fast_build import build_part as direct
from cad_pipeline.saved_recipe_agreement import compare


class PreservePrefix(unittest.TestCase):
    def test_retained_prefix_is_live_after_metadata_and_save(self):
        fixture=append_fixture.NativeAppend();fixture.setUp()
        for p in fixture.params.values():p['unit']='mm'
        params=fixture.params
        old=dict(parameters=params,parts=[fixture.old]);new=dict(parameters=copy.deepcopy(params),parts=[fixture.new])
        new['parameters']['extra']=dict(value=3.,unit='mm')
        doc=A.newDocument('PreserveFixture')
        try:
            controller=doc.addObject('App::FeaturePython','Parameters')
            for name,p in params.items():controller.addProperty('App::PropertyFloat',name);setattr(controller,name,p['value'])
            build_part(doc,fixture.old,params,0)
            controller.addProperty('App::PropertyFloat','extra');controller.extra=3.
            doc.Shaft_F1.touch()
            record=preserve(doc,old,new)
            self.assertEqual(record['retained_part_ids'],['Shaft'])
            self.assertNotIn('Touched',doc.Shaft_F1.State)
            doc.recompute();tip=append(doc,fixture.old,fixture.new,new['parameters'])
            out=Path('build/cad-tests')/str(uuid.uuid4());out.mkdir(parents=True)
            file=out/'preserve.FCStd';doc.saveAs(str(file));A.closeDocument(doc.Name)
            doc=A.openDocument(str(file));doc.Parameters.journal=5.2;doc.recompute()
            changed=copy.deepcopy(new['parameters']);changed['journal']['value']=5.2
            tip=next(o for o in doc.Objects if hasattr(o,'StablePartID'))
            self.assertTrue(compare(tip.Shape,direct(fixture.new,changed),'live retained prefix')['passed'])
        finally:
            if A.ActiveDocument:A.closeDocument(A.ActiveDocument.Name)

    def test_changed_controller_dependency_is_not_retained(self):
        fixture=append_fixture.NativeAppend();fixture.setUp()
        for p in fixture.params.values():p['unit']='mm'
        old=dict(parameters=fixture.params,parts=[fixture.old]);new=copy.deepcopy(old)
        new['parameters']['journal']['value']=5.2
        doc=A.newDocument('ChangedPrefixFixture')
        try:
            controller=doc.addObject('App::FeaturePython','Parameters')
            for name,p in old['parameters'].items():controller.addProperty('App::PropertyFloat',name);setattr(controller,name,p['value'])
            build_part(doc,fixture.old,old['parameters'],0)
            # Do not manually touch the feature: FreeCAD may defer propagation
            # of the changed controller until recompute. Retention must not
            # clear that real dimension change along with metadata dirtiness.
            controller.journal=5.2
            record=preserve(doc,old,new)
            self.assertEqual(record['retained_part_ids'],[])
            self.assertEqual(record['reactivated_part_ids'],['Shaft'])
            self.assertIn('Touched',doc.Shaft_F1.State)
            doc.recompute();self.assertAlmostEqual(doc.Shaft_F1.Radius.Value,5.2)
        finally:A.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
