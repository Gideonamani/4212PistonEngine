"""Structural acceptance checks for the local V4 web export."""
import json
import struct
import sys
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('build/full-engine-web/gtsio520-six-cylinder-drive.glb')
data = path.read_bytes()
assert data[:4] == b'glTF', 'not a binary glTF file'
json_length = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + json_length])
names = {node.get('name', '') for node in doc.get('nodes', [])}
for cylinder in range(1, 7):
    assert any(name.startswith(f'C{cylinder} | ') for name in names), f'cylinder {cylinder} missing'
assert any('crank' in name.lower() for name in names), 'crankshaft objects missing'
assert any('cam' in name.lower() for name in names), 'camshaft objects missing'
assert any('prop' in name.lower() for name in names), 'propeller drive objects missing'
assert any(name.startswith('V5 ') for name in names), 'V5 crankcase objects missing'
assert any('crankcase' in name.lower() for name in names), 'crankcase shells missing'
channels = sum(len(animation.get('channels', [])) for animation in doc.get('animations', []))
assert channels >= 100, f'expected baked operating transforms, found {channels}'
assert len(doc.get('meshes', [])) >= 800, 'incomplete engine mesh export'
print(json.dumps({'passed': True, 'bytes': len(data), 'meshes': len(doc['meshes']), 'nodes': len(doc['nodes']), 'animation_channels': channels}, indent=2))
