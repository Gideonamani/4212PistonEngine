"""Refresh versioned study delivery URLs and byte-exact native source hashes after authoring."""
from pathlib import Path
import json,hashlib,gzip
R=Path(__file__).resolve().parents[1]
registry=R/'src/data/models.json';models=json.loads(registry.read_text(encoding='utf-8'))
for model in models:
 if model['adapter']=='animated-study':
  identifier=model['id'];contract=json.loads((R/'web'/ (identifier+'-contract.json')).read_text(encoding='utf-8'));packed=(R/'web'/ (identifier+'.glb.gz')).read_bytes();raw=gzip.decompress(packed)
  assert hashlib.sha256(raw).hexdigest()==contract['asset_sha256'],identifier
  version=contract['asset_sha256'][:12]
  model['sources'][0].update(localUrl='./'+identifier+'.glb.gz?v='+version,transferBytes=len(packed),decodedBytes=len(raw))
  model['contractUrl']='./'+identifier+'-contract.json?v='+version
 if model['id']=='cylinder':model['savedMotionsUrl']='./cylinder-saved-motions.json?v='+hashlib.sha256((R/'web/cylinder-saved-motions.json').read_bytes()).hexdigest()[:12]
registry.write_bytes((json.dumps(models,indent=2)+'\n').encode('utf-8'))
manifest={}
for file in (R/'cad-studies').glob('*/*'):
 if file.suffix in ['.FCStd','.step','.blend','.json'] and file.name!='geometry.json':manifest[file.relative_to(R).as_posix()]={'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
(R/'cad-studies/source-manifest.json').write_bytes((json.dumps(manifest,indent=2)+'\n').encode('utf-8'))
print('Study delivery and native source hashes refreshed')
