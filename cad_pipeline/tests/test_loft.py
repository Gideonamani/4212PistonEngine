"""Saved native ruled lofts retain their section expressions and taper geometry."""
import copy
import json
import unittest
import uuid
from pathlib import Path
from cad_pipeline.spec import validate_spec

ROOT=Path(__file__).resolve().parents[2]


def fixture():
    parameters={n:dict(value=v,unit='mm',status='inferred',source_ids=[],rationale='Loft regression fixture') for n,v in [('width',20.),('height',14.),('taper',2.)]}
    xy=[[0,0],['width',0],['width',10],[0,10]]
    sections=[[[x,y,f'taper*({x})/(2*width)'] for x,y in xy],[[x,y,f'height-taper*({x})/(2*width)'] for x,y in xy]]
    return dict(schema_version=1,model_id='taper-test',units='mm',input_mode='text',scope='Linked tilted section regression fixture',sources={},parameters=parameters,
                parts=[dict(id='Web',label='Tapered web',group='test',material='steel',evidence='Fixture',features=[dict(primitive='loft',operation='add',sections=sections)])])


class LoftTest(unittest.TestCase):
    def test_bad_correspondence_rejected(self):
        spec=fixture();spec['parts'][0]['features'][0]['sections'][1].pop()
        with self.assertRaises(ValueError):validate_spec(spec)

    def test_saved_taper_regenerates_and_matches_direct_kernel(self):
        import FreeCAD as App
        from cad_pipeline.generate import build
        from cad_pipeline.fast_build import feature_shape
        spec=fixture();out=ROOT/'build/cad-tests'/str(uuid.uuid4());build(spec,out)
        doc=App.openDocument(str(out/'taper-test.FCStd'));doc.recompute()
        try:
            tip=next(o for o in doc.Objects if getattr(o,'StablePartID',None)=='Web')
            self.assertAlmostEqual(tip.Shape.Volume,2600.,places=6)
            direct=feature_shape(spec['parts'][0]['features'][0],spec['parameters'])
            self.assertAlmostEqual(direct.Volume,tip.Shape.Volume,places=6)
            self.assertEqual(tip.TypeId,'Part::Loft')
            self.assertTrue(all(o.TypeId=='Part::Polygon' and o.ExpressionEngine for o in tip.Sections))
            doc.Parameters.taper=4.;doc.recompute()
            self.assertTrue(tip.Shape.isValid());self.assertEqual(len(tip.Shape.Solids),1)
            self.assertAlmostEqual(tip.Shape.Volume,2400.,places=6)
            self.assertAlmostEqual(tip.Sections[0].Nodes[1].z,2.,places=7)
        finally:App.closeDocument(doc.Name)


if __name__=='__main__':unittest.main()
