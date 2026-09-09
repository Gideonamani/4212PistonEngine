"""Verify the existing static GLB's mechanism transforms against the CAD profile."""
from pathlib import Path
import hashlib,json,math,struct
repo=Path(__file__).resolve().parents[1]
profile=json.loads((repo/'data/motion-profile.json').read_text())
asset=repo/'.local/GTSIO520_Cylinder_Drive_Test.glb'
raw=asset.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+size])
nodes={n.get('extras',{}).get('cad_part_id'):n for n in gltf['nodes'] if n.get('extras',{}).get('cad_part_id')}
assert set(nodes)=={p['id'] for p in profile['parts']}
q=nodes['CrankThrow']['rotation'];angle=2*math.atan2(q[2],q[3])
r=profile['dimensions']['Stroke']['value_mm']/2000
length=profile['dimensions']['RodLength']['value_mm']/1000
cx,cy=r*math.cos(angle),r*math.sin(angle)
reach=math.sqrt(length*length-cy*cy)
expected={'PistonBody':[cx+reach,0,0],'ConnectingRodBody':[cx,cy,0]}
errors={name:math.dist(nodes[name]['translation'],point) for name,point in expected.items()}
rod_q=nodes['ConnectingRodBody']['rotation'];rod_angle=2*math.atan2(rod_q[2],rod_q[3])
angle_error=abs(rod_angle+math.atan2(cy,reach))
assert max(errors.values())<1e-7 and angle_error<1e-6
report={'asset':asset.name,'sha256':hashlib.sha256(raw).hexdigest(),'passed':True,
        'bind_angle_deg':math.degrees(angle),'cad_inspection_angle_deg':profile['reference_angle_deg'],
        'coordinates':'glTF metres; piston along X, crankpin in XY; positive crank rotation about Z',
        'position_errors_m':errors,'rod_rotation_error_rad':angle_error,
        'scope':'60 IDs and three mechanism node transforms; not valve motion, vertex topology or clearance verification'}
(repo/'data/web-bind-pose.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
