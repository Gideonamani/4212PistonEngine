"""Bake independent, named motions from FreeCAD geometry into editable Blender + GLB."""
from pathlib import Path
import bpy,json,math,gzip,hashlib,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from accessory_paths import EDGES
from mathutils import Vector
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
    o['cad_part_id']=p['id'];o['dimension_status']=d['scope'];o['evidence']=p['evidence'];objects[p['id']]=o
    mat=bpy.data.materials.get(p['group']) or bpy.data.materials.new(p['group']);mat.diffuse_color=colors[p['group']]+(1,);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color;m.materials.append(mat)
paths=[
 dict(id='magnetos',label='Magnetos: ignition',parts=['CrankGear','CrankShaft','IdlerGear','IdlerPin']+[p['id'] for p in d['parts'] if p['group'].startswith('magneto')],ratio=1.5,direction='CW',outputs=['LeftMagShaft','RightMagShaft'],note='Crank → idler → left/right drive gears → splined shafts → magnetos. Supplies timed ignition; two separate magnetos, twelve plugs. C-3-2; A-3-2.'),
 dict(id='fuel',label='Fuel: continuous-flow injection',parts=['CrankGear','CamGear','CamShaft']+[p['id'] for p in d['parts'] if p['group']=='fuel'],ratio=None,direction='Unverified',outputs=['FuelCoupling'],note='Crank → cam cluster → fuel drive gear → coupling → fuel pump. H replacement pump coupling differs from old style. Fuel-drive numerical ratio is unverified; animation uses illustrative tooth sizes. C-3-6.'),
 dict(id='oil-tach',label='Oil and tachometer',parts=['CrankGear','CamGear','CamShaft']+[p['id'] for p in d['parts'] if p['group']=='oil-tach'],ratio=.5,direction='CW (tach output)',outputs=['TachOutput'],note='Crank → cam → splined oil/tach shaftgear → pump and bevel tach output. 0.5:1 is verified for tach, not a separately published oil-pump specification. Lubrication and speed indication. A-3-2; A-4-16; C-3-2.'),
 dict(id='starter',label='Starter: power into engine',parts=['CrankGear','CrankShaft']+[p['id'] for p in d['parts'] if p['group']=='starter'],ratio=32,direction='CCW (starter drive)',outputs=['StarterWorm'],note='Motor → worm → worm wheel → wrap spring grips drum → shaftgear → crank. After starting, spring releases; shaftgear stays engine-driven. 32:1 is starter drive/crank speed during cranking, not normal operation. A-3-2; C-3-2.'),
 dict(id='alternator',label='Alternator: electrical supply',parts=['CrankGear']+[p['id'] for p in d['parts'] if p['group']=='alternator'],ratio=3,direction='CW',outputs=['AlternatorOutput'],note='Gear-driven alternator endpoint: 3:1 verified. Dashed route marks unresolved transfer geometry; A-3-2 generator-pulley wording is not an H alternator reconstruction. A-4-13; C-3-3.'),
 dict(id='vacuum',label='Optional vacuum drive',parts=['CrankGear','IdlerGear','LeftMagGear','LeftMagShaft','LeftMagAdapter']+[p['id'] for p in d['parts'] if p['group']=='vacuum'],ratio=1.14,direction='CCW',outputs=['VacuumOutput'],note='Optional upper-rear accessory splines; adapter transfer shown schematically, not reconstructed. H vacuum, deice and autopilot drive listings are 1.14:1. Aircraft equipment depends on installation. A-3-2; C-3-3.'),
 dict(id='governor',label='Governor: propeller control',parts=['CrankGear','CamGear','CamShaft']+[p['id'] for p in d['parts'] if p['group']=='governor'],ratio=.809,direction='CW',outputs=['GovernorOutput'],note='Crank → camshaft → front bevel pair → governor. Remote front drive relocated; bevel geometry omitted. 0.809:1 output controls propeller pitch hydraulically. A-3-2; C-3-3.')]
