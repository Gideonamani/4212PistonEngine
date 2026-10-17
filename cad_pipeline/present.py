"""Create an editable named Blender inspection tour and component plates from CAD.
The tour is presentation visibility/camera motion, not engine operation.
"""
import argparse,hashlib,json,sys,math
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cad_pipeline.look import COLORS, HIGH_PART_COUNT_THRESHOLD, apply_smooth_by_angle, apply_studio_world, blender_material
from cad_pipeline.presentation_camera import frame_camera

TITLES={'crankcase':'Crankcase & water jacket','cover':'Sheet-steel crankcase cover','cylinders':'Four cylinder liners',
        'pistons':'Cast-iron pistons & wrist pins','rods':'Built-up connecting rods','crankshaft':'Four-throw crankshaft',
        'valve_boxes':'Combustion chambers / valve boxes','valves':'Intake & exhaust valves',
        'camshafts':'Exhaust & ignition camshafts','timing':'Timing sprocket envelopes','flywheel':'Engine flywheel',
        'induction':'Intake & fuel mixing system','cooling':'Water connections','lubrication':'Oil system (rebuilt accessory)',
        'ignition':'Make-and-break ignition & spark control','generator':'Generator & flywheel friction drive','bearings':'Split main bearings & shaft supports','rockers':'Two-cheek exhaust rockers & rollers'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--engine',choices=['workbench','cycles','eevee'],default='workbench');p.add_argument('--config',type=Path,help='Presentation-only labels/views; never geometry')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
    package=a.package.resolve();manifest=json.loads((package/'cad-validation.json').read_text());g=package/'geometry.json'
    if manifest.get('complete_spec') is False or not manifest.get('geometric_validation_passed'):raise ValueError('CAD package is incomplete or invalid')
    if hashlib.sha256(g.read_bytes()).hexdigest()!=manifest['files']['geometry.json']['sha256']:raise ValueError('CAD geometry hash mismatch')
    data=json.loads(g.read_text());config=dict(data.get('presentation',{}))
    if a.config:
        overrides=json.loads(a.config.read_text())
        if 'group_titles' in overrides:
            overrides['group_titles']={**config.get('group_titles',{}),**overrides['group_titles']}
        config.update(overrides)
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1;scene.render.engine={'workbench':'BLENDER_WORKBENCH','cycles':'CYCLES','eevee':'BLENDER_EEVEE'}[a.engine];scene.cycles.samples=20
    if a.engine=='cycles':
        scene.cycles.device='CPU';scene.cycles.denoiser='OPENIMAGEDENOISE';scene.cycles.denoising_use_gpu=False
    scene.display.shading.light='STUDIO';scene.display.shading.studiolight_rotate_z=.4;scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD'
    scene.cycles.use_denoising=True;scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.fps=24
    for name in ('view_transform','look','exposure','gamma'):
        if name in config.get('view_settings',{}):setattr(scene.view_settings,name,config['view_settings'][name])
    apply_studio_world(scene)
    materials={};objects=[];groups={}
    vary_tones=bool(config.get('vary_part_tones',len(data['parts'])>HIGH_PART_COUNT_THRESHOLD))
    for part in data['parts']:
        mesh=bpy.data.meshes.new(part['id']);mesh.from_pydata([[c/1000 for c in v] for v in part['vertices_mm']],[],part['triangles']);mesh.update()
        if 'smooth_angle_deg' in config:
            apply_smooth_by_angle(mesh,config['smooth_angle_deg'])
        obj=bpy.data.objects.new(part['id'],mesh);scene.collection.objects.link(obj);obj.data.materials.append(blender_material(part['material'],part_id=part['id'],vary=vary_tones,cache=materials))
        for key in ('id','label','group','evidence'):obj[key]=part[key]
        obj['cad_geometry_sha256']=manifest['files']['geometry.json']['sha256'];objects.append(obj);groups.setdefault(part['group'],[]).append(obj)
    # Blender now owns the copied meshes; do not retain a second full set of
    # Python vertex/triangle lists during export and rendering on small machines.
    del data['parts']
    # Export only engineering parts. Titles/cameras/lights never enter the engineering GLB.
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/(data['model_id']+'.glb')),export_format='GLB',use_selection=True,export_extras=True,export_animations=False)
    for o in objects:o.select_set(False)
    engineering_objects=list(objects);section_views=[]
    for section in data.get('sections',[]):
        section_objects=[]
        for part in section['parts']:
            mesh=bpy.data.meshes.new(part['id']);mesh.from_pydata([[c/1000 for c in v] for v in part['vertices_mm']],[],part['triangles']);mesh.update()
            if 'smooth_angle_deg' in config:
                apply_smooth_by_angle(mesh,config['smooth_angle_deg'])
            obj=bpy.data.objects.new(part['id'],mesh);scene.collection.objects.link(obj);obj.data.materials.append(blender_material(part['material'],part_id=part.get('source_part_id',part['id']),vary=vary_tones,cache=materials))
            for key in ('id','label','group','evidence','source_part_id'):obj[key]=part[key]
            obj['presentation_only']=True;objects.append(obj);section_objects.append(obj)
        section_views.append((section['id'],section_objects,section['title'],section['direction']))
    camera_data=bpy.data.cameras.new('Inspection camera');camera_data.type='ORTHO';camera=bpy.data.objects.new('Inspection camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
    for name,pos,power,size in [('Key',(1,-1,2),1000,2),('Fill',(-1,-.5,1),650,2),('Rim',(0,1.5,1.7),950,1.5)]:
        lighting_scale=float(config.get('light_energy_scale',1.))
        if not math.isfinite(lighting_scale) or lighting_scale<=0:raise ValueError('Light energy scale must be positive')
        light=bpy.data.lights.new(name,'AREA');light.energy=power*lighting_scale;light.shape='DISK';light.size=size;o=bpy.data.objects.new(name,light);o.location=pos;scene.collection.objects.link(o);o.rotation_euler=(Vector((.18,.2,0))-o.location).to_track_quat('-Z','Y').to_euler()
    emission=bpy.data.materials.new('Caption white');emission.diffuse_color=(.8,.9,1,1);emission.use_nodes=True;n=emission.node_tree.nodes;n.clear();e=n.new('ShaderNodeEmission');e.inputs[0].default_value=(.78,.89,1,1);output=n.new('ShaderNodeOutputMaterial');emission.node_tree.links.new(e.outputs[0],output.inputs['Surface'])
    font_path=Path('C:/Windows/Fonts/segoeui.ttf');font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
    captions=[]
    for name in ['Header','Title','Footer']:
        text=bpy.data.curves.new(name,'FONT');text.align_x='LEFT';text.size=.03
        if font:text.font=font
        o=bpy.data.objects.new(name,text);scene.collection.objects.link(o);o.parent=camera;text.materials.append(emission);captions.append(o)
    default_direction=config.get('direction',(1,-1,.85))
    def pose(visible,title,direction=None):
        if direction is None:direction=default_direction
        for o in objects:o.hide_render=o not in visible;o.hide_viewport=o not in visible
        scale=frame_camera(scene,camera,visible,direction,config.get('up'));vertical=scale/1.5
        for o,body,y,size in zip(captions,[config.get('header','WRIGHT 1903 ENGINE'),title,config.get('footer','Evidence-led teaching reconstruction | Estimated geometry remains')],[.43,.35,-.45],[.020,.030,.016]):
            o.data.body=body;o.data.size=scale*size;o.location=(-scale*.45,vertical*y,-1.5)
    selected_groups=config.get('group_views',list(groups))
    if set(selected_groups)-set(groups):raise ValueError('Unknown component inspection group')
    plates=[];tourlabels=[];tour=[('overview',engineering_objects,'Major components - assembly',default_direction)]+[(key,vals,config.get('group_titles',{}).get(key,TITLES.get(key,key)),default_direction) for key,vals in groups.items() if key in selected_groups]
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
    result=dict(model_id=data['model_id'],scope=data['scope'],blender_version=bpy.app.version_string,units='metres',cad_geometry_sha256=manifest['files']['geometry.json']['sha256'],surface_shading_angle_deg=config.get('smooth_angle_deg'),parts=len(engineering_objects),presentation_only_parts=len(objects)-len(engineering_objects),tour=plates,
                files={f.name:dict(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in out.iterdir() if f.suffix in ('.blend','.glb','.png')})
    result['rendering']=dict(engine=scene.render.engine,device=scene.cycles.device if a.engine=='cycles' else None,samples=scene.cycles.samples if a.engine=='cycles' else None,group_views=selected_groups,light_energy_scale=lighting_scale,up_reference=config.get('up'),view_settings={name:getattr(scene.view_settings,name) for name in ('view_transform','look','exposure','gamma')})
    (out/'presentation-manifest.json').write_text(json.dumps(result,indent=2)+'\n');print('PRESENTATION_COMPLETE',flush=True)

if __name__=='__main__':main()
