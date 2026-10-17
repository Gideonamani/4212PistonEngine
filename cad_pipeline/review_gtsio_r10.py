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


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--output', type=Path, default=REPO/'build/gtsio520-animation-review')
    a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    a.output.mkdir(parents=True, exist_ok=True)
    handoff = json.loads((REPO/'cad-studies/gtsio520-h-static/crankcase-contours/animation-handoff.json').read_text())
    for key in ['selected_geometry', 'selected_spec', 'selected_inventory']:
        b = handoff[key]
        if digest(REPO/b['path']) != b['sha256']:
            raise ValueError('Frozen input changed: '+key)
    data = json.loads((REPO/handoff['selected_geometry']['path']).read_text())
    if len(data['parts']) != 1396 or len({p['id'] for p in data['parts']}) != 1396:
        raise ValueError('Incomplete frozen input')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    colors = {'steel': (.49,.57,.65,1), 'aluminium': (.69,.75,.79,1),
              'bronze': (.67,.40,.14,1), 'rubber': (.045,.065,.085,1)}
    mats = {}
    for name, color in colors.items():
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = color
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = color
        shader.inputs['Metallic'].default_value = .45 if name != 'rubber' else 0
        shader.inputs['Roughness'].default_value = .46
        mats[name] = mat
    collections = {}
    for part in data['parts']:
        if part['group'] not in collections:
            collection = bpy.data.collections.new(part['group'])
            scene.collection.children.link(collection)
            collections[part['group']] = collection
        mesh = bpy.data.meshes.new(part['id'])
        mesh.from_pydata([tuple(c/1000 for c in v) for v in part['vertices_mm']], [], part['triangles'])
        mesh.update()
        obj = bpy.data.objects.new(part['id'], mesh)
        obj.rotation_mode = 'QUATERNION'
        collections[part['group']].objects.link(obj)
        mesh.materials.append(mats.get(part['material'], mats['steel']))
        for key in ['label','group','evidence']:
            obj[key] = part[key]
        obj['cad_part_id'] = part['id']
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
    packed = a.output/(glb.name+'.gz')
    packed.write_bytes(gzip.compress(glb.read_bytes(), mtime=0))
    manifest = dict(status='private unaccepted presentation', part_count=len(data['parts']),
        triangles=sum(len(p['triangles']) for p in data['parts']),
        geometry=handoff['selected_geometry'],spec=handoff['selected_spec'],
        asset_sha256=digest(glb), asset_bytes=glb.stat().st_size,
        gzip_bytes=packed.stat().st_size, blender_version=bpy.app.version_string,
        complete_engine_acceptance=False, release_allowed=False,
        pending=handoff['pending_before_animation_acceptance'],
        parts=[dict({k:v for k,v in part.items() if k not in ['vertices_mm','triangles']},
                    mesh_bounds_mm=[[fn(v[i] for v in part['vertices_mm']) for i in range(3)] for fn in [min,max]])
               for part in data['parts']])
    (a.output/'review-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('FROZEN_R10_STATIC_REVIEW_READY', manifest['part_count'], manifest['asset_bytes'], flush=True)


if __name__ == '__main__':
    main()
