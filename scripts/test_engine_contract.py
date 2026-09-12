"""Validate the portable engine-contract shape and binding to the published GLB."""
import hashlib
import gzip
import json
import struct
from pathlib import Path

root=Path(__file__).resolve().parents[1]
contract_path=root/'data/engine-contracts/gtsio520-h-v5.json'
contract=json.loads(contract_path.read_text())
assert json.loads((root/'web/engine-contract.json').read_text())==contract
assert contract['schema']=='4212.engine-contract/v1'
assert contract['operation']['cycle_degrees']==720
assert contract['operation']['source_frames']=={'start':1,'end':241,'degrees_per_frame':3}
assert contract['operation']['firing_order']==[1,4,5,2,3,6]
assert len(contract['modules'])>=3
groups=contract['inspection_groups'];assert groups[0]['id']=='all';assert len(groups)==10
assert all(group['selector'].get('all') or group['selector'].get('any_regex') for group in groups)
asset=root/'web/engine.glb'
assert hashlib.sha256(asset.read_bytes()).hexdigest()==contract['asset']['sha256']
transport=contract['asset']['transport']
transport_asset=root/'web'/Path(transport['web_url']).name
packed=transport_asset.read_bytes()
assert transport['encoding']=='gzip'
assert transport['bytes']==len(packed)
assert transport['sha256']==hashlib.sha256(packed).hexdigest()
assert gzip.decompress(packed)==asset.read_bytes()
assert packed==gzip.compress(asset.read_bytes(),compresslevel=9,mtime=0)

raw=asset.read_bytes()
assert struct.unpack_from('<III',raw)==(0x46546C67,2,len(raw))
json_bytes,chunk_type=struct.unpack_from('<II',raw,12)
assert chunk_type==0x4E4F534A
gltf=json.loads(raw[20:20+json_bytes])
parents={}
for index,node in enumerate(gltf['nodes']):
    for child in node.get('children',[]): parents[child]=index
labels=[]
for index,node in enumerate(gltf['nodes']):
    if 'mesh' not in node: continue
    lineage=[];cursor=index
    while cursor in range(len(gltf['nodes'])):
        lineage.append(gltf['nodes'][cursor].get('name',''))
        cursor=parents.get(cursor,-1)
        if cursor==-1: break
    labels.append(' / '.join(lineage))
components=contract['teaching_components']
assert len(components)==35
assert len({component['id'] for component in components})==len(components)
assert all(' | ' not in component['label'] and component['description'] for component in components)
for component in components:
    patterns=component['selector'].get('any_regex',[])
    assert patterns and any(__import__('re').search(pattern,label,__import__('re').I) for pattern in patterns for label in labels), component['id']
print(json.dumps({'passed':True,'contract':contract['id'],'groups':len(groups),'teaching_components':len(components),'asset_sha256':contract['asset']['sha256']},indent=2))
