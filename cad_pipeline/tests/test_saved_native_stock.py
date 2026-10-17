"""Mutation gates for single-tip extraction from a previously audited package."""
import json
import tempfile
import unittest
import xml.etree.ElementTree as E
import zipfile
from pathlib import Path
from cad_pipeline.saved_native_stock import extract,file_sha


class StockGate(unittest.TestCase):
    def setUp(self):
        Path('build').mkdir(exist_ok=True)
        self.base=Path('build').resolve()
        self.temp=tempfile.TemporaryDirectory(dir=str(self.base));self.root=Path(self.temp.name).resolve()
        if not self.root.is_relative_to(self.base):raise ValueError('Fixture must remain inside build directory')
        self.spec=self.root/'spec.json';self.spec.write_text(json.dumps({'part':'fixture'}))
        self.native=self.root/'fixture.FCStd';self.audit=self.root/'audit.json'
        self.write_native();self.write_audit()

    def tearDown(self):
        if not self.root.resolve().is_relative_to(self.base):raise ValueError('Refuse cleanup outside fixture workspace')
        self.temp.cleanup()

    def write_native(self,duplicate=False,px='0',embedded=None):
        root=E.Element('Document');data=E.SubElement(root,'ObjectData')
        params=E.SubElement(E.SubElement(data,'Object',name='Parameters'),'Properties')
        E.SubElement(E.SubElement(params,'Property',name='SpecificationJSON'),'String',value=self.spec.read_text() if embedded is None else embedded)
        for i in range(2 if duplicate else 1):
            props=E.SubElement(E.SubElement(data,'Object',name='Tip'+str(i)),'Properties')
            E.SubElement(E.SubElement(props,'Property',name='StablePartID'),'String',value='TestStock')
            E.SubElement(E.SubElement(props,'Property',name='Placement'),'PropertyPlacement',Px=px,Py='0',Pz='0',Q0='0',Q1='0',Q2='0',Q3='1')
            E.SubElement(E.SubElement(props,'Property',name='Shape'),'Part',file='fixture.brep')
        with zipfile.ZipFile(self.native,'w') as z:z.writestr('Document.xml',E.tostring(root));z.writestr('fixture.brep',b'a known frozen source body')

    def write_audit(self,passed=True):
        self.audit.write_text(json.dumps(dict(passed=passed,native_sha256=file_sha(self.native),spec_sha256=file_sha(self.spec),agreement=[dict(id='TestStock',passed=passed)])))

    def read(self):return extract(self.native,self.audit,self.spec,'TestStock',self.root/'result.brep')

    def test_bound_stock_roundtrip(self):
        result=self.read();self.assertEqual((self.root/'result.brep').read_bytes(),b'a known frozen source body');self.assertEqual(result['extracted_brep_sha256'],file_sha(self.root/'result.brep'))

    def test_changed_native_rejected(self):
        self.write_native(px='.01')
        with self.assertRaises(ValueError):self.read()

    def test_changed_spec_file_rejected(self):
        self.spec.write_text('{"part":"different"}')
        with self.assertRaises(ValueError):self.read()

    def test_wrong_embedded_recipe_rejected(self):
        self.write_native(embedded='{"part":"different"}');self.write_audit()
        with self.assertRaises(ValueError):self.read()

    def test_duplicate_part_rejected(self):
        self.write_native(duplicate=True);self.write_audit()
        with self.assertRaises(ValueError):self.read()

    def test_unhandled_placement_rejected(self):
        self.write_native(px='.01');self.write_audit()
        with self.assertRaises(ValueError):self.read()

    def test_failed_source_rejected(self):
        self.write_audit(passed=False)
        with self.assertRaises(ValueError):self.read()

    def test_explicit_subset_agreement_schema(self):
        audit=json.loads(self.audit.read_text());audit['agreements']=audit.pop('agreement');self.audit.write_text(json.dumps(audit))
        result=extract(self.native,self.audit,self.spec,'TestStock',self.root/'result.brep',agreement_key='agreements')
        self.assertEqual(result['extracted_brep_sha256'],file_sha(self.root/'result.brep'))


if __name__=='__main__':unittest.main()
