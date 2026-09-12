"""Make a localhost-only copy of the current viewer for a verified export package."""
from pathlib import Path
import argparse,hashlib,json,shutil,math
parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True)
parser.add_argument('--valves',action='store_true')
args=parser.parse_args()
folder=args.package.resolve();repo=Path(__file__).resolve().parents[1]
check=json.loads((folder/'verification.json').read_text());assert check['passed']
asset=folder/'engine.glb';assert hashlib.sha256(asset.read_bytes()).hexdigest()==check['asset_sha256']
data=json.loads((folder/'geometry.json').read_text())
assert data['source_sha256']==check['source_sha256']
preview=folder/'preview';preview.mkdir(exist_ok=True)
for name in ['index.html','viewer.js','kinematics.mjs','valve-kinematics.mjs','valve-transforms.mjs','cycle-cues.mjs','cycle-particles.mjs','cycle-visuals.mjs','cycle-preview-check.mjs','transfer.mjs','model-transport.mjs','components.json']:
    shutil.copy2(repo/'web'/name,preview/name)
(preview/'config.json').write_text('{}\n')
shutil.copy2(asset,preview/'control.glb')
if (folder/'transport.json').exists():
    transport=json.loads((folder/'transport.json').read_text())
    assert transport['passed'] and transport['decoded_sha256']==check['asset_sha256']
    assert transport['source_sha256']==check['source_sha256']
    assert transport['asset_file']=='engine.glb.gz' and transport['encoding']=='gzip'
    packed=folder/transport['asset_file']
    assert hashlib.sha256(packed.read_bytes()).hexdigest()==transport['asset_sha256']
    shutil.copy2(packed,preview/'control.glb.gz')
    (preview/'config.json').write_text(json.dumps({'local_model_url':'./control.glb.gz','local_model_fallback_url':'./control.glb'},indent=2)+'\n')
profile={'schema_version':1,'asset_sha256':check['asset_sha256'],'bind_angle_deg':data['bind_angle_deg'],
         'radius_m':data['dimensions_mm']['Stroke']/2000,'rod_length_m':data['dimensions_mm']['RodLength']/1000,
         'groups':{p['id']:p['group'] for p in data['parts']},
         'scope':'Isolated propagation preview: slider-crank only, no validated valve motion.'}
if args.valves:
    valves=json.loads((repo/'data/valve-motion.json').read_text())
    assert valves['source_sha256']==check['source_sha256']
    assert data['bind_angle_deg']==0
    profile['valves']=valves
    profile['scope']='Unreleased rigid valve motion preview; spring compression and gas integration pending.'
    blender=json.loads((folder/'blender-manifest.json').read_text())
    if 'spring_motion' in blender:
        morph=json.loads((folder/'spring-morph-verification.json').read_text())
        assert morph['passed'] and morph['asset_sha256']==check['asset_sha256'] and morph['source_sha256']==check['source_sha256']
        spring_file=repo/'data/spring-motion.json'
        assert hashlib.sha256(spring_file.read_bytes()).hexdigest()==blender['spring_motion']['audit_sha256']
        spring=json.loads(spring_file.read_text())
        assert spring['passed'] and spring['audit_complete'] and spring['source_sha256']==check['source_sha256']
        profile['valves']['spring_targets']={pid:{'train':'intake' if pid.startswith('Intake') else 'exhaust',
            'maximum_lift_mm':spring['springs'][pid]['maximum_lift_mm'],'target':blender['spring_motion']['target_name']}
            for pid in blender['spring_motion']['ids']}
        profile['scope']='Unreleased valve and spring motion preview; gas integration pending.'
    landmarks_file=repo/'data/cycle-cues-profile.json'
    if landmarks_file.exists():
        landmarks=json.loads(landmarks_file.read_text())
        assert landmarks['passed'] and landmarks['audit_complete'] and landmarks['source_sha256']==check['source_sha256']
        audit_file=repo/'data/cycle-region-solid-audit.json'
        assert hashlib.sha256(audit_file.read_bytes()).hexdigest()==landmarks['audit_sha256']
        contact=json.loads((repo/'data/spring-seat-contact.json').read_text())
        frames=json.loads((repo/'data/pushrod-frames.json').read_text())
        assert frames['source_sha256']==contact['joint_frame_source_sha256']
        assert contact['source_sha256']==check['source_sha256']
        for name,port in landmarks['ports'].items():
            frame=frames['trains'][name];origin=frame['closed_valve_origin_mm'];axis=frame['valve_axis']
            part=next(p for p in data['parts'] if p['id']==name.title()+'Valve')
            # Cylinder group is the world frame in this validated zero-degree package.
            group=data['groups'][part['group']]
            assert all(abs(v)<1e-9 for v in group['translation_mm'])
            assert all(abs(a-b)<1e-9 for a,b in zip(group['quaternion_xyzw'],[0,0,0,1]))
            radius=0
            for vertex in part['vertices_mm']:
                offset=[a-b for a,b in zip(vertex,origin)];axial=sum(a*b for a,b in zip(offset,axis))
                radius=max(radius,math.sqrt(sum((a-axial*b)**2 for a,b in zip(offset,axis))))
            port['valve']={'origin_mm':origin,'axis':axis,'head_radius_mm':radius}
        landmarks['flow_path_status']='Schematic connection through CAD port and valve frames; not an audited fluid passage or CFD trajectory.'
        profile['cycle_landmarks']=landmarks
        profile['scope']='Unreleased operating-cylinder preview with illustrative cycle cues; instructor review pending.'
    shutil.copy2(repo/'scripts/valve-transform-check.html',preview/'valve-transform-check.html')
    shutil.copy2(repo/'data/spring-seat-contact.json',preview/'valve-audit.json')
(preview/'motion.json').write_text(json.dumps(profile,indent=2)+'\n')
print('Prepared localhost preview:',preview)
