"""Read one audit-bound, unplaced saved BREP without loading an entire engine.

This is source-stock extraction, not new CAD acceptance. The native archive
hash, specification and prior passed part agreement are checked before use.
Only identity-placement tips are supported; callers must validate new edits.
"""
import hashlib
import json
import xml.etree.ElementTree as E
import zipfile
from pathlib import Path


def file_sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
    return h.hexdigest()


def extract(native,audit_path,spec_path,part_id,output,agreement_key='agreement'):
    audit=json.loads(Path(audit_path).read_text(encoding='utf-8'))
    if not audit.get('passed') or audit.get('native_sha256')!=file_sha(native):
        raise ValueError('Passed saved audit/native hash required')
    spec=json.loads(Path(spec_path).read_text(encoding='utf-8'))
    expected=file_sha(spec_path)
    normalized=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest()
    if audit.get('spec_sha256')!=expected:raise ValueError('Saved audit/specification file mismatch')
    agreements=[r for r in audit[agreement_key] if r['id']==part_id]
    if len(agreements)!=1 or not agreements[0].get('passed'):raise ValueError('Missing passed part agreement')
    with zipfile.ZipFile(native) as archive:
        xml=E.fromstring(archive.read('Document.xml'));matches=[]
        embedded=xml.find(".//ObjectData/Object[@name='Parameters']/Properties/Property[@name='SpecificationJSON']/String")
        if embedded is None or hashlib.sha256(json.dumps(json.loads(embedded.get('value')),sort_keys=True).encode()).hexdigest()!=normalized:
            raise ValueError('Saved embedded specification mismatch')
        for obj in xml.findall('.//ObjectData/Object'):
            properties=obj.find('Properties')
            if properties is None:continue
            prop=properties.find("Property[@name='StablePartID']/String")
            if prop is not None and prop.get('value')==part_id:matches.append(obj)
        if len(matches)!=1:raise ValueError('Ambiguous saved part identity')
        props=matches[0].find('Properties')
        placement=props.find("Property[@name='Placement']/PropertyPlacement")
        # FreeCAD XML stores Px,Py,Pz and Q0..Q3 on PropertyPlacement.
        if placement is None or any(abs(float(placement.get(k,'0')))>1e-12 for k in ['Px','Py','Pz','Q0','Q1','Q2']) or abs(float(placement.get('Q3','1'))-1)>1e-12:
            raise ValueError('Source tip placement must be identity')
        part=props.find("Property[@name='Shape']/Part")
        if part is None:raise ValueError('No saved BREP property')
        member=part.get('file');data=archive.read(member)
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(data)
    return dict(part_id=part_id,native_sha256=audit['native_sha256'],audit_sha256=file_sha(audit_path),
                spec_sha256=expected,normalized_spec_sha256=normalized,archive_member=member,extracted_brep_sha256=file_sha(output),
                scope='One frozen, unplaced saved native tip; new geometry still needs validation')
