"""Bind extracted landmarks to a completed whole-region CAD audit."""
from pathlib import Path
import hashlib,json
repo=Path(__file__).resolve().parents[1]
landmarks=json.loads((repo/'data/cycle-landmarks.json').read_text())
audit_file=repo/'data/cycle-region-solid-audit.json';audit=json.loads(audit_file.read_text())
assert audit['passed'] and audit['audit_complete']
assert landmarks['source_sha256']==audit['source_sha256']
expected={('CylinderHead',None),('CylinderBarrel',None)}|{(label+'Valve',n/4) for label in ['Intake','Exhaust'] for n in range(29)}
assert {(r['part'],r['lift_mm']) for r in audit['checks']}==expected
assert all(r['intersection_mm3']<=1e-5 for r in audit['checks'])
c=landmarks['chamber'];region=audit['maximum_region']
assert c['front_x_mm']==region['end_x_mm'] and c['radius_mm']==region['radius_mm']
assert set(landmarks['ports'])=={'intake','exhaust'}
profile={'schema_version':1,'source_sha256':audit['source_sha256'],'passed':True,'audit_complete':True,
 'ports':landmarks['ports'],'chamber':c,'audit_sha256':hashlib.sha256(audit_file.read_bytes()).hexdigest(),
 'scope':'Whole maximum display region clears head/barrel and sampled valve lifts; piston clearance uses its moving axial bound. Reconstructed geometry, illustrative cues, not CFD.'}
(repo/'data/cycle-cues-profile.json').write_text(json.dumps(profile,indent=2)+'\n')
print('Built completed-audit-bound cycle cue profile')
