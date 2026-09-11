"""Build an editable Blender scene and GLB from a hash-verified CAD package."""
from pathlib import Path
import argparse,hashlib,json,sys,math
import bpy
from mathutils import Quaternion,Vector

parser=argparse.ArgumentParser()
parser.add_argument('--package',type=Path,required=True)
parser.add_argument('--spring-motion',type=Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
folder=args.package.resolve()
manifest=json.loads((folder/'cad-manifest.json').read_text())
geometry=folder/manifest['geometry_file']
assert hashlib.sha256(geometry.read_bytes()).hexdigest()==manifest['geometry_sha256']
data=json.loads(geometry.read_text())
assert data['source_sha256']==manifest['source_sha256']
spring_motion=None
if args.spring_motion:
    spring_motion=json.loads(args.spring_motion.read_text())
    assert spring_motion['passed'] and spring_motion['audit_complete']
    assert spring_motion['source_sha256']==manifest['source_sha256']
    assert spring_motion['geometry_sha256']==manifest['geometry_sha256']
for name in ['blender-manifest.json','verification.json','spring-morph-verification.json']:
    (folder/name).unlink(missing_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
groups={}
for name,frame in data['groups'].items():
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj)
    obj.location=[x/1000 for x in frame['translation_mm']]
    x,y,z,w=frame['quaternion_xyzw'];obj.rotation_mode='QUATERNION';obj.rotation_quaternion=Quaternion((w,x,y,z))
    obj['motion_group']=name;groups[name]=obj
colors={'steel':(.48,.55,.62),'aluminium':(.77,.79,.82),'cast_aluminium':(.48,.52,.56),
        'bronze':(.69,.47,.20),'seat':(.28,.30,.33),'ring':(.19,.22,.25),'spring':(.22,.27,.32),
        'gasket':(.16,.18,.17),'sheet_steel':(.66,.68,.63),'ceramic':(.92,.91,.86)}
materials={}
for part in data['parts']:
    mesh=bpy.data.meshes.new(part['id']);mesh.from_pydata([[v/1000 for v in point] for point in part['vertices_mm']],[],part['triangles']);mesh.update()
    # Preserve the established presentation rule without changing CAD vertices.
    for polygon in mesh.polygons:polygon.use_smooth=True
    if hasattr(mesh,'set_sharp_from_angle'):mesh.set_sharp_from_angle(angle=math.radians(35))
    obj=bpy.data.objects.new(part['id'],mesh);bpy.context.collection.objects.link(obj)
    obj.parent=groups[part['group']];obj['cad_part_id']=part['id'];obj['component_label']=part['label']
    if spring_motion and part['id'] in spring_motion['springs']:
        spring=spring_motion['springs'][part['id']]
        x,y,z,w=spring['body_world_quaternion_xyzw'];body_rotation=Quaternion((w,x,y,z))
        body_translation=Vector(spring['body_world_translation_mm'])/1000
        group=groups[part['group']];group_rotation=group.rotation_quaternion
        obj.shape_key_add(name='Basis');compressed=obj.shape_key_add(name='ValveLift7mm')
        for index,vertex in enumerate(mesh.vertices):
            local=body_rotation.inverted()@(group_rotation@vertex.co+group.location-body_translation)*1000
            fraction=(spring['angular_direction']*math.atan2(local.z,local.y)/(2*math.pi))%1
            turn=round((local.x-spring['start_x_mm'])/spring['pitch_mm']-fraction)
            travel=min(1,max(0,(turn+fraction)/spring['turns']))
            delta=group_rotation.inverted()@(body_rotation@Vector((-spring['maximum_lift_mm']*travel/1000,0,0)))
            compressed.data[index].co=vertex.co+delta
        compressed.value=0
        obj['spring_max_lift_mm']=spring['maximum_lift_mm']
    category=part['material_category']
    if category not in materials:
        mat=bpy.data.materials.new(category);mat.diffuse_color=(*colors.get(category,colors['steel']),1)
        mat.use_nodes=True;shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=mat.diffuse_color
        shader.inputs['Metallic'].default_value=0 if category in ['gasket','ceramic'] else .45
        shader.inputs['Roughness'].default_value=.4;materials[category]=mat
    mesh.materials.append(materials[category])
scene=bpy.context.scene;scene['cad_source_sha256']=manifest['source_sha256'];scene['bind_angle_deg']=data['bind_angle_deg']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'engine.blend'))
bpy.ops.export_scene.gltf(filepath=str(folder/'engine.glb'),export_format='GLB',use_selection=True,
                          export_extras=True,export_animations=False,export_morph=True,export_morph_normal=True)
result={'schema_version':1,'stage':'Blender export; browser and mesh verification pending',
        'source_sha256':manifest['source_sha256'],'cad_geometry_sha256':manifest['geometry_sha256'],
        'bind_angle_deg':data['bind_angle_deg'],'parts':len(data['parts']),'blender_version':bpy.app.version_string,
        'files':{name:{'sha256':hashlib.sha256((folder/name).read_bytes()).hexdigest(),'bytes':(folder/name).stat().st_size}
                 for name in ['engine.blend','engine.glb']}}
if spring_motion:
    result['spring_motion']={'audit_sha256':hashlib.sha256(args.spring_motion.read_bytes()).hexdigest(),
                             'ids':list(spring_motion['springs']),'target_name':'ValveLift7mm'}
(folder/'blender-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
