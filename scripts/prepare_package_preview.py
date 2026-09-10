"""Make a localhost-only copy of the current viewer for a verified export package."""
from pathlib import Path
import argparse,hashlib,json,shutil
parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True)
folder=parser.parse_args().package.resolve();repo=Path(__file__).resolve().parents[1]
check=json.loads((folder/'verification.json').read_text());assert check['passed']
asset=folder/'engine.glb';assert hashlib.sha256(asset.read_bytes()).hexdigest()==check['asset_sha256']
data=json.loads((folder/'geometry.json').read_text())
assert data['source_sha256']==check['source_sha256']
preview=folder/'preview';preview.mkdir(exist_ok=True)
for name in ['index.html','viewer.js','kinematics.mjs','transfer.mjs','components.json']:
    shutil.copy2(repo/'web'/name,preview/name)
(preview/'config.json').write_text('{}\n')
shutil.copy2(asset,preview/'control.glb')
profile={'schema_version':1,'asset_sha256':check['asset_sha256'],'bind_angle_deg':data['bind_angle_deg'],
         'radius_m':data['dimensions_mm']['Stroke']/2000,'rod_length_m':data['dimensions_mm']['RodLength']/1000,
         'groups':{p['id']:p['group'] for p in data['parts']},
         'scope':'Isolated propagation preview: slider-crank only, no validated valve motion.'}
(preview/'motion.json').write_text(json.dumps(profile,indent=2)+'\n')
print('Prepared localhost preview:',preview)
