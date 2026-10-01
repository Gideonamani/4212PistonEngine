from pathlib import Path
import bpy,math,json
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
for name in ['cylinder','hydraulic-tappet','oil-pump']:
 folder=R/'cad-studies'/name;file=folder/('Cylinder_Saved_Motions.blend' if name=='cylinder' else name+'.blend')
 bpy.ops.wm.open_mainfile(filepath=str(file));scene=bpy.context.scene
 action=bpy.data.actions['Exploded overview']
 for o in bpy.data.objects:
  if o.type=='MESH' and o.animation_data:
   o.animation_data.action=action;o.animation_data.action_slot=next(slot for slot in action.slots if slot.name_display==o.get('cad_part_id'))
 scene.frame_set(scene.frame_end);bpy.context.view_layer.update()
 points=[o.matrix_world@Vector(corner) for o in bpy.data.objects if o.type=='MESH' for corner in o.bound_box]
 lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)/2;size=(hi-lo).length
 camera=bpy.data.objects.new('Preview camera',bpy.data.cameras.new('Preview camera'));scene.collection.objects.link(camera);scene.camera=camera
 camera.location=center+Vector((1,-1,.7)).normalized()*size*2;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=size*1.65;camera.data.clip_start=.001;camera.data.clip_end=20
 for loc,energy in [((1,-2,3),700),((-2,-1,1),450)]:
  lamp=bpy.data.objects.new('Studio light',bpy.data.lights.new('Studio light','AREA'));scene.collection.objects.link(lamp);lamp.location=center+Vector(loc)*size;lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();lamp.data.energy=energy*size*size;lamp.data.shape='DISK';lamp.data.size=size*2
 scene.world.color=(.04,.04,.04);scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.render.filepath=str(folder/'exploded-preview.png');bpy.ops.render.render(write_still=True)
 print('PREVIEW_RENDERED',name,flush=True)
