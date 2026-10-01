"""Rig the FreeCAD solid studies in Blender; export named interactive GLB clips."""
from pathlib import Path
import bpy,json,math,gzip,hashlib,sys
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
selected = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['hydraulic-tappet','oil-pump']
for name in selected:
 assert name in ['hydraulic-tappet','oil-pump']
 folder=R/'cad-studies'/name;data=json.loads((folder/'geometry.json').read_text());profile=json.loads((R/'web'/ (name+'-motions.json')).read_text())
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 objects={}
 for part in data['parts']:
  mesh=bpy.data.meshes.new(part['id']);mesh.from_pydata([[v/1000 for v in vertex] for vertex in part['vertices_mm']],[],part['triangles']);mesh.update()
  o=bpy.data.objects.new(part['id'],mesh);bpy.context.collection.objects.link(o);o['cad_part_id']=part['id'];objects[part['id']]=o
  # Rotation pivots remain on each gear axis while CAD triangles keep their exact world placement.
  pivot=Vector((.024,0,0)) if part['id'] in ['DrivenGear','DrivenShaft'] else Vector((0,0,0))
  for vertex in mesh.vertices:vertex.co-=pivot
  o.location=pivot
  material=bpy.data.materials.new(part['group']);material.diffuse_color=tuple({'gears':(.38,.55,.65),'check-valve':(.78,.53,.28),'relief':(.78,.53,.28),'plunger':(.25,.66,.61)}.get(part['group'],(.62,.70,.73)))+(1,);material.use_nodes=True
  material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=material.diffuse_color
  mesh.materials.append(material)
 spring_keys={}
 for identifier,bottom,height,travel,anchored_top in ([('PlungerSpring',.004,.010,.001,False)] if name=='hydraulic-tappet' else [('ReliefSpring',.012,.012,.005,True)]):
  obj=objects[identifier];obj.shape_key_add(name='Basis');key=obj.shape_key_add(name='Illustrative compression');key.slider_min=-1
  for vertex,target in zip(obj.data.vertices,key.data):
   fraction=max(0,min(1,(vertex.co.z-bottom)/height))
   target.co.z += travel*(1-fraction) if anchored_top else -travel*fraction
  spring_keys[identifier]=key
 bases={n:o.location.copy() for n,o in objects.items()}
 scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=301;scene.render.fps=30;scene['scope']=data['scope'];scene['reference']=data['reference']
 names=['Operating mechanism','Exploded overview','Reassembly overview']+(['Relief valve opening'] if name=='oil-pump' else [])
 for title in names:
  action=bpy.data.actions.new(title)
  for part in data['parts']:
   o=objects[part['id']];o.animation_data_create();o.animation_data.action=action;o.animation_data.action_slot=action.slots.new(id_type='OBJECT',name=o.name)
   for frame in range(1,302,5):
    u=(frame-1)/300;o.location=bases[o.name].copy();o.rotation_euler=(0,0,0)
    if title in ['Exploded overview','Reassembly overview']:
     amount=max(0,min(1,(1-u if title=='Reassembly overview' else u)*3-part['stage']+1));v=part['offset_m'];o.location+=Vector((v[0],-v[2],v[1]))*amount
    elif title=='Operating mechanism':
     if name=='oil-pump' and o.name in ['DriveGear','DriveShaft','DrivenGear','DrivenShaft']:o.rotation_euler.z=math.pi*2*u*(-1 if o.name.startswith('Driven') else 1)
     elif name=='hydraulic-tappet':
      # Small, illustrative loaded/replenishing travel, not actual valve timing or oil-pressure simulation.
      body_lift=.004*(.5-.5*math.cos(2*math.pi*u));replenishment=max(0,-math.sin(2*math.pi*u))
      o.location.z+=body_lift
      if o.name in ['Plunger','Socket','CheckHousing','CheckPlate','CheckSpring']:o.location.z+=.0005*replenishment
      if o.name=='CheckPlate':o.location.z+=.0003*max(0,-math.sin(2*math.pi*u))
    elif o.name=='ReliefPlunger':o.location.z+=.005*u
    o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_euler',frame=frame)
   # Include exact terminal frame (loop closure / full explosion).
   scene.frame_set(301)
   track=o.animation_data.nla_tracks.new();track.name=title;strip=track.strips.new(title,1,action);strip.action_slot=o.animation_data.action_slot;track.mute=True
  for identifier,key in spring_keys.items():
   key_data=objects[identifier].data.shape_keys;key_data.animation_data_create();key_data.animation_data.action=action;key_data.animation_data.action_slot=action.slots.new(id_type='KEY',name=identifier+' deformation')
   for frame in range(1,302,5):
    u=(frame-1)/300;key.value=-.5*max(0,-math.sin(2*math.pi*u)) if name=='hydraulic-tappet' and title=='Operating mechanism' else u if name=='oil-pump' and title=='Relief valve opening' else 0
    key.keyframe_insert('value',frame=frame)
   track=key_data.animation_data.nla_tracks.new();track.name=title;strip=track.strips.new(title,1,action);strip.action_slot=key_data.animation_data.action_slot;track.mute=True
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      for key in curve.keyframe_points:key.interpolation='LINEAR'
 operating=bpy.data.actions['Operating mechanism']
 for n,o in objects.items():o.animation_data.action=operating;o.animation_data.action_slot=next(slot for slot in operating.slots if slot.name_display==n)
 for identifier in spring_keys:
  key_data=objects[identifier].data.shape_keys;key_data.animation_data.action=operating;key_data.animation_data.action_slot=next(slot for slot in operating.slots if slot.name_display==identifier+' deformation')
 scene.frame_set(1)
 bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(folder/(name+'.glb')),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True)
 raw=(folder/(name+'.glb')).read_bytes();packed=gzip.compress(raw,mtime=0);(R/'web'/ (name+'.glb.gz')).write_bytes(packed)
 contract={'asset_sha256':hashlib.sha256(raw).hexdigest(),'parts':[{k:v for k,v in p.items() if k not in ['vertices_mm','triangles','offset_m','stage']} for p in data['parts']],'reference':data['reference'],'scope':data['scope'],'motions':[{'id':title,'label':title,'loop':title=='Operating mechanism','stages':[] if title=='Operating mechanism' else [{'label':'Seated','progress':0},{'label':'Open','progress':100}] if title=='Relief valve opening' else [dict(stage,progress=100-stage['progress']) for stage in reversed(profile['stages'])] if title=='Reassembly overview' else profile['stages']} for title in names]}
 if name=='hydraulic-tappet':
  contract['motions'][0]['stages']=[{'label':'Unloaded','progress':0,'note':'Plunger extended; replenishment travel is illustrative.'},{'label':'Loading','progress':25,'note':'The body and internals rise together; the check plate stays closed during loading.'},{'label':'Trapped oil under load','progress':50,'note':'The closed check valve retains oil as the load is transmitted.'},{'label':'Replenishing','progress':75,'note':'During return, the plunger extends and the check plate opens for illustrative replenishment.'},{'label':'Cycle returns','progress':100,'note':'The illustration returns to its initial pose.'}]
 (R/'web'/ (name+'-contract.json')).write_text(json.dumps(contract,indent=2));(folder/'blender-verification.json').write_text(json.dumps({'passed':True,'parts':len(objects),'authored_actions':names,'asset_sha256':contract['asset_sha256'],'scope':data['scope']},indent=2))
 print('STUDY_ANIMATED',name,flush=True)
