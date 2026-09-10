"""Build an unreleased valve contract only from completed candidate audits."""
from pathlib import Path
import hashlib,json
repo=Path(__file__).resolve().parents[1]
def read(name):return json.loads((repo/name).read_text())
candidate=read('data/spring-seat-candidate.json')
contact=read('data/spring-seat-contact.json')
spring=read('data/spring-seat-audit.json')
frames=read('data/pushrod-frames.json')
sha=hashlib.sha256((repo/candidate['candidate_file']).read_bytes()).hexdigest()
assert sha==candidate['candidate_sha256']==contact['source_sha256']==spring['source_sha256']
assert contact['audit_complete'] and contact['sampled_clearance_gate']['passed']
assert spring['audit_complete'] and spring['passed']
assert frames['source_sha256']==contact['joint_frame_source_sha256']
trains={}
for name,frame in frames['trains'].items():
    # Deliberately omit superseded spring dimensions from the older joint-frame source.
    fields=['valve_axis','rocker_pivot_mm','rocker_axis','pushrod_socket_mm','pushrod_lower_mm','pushrod_length_mm']
    train={key:frame[key] for key in fields}
    poses=[p for p in contact['poses'] if p['train'].lower()==name]
    assert [p['lift_mm'] for p in poses]==[n/4 for n in range(29)]
    train['contact_samples']=[{k:p[k] for k in ['lift_mm','rocker_angle_deg']} for p in poses]
    trains[name]=train
result={'schema_version':1,'source_sha256':sha,'coordinates':'FreeCAD world millimetres',
        'status':'Unreleased teaching motion contract; interpolation between sampled contact poses is not continuously audited',
        'cycle':{'degrees':720,'maximum_lift_mm':7,'timing':'Illustrative sin-squared lift over ideal intake/exhaust strokes; not manufacturer cam timing'},
        'trains':trains}
(repo/'data/valve-motion.json').write_text(json.dumps(result,indent=2)+'\n')
print('Built source-bound valve motion contract')
