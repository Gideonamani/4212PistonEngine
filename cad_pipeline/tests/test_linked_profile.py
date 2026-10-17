"""Prove editable derived outlines in saved native CAD, including off-axis extrusion."""
import copy
import json
import sys
import time
import unittest
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.generate import build
from cad_pipeline.fast_build import build_part as direct_part
from cad_pipeline.spec import validate_spec
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from accessory_gears import solve_gtsio_static_drive
from gear_geometry import profile


class LinkedProfileTest(unittest.TestCase):
    def fixture(self):
        root=Path(__file__).resolve().parents[2]
        s=json.loads((root/'cad_pipeline/examples/bearing-housing.json').read_text())
        s.update(model_id='linked-gear-profile-fixture',scope='Isolated software-method fixture; no manufacturer gear claim',
                 parameters={k:dict(value=v,unit='mm',status='inferred',rationale='Method fixture')
                             for k,v in [('gear_module',2.8),('face_width',8.),('bore_radius',10.)]})
        g=solve_gtsio_static_drive()['CrankshaftGear']
        points=profile(g['teeth'],g['r_pitch'],g['addendum'],g['phase'],**g['form'])
        points=[[str(v/g['module_mm'])+'*gear_module' for v in p] for p in points]
        pose=dict(origin=[70,60,90],axis=[0,1,0],roll=17)
        s['parts']=[dict(id='GearTrial',label='Linked involute-profile trial',group='fixture',material='steel',evidence='Method fixture',
            features=[dict(primitive='prism',operation='add',points=points,height='face_width',derived=True,linked_profile=True,**pose),
                      dict(primitive='cylinder',operation='cut',radius='bore_radius',height='face_width',**pose)])]
        return s

    def test_invalid_profile_option(self):
        s=self.fixture();s['parts'][0]['features'][0]['linked_profile']='yes'
        with self.assertRaisesRegex(ValueError,'Linked profile'):validate_spec(s)
        s=self.fixture();s['parts'][0]['features'][1]['linked_profile']=True
        with self.assertRaisesRegex(ValueError,'Linked profile'):validate_spec(s)

    def test_saved_profile_and_dimension_edits(self):
        s=self.fixture()
        folder=Path(__file__).resolve().parents[2]/'build/method-fixtures'/('linked-profile-'+str(time.time_ns()))
        build(s,folder)
        native=folder/(s['model_id']+'.FCStd')
        edited=folder/'edited.FCStd'; edited_step=folder/'edited.step'
        checks=[]
        for state in ('initial','edited','reopened_edit'):
            doc=A.openDocument(str(edited if state=='reopened_edit' else native))
            try:
                current=copy.deepcopy(s)
                if state!='initial':
                    current['parameters']['gear_module']['value']=3.2
                    current['parameters']['face_width']['value']=11.
                    current['parameters']['bore_radius']['value']=12.
                if state=='edited':
                    for k,v in current['parameters'].items():setattr(doc.Parameters,k,v['value'])
                doc.recompute()
                wire=doc.getObject('GearTrial_F1_Profile');extrusion=doc.getObject('GearTrial_F1')
                self.assertEqual(wire.TypeId,'Part::Polygon')
                self.assertEqual(extrusion.TypeId,'Part::Extrusion')
                self.assertEqual(extrusion.Base,wire)
                shape=next(o.Shape for o in doc.Objects if getattr(o,'StablePartID',None)=='GearTrial')
                direct=direct_part(current['parts'][0],current['parameters'])
                self.assertTrue(shape.isValid());self.assertEqual(len(shape.Solids),1)
                volume_error=abs(shape.Volume-direct.Volume)/shape.Volume
                ba,bb=shape.optimalBoundingBox(False,False),direct.optimalBoundingBox(False,False)
                bounds_error=max(abs(getattr(ba,k)-getattr(bb,k)) for k in ('XMin','YMin','ZMin','XMax','YMax','ZMax'))
                self.assertLess(volume_error,1e-6);self.assertLess(bounds_error,1e-5)
                self.assertAlmostEqual(shape.BoundBox.YLength,current['parameters']['face_width']['value'],places=6)
                if state=='edited':doc.saveAs(str(edited));Part.export([o for o in doc.Objects if hasattr(o,'StablePartID')],str(edited_step))
                checks.append(dict(state=state,volume_mm3=shape.Volume,relative_volume_error=volume_error,bounds_error_mm=bounds_error))
            finally:A.closeDocument(doc.Name)
        self.assertGreater(checks[1]['volume_mm3'],checks[0]['volume_mm3']*1.5)
        for file in [folder/(s['model_id']+'.step'),edited_step]:
            shape=Part.read(str(file));self.assertTrue(shape.isValid());self.assertEqual(len(shape.Solids),1)
            expected=checks[0 if file.name.startswith(s['model_id']) else 1]['volume_mm3']
            self.assertLess(abs(shape.Volume-expected)/expected,1e-4)
        (folder/'method-checks.json').write_text(json.dumps(dict(passed=True,freecad_version=A.Version(),
            native_polygon_and_extrusion=True,off_axis_origin_and_roll=True,
            dimension_edits=['gear_module','face_width','bore_radius'],saved_reopened=True,
            checks=checks,strict_step_verified=True),indent=2)+'\n')
        print('METHOD_FIXTURE',folder,flush=True)


if __name__=='__main__':unittest.main()
