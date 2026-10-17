"""Preserved native prefixes must remain live after append, reopen and edits."""
import copy
import tempfile
import unittest
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.append_native_history import eligible, append
from cad_pipeline.generate import build_part
from cad_pipeline.fast_build import build_part as direct
from cad_pipeline.gtsio_core import cylinder
from cad_pipeline.saved_recipe_agreement import compare


class NativeAppend(unittest.TestCase):
    def setUp(self):
        self.params={k:dict(value=v) for k,v in [('journal',5.),('bore',1.5)]}
        self.old=dict(id='Shaft',label='Shaft',evidence='Fixture',group='fixture',material='steel',
                      features=[cylinder('journal',20,[0,0,0])])
        self.new=copy.deepcopy(self.old)
        self.new['features'] += [cylinder(7,5,[0,0,5]),cylinder('bore',22,[0,0,-1],op='cut')]

    def test_unsafe_prefix_or_dependency_not_eligible(self):
        self.assertTrue(eligible(self.old,self.new,[]))
        self.assertFalse(eligible(self.old,self.new,['journal']))
        self.assertFalse(eligible(self.old,self.new,[],has_instances=True))
        for key,value in [('placement',{'origin':[1,0,0]}),('dressups',[{'radius':1}]),('boolean_refine',False)]:
            changed=copy.deepcopy(self.new);changed[key]=value
            self.assertFalse(eligible(self.old,changed,[]))
        changed=copy.deepcopy(self.new);changed['features'][0]['radius']=6
        self.assertFalse(eligible(self.old,changed,[]))

    def test_saved_live_prefix_bore_edit_and_step(self):
        base=Path('build').resolve();base.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=str(base)) as temp:
            root=Path(temp).resolve()
            if not root.is_relative_to(base):raise ValueError('Fixture outside workspace')
            doc=A.newDocument('NativeAppendFixture')
            try:
                controller=doc.addObject('App::FeaturePython','Parameters')
                for name,p in self.params.items():
                    controller.addProperty('App::PropertyFloat',name);setattr(controller,name,p['value'])
                _,original=build_part(doc,self.old,self.params,0)
                tip=append(doc,self.old,self.new,self.params)
                self.assertEqual(original.Name,'Shaft_F1')
                self.assertFalse(hasattr(original,'StablePartID'))
                self.assertEqual(tip.Base.Base.Name,original.Name)
                self.assertTrue(compare(tip.Shape,direct(self.new,self.params),'appended')['passed'])
                file=root/'fixture.FCStd';doc.saveAs(str(file));A.closeDocument(doc.Name)
                doc=A.openDocument(str(file));doc.recompute()
                tips=[o for o in doc.Objects if hasattr(o,'StablePartID')]
                self.assertEqual(len(tips),1)
                doc.Parameters.bore=2.;doc.recompute()
                edited=copy.deepcopy(self.params);edited['bore']['value']=2.
                self.assertTrue(compare(tips[0].Shape,direct(self.new,edited),'edited')['passed'])
                self.assertAlmostEqual(doc.Shaft_F1.Radius.Value,5.)
                step=root/'fixture.step';Part.export(tips,str(step));shape=Part.read(str(step))
                self.assertTrue(shape.isValid());self.assertEqual(len(shape.Solids),1)
                self.assertLess(abs(shape.Volume-tips[0].Shape.Volume)/shape.Volume,1e-6)
            finally:
                if A.ActiveDocument:A.closeDocument(A.ActiveDocument.Name)


if __name__=='__main__':unittest.main()
