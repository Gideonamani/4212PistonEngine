"""Create an isolated React/Vite preview for a verified cylinder export package."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import shutil

from prepare_vite_preview import prepare_vite_preview, print_preview_command

parser = argparse.ArgumentParser()
parser.add_argument('--package', type=Path, required=True)
parser.add_argument('--valves', action='store_true')
args = parser.parse_args()
folder = args.package.resolve()
repo = Path(__file__).resolve().parents[1]
check = json.loads((folder / 'verification.json').read_text())
assert check['passed']
asset = folder / 'engine.glb'
assert hashlib.sha256(asset.read_bytes()).hexdigest() == check['asset_sha256']
data = json.loads((folder / 'geometry.json').read_text())
assert data['source_sha256'] == check['source_sha256']

preview = folder / 'preview'
prepare_vite_preview(repo, preview)
shutil.copy2(asset, preview / 'web' / 'control.glb')
sources = [{'localUrl': './control.glb'}]
if (folder / 'transport.json').exists():
    transport = json.loads((folder / 'transport.json').read_text())
    assert transport['passed'] and transport['decoded_sha256'] == check['asset_sha256']
    assert transport['source_sha256'] == check['source_sha256']
    assert transport['asset_file'] == 'engine.glb.gz' and transport['encoding'] == 'gzip'
    packed = folder / transport['asset_file']
    assert hashlib.sha256(packed.read_bytes()).hexdigest() == transport['asset_sha256']
    shutil.copy2(packed, preview / 'web' / 'control.glb.gz')
    sources.insert(0, {'localUrl': './control.glb.gz', 'compressed': True})

profile = {
    'schema_version': 1,
    'asset_sha256': check['asset_sha256'],
    'bind_angle_deg': data['bind_angle_deg'],
    'radius_m': data['dimensions_mm']['Stroke'] / 2000,
    'rod_length_m': data['dimensions_mm']['RodLength'] / 1000,
    'groups': {part['id']: part['group'] for part in data['parts']},
    'scope': 'Isolated React preview: slider-crank only, no validated valve motion.',
}

if args.valves:
    valves = json.loads((repo / 'data' / 'valve-motion.json').read_text())
    assert valves['source_sha256'] == check['source_sha256']
    assert data['bind_angle_deg'] == 0
    profile['valves'] = valves
    profile['scope'] = 'Unreleased rigid valve motion preview; spring compression and gas integration pending.'
    blender = json.loads((folder / 'blender-manifest.json').read_text())
    if 'spring_motion' in blender:
        morph = json.loads((folder / 'spring-morph-verification.json').read_text())
        assert morph['passed'] and morph['asset_sha256'] == check['asset_sha256'] and morph['source_sha256'] == check['source_sha256']
        spring_file = repo / 'data' / 'spring-motion.json'
        assert hashlib.sha256(spring_file.read_bytes()).hexdigest() == blender['spring_motion']['audit_sha256']
        spring = json.loads(spring_file.read_text())
        assert spring['passed'] and spring['audit_complete'] and spring['source_sha256'] == check['source_sha256']
        profile['valves']['spring_targets'] = {
            part_id: {
                'train': 'intake' if part_id.startswith('Intake') else 'exhaust',
                'maximum_lift_mm': spring['springs'][part_id]['maximum_lift_mm'],
                'target': blender['spring_motion']['target_name'],
            }
            for part_id in blender['spring_motion']['ids']
        }
        profile['scope'] = 'Unreleased valve and spring motion preview; gas integration pending.'
    landmarks_file = repo / 'data' / 'cycle-cues-profile.json'
    if landmarks_file.exists():
        landmarks = json.loads(landmarks_file.read_text())
        assert landmarks['passed'] and landmarks['audit_complete'] and landmarks['source_sha256'] == check['source_sha256']
        audit_file = repo / 'data' / 'cycle-region-solid-audit.json'
        assert hashlib.sha256(audit_file.read_bytes()).hexdigest() == landmarks['audit_sha256']
        contact = json.loads((repo / 'data' / 'spring-seat-contact.json').read_text())
        frames = json.loads((repo / 'data' / 'pushrod-frames.json').read_text())
        assert frames['source_sha256'] == contact['joint_frame_source_sha256']
        assert contact['source_sha256'] == check['source_sha256']
        for name, port in landmarks['ports'].items():
            frame = frames['trains'][name]
            origin, axis = frame['closed_valve_origin_mm'], frame['valve_axis']
            part = next(item for item in data['parts'] if item['id'] == name.title() + 'Valve')
            group = data['groups'][part['group']]
            assert all(abs(value) < 1e-9 for value in group['translation_mm'])
            assert all(abs(left - right) < 1e-9 for left, right in zip(group['quaternion_xyzw'], [0, 0, 0, 1]))
            radius = 0
            for vertex in part['vertices_mm']:
                offset = [left - right for left, right in zip(vertex, origin)]
                axial = sum(left * right for left, right in zip(offset, axis))
                radius = max(radius, math.sqrt(sum((left - axial * right) ** 2 for left, right in zip(offset, axis))))
            port['valve'] = {'origin_mm': origin, 'axis': axis, 'head_radius_mm': radius}
        landmarks['flow_path_status'] = 'Schematic connection through CAD port and valve frames; not an audited fluid passage or CFD trajectory.'
        profile['cycle_landmarks'] = landmarks
        profile['scope'] = 'Unreleased operating-cylinder preview with illustrative cycle cues; instructor review pending.'

(preview / 'web' / 'motion.json').write_text(json.dumps(profile, indent=2) + '\n')
(preview / 'web' / 'config.json').write_text('{}\n')
registry_path = preview / 'src' / 'data' / 'models.json'
registry = json.loads(registry_path.read_text())
next(model for model in registry if model['id'] == 'cylinder')['sources'] = sources
registry_path.write_text(json.dumps(registry, indent=2) + '\n')
print_preview_command(preview)
