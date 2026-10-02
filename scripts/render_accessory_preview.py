from pathlib import Path
import bpy, math
from mathutils import Vector
R=Path(__file__).resolve().parents[1];F=R/'cad-studies/accessory-drives'
bpy.ops.wm.open_mainfile(filepath=str(F/'accessory-drives.blend'))
scene=bpy.context.scene;action=bpy.data.actions['Exploded overview']
for o in bpy.data.objects:
    if o.type=='MESH':o.animation_data.action=action;o.animation_data.action_slot=next(s for s in action.slots if s.name_display==o.name)
scene.frame_set(601);bpy.context.view_layer.update()
points=[o.matrix_world@Vector(c) for o in bpy.data.objects if o.type=='MESH' for c in o.bound_box]
lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)/2;size=(hi-lo).length
cam=bpy.data.objects.new('Study camera',bpy.data.cameras.new('Study camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.location=center+Vector((.65,-.8,1.8)).normalized()*size*2;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=size*1.25;cam.data.clip_start=.001
for location,power in [((1,-1,3),160),((-2,1,1),100)]:
    lamp=bpy.data.objects.new('Studio area',bpy.data.lights.new('Studio area','AREA'));scene.collection.objects.link(lamp);lamp.location=center+Vector(location)*size;lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();lamp.data.energy=power*size*size;lamp.data.size=size*2
scene.world.color=(.03,.045,.055);scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1000;scene.render.resolution_y=750;scene.render.resolution_percentage=100
scene.render.filepath=str(R/'web/model-previews/accessory-drives.png');bpy.ops.render.render(write_still=True)
print('ACCESSORY_PREVIEW_RENDERED')
