"""Source-scoped static drive features extending the frozen valve-train milestone."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
from cad_pipeline import gtsio_drive_layout as layout
from cad_pipeline.gtsio_drive_research import BASE,STUDY,additions
from cad_pipeline.research_gate import review
from cad_pipeline.spec import validate_spec,evaluate
from accessory_gears import solve_gtsio_static_drive,gtsio_static_mesh_records
from gear_geometry import profile


def guest_bores_for_extension(features):
    """Retain fitted bores without replaying cavities through restored webs."""
    original_only={'Open crank/rod/damper cavity','Cam-lobe chamber'}
    return [copy.deepcopy(f) for f in features if f['operation']=='cut'
            and f['primitive']!='box' and f.get('label') not in original_only]


def feature(kind,op='add',origin=None,axis=None,**kw):
    return dict(primitive=kind,operation=op,origin=origin or [0,0,0],axis=axis or [0,0,1],**kw)


def cyl(radius,height,z=0,y=0,x=0,op='add',label=''):
    return feature('cylinder',op,[x,y,z],radius=radius,height=height,label=label)


def tube(radius,inner,height,z=0,y=0,x=0,op='add'):
    return feature('tube',op,[x,y,z],radius=radius,inner_radius=inner,height=height)


def box(length,width,height,origin,op='add'):
    return feature('box',op,origin,length=length,width=width,height=height)


def ring_profile(radius,wire,z,y=0,material='steel'):
    points=[[radius+wire*math.cos(a),wire*math.sin(a)] for a in [2*math.pi*n/24 for n in range(24)]]
    return feature('revolve',origin=[0,y,z],points=points,angle=360)


def half_cut(side):
    if side=='Left':return box(500,800,1100,['-drive_case_split/2',-350,-100],'cut')
    return box('500+drive_case_split/2',800,1100,[-500,-350,-100],'cut')


def build_spec(flange='D'):
    inv=json.loads((STUDY/'inventory.json').read_text())
    if inv['configuration']['flange_pattern']!=flange:raise ValueError('Review inventory for this flange choice first')
    spec=json.loads((BASE/'part-spec.json').read_text());spec=copy.deepcopy(spec)
    spec['model_id']='gtsio520-h-static-drive-v1';spec['scope']=inv['decision']
    spec['sources'].update(inv['sources'])
    p=layout.parameters(flange);spec['parameters'].update(p)
    v=lambda name:evaluate(name,p)
    parts={part['id']:part for part in spec['parts']}
    new=[]
    def part(id,label,group,features,material='steel',evidence='X-30045A A-4-19/20; source construction, estimated packaging/detail'):
        item=dict(id=id,label=label,group=group,material=material,evidence=evidence,features=features,boolean_refine=True)
        new.append(item);return item
    def screw(id,label,x,y,z,length,radius=2.9,head_radius=5.,head_height=3.,axis=None):
        axis=axis or [0,0,1]
        f=[feature('cylinder',origin=[x,y,z],axis=axis,radius=radius,height=length),
           feature('prism',origin=[x,y,z-head_height],axis=axis,derived=True,height=head_height,
                   points=[[head_radius*math.cos(n*math.pi/3),head_radius*math.sin(n*math.pi/3)] for n in range(6)])]
        return part(id,label,'drive_fasteners',f)
    gears=solve_gtsio_static_drive()
    def gear_feature(id):
        g=gears[id];module_name='reduction_module' if id in ('ReductionPinion','PropellerShaft') else 'timing_module'
        points=profile(g['teeth'],g['r_pitch'],g['addendum'],g['phase'],**g['form'])
        points=[[f'{a/g["module_mm"]}*{module_name}' for a in q] for q in points]
        return feature('prism',origin=[g['centre'][0],'propeller_axis_y' if id=='PropellerShaft' else g['centre'][1],
                        'drive_gear_z' if id in ('ReductionPinion','PropellerShaft') else g['z']],
                       points=points,height='drive_face_width' if id in ('ReductionPinion','PropellerShaft') else g['width'],
                       derived=True,linked_profile=True,label='Calculated sampled involute profile; estimated tooth count/module')

    # Rear timing gears reuse the existing unequal cam and six-bolt crank datums.
    crank=parts['Crankshaft']
    rear_bolts=[f for f in crank['features'] if f.get('label')=='Rear gear screw seat']
    crank['features']=[f for f in crank['features'] if f not in rear_bolts]
    for f in crank['features']:
        if f.get('label','').startswith('Illustrative quill socket'):
            f.clear();f.update(feature('prism','cut',[0,0,559.],height=31.,derived=True,linked_profile=True,
                points=layout.spline_profile(p,'quill_spline_clearance',True),label='Matched estimated quill spline socket'))
    crank['features'].append(cyl('main_diameter/2',26.,-26.,label='Estimated rear gear mounting land'))
    for f in rear_bolts:
        x,y,_=f['origin'];crank['features'].append(cyl(3.,43.,-31.,x=x,y=y,op='cut',label='Source six rear gear screw seats'))
    crank['features'].append(cyl(1.55,8.,-29.,y=28.,op='cut',label='Estimated locating dowel seat'))
    # The documented milled spline line is aligned to an estimated journal feed aperture.
    port=feature('cylinder','cut',[0,0,578.],[0,1,0],radius=2.2,height=46.,label='Journal feed aperture; hidden oil gallery remains deferred')
    crank['features'].append(port)
    for id in ('MainBearingLeft4','MainBearingRight4'):parts[id]['features'].append(dict(port,radius=2.3))
    fg=[gear_feature('CrankshaftGear'),cyl(10.,14.,-37.,op='cut'),cyl('main_diameter/2',2.1,-26.,op='cut')]
    for n,f in enumerate(rear_bolts,1):
        x,y,_=f['origin'];fg.append(cyl(3.1,14.,-37.,x=x,y=y,op='cut'))
        screw('CrankGearScrew'+str(n),'Rear crank gear screw '+str(n),x,y,-36.,30.,head_radius=4.8)
    fg.append(cyl(1.55,14.,-37.,y=28.,op='cut'))
    part('CrankshaftGear','Rear crankshaft timing gear','cam_drive',fg)
    part('CrankGearDowel','Crank gear locating dowel','drive_fasteners',[cyl(1.5,5.,-28.5,y=28.)])
    cam_holes=[f['origin'][:2] for f in parts['Camshaft']['features'] if f.get('label')=='Estimated unequally indexed gear attachment']
    if len(cam_holes)!=4:raise ValueError('Frozen cam flange datums changed')
    for id in ('CamshaftGear','CamClusterGear'):
        g=gears[id];fg=[gear_feature(id),cyl(9.55,g['width']+2,g['z']-1,y=g['centre'][1],op='cut')]
        if id=='CamshaftGear':fg.append(cyl(30.,2.1,-26.,y=g['centre'][1],op='cut'))
        for x,y in cam_holes:fg.append(cyl(3.1,g['width']+2,g['z']-1,x=x,y=y,op='cut'))
        part(id,'Camshaft gear' if id=='CamshaftGear' else 'Camshaft fuel-pump cluster gear','cam_drive',fg)
    for n,(x,y) in enumerate(cam_holes,1):screw('CamGearScrew'+str(n),'Unequally indexed cam gear screw '+str(n),x,y,-46.,29.)

    # Separate quill: reduced core, two spline ends, visible split/milled line and retained front end.
    spline=layout.spline_profile(p,expressions=True)
    q=[cyl('quill_core_radius','quill_front_z+quill_spline_length-quill_rear_z','quill_rear_z'),
       feature('prism',origin=[0,0,'quill_rear_z'],points=spline,height='quill_spline_length',derived=True,linked_profile=True),
       feature('prism',origin=[0,0,'quill_front_z'],points=spline,height='quill_spline_length',derived=True,linked_profile=True),
       box(30,3.2,8.,[-15,-1.6,'quill_rear_z'],'cut'),
       box(8,'quill_tip_radius-quill_root_radius+2','quill_spline_length',[-4,'quill_root_radius-.2','quill_rear_z'],'cut')]
    for x in (-6,6):q.append(cyl(2.05,17.,'quill_plate_z-16',x=x,op='cut'))
    part('QuillShaft','Estimated splined reduced-section quill shaft','front_drive',q)
    pinion=[gear_feature('ReductionPinion'),cyl('reduction_journal_diameter/2','drive_gear_end+47-(drive_gear_z-44)','drive_gear_z-44'),
            cyl(37.5,4.,'reduction_collar_z'),
            feature('prism','cut',[0,0,'drive_gear_z-45'],points=layout.spline_profile(p,'quill_spline_clearance',True),
                    height='drive_gear_end+48-(drive_gear_z-45)',derived=True,linked_profile=True),
            cyl(14.5,8.,'quill_plate_z-.4',op='cut'),cyl(15.4,1.1,'quill_plate_z+2.2',op='cut')]
    part('ReductionPinion','Quill-driven reduction pinion and journal','front_drive',pinion)
    plate=[cyl(14.,2.,'quill_plate_z')]+[cyl(2.1,4.,'quill_plate_z-1',x=x,op='cut') for x in (-6,6)]
    part('QuillPlate','Two-screw quill retaining plate','reduction_retention',plate)
    for n,x in enumerate((-6,6),1):
        part('QuillPlateScrew'+str(n),'Quill retaining screw '+str(n),'reduction_retention',
             [cyl(1.95,14.,'quill_plate_z-12',x=x),cyl(3.3,2.5,'quill_plate_z+2',x=x)])
    part('QuillRetainingRing','Split internal quill retaining ring','reduction_retention',[
        feature('revolve',origin=[0,0,'quill_plate_z+2.3'],points=[[13.3,0],[15.3,0],[15.3,.8],[13.3,.8]],angle=335)])

    # Integral propeller gear/shaft, bearing lands, slingers and external flange.
    y='propeller_axis_y'
    prop=[gear_feature('PropellerShaft'),cyl('propeller_journal_diameter/2','drive_gear_end+117.2-(drive_gear_z-32)','drive_gear_z-32',y=y),
          cyl(37.,2.,'propeller_slinger_z',y=y),cyl(37.,3.,'propeller_collar_z',y=y),
          feature('cone',origin=[0,y,'propeller_flange_z-4'],radius1='propeller_journal_diameter/2',radius2=47.,height=4.),
          cyl('propeller_flange_radius','propeller_flange_width','propeller_flange_z',y=y),
          cyl('propeller_pilot_radius',7.,'propeller_flange_z+propeller_flange_width',y=y),
          cyl(10.,'transfer_stem_z-(drive_gear_z-32)','drive_gear_z-32',y=y,op='cut'),
          cyl('transfer_sleeve_hole_diameter/2','transfer_outlet_z-transfer_stem_z+.2','transfer_stem_z',y=y,op='cut')]
    for n in range(8):
        a=(n+.5)*math.pi/4;r=v('propeller_bolt_circle')/2
        prop.append(cyl('propeller_bolt_diameter/2','propeller_flange_width+2','propeller_flange_z-1',y=f'propeller_axis_y+{r*math.sin(a)}',x=r*math.cos(a),op='cut'))
    if flange=='N':
        for sign in (-1,1):prop.append(cyl(6.35,'propeller_flange_width+2','propeller_flange_z-1',y=f'propeller_axis_y+{sign*v("propeller_bolt_circle")/2}',op='cut'))
    part('PropellerShaft','Integral propeller gear, shaft and selected '+flange+'-family flange','propeller_shaft',prop)
    for station,z,width in [('Front','propeller_front_bearing_z','propeller_front_bearing_width'),('Rear','propeller_rear_bearing_z','propeller_rear_bearing_width')]:
        for side in ('Left','Right'):part('Propeller'+station+'Bearing'+side,station+' propeller bearing '+side.lower(),'drive_bearings',
            [tube('propeller_seat_diameter/2','propeller_bearing_id/2',width,z,y=y),half_cut(side)],'steel')
    for side in ('Left','Right'):part('ReductionBearing'+side,'Reduction bearing '+side.lower(),'drive_bearings',
        [tube('reduction_seat_diameter/2','reduction_bearing_id/2','reduction_bearing_width','reduction_bearing_z'),half_cut(side)],'steel')
    for station,z in [('Front','propeller_thrust_front_z'),('Aft','propeller_thrust_aft_z')]:
        for side in ('Left','Right'):
            fg=[tube(37.,'propeller_journal_diameter/2+.05','propeller_thrust_width',z,y=y),half_cut(side)]
            if side=='Right':fg.append(feature('cylinder','cut',[35,y,z+'+.75'],[1,0,0],radius=.51,height=6.))
            part('PropellerThrust'+station+side,station+' propeller thrust-washer half '+side.lower(),'propeller_thrust',fg,'bronze')
        part('PropellerThrustPin'+station,station+' thrust-washer locating pin','propeller_thrust',
             [feature('cylinder',origin=[35,y,z+'+.75'],axis=[1,0,0],radius=.5,height=5.)])

    # Fixed oil-transfer assembly; the tube opens into the inlet chamber, not through a solid tube wall.
    rear=[cyl(9.,26.,'transfer_rear_z',y=y),
          feature('cylinder',origin=[0,y,'transfer_rear_z+4'],axis=[0,-1,0],radius=6.,height='propeller_axis_y-46'),
          cyl('transfer_receiving_id/2',26.,'transfer_rear_z+1.5',y=y,op='cut'),
          feature('cylinder','cut',[0,'propeller_axis_y+1','transfer_rear_z+4'],[0,-1,0],radius=4.,height='propeller_axis_y-45'),
          tube(9.2,7.8,2.5,'transfer_rear_z+22',y=y,op='cut')]
    part('PropellerRearSleeve','Stationary rear oil-transfer sleeve and transverse inlet','propeller_oil_transfer',rear,'bronze')
    part('PropellerTransferTube','Central fixed propeller oil-transfer tube','propeller_oil_transfer',
         [tube('transfer_tube_diameter/2',4.,'transfer_tube_front_z-transfer_tube_rear_z','transfer_tube_rear_z',y=y)])
    front=[cyl(8.5,'transfer_stem_z-transfer_front_z','transfer_front_z',y=y),
           cyl('transfer_sleeve_hole_diameter/2','transfer_outlet_z-transfer_stem_z','transfer_stem_z',y=y),
           cyl(4.,'transfer_outlet_z-transfer_front_z+2','transfer_front_z-1',y=y,op='cut'),
           cyl('transfer_receiving_id/2','transfer_tube_front_z+1-transfer_front_z+1','transfer_front_z-1',y=y,op='cut')]
    part('PropellerTransferSleeve','Forward stepped oil-transfer sleeve; assembled press seat','propeller_oil_transfer',front,'bronze')
    part('PropellerTransferORing','Rear transfer sleeve O-ring','propeller_oil_transfer',
         [ring_profile(8.9,1.1,v('transfer_rear_z')+23.25,v('propeller_axis_y'))],'rubber')
    seal=[tube(40.,'propeller_journal_diameter/2',11.,'propeller_seal_z',y=y),
          tube(39.,36.,3.,'propeller_seal_z+5',y=y,op='cut'),
          tube(32.65,31.35,1.7,'propeller_seal_z+3',y=y,op='cut')]
    part('PropellerOilSeal','Propeller shaft oil seal with reinforcement and spring cavities','propeller_seal',seal,'rubber')
    part('SealReinforcementRing','Oil-seal reinforcing ring','propeller_seal',[tube(38.9,36.1,2.8,'propeller_seal_z+5.1',y=y)])
    part('SealGarterSpring','Simplified continuous garter spring envelope','propeller_seal',
         [ring_profile(32.,.5,v('propeller_seal_z')+3.85,v('propeller_axis_y'))])

    # Source-described six front through bolts, with distinct plain and lock washers/nuts.
    bolts=layout.through_bolts(p)
    for b in bolts:
        n,yb,zb,w=b['id'],b['y'],b['z'],b['half_width']
        part('FrontCaseThroughBolt'+str(n),'Front case through bolt '+str(n),'front_case_hardware',
             [feature('cylinder',origin=[-w-11,yb,zb],axis=[1,0,0],radius='drive_case_bolt_radius',height=2*w+22)])
        for side,sign in [('Left',-1),('Right',1)]:
            def start(distance,width):return sign*distance-(width if sign<0 else 0)
            part(f'FrontCaseWasher{n}{side}','Front case plain washer','front_case_hardware',
                 [feature('tube',origin=[start(w,2.3),yb,zb],axis=[1,0,0],radius=8.,inner_radius=5.1,height=2.3)])
            lock=[feature('tube',origin=[start(w+2.3,.9),yb,zb],axis=[1,0,0],radius=7.8,inner_radius=5.1,height=.9),
                  box(2.,.7,10.,[start(w+2.3,.9)-.5,yb-.35,zb],'cut')]
            part(f'FrontCaseLockWasher{n}{side}','Compressed split lock washer','front_case_hardware',lock)
            nut=[feature('prism',origin=[start(w+3.2,6.),yb,zb],axis=[1,0,0],height=6.,derived=True,
                         points=[[8.5*math.cos(a*math.pi/3),8.5*math.sin(a*math.pi/3)] for a in range(6)]),
                 feature('cylinder','cut',[start(w+3.2,6.)-.2,yb,zb],[1,0,0],radius=5.1,height=6.4)]
            part(f'FrontCaseNut{n}{side}','Front case hex nut; thread simplified','front_case_hardware',nut)

    # Extend both authoritative castings; all guest bores follow their shared datums.
    for side in ('Left','Right'):
        case=parts['Crankcase'+side]
        # The new stock does not reach the old sump datum/oil-return bays.
        # Recutting those unchanged faces, or their exact existing split plane,
        # creates an OCC tessellation T-junction at the old lower front edge.
        # The original bulk cavities precede the bearing webs. Replaying them
        # globally here removes those webs. They do not reach the new front
        # stock; only fitted/attachment bores may be replayed.
        old_cuts=guest_bores_for_extension(case['features'])
        adds=[cyl(68.,'drive_gear_end+2-drive_case_start','drive_case_start'),cyl(92.,'drive_gear_end+2-drive_case_start','drive_case_start',y='propeller_axis_y'),
              feature('cone',origin=[0,0,'drive_gear_end'],radius1=68.,radius2=47.,height=49.),
              feature('cone',origin=[0,'propeller_axis_y','drive_gear_end'],radius1=92.,radius2=52.,height=49.),
              cyl(47.,19.,'drive_gear_end+49'),cyl(52.,'drive_case_end-(drive_gear_end+49)','drive_gear_end+49',y='propeller_axis_y')]
        sections=[[[x,y,z] for x,y in [(-w,0),(w,0),(w,'propeller_axis_y'),(-w,'propeller_axis_y')]]
                  for z,w in [('drive_case_start',68.),('drive_gear_end',68.),('drive_gear_end+49',48.)]]
        adds.append(feature('loft',sections=sections))
        adds.append(box(96.,'propeller_axis_y','drive_case_end-(drive_gear_end+49)',[-48,0,'drive_gear_end+49']))
        for b in bolts:adds.append(box(2*b['half_width'],16.,16.,[-b['half_width'],b['y']-8,b['z']-8]))
        case['features']+=adds+old_cuts
        case['features'].append(feature('cylinder',origin=[0,40,'transfer_rear_z+4'],axis=[0,1,0],radius=10.,height=32.,label='Fitted transfer-inlet boss; hidden gallery deferred'))
        cuts=[cyl('reduction_journal_diameter/2+.4','quill_plate_z+6-588',588.,op='cut'),
              cyl('reduction_module*reduction_teeth/2+reduction_module+drive_tooth_case_gap','drive_face_width+2.1','drive_gear_z-2',op='cut'),
              cyl('reduction_module*propeller_teeth/2+reduction_module+drive_tooth_case_gap','drive_face_width+2.1','drive_gear_z-2',y='propeller_axis_y',op='cut'),
              cyl('reduction_seat_diameter/2','reduction_bearing_width','reduction_bearing_z',op='cut'),
              cyl(37.8,17.,'reduction_bearing_z+reduction_bearing_width',op='cut'),
              cyl('propeller_journal_diameter/2+.4','drive_case_end-(drive_gear_z-33)+1','drive_gear_z-33',y='propeller_axis_y',op='cut'),
              cyl('propeller_seat_diameter/2','propeller_rear_bearing_width','propeller_rear_bearing_z',y='propeller_axis_y',op='cut'),
              cyl('propeller_seat_diameter/2','propeller_front_bearing_width','propeller_front_bearing_z',y='propeller_axis_y',op='cut'),
              cyl(37.4,3.7,'propeller_slinger_z-.2',y='propeller_axis_y',op='cut'),
              cyl(37.4,14.,'propeller_thrust_front_z',y='propeller_axis_y',op='cut'),
              cyl(40.,11.,'propeller_seal_z',y='propeller_axis_y',op='cut'),
              feature('cylinder','cut',[0,'propeller_axis_y+1','transfer_rear_z+4'],[0,-1,0],radius=6.15,height='propeller_axis_y-39'),
              cyl(10.15,28.,'transfer_rear_z-1',y='propeller_axis_y',op='cut'),dict(port,radius=2.4)]
        for b in bolts:cuts.append(feature('cylinder','cut',[-b['half_width']-1,b['y'],b['z']],[1,0,0],radius='drive_case_bolt_radius+drive_case_bolt_clearance/2',height=2*b['half_width']+2))
        for z in ('propeller_thrust_front_z','propeller_thrust_aft_z'):cuts.append(feature('cylinder','cut',[34.9,'propeller_axis_y',z+'+.75'],[1,0,0],radius=.55,height=8.))
        split=half_cut(side)
        # Keep the old parting face untouched; new estimated stock stops 1 um
        # inside its assembly gap. This is an authoritative CAD geometry choice,
        # not an exported-mesh patch or a change to any acceptance limit.
        if side=='Left':split['origin'][0]='-drive_case_split/2+.001'
        else:split['length']='500+drive_case_split/2-.001'
        case['features']+=cuts+[split]
        case['boolean_refine']=True
        case['label']='Split '+side.lower()+' crankcase with fitted front drive and propeller supports'

    planned={id for ids in additions().values() for id in ids}
    if {p['id'] for p in new}!=planned:raise ValueError('New CAD identities disagree with reviewed scope')
    spec['parts']+=new
    spec['research']=dict(inventory_path='cad-studies/gtsio520-h-static/drive-development/inventory.json',
        inventory_sha256=hashlib.sha256((STUDY/'inventory.json').read_bytes()).hexdigest())
    spec.setdefault('tessellation',{}).setdefault('groups',{}).update({g:.06 for g in ['cam_drive','front_drive','propeller_shaft','drive_bearings','propeller_thrust','propeller_seal','propeller_oil_transfer','reduction_retention','drive_fasteners','front_case_hardware']})
    spec['presentation'].setdefault('group_titles',{}).update(dict(cam_drive='Rear crank / cam timing gears and cluster',front_drive='Matched quill coupling and reduction pinion',propeller_shaft='Integral propeller shaft and selected D-family flange',drive_bearings='Split reduction and propeller bearing inserts',propeller_thrust='Propeller thrust washers and locating pins',propeller_oil_transfer='Fixed propeller oil-transfer sleeves and tube',propeller_seal='Propeller oil seal, reinforcing ring and spring',reduction_retention='Quill retaining plate, screws and split ring',front_case_hardware='Front case through bolts and attaching hardware',drive_fasteners='Rear gear screws and locating dowel',crankcase='Split crankcase / fitted front drive supports'))
    validate_spec(spec);review(inv,[p['id'] for p in spec['parts']])
    return spec


def main():
    p=argparse.ArgumentParser();p.add_argument('--flange',choices=['D','N'],default='D');p.add_argument('--out',type=Path,default=STUDY/'part-spec.json');a=p.parse_args()
    spec=build_spec(a.flange);a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(spec,indent=2)+'\n',encoding='utf-8')
    print('STATIC_DRIVE_SPEC',len(spec['parts']),a.out,flush=True)


if __name__=='__main__':main()
