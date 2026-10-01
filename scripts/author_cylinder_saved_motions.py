"""Author native Blender motions from the unchanged, verified cylinder GLB."""
from pathlib import Path
import bpy,json,gzip,hashlib,math
from mathutils import Vector
R=Path(__file__).resolve().parents[1]; OUT=R/'cad-studies/cylinder';OUT.mkdir(parents=True,exist_ok=True)
p=json.loads((R/'web/cylinder-saved-motions.json').read_text());raw=gzip.decompress((R/'web/cylinder-reviewed-20261001.glb.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest()==p['source_asset_sha256']
tmp=OUT/'source.glb';tmp.write_bytes(raw)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(tmp));tmp.unlink()
objects={o.get('cad_part_id'):o for o in bpy.data.objects if o.type=='MESH'}
assert set(objects)==set(p['parts'])
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=361
bases={n:o.location.copy() for n,o in objects.items()}
worlds={n:o.matrix_world.translation.copy() for n,o in objects.items()}
for name,reverse in [('Exploded overview',False),('Reassembly overview',True)]:
 action=bpy.data.actions.new(name)
 for n,o in objects.items():
  o.animation_data_create();o.animation_data.action=action;o.animation_data.action_slot=action.slots.new(id_type='OBJECT',name=n)
  part=p['parts'][n];v=part['offset_m'];world=Vector((v[0],-v[2],v[1]));local=o.parent.matrix_world.to_3x3().inverted()@world if o.parent else world
  for k in range(5):
   progress=(4-k if reverse else k);amount=max(0,min(1,progress-part['stage']+1))
   o.location=bases[n]+local*amount;o.keyframe_insert('location',frame=1+k*90)
  track=o.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);strip.action_slot=o.animation_data.action_slot;track.mute=True
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
# Verify native authored explosion against the exported browser offsets.
action=bpy.data.actions['Exploded overview']
for n,o in objects.items():o.animation_data.action=action;o.animation_data.action_slot=next(slot for slot in action.slots if slot.name_display==n)
scene.frame_set(361);bpy.context.view_layer.update();maximum=0
for n,o in objects.items():
 delta=o.matrix_world.translation-worlds[n];actual=Vector((delta.x,delta.z,-delta.y));maximum=max(maximum,(actual-Vector(p['parts'][n]['offset_m'])).length)
assert maximum<1e-6,maximum
scene.frame_set(1)
scene['scope']=p['scope'];scene['source_asset_sha256']=p['source_asset_sha256']
for stage in p['stages']:scene.timeline_markers.new(stage['label'],frame=1+round(stage['progress']*3.6))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Cylinder_Saved_Motions.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'Cylinder_Saved_Motions.glb'),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True)
report={'passed':True,'parts':len(objects),'actions':['Exploded overview','Reassembly overview'],'maximum_native_offset_error_m':maximum,'source_asset_sha256':p['source_asset_sha256']}
(OUT/'verification.json').write_text(json.dumps(report,indent=2));print('SAVED_MOTIONS_VERIFIED',report,flush=True)
