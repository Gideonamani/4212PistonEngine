"""Private presentation of the frozen R10 tessellation; no CAD acceptance claim.

Run in Blender 5.0.1. Sources and the student release are never written.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from cad_pipeline.gtsio_review_motion import ReviewMotion, build_reference_poses, build_review_contract
from cad_pipeline.look import DEFAULT_SMOOTH_ANGLE_DEG, apply_smooth_by_angle, apply_studio_world, blender_material


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--output', type=Path, default=REPO/'build/gtsio520-animation-review')
    p.add_argument('--smooth-angle', type=float, default=DEFAULT_SMOOTH_ANGLE_DEG)
    a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    a.output.mkdir(parents=True, exist_ok=True)
    handoff = json.loads((REPO/'cad-studies/gtsio520-h-static/crankcase-contours/animation-handoff.json').read_text())
    for key in ['selected_geometry', 'selected_spec', 'selected_inventory']:
        b = handoff[key]
        if digest(REPO/b['path']) != b['sha256']:
            raise ValueError('Frozen input changed: '+key)
    data = json.loads((REPO/handoff['selected_geometry']['path']).read_text())
    spec = json.loads((REPO/handoff['selected_spec']['path']).read_text())
    if len(data['parts']) != 1396 or len({p['id'] for p in data['parts']}) != 1396:
        raise ValueError('Incomplete frozen input')
    motion = ReviewMotion(spec, data['parts'], handoff['rigid_body_seeds'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    apply_studio_world(scene)
    mats = {}
    collections = {}
    for part in data['parts']:
        if part['group'] not in collections:
            collection = bpy.data.collections.new(part['group'])
            scene.collection.children.link(collection)
            collections[part['group']] = collection
        mesh = bpy.data.meshes.new(part['id'])
        mesh.from_pydata([tuple(c/1000 for c in v) for v in part['vertices_mm']], [], part['triangles'])
        apply_smooth_by_angle(mesh, a.smooth_angle)
        obj = bpy.data.objects.new(part['id'], mesh)
        obj.rotation_mode = 'QUATERNION'
        collections[part['group']].objects.link(obj)
        mesh.materials.append(blender_material(part['material'], part_id=part['id'], vary=True, cache=mats))
        for key in ['label','group','evidence']:
            obj[key] = part[key]
        obj['cad_part_id'] = part['id']
        obj['review_body'] = motion.body(part['id'])
        obj['cycle_visible'] = motion.cycle_visible(part['id'])
        obj['source_geometry_sha256'] = handoff['selected_geometry']['sha256']
        obj['scope'] = 'Frozen R10 direct tessellation; private unaccepted review'
    camera_data = bpy.data.cameras.new('Review camera')
    camera = bpy.data.objects.new('Review camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (1.18, .92, 1.30)
    camera.rotation_euler = (Vector((0,0,.30))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 1.35
    scene.camera = camera
    scene['review_scope'] = 'Presentation draft; whole-engine native/STEP and swept clearance gates remain open'
    blend = a.output/'gtsio520-r10-review.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    glb = a.output/'gtsio520-r10-static.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_extras=True,
                              export_animations=False, export_cameras=False)
    raw_bytes = glb.read_bytes()
    packed = a.output/(glb.name+'.gz')
    packed_bytes = gzip.compress(raw_bytes, mtime=0)
    packed.write_bytes(packed_bytes)
    asset_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    manifest_parts = [
        dict({k:v for k,v in part.items() if k not in ['vertices_mm','triangles']},
             mesh_bounds_mm=[[fn(v[i] for v in part['vertices_mm']) for i in range(3)] for fn in [min,max]])
        for part in data['parts']
    ]
    manifest = dict(status='private unaccepted presentation', part_count=len(data['parts']),
        triangles=sum(len(p['triangles']) for p in data['parts']),
        geometry=handoff['selected_geometry'],spec=handoff['selected_spec'],
        asset_sha256=asset_sha256, asset_bytes=len(raw_bytes),
        gzip_bytes=len(packed_bytes), blender_version=bpy.app.version_string,
        complete_engine_acceptance=False, release_allowed=False,
        pending=handoff['pending_before_animation_acceptance'],
        parts=manifest_parts)
    (a.output/'review-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    contract = build_review_contract(
        motion=motion,
        handoff=handoff,
        spec=spec,
        parts=manifest_parts,
        asset_file=glb.name,
        asset_sha256=asset_sha256,
        asset_bytes=len(raw_bytes),
        gzip_bytes=len(packed_bytes),
        blender_version=bpy.app.version_string,
    )
    (a.output/'review-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
    reference = build_reference_poses(motion, manifest_parts)
    (a.output/'reference-poses.json').write_text(json.dumps(reference)+'\n')
    print('FROZEN_R10_STATIC_REVIEW_READY', manifest['part_count'], manifest['asset_bytes'], flush=True)


if __name__ == '__main__':
    main()

