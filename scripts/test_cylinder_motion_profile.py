"""Validate the released operating-cylinder asset used by the shared training shell."""
from pathlib import Path
import hashlib
import gzip
import json

root = Path(__file__).resolve().parents[1]
web = root / 'web'
profile = json.loads((web / 'motion.json').read_text())
config = json.loads((web / 'config.json').read_text())

registry = json.loads((root / 'src' / 'data' / 'models.json').read_text())
cylinder = next(model for model in registry if model['id'] == 'cylinder')
release=json.loads((root/'releases/cylinder-reviewed-20261001.json').read_text())
assert cylinder['sources'][0]['localUrl']=='./cylinder-reviewed-20261001.glb.gz'
assert cylinder['sources'][0]['compressed']
assert config['drive_api_key']

# Published GLBs live in Google Drive, not git. Bind the local synced copies when
# present (instructor machine); CI has only the contract data to check.
packed=(root/release['transport_file']).read_bytes()
asset=gzip.decompress(packed)
assert hashlib.sha256(packed).hexdigest()==release['transport_sha256']
assert hashlib.sha256(asset).hexdigest()==release['asset_sha256']==profile['asset_sha256']
catalogue=json.loads((web/'components.json').read_text())
assert sorted(profile['groups'])==release['parts']==sorted(p['cad_stable_id'] for p in catalogue['parts'])
assert len(profile['groups'])==61 and profile['groups']['FuelDischargeNozzle']=='Cylinder'
assert profile['cad_source_sha256']==release['cad_sha256']
assert profile['valves']['source_sha256']==release['parent_cad_sha256']
assert release['current_cue_static_clearance_check']['passed']
assert release['current_cue_static_clearance_check']['cad_sha256']==release['cad_sha256']
assert all(volume<1e-5 for volume in release['current_cue_static_clearance_check']['intersection_mm3'].values())
assert profile['bind_angle_deg'] == 0
assert profile['valves']['cycle']['degrees'] == 720
assert profile['valves']['spring_targets'].keys() == {
    'IntakeInnerSpring', 'IntakeOuterSpring', 'ExhaustInnerSpring', 'ExhaustOuterSpring'
}
assert profile['cycle_landmarks']['passed'] and profile['cycle_landmarks']['audit_complete']
assert profile['cycle_landmarks']['source_sha256'] == profile['valves']['source_sha256']
print('published operating-cylinder asset and cycle profile are bound')
