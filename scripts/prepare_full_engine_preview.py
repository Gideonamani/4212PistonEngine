"""Create an isolated React/Vite preview for a newly exported full engine."""
from pathlib import Path
import gzip
import hashlib
import json
import shutil

from prepare_vite_preview import prepare_vite_preview, print_preview_command

root = Path(__file__).resolve().parents[1]
source = root / 'build' / 'full-engine-web' / 'gtsio520-six-cylinder-drive.glb'
if not source.exists():
    raise SystemExit('Run export_full_engine_web.py through Blender first.')

preview = root / 'build' / 'full-engine-web' / 'preview'
prepare_vite_preview(root, preview)
raw = source.read_bytes()
shutil.copy2(source, preview / 'web' / 'engine.glb')
(preview / 'web' / 'engine.glb.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))

contract_path = preview / 'web' / 'engine-contract.json'
contract = json.loads(contract_path.read_text())
contract['asset']['sha256'] = hashlib.sha256(raw).hexdigest()
contract['asset']['bytes'] = len(raw)
contract['asset']['web_url'] = './engine.glb'
contract['asset']['transport'].update({
    'web_url': './engine.glb.gz',
    'fallback_web_url': './engine.glb',
    'bytes': (preview / 'web' / 'engine.glb.gz').stat().st_size,
    'sha256': hashlib.sha256((preview / 'web' / 'engine.glb.gz').read_bytes()).hexdigest(),
})
contract_path.write_text(json.dumps(contract, indent=2) + '\n')
(preview / 'web' / 'config.json').write_text('{}\n')
print_preview_command(preview)
