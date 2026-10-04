"""Create an editable named Blender inspection tour and component plates from CAD.
The tour is presentation visibility/camera motion, not engine operation.
"""
import argparse,hashlib,json,sys
from pathlib import Path
import bpy
from mathutils import Vector

TITLES={'crankcase':'Crankcase & water jacket','cover':'Sheet-steel crankcase cover','cylinders':'Four cylinder liners',
        'pistons':'Cast-iron pistons & wrist pins','rods':'Built-up connecting rods','crankshaft':'Four-throw crankshaft',
        'valve_boxes':'Combustion chambers / valve boxes','valves':'Intake & exhaust valves',
        'camshafts':'Exhaust & ignition camshafts','timing':'Timing sprocket envelopes','flywheel':'Engine flywheel',
        'induction':'Intake & fuel mixing system','cooling':'Water connections','lubrication':'Oil system (rebuilt accessory)',
        'ignition':'Make-and-break ignition & spark control','generator':'Generator & flywheel friction drive','bearings':'Split main bearings & shaft supports','rockers':'Two-cheek exhaust rockers & rollers'}
COLORS={'steel':(.32,.39,.47,1),'aluminium':(.64,.69,.74,1),'cast_iron':(.21,.24,.27,1),'bronze':(.55,.31,.12,1),
        'babbitt':(.72,.73,.68,1),'copper':(.62,.28,.12,1),'wood':(.28,.15,.06,1),'rubber':(.055,.065,.075,1),'gasket':(.34,.24,.15,1),'insulator':(.8,.78,.63,1),'platinum':(.84,.86,.89,1)}

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--engine',choices=['workbench','cycles','eevee'],default='workbench')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
    package=a.package.resolve();manifest=json.loads((package/'cad-validation.json').read_text());g=package/'geometry.json'
    if manifest.get('complete_spec') is False or not manifest.get('geometric_validation_passed'):raise ValueError('CAD package is incomplete or invalid')
    if hashlib.sha256(g.read_bytes()).hexdigest()!=manifest['files']['geometry.json']['sha256']:raise ValueError('CAD geometry hash mismatch')
    data=json.loads(g.read_text());config=data.get('presentation',{});bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1;scene.render.engine={'workbench':'BLENDER_WORKBENCH','cycles':'CYCLES','eevee':'BLENDER_EEVEE'}[a.engine];scene.cycles.samples=20
    scene.display.shading.light='STUDIO';scene.display.shading.studiolight_rotate_z=.4;scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD'
    scene.cycles.use_denoising=True;scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.fps=24
    world=bpy.data.worlds.new('Workshop');world.color=(.045,.065,.10);world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.13,.18,1);world.node_tree.nodes['Background'].inputs[1].default_value=.4;scene.world=world
    materials={};objects=[];groups={}
    for name,col in COLORS.items():
        m=bpy.data.materials.new(name);m.diffuse_color=col;m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=col;b.inputs['Metallic'].default_value=.65;b.inputs['Roughness'].default_value=.37;materials[name]=m
    for part in data['parts']:
        mesh=bpy.data.meshes.new(part['id']);mesh.from_pydata([[c/1000 for c in v] for v in part['vertices_mm']],[],part['triangles']);mesh.update()
        obj=bpy.data.objects.new(part['id'],mesh);scene.collection.objects.link(obj);obj.data.materials.append(materials.get(part['material'],materials['steel']))
        for key in ('id','label','group','evidence'):obj[key]=part[key]
        obj['cad_geometry_sha256']=manifest['files']['geometry.json']['sha256'];objects.append(obj);groups.setdefault(part['group'],[]).append(obj)
    # Export only engineering parts. Titles/cameras/lights never enter the engineering GLB.
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/(data['model_id']+'.glb')),export_format='GLB',use_selection=True,export_extras=True,export_animations=False)
    for o in objects:o.select_set(False)
    engineering_objects=list(objects);section_views=[]
    for section in data.get('sections',[]):
        section_objects=[]
        for part in section['parts']:
            mesh=bpy.data.meshes.new(part['id']);mesh.from_pydata([[c/1000 for c in v] for v in part['vertices_mm']],[],part['triangles']);mesh.update()
            obj=bpy.data.objects.new(part['id'],mesh);scene.collection.objects.link(obj);obj.data.materials.append(materials.get(part['material'],materials['steel']))
            for key in ('id','label','group','evidence','source_part_id'):obj[key]=part[key]
            obj['presentation_only']=True;objects.append(obj);section_objects.append(obj)
        section_views.append((section['id'],section_objects,section['title'],section['direction']))
    camera_data=bpy.data.cameras.new('Inspection camera');camera_data.type='ORTHO';camera=bpy.data.objects.new('Inspection camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
    for name,pos,power,size in [('Key',(1,-1,2),1000,2),('Fill',(-1,-.5,1),650,2),('Rim',(0,1.5,1.7),950,1.5)]:
        light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;o=bpy.data.objects.new(name,light);o.location=pos;scene.collection.objects.link(o);o.rotation_euler=(Vector((.18,.2,0))-o.location).to_track_quat('-Z','Y').to_euler()
    emission=bpy.data.materials.new('Caption white');emission.diffuse_color=(.8,.9,1,1);emission.use_nodes=True;n=emission.node_tree.nodes;n.clear();e=n.new('ShaderNodeEmission');e.inputs[0].default_value=(.78,.89,1,1);output=n.new('ShaderNodeOutputMaterial');emission.node_tree.links.new(e.outputs[0],output.inputs['Surface'])
    font_path=Path('C:/Windows/Fonts/segoeui.ttf');font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
    captions=[]
    for name in ['Header','Title','Footer']:
        text=bpy.data.curves.new(name,'FONT');text.align_x='LEFT';text.size=.03
        if font:text.font=font
        o=bpy.data.objects.new(name,text);scene.collection.objects.link(o);o.parent=camera;text.materials.append(emission);captions.append(o)
    def pose(visible,title,direction=(1,-1,.85)):
        for o in objects:o.hide_render=o not in visible;o.hide_viewport=o not in visible
        pts=[o.matrix_world @ Vector(v) for o in visible for v in o.bound_box]
        lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)));center=(lo+hi)/2
        direction=Vector(direction).normalized();camera.location=center+direction*3;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        inv=camera.matrix_world.inverted();bpy.context.view_layer.update();inv=camera.matrix_world.inverted();projected=[inv @ v for v in pts]
        width=max(v.x for v in projected)-min(v.x for v in projected);height=max(v.y for v in projected)-min(v.y for v in projected)
        # Blender's orthographic scale is horizontal in landscape rendering.
        camera_data.ortho_scale=max(width*1.28,height*1.5*1.5,.22)
        scale=camera_data.ortho_scale;vertical=scale/1.5
        for o,body,y,size in zip(captions,[config.get('header','WRIGHT 1903 ENGINE'),title,config.get('footer','Evidence-led teaching reconstruction | Estimated geometry remains')],[.43,.35,-.45],[.020,.030,.016]):
            o.data.body=body;o.data.size=scale*size;o.location=(-scale*.45,vertical*y,-1.5)
    plates=[];tourlabels=[];tour=[('overview',engineering_objects,'Major components - assembly',(1,-1,.85))]+[(key,vals,config.get('group_titles',{}).get(key,TITLES.get(key,key)),(1,-1,.85)) for key,vals in groups.items()]
    for view in config.get('views',[]):
        visible=[o for o in engineering_objects if o['id'] in view['parts']] if 'parts' in view else [o for o in engineering_objects if o['group'] not in view.get('hide_groups',[])]
        tour.append((view['id'],visible,view['title'],view.get('direction',(1,-1,.85))))
    tour.extend(section_views)
    scene.frame_start=1;scene.frame_end=len(tour)*72
    for index,(key,visible,title,direction) in enumerate(tour):
        frame=1+index*72;scene.frame_set(frame);pose(visible,title,direction)
        scene.timeline_markers.new(title,frame=frame)
        for o in objects:o.keyframe_insert('hide_render',frame=frame);o.keyframe_insert('hide_viewport',frame=frame)
        camera.keyframe_insert('location',frame=frame);camera.keyframe_insert('rotation_euler',frame=frame);camera_data.keyframe_insert('ortho_scale',frame=frame)
        for o in captions:o.keyframe_insert('location',frame=frame);o.data.keyframe_insert('size',frame=frame)
        # Text body is not animatable; a separate keyed title carries each tour segment.
        captions[1].hide_render=True;captions[1].hide_viewport=True
        for oldlabel in tourlabels:oldlabel.hide_render=True;oldlabel.hide_viewport=True
        label=captions[1].copy();label.data=captions[1].data.copy();label.animation_data_clear();label.data.animation_data_clear();scene.collection.objects.link(label);label.name='Tour title '+key;label.hide_render=False
        captions[1].data.body='';label.hide_viewport=False
        for prop in ('hide_render','hide_viewport'):
            setattr(label,prop,False);label.keyframe_insert(prop,frame=frame);setattr(label,prop,True)
            if frame>1:label.keyframe_insert(prop,frame=frame-1)
            label.keyframe_insert(prop,frame=frame+72)
        tourlabels.append(label)
        scene.render.filepath=str(out/(key+'.png'));label.hide_render=False;label.hide_viewport=False;bpy.ops.render.render(write_still=True);label.hide_render=True;label.hide_viewport=True
        plates.append(dict(group=key,title=title,frame=frame,parts=[o['id'] for o in visible],labels=[o['label'] for o in visible],image=key+'.png'))
    # Pose and captions at frame 1 are stored as a ready-to-open assembly.
    for datablock in [camera,camera_data,*captions,*[o.data for o in captions]]:
        if datablock.animation_data and datablock.animation_data.action:
            action=datablock.animation_data.action
            for layer in action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for curve in bag.fcurves:
                            for keyframe in curve.keyframe_points:keyframe.interpolation='CONSTANT'
    scene.frame_set(1);pose(engineering_objects,'Major components - assembly');captions[1].data.body='';captions[1].hide_render=True;captions[1].hide_viewport=True
    scene['scope']=data['scope'];scene['tour']='Frame 1 assembly; subsequent 72-frame blocks isolate named groups. Visibility tour only; no engine operation.'
    scene['cad_geometry_sha256']=manifest['files']['geometry.json']['sha256']
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(data['model_id']+'.blend')))
    result=dict(model_id=data['model_id'],scope=data['scope'],blender_version=bpy.app.version_string,units='metres',cad_geometry_sha256=manifest['files']['geometry.json']['sha256'],parts=len(engineering_objects),presentation_only_parts=len(objects)-len(engineering_objects),tour=plates,
                files={f.name:dict(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in out.iterdir() if f.suffix in ('.blend','.glb','.png')})
    (out/'presentation-manifest.json').write_text(json.dumps(result,indent=2)+'\n');print('PRESENTATION_COMPLETE',flush=True)

if __name__=='__main__':main()
