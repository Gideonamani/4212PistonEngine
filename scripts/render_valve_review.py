"""Blender review render from audited native CAD meshes; no publication/export asset."""
from pathlib import Path
import json
import bpy
from mathutils import Vector

repo=Path(__file__).resolve().parents[1]
data=json.loads((repo/'.local/housing-review.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color,opacity=1):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    solid=nodes.new('ShaderNodeBsdfPrincipled')
    solid.inputs['Base Color'].default_value=(*color,1)
    solid.inputs['Metallic'].default_value=.35 if opacity==1 else 0
    solid.inputs['Roughness'].default_value=.3
    if opacity<1:
        transparent=nodes.new('ShaderNodeBsdfTransparent')
        mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=opacity
        mat.node_tree.links.new(transparent.outputs[0],mix.inputs[1])
        mat.node_tree.links.new(solid.outputs[0],mix.inputs[2])
        mat.node_tree.links.new(mix.outputs[0],output.inputs['Surface'])
    else:mat.node_tree.links.new(solid.outputs[0],output.inputs['Surface'])
    return mat

colors={'Rocker':(.72,.37,.06),'Valve':(.38,.48,.57),'Pushrod':(.25,.32,.39),
        'Shaft':(.40,.45,.50),'Housing':(.18,.42,.57),'Tube':(.18,.42,.57)}
for part in data['parts']:
    mesh=bpy.data.meshes.new(part['name'])
    mesh.from_pydata([[v/1000 for v in p] for p in part['vertices_mm']],[],part['triangles']);mesh.update()
    obj=bpy.data.objects.new(part['name'],mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material(part['name'],colors[part['name']],.10 if part['name'] in ['Housing','Tube'] else 1))

scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.cycles.use_denoising=True;scene.cycles.transparent_max_bounces=16
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.83,.87,.91,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,location,power in [('Key',(.45,-.3,.25),3),('Fill',(.28,.15,.1),2)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=.25
    obj=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector((.39,-.06,-.02))-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('ReviewCamera');obj=bpy.data.objects.new('ReviewCamera',camera)
bpy.context.collection.objects.link(obj);scene.camera=obj
obj.location=(.43,-.34,.035);target=Vector((.389,-.06,-.018))
obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
camera.type='ORTHO';camera.ortho_scale=.18;camera.clip_start=.001
scene.render.resolution_x=1000;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(repo/'.local/valve-clearance-review.png')
bpy.ops.wm.save_as_mainfile(filepath=str(repo/'.local/valve-clearance-review.blend'))
bpy.ops.render.render(write_still=True)
