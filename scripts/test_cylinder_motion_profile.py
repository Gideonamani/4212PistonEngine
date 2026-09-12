"""Validate the released operating-cylinder asset used by the shared training shell."""
from pathlib import Path
import hashlib
import gzip
import json

root = Path(__file__).resolve().parents[1]
web = root / 'web'
profile = json.loads((web / 'motion.json').read_text())
config = json.loads((web / 'config.json').read_text())

asset_hash = hashlib.sha256((web / 'control.glb').read_bytes()).hexdigest()
assert asset_hash == profile['asset_sha256']
assert config['packaged_model_url'] == './control.glb.gz'
assert config['packaged_model_fallback_url'] == './control.glb'
assert gzip.decompress((web / 'control.glb.gz').read_bytes()) == (web / 'control.glb').read_bytes()
assert profile['bind_angle_deg'] == 0
assert profile['valves']['cycle']['degrees'] == 720
assert profile['valves']['spring_targets'].keys() == {
    'IntakeInnerSpring', 'IntakeOuterSpring', 'ExhaustInnerSpring', 'ExhaustOuterSpring'
}
assert profile['cycle_landmarks']['passed'] and profile['cycle_landmarks']['audit_complete']
assert profile['cycle_landmarks']['source_sha256'] == profile['valves']['source_sha256']
print('published operating-cylinder asset and cycle profile are bound')
