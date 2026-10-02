"""Bind the reviewed registry to versioned Drive exports without changing asset hashes."""
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'docs/drive-asset-manifest.json').read_text(encoding='utf8'))
assets = {entry['path'].removeprefix('web/'): entry for entry in manifest['web_assets']}
path = root / 'src/data/models.json'
models = json.loads(path.read_text(encoding='utf8'))
for model in models:
    for source in model.get('sources', []):
        name = source.get('localUrl', '').removeprefix('./').split('?')[0]
        if name in assets:
            asset = assets[name]
            if not asset.get('drive_id'):
                raise RuntimeError('Drive publication incomplete: ' + name)
            source['driveId'] = asset['drive_id']
path.write_text(json.dumps(models, indent=2) + '\n', encoding='utf8')
print('Bound verified Drive model identities')
