"""Run with Blender --background --python export_drive_test.py."""
from pathlib import Path
import bpy, json, struct, hashlib
ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Visualization.blend'
OUT = ROOT / '.local'
OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.scene.frame_set(13)
bpy.context.view_layer.update()
parts = [o for o in bpy.context.scene.objects if o.get('cad_part_id')]
assert len(parts) == 60
for o in list(bpy.context.scene.objects):
    if o not in parts:
        continue
    world = o.matrix_world.copy()
    o.parent = None
    o.animation_data_clear()
    o.matrix_world = world
    o.name = o['cad_part_id']
    o.hide_set(False)
    o.hide_viewport = False
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
target = OUT / 'GTSIO520_Cylinder_Drive_Test.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
    export_extras=True, export_animations=False, export_cameras=False, export_lights=False)
raw = target.read_bytes()
length, kind = struct.unpack_from('<II', raw, 12)
doc = json.loads(raw[20:20+length])
ids = [n.get('extras', {}).get('cad_part_id') for n in doc['nodes']]
assert set(filter(None, ids)) == {o['cad_part_id'] for o in parts}
report = {'source': str(SOURCE), 'asset': target.name, 'bytes': len(raw),
    'sha256': hashlib.sha256(raw).hexdigest(), 'verified_part_ids': 60,
    'scope': 'Static assembly pose for Drive delivery, orbit, zoom and component selection testing. No operating animation.'}
(OUT / 'export-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
