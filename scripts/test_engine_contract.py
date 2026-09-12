"""Validate the portable engine-contract shape and binding to the published GLB."""
import hashlib
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
contract=json.loads((root/'data/engine-contracts/gtsio520-h-v5.json').read_text())
assert contract['schema']=='4212.engine-contract/v1'
assert contract['operation']['cycle_degrees']==720
assert contract['operation']['source_frames']=={'start':1,'end':241,'degrees_per_frame':3}
assert contract['operation']['firing_order']==[1,4,5,2,3,6]
assert len(contract['modules'])>=3
groups=contract['inspection_groups'];assert groups[0]['id']=='all';assert len(groups)==10
assert all(group['selector'].get('all') or group['selector'].get('any_regex') for group in groups)
asset=root/'web/engine.glb'
assert hashlib.sha256(asset.read_bytes()).hexdigest()==contract['asset']['sha256']
print(json.dumps({'passed':True,'contract':contract['id'],'groups':len(groups),'asset_sha256':contract['asset']['sha256']},indent=2))