for path in paths:path['edges']=EDGES[path['id']]
names=['Operating mechanism','Exploded overview','Reassembly overview']+['Focus: '+p['id'] for p in paths if p['id']!='starter']+['Starter engagement and start']
stages=[dict(label='Assembled',progress=0,note='Inspect mounting interfaces.'),dict(label='Covers, seals and envelopes',progress=50,note='Expose the actual open chambers.'),dict(label='Gears, shafts and couplings',progress=100,note='Trace power paths; explosion order is pedagogical.')]
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=601;scene.render.fps=30;scene['scope']=d['scope'];scene['reference']=d['reference']
for title in names:
    action=bpy.data.actions.new(title)
    path=next((p for p in paths if title=='Focus: '+p['id']),None)
    for p in d['parts']:
        o=objects[p['id']];o.animation_data_create();o.animation_data.action=action;o.animation_data.action_slot=action.slots.new(id_type='OBJECT',name=o.name)
        for frame in range(1,602):
            u=(frame-1)/600;o.location=Vector(p['pivot_mm'])/1000;o.rotation_mode='AXIS_ANGLE';o.rotation_axis_angle=(0,*p['axis']);o.scale=(1,1,1)
            if title in ['Exploded overview','Reassembly overview']:
                v=1-u if title=='Reassembly overview' else u;amount=max(0,min(1,v*2-p['stage']+1));o.location+=Vector(p['offset_mm'])/1000*amount
            else:
                rate=p['rate'] if not path or p['id'] in path['parts'] else 0
                angle=4*math.pi*u*rate
                if title=='Starter engagement and start':
                    # Cranking first; engine takes over at 65%. Temporal profile is illustrative.
                    crank=min(u,.65)*4*math.pi+max(0,u-.65)*8*math.pi
                    angle=crank*rate
                    if p['id']=='StarterWorm': angle=min(u,.65)*4*math.pi*32
                    if p['id'] in ['WormWheel','ClutchSpring']:angle=min(u,.65)*4*math.pi
                    if p['id']=='ClutchSpring':
                        tight=1 if .1<=u<.65 else max(0,u/.1) if u<.1 else 0
                        o.scale=(1-.04*tight,1-.04*tight,1)
                o.rotation_axis_angle=(angle,*p['axis'])
            o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_axis_angle',frame=frame);o.keyframe_insert('scale',frame=frame)
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
bpy.ops.export_scene.gltf(filepath=str(F/'accessory-drives.glb'),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_step=2,export_anim_slide_to_zero=True)
raw=(F/'accessory-drives.glb').read_bytes();(R/'web/accessory-drives.glb.gz').write_bytes(gzip.compress(raw,mtime=0))
motions=[]
for title in names:
    stops=stages if title=='Exploded overview' else [dict(s,progress=100-s['progress']) for s in reversed(stages)] if title=='Reassembly overview' else [dict(label='Motor cranking / spring grips',progress=10,note='Battery energy enters motor; clutch contraction is illustrative.'),dict(label='Engine takes over / spring releases',progress=65,note='Worm and wheel stop; engine continues to drive shaftgear. No Bendix pinion translation.'),dict(label='Running',progress=100,note='Starting timings are illustrative; not an aircraft start checklist.')] if title=='Starter engagement and start' else [dict(label='Start of sample',progress=0),dict(label='One crank revolution',progress=50),dict(label='Two crank revolutions',progress=100)]
    motions.append(dict(id=title,label=title,loop=False,stages=stops))
contract=dict(asset_sha256=hashlib.sha256(raw).hexdigest(),parts=[{k:v for k,v in p.items() if k not in ['vertices_mm','triangles']} for p in d['parts']],reference=d['reference'],scope=d['scope'],motions=motions,powerPaths=paths,viewpoint='CW/CCW facing engine drive pad. CAD +Z points toward the rear observer; outputs are relocated. Arrows indicate output direction, not an inferred intermediate mesh.',rotationOutputs=[dict(id=id,direction=p['direction'],axis=[1,0,0] if p['id']=='starter' else [0,1,0]) for p in paths for id in p['outputs'] if p['ratio'] is not None])
(R/'web/accessory-drives-contract.json').write_text(json.dumps(contract,indent=2))
(F/'blender-verification.json').write_text(json.dumps(dict(passed=True,parts=len(objects),authored_actions=names,asset_sha256=contract['asset_sha256'],scope=d['scope']),indent=2))
print('ACCESSORY_RIG_EXPORTED',len(raw),flush=True)
