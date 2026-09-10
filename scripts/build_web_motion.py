from pathlib import Path
import json
repo=Path(__file__).resolve().parents[1]
cad=json.loads((repo/'data/motion-profile.json').read_text())
bind=json.loads((repo/'data/web-bind-pose.json').read_text())
assert cad['validation']['passed'] and bind['passed']
if bind.get('cad_source_sha256') != cad['source']['sha256']:
    raise ValueError('GLB bind verification must be rerun for this CAD motion profile')
profile={'schema_version':1,'asset_sha256':bind['sha256'],'bind_angle_deg':bind['bind_angle_deg'],
         'radius_m':cad['dimensions']['Stroke']['value_mm']/2000,
         'rod_length_m':cad['dimensions']['RodLength']['value_mm']/1000,
         'groups':{p['id']:p['motion_group'] for p in cad['parts']},
         'scope':'Slider-crank kinematics only. Valves remain closed; no gas or combustion simulation.'}
(repo/'web/motion.json').write_text(json.dumps(profile,indent=2)+'\n')
