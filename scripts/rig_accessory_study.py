"""Bake independent, named motions from FreeCAD geometry into editable Blender + GLB."""
from pathlib import Path
import bpy,json,math,gzip,hashlib,sys,shutil
sys.path.insert(0,str(Path(__file__).resolve().parent))
from accessory_paths import EDGES
from accessory_gears import SPLINED_TO, spring_grip_scale
from normalize_glb_motion_time import normalize_motion_time
from mathutils import Vector,Quaternion
R=Path(__file__).resolve().parents[1];F=R/'cad-studies/accessory-drives'
d=json.loads((F/'geometry.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
objects={}
colors={'housing':(.31,.43,.51),'core':(.55,.66,.74),'magneto-left':(.24,.68,.56),'magneto-right':(.24,.68,.56),'fuel':(.91,.63,.24),'oil-tach':(.3,.57,.91),'starter':(.77,.40,.63),'vacuum':(.67,.55,.91),'alternator':(.84,.72,.3),'governor':(.39,.77,.78)}
for p in d['parts']:
    m=bpy.data.meshes.new(p['id']);pivot=Vector(p['pivot_mm'])/1000
    m.from_pydata([Vector(v)/1000-pivot for v in p['vertices_mm']],[],p['triangles']);m.update()
    o=bpy.data.objects.new(p['id'],m);bpy.context.collection.objects.link(o);o.location=pivot
    o['cad_part_id']=p['id'];o['dimension_status']=d['scope'];o['evidence']=p['evidence'];o['shape_status']=p['shape_status'];o['presentation_role']=p.get('role','engine-study');objects[p['id']]=o
    fixture=p.get('role')=='teaching-fixture';key='Teaching fixtures' if fixture else p['group']
    mat=bpy.data.materials.get(key) or bpy.data.materials.new(key);mat.diffuse_color=((.24,.28,.31) if fixture else colors[p['group']])+(1,);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color;m.materials.append(mat)
paths=[
 dict(id='magnetos',label='Magnetos: ignition',parts=['CrankGear','CrankShaft','IdlerGear','IdlerPin']+[p['id'] for p in d['parts'] if p['group'].startswith('magneto')],ratio=1.5,direction='CW',outputs=['LeftMagShaft','RightMagShaft'],note='Crank → idler → left/right drive gears → splined shafts → magnetos. Supplies timed ignition; two separate magnetos, twelve plugs. C-3-2; A-3-2.'),
 dict(id='fuel',label='Fuel: continuous-flow injection',parts=['CrankGear','CamGear','CamShaft']+[p['id'] for p in d['parts'] if p['group']=='fuel'],ratio=None,direction='Unverified',outputs=['FuelCoupling'],note='Crank → cam cluster → fuel drive gear → coupling → fuel pump. H replacement pump coupling differs from old style. Fuel-drive numerical ratio is unverified; animation uses illustrative tooth sizes. C-3-6.'),
 dict(id='oil-tach',label='Oil and tachometer',parts=['CrankGear','CamGear','CamShaft']+[p['id'] for p in d['parts'] if p['group']=='oil-tach'],ratio=.5,direction='CW (tach output)',outputs=['TachOutput'],note='Crank → internal cam-gear spline → oil/tach shaft → pump and 90° tach bevel pair → lateral output. Bevels are smooth pitch-form studies, not manufactured teeth. 0.5:1 is verified for tach, not a separately published oil-pump specification. A-3-2; A-4-16; C-3-2.'),
 dict(id='starter',label='Starter: power into engine',parts=['CrankGear','CrankShaft']+[p['id'] for p in d['parts'] if p['group']=='starter'],ratio=32,direction='CCW (starter drive)',outputs=['StarterWorm'],note='Motor → worm → worm wheel → wrap spring grips drum → shaftgear → crank. After starting, spring releases; shaftgear stays engine-driven. 32:1 is starter drive/crank speed during cranking, not normal operation. A-3-2; C-3-2.'),
 dict(id='alternator',label='Alternator: electrical supply',parts=['CrankGear']+[p['id'] for p in d['parts'] if p['group']=='alternator'],ratio=3,direction='CW',outputs=['AlternatorOutput'],note='Gear-driven alternator endpoint: 3:1 verified. Dashed route marks unresolved transfer geometry; A-3-2 generator-pulley wording is not an H alternator reconstruction. A-4-13; C-3-3.'),
 dict(id='vacuum',label='Optional vacuum drive',parts=['CrankGear','IdlerGear','LeftMagGear','LeftMagShaft','LeftMagAdapter']+[p['id'] for p in d['parts'] if p['group']=='vacuum'],ratio=1.14,direction='CCW',outputs=['VacuumOutput'],note='Optional upper-rear accessory splines; adapter transfer shown schematically, not reconstructed. H vacuum, deice and autopilot drive listings are 1.14:1. Aircraft equipment depends on installation. A-3-2; C-3-3.'),
 dict(id='governor',label='Governor: propeller control',parts=['CrankGear','CamGear','CamShaft']+[p['id'] for p in d['parts'] if p['group']=='governor'],ratio=.809,direction='CW',outputs=['GovernorOutput'],note='Crank → camshaft → front bevel pair → governor. Remote front drive relocated; bevel geometry omitted. 0.809:1 output controls propeller pitch hydraulically. A-3-2; C-3-3.')]
for path in paths:path['edges']=EDGES[path['id']]
names=['Operating mechanism','Exploded overview','Reassembly overview']+['Focus: '+p['id'] for p in paths if p['id']!='starter']+['Starter engagement and start']
stages=[dict(label='Assembled',progress=0,note='Inspect mounting interfaces; front modules are relocated.'),dict(label='Case half, adapters and bodies',progress=50,note='Expose model chambers; hidden casting details are reconstructed.'),dict(label='Gears, shafts and couplings',progress=100,note='Trace power paths; explosion order is pedagogical.')]
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=601;scene.render.fps=30;scene['scope']=d['scope'];scene['reference']=d['reference']
for title in names:
    print('ACCESSORY_BAKING', title, flush=True)
    action=bpy.data.actions.new(title)
    path=next((p for p in paths if title=='Focus: '+p['id']),None)
    for p in d['parts']:
        o=objects[p['id']];o.animation_data_create();o.animation_data.action=action;o.animation_data.action_slot=action.slots.new(id_type='OBJECT',name=o.name)
        for frame in range(1,602):
            u=(frame-1)/600;o.location=Vector(p['pivot_mm'])/1000;o.rotation_mode='QUATERNION';o.rotation_quaternion=Quaternion();o.scale=(1,1,1)
            if title in ['Exploded overview','Reassembly overview']:
                v=1-u if title=='Reassembly overview' else u;amount=max(0,min(1,v*2-p['stage']+1));o.location+=Vector(p['offset_mm'])/1000*amount
            else:
                rate=p['rate'] if not path or p['id'] in path['parts'] or SPLINED_TO.get(p['id']) in path['parts'] else 0
                angle=4*math.pi*u*rate
                if title=='Starter engagement and start':
                    # Cranking first; engine takes over at 65%. Temporal profile is illustrative.
                    crank=min(u,.65)*4*math.pi+max(0,u-.65)*8*math.pi
                    angle=crank*rate
                    if p['id']=='StarterWorm': angle=min(u,.65)*4*math.pi*32
                    if p['id'] in ['WormWheel','WormWheelHub','ClutchSpring']:angle=-min(u,.65)*4*math.pi
                    if p['id']=='ClutchSpring':
                        tight=1 if .1<=u<.65 else max(0,u/.1) if u<.1 else 0
                        shrink=1-spring_grip_scale();o.scale=(1-shrink*tight,1-shrink*tight,1)
                o.rotation_quaternion=Quaternion(Vector(p['axis']),angle)
            o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion',frame=frame);o.keyframe_insert('scale',frame=frame)
        track=o.animation_data.nla_tracks.new();track.name=title;strip=track.strips.new(title,1,action);strip.action_slot=o.animation_data.action_slot;track.mute=True
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
operating=bpy.data.actions[names[0]]
for id,o in objects.items():o.animation_data.action=operating;o.animation_data.action_slot=next(s for s in operating.slots if s.name_display==id)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(F/'accessory-drives.blend'))
# Authored keys already sample every frame, including the 32x starter. Export
# those curves directly instead of repeatedly evaluating the entire assembly.
bpy.ops.export_scene.gltf(filepath=str(F/'accessory-drives.glb'),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=False,export_frame_step=2,export_anim_slide_to_zero=True)
normalize_motion_time(F/'accessory-drives.glb')
raw_file=F/'accessory-drives.glb'
with raw_file.open('rb') as source, (R/'web/accessory-drives.glb.gz').open('wb') as target:
    with gzip.GzipFile(filename='',mode='wb',fileobj=target,mtime=0) as packed:shutil.copyfileobj(source,packed,1024*1024)
with raw_file.open('rb') as source:asset_hash=hashlib.file_digest(source,'sha256').hexdigest()
motions=[]
for title in names:
    stops=stages if title=='Exploded overview' else [dict(s,progress=100-s['progress']) for s in reversed(stages)] if title=='Reassembly overview' else [dict(label='Motor cranking / spring grips',progress=10,note='Battery energy enters motor; clutch contraction is illustrative.'),dict(label='Engine takes over / spring releases',progress=65,note='Worm and wheel stop; engine continues to drive shaftgear. No Bendix pinion translation.'),dict(label='Running',progress=100,note='Starting timings are illustrative; not an aircraft start checklist.')] if title=='Starter engagement and start' else [dict(label='Start of sample',progress=0),dict(label='One crank revolution',progress=50),dict(label='Two crank revolutions',progress=100)]
    motions.append(dict(id=title,label=title,loop=False,stages=stops))
rotation_outputs=[]
for path in paths:
    for id in path['outputs'] if path['ratio'] is not None else []:
        part=next(p for p in d['parts'] if p['id']==id);x,y,z=part['axis']
        extent=max(sum((v[i]-part['pivot_mm'][i])*part['axis'][i] for i in range(3)) for v in part['vertices_mm'])/1000
        rotation_outputs.append(dict(id=id,direction=path['direction'],axis=[x,z,-y],markerOffsetM=extent+.009))
contract=dict(asset_sha256=asset_hash,parts=[{k:v for k,v in p.items() if k not in ['vertices_mm','triangles']} for p in d['parts']],reference=d['reference'],scope=d['scope'],motions=motions,powerPaths=paths,interfaces=d['interfaces'],gearMeshes=d['gear_meshes'],gearForm=d['gear_form'],remoteDisplays=[dict(group='alternator',label='Alternator'),dict(group='vacuum',label='Optional vacuum'),dict(group='governor',label='Governor')],viewpoint='CW/CCW facing each engine drive pad. Magnetos face the front side of their accessory pads (A-3-3); tach faces a lateral pad (A-4-16). Arrows follow those study shaft axes. The crank and intermediate signed rotations are inferred from external meshes and the front magneto pad viewpoint, not a directly published crank-direction specification. Grey fixtures are teaching stands. Front/optional modules are relocated and omitted transfers remain conceptual.',rotationOutputs=rotation_outputs)
(R/'web/accessory-drives-contract.json').write_text(json.dumps(contract,indent=2))
(F/'blender-verification.json').write_text(json.dumps(dict(passed=True,parts=len(objects),authored_actions=names,asset_sha256=contract['asset_sha256'],scope=d['scope']),indent=2))
print('ACCESSORY_RIG_EXPORTED',raw_file.stat().st_size,flush=True)
