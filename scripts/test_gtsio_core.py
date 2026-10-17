"""Core acceptance: source coverage and kinematic closure, including mutations."""
import copy
import json
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cad_pipeline import gtsio_layout as k
from cad_pipeline.gtsio_core import build
from cad_pipeline.research_gate import review
from cad_pipeline.spec import validate_spec


class CoreTest(unittest.TestCase):
    def test_slider_closure_and_stroke(self):
        for n in range(1,7):
            values=[]
            for theta in range(721):
                p=k.pose(n,theta);values.append(p['wrist'][0])
                self.assertAlmostEqual(math.dist(p['pin'],p['wrist']),k.ROD_LENGTH,places=8)
            self.assertAlmostEqual(max(values)-min(values),101.6,places=8)
            self.assertAlmostEqual(k.slider(n,0),k.slider(n,720),places=8)

    def test_opposed_bays_and_forward_left_bank(self):
        for n in (1,3,5):
            a,b=k.pose(n),k.pose(n+1)
            self.assertAlmostEqual(a['pin'][0],-b['pin'][0])
            self.assertAlmostEqual(a['pin'][1],-b['pin'][1])
            self.assertGreater(b['pin'][2],a['pin'][2])

    def test_all_generated_parts_have_source_dispositions(self):
        spec,_=build();validate_spec(spec)
        inventory=json.loads(Path('cad-studies/gtsio520-h-realism/inventory.json').read_text())
        self.assertEqual(len(spec['parts']),103)
        self.assertTrue(review(inventory,[p['id'] for p in spec['parts']])['coverage_checked'])
        # Prove the gate rejects a missing generated bearing.
        ids=[p['id'] for p in spec['parts'] if p['id']!='RodBearingUpper1']
        with self.assertRaises(ValueError):review(inventory,ids)

    def test_four_rings_and_prescribed_gap_orientation(self):
        spec,_=build();parts={p['id']:p for p in spec['parts']}
        for n in range(1,7):
            for name in ['CompressionRingA','CompressionRingB','OilRing','ScraperRing']:
                self.assertIn(name+str(n),parts)
            # Gap placements of rings 1/3 coincide in orientation; 2/4 are opposite.
            from cad_pipeline.spec import evaluate
            for name,sign in [('CompressionRingA',1),('OilRing',1),('CompressionRingB',-1),('ScraperRing',-1)]:
                gap=parts[name+str(n)]['features'][1]
                z=evaluate(gap['origin'][2],spec['parameters'])-k.station(n)
                self.assertEqual(z,0 if sign==1 else -72)
        altered=copy.deepcopy(spec);altered['parts'].append(altered['parts'][0])
        with self.assertRaises(ValueError):validate_spec(altered)


if __name__=='__main__':unittest.main()
