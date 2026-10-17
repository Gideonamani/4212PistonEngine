"""Static foundation contracts: axial packaging, race contact and source coverage."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cad_pipeline.gtsio_static import build,CASE_NAMES
from cad_pipeline.gtsio_layout import StaticEngineLayout
from cad_pipeline.spec import validate_spec


class StaticFoundationTest(unittest.TestCase):
    def test_case_source_key_and_part_mapping(self):
        self.assertEqual(len(CASE_NAMES),143)
        self.assertEqual(CASE_NAMES[125],'Left crankcase');self.assertEqual(CASE_NAMES[126],'Right crankcase')
        spec,inventory,review=build(('dampers','case'));validate_spec(spec)
        self.assertTrue(review['coverage_checked']);self.assertEqual(len(spec['parts']),395)
        mapped={p for c in inventory['components'] for p in c['part_ids']}
        self.assertEqual(mapped,{p['id'] for p in spec['parts']})

    def test_race_offsets_and_axial_containment(self):
        spec,_,_=build(('dampers','case'));p={n:v['value'] for n,v in spec['parameters'].items()}
        self.assertAlmostEqual(p['damper_blade_race_clearance']+p['damper_pin_diameter']/2,p['blade_race_id']/2)
        self.assertAlmostEqual(p['damper_weight_race_clearance']+p['damper_pin_diameter']/2,p['damper_bushing_id']/2)
        self.assertAlmostEqual(p['damper_loaded_shift'],p['damper_blade_race_clearance']+p['damper_weight_race_clearance'])
        self.assertGreater(p['damper_fork_slot'],p['blade_width'])
        self.assertGreater(p['cheek_width']-p['damper_width'],1.)
        self.assertGreater(2*p['damper_bush_outer_face']-p['damper_pin_end_clearance'],p['damper_fork_slot'])

    def test_recalibrated_slider_still_closes(self):
        k=StaticEngineLayout()
        for n in range(1,7):
            xs=[]
            for theta in range(721):
                state=k.pose(n,theta);self.assertAlmostEqual(math.dist(state['pin'],state['wrist']),k.ROD_LENGTH,places=8);xs.append(state['wrist'][0])
            self.assertAlmostEqual(max(xs)-min(xs),k.STROKE,places=8)
        self.assertEqual(k.BAY_PITCH,182.)
        self.assertEqual(k.station(2)-k.station(1),56.)


if __name__=='__main__':unittest.main()
