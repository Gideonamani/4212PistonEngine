"""Restore hash-bound public teaching exports for local/CI validation, never CAD sources."""
from pathlib import Path
import hashlib, json, os, sys, tempfile, urllib.request

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'docs/drive-asset-manifest.json').read_text(encoding='utf8'))
config = json.loads((root / 'web/config.json').read_text(encoding='utf8'))
for asset in manifest['web_assets']:
    target = root / asset['path']
    if '--verify-remote' not in sys.argv and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == asset['sha256']:
        print('Verified local asset:', asset['path']); continue
    if not asset.get('drive_id'):
        raise RuntimeError('Drive publication is incomplete: ' + asset['path'])
    request = urllib.request.Request(
        'https://www.googleapis.com/drive/v3/files/' + asset['drive_id'] + '?alt=media',
        headers={'X-Goog-Api-Key': config['drive_api_key'], 'Referer': 'https://gideonamani.github.io/4212PistonEngine/'})
    print('Checking anonymous Drive delivery:', asset['path'], flush=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(request, timeout=300) as response:
        data = response.read()
    if len(data) != asset['bytes'] or hashlib.sha256(data).hexdigest() != asset['sha256']:
        raise RuntimeError('Drive asset size/hash mismatch: ' + asset['path'])
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
        output.write(data); temporary = output.name
    os.replace(temporary, target)
    print('Restored verified Drive asset:', asset['path'])
