"""Source-accounted cam, hydraulic lifters, rods/housings and rocker retention."""
import math,copy
from cad_pipeline.gtsio_core import cylinder,tube,box,prism
from cad_pipeline.gtsio_cylinders import revolve
from cad_pipeline import gtsio_valve_layout as vl
from cad_pipeline import gtsio_valvetrain_pose as kp

CAM_NAMES=['Governor driven bevel gear','Governor drive bevel gear','Woodruff key','Hex-head screw','Cam cluster gear','Camshaft gear','Camshaft']
LIFTER_NAMES=['Body','Plunger spring','Check-valve housing','Check-valve spring','Check-valve plate','Plunger','Socket','Retaining ring','Exterior oil groove','Body oil inlet','Interior oil groove','Plunger oil inlet','Plunger reservoir','Oil discharge hole','Body reservoir','Oil outlet hole']

def sphere(r,p,op='add',label=''):return dict(primitive='sphere',operation=op,radius=r,origin=list(p),label=label)
def segment(r,start,end,ri=None,op='add',label=''):
    direction=kp.unit(kp.sub(end,start));length=math.dist(start,end)
    return tube(r,ri,length,start,direction,op=op,label=label) if ri else cylinder(r,length,start,direction,op=op,label=label)
def helix(r,wire,length,start,axis,turns,left=False):
    return dict(primitive='helix',operation='add',radius=r,wire_radius=wire,pitch=(length-2*wire)/turns,height=length-2*wire,origin=list(kp.add(start,kp.scale(axis,wire))),axis=list(axis),left_handed=left)

def cup_section():
    # Explicit rounded bowl section avoids a sphere/cone seam that corrupted
    # the closed rocker's STEP solid. Arc chord error stays below the selected
    # 0.05 mm ball/seat clearance; the oil passage remains open.
    outer=[(math.sqrt(49-t*t),t) for t in [-2+8.896*(i/32) for i in range(33)]]
    outer[-1]=(1.2,math.sqrt(49-1.44))
    inner=[(1.2,math.sqrt(4.85**2-1.2**2))]+[(math.sqrt(4.85**2-t*t),t) for t in [4.7-6.7*(i/32) for i in range(33)]]
    return outer+inner


def cup_clearance_section():
    # Cut through the whole forging after union: a hollow additive cup alone
    # cannot remove arm stock occupying the ball's swept seating space.
    arc=[(math.sqrt(4.85**2-t*t),t) for t in [-2+6.7*i/32 for i in range(33)]]
    return [(0,-12),(8.5,-12)]+arc+[(1.2,8),(0,8)]

def raw_from_world(p,n,layout):
    x,y,z=p;z-=layout.station(n)
    if n%2==0:x,z=-x,-z
    return x,y,-z

def housing_line(name,params,layout):
    # All six heads have the same local seats. Use one raw master calculation.
    a=raw_from_world(kp.nominal_socket(name,1,params,layout),1,layout);b=vl.raw_point(name,vl.CUP_T,vl.CUP_U,0,params);d=kp.unit(kp.sub(b,a))
    base,axis,_=vl.raw_frame(name,params)
    lam=(75-kp.dot(kp.sub(a,base),axis))/kp.dot(d,axis)
    head=kp.add(a,kp.scale(d,lam));case=kp.add(a,kp.scale(d,(135-a[0])/d[0]))
    return case,head,d

def add(a,layout,theta=0):
    for name,value,why,source in [
        ('cam_journal_diameter',31.7119,'Table6 PDF103 1.2480-1.2490 in midpoint',True),
        ('tappet_body_diameter',25.38095,'Table6 PDF104 .9990-.9995 in midpoint',True),
        ('tappet_guide_diameter',25.4254,'Table6 PDF103 1.0005-1.0015 in midpoint',True),
        ('tappet_socket_oil_diameter',3.175,'PDF17 new shouldered-socket variant 1/8 in oil hole',True),
        ('cam_base_radius',kp.BASE_RADIUS,'Illustrative convex flat-follower cam constrained by case envelope',False),
        ('cam_follower_lift',kp.CAM_LIFT,'Illustrative 6 mm harmonic support displacement; not OEM lift/timing',False),
        ('pushrod_outer_radius',3.5,'Estimated hollow steel rod; socket and tube clearances derived',False),
        ('pushrod_oil_radius',1.2,'Estimated centre-drilled passage; full oil routing unverified',False),
        ('pushrod_ball_radius',4.8,'Estimated forged spherical ends and matching hardened sockets',False),
        ('housing_outer_radius',11.5,'Estimated beaded tube, constrained by straight path and internal rod excursion',False),
        ('housing_inner_radius',10.1,'Estimated oil-return and angular-clearance bore',False),
    ]:a.parameter(name,value,why,source)
    sp=a.spec;parts={p['id']:p for p in sp['parts']};params=a.parameters
    # R16's tessellation-only refinement no longer preserves this boundary.
    # Refine the revised native Boolean construction and check it independently.
    parts['CrankcaseRight'].pop('mesh_refine',None)
    parts['CrankcaseRight']['boolean_refine']=True
    # Ground journals and nine derived convex lobes on one forged shaft.
    cam=[cylinder(9.5,638,[0,'case_cam_y',-30]),cylinder(30,12,[0,'case_cam_y',-26])]
    for bay in range(4):cam.append(cylinder('cam_journal_diameter/2',layout.MAIN_WIDTH-.4,[0,'case_cam_y',bay*layout.BAY_PITCH+.2]))
    for lobe in kp.lobes(layout):
        f=prism(kp.profile(lobe['phase'],theta),kp.LOBE_WIDTH,[0,a.value('case_cam_y'),lobe['station']-kp.LOBE_WIDTH/2],label='Inferred '+lobe['id']+' flat-follower support envelope');f['derived']=True;cam.append(f)
    cam.append(tube(16.1,15.25,1.4,[0,'case_cam_y',3*layout.BAY_PITCH+21.3],op='cut',label='Front journal oil-transfer groove'))
    for angle in [0,80,185,275]:
        t=math.radians(angle);cam.append(cylinder(3.1,14,[23*math.cos(t),a.value('case_cam_y')+23*math.sin(t),-27],op='cut',label='Estimated unequally indexed gear attachment'))
    a.add('Camshaft','Four-journal nine-lobe forged camshaft / inferred static profile','camshaft',cam,['A-4-19:7'],refine=False)
    poses=[]
    for n in range(1,7):
        frame=copy.deepcopy(parts['CylinderBarrel'+str(n)]['placement']);head=parts['CylinderHead'+str(n)]
        # Shaft is supported by retainers inside the box, not its outer walls.
        head['features']=[f for f in head['features'] if 'rocker support bore' not in f.get('label','')]
        for name in ['Intake','Exhaust']:
            st=kp.pose(name,n,params,layout,theta);poses.append(st);tag=name+str(n);base,axis,v=vl.raw_frame(name,params)
            pt=lambda t,u=0,w=0:vl.raw_point(name,t,u,w,params)
            def local(id,label,group,features,callouts,material='steel'):
                p=a.add(name+id+str(n),f'Cylinder {n} / {name} '+label,group,features,callouts,material);p['placement']=copy.deepcopy(frame);return p
            # Source-backed interfaces retained while the rounded contact closes.
            tip=a.value(name.lower()+'_valve_length')-3;cup=pt(vl.CUP_T,vl.CUP_U);pivot=pt(vl.PIVOT_T,vl.PIVOT_U)
            profile=[(tip+8,-3),(tip+8,3),(143,vl.PIVOT_U),(134,vl.PIVOT_U-3),(vl.CUP_T+6,vl.CUP_U),(vl.CUP_T,vl.CUP_U-3),(124,vl.PIVOT_U)]
            case,housing_head,hd=housing_line(name,params,layout)
            rocker=[cylinder(13,kp.ROCKER_HUB_WIDTH,pt(vl.PIVOT_T,vl.PIVOT_U,-kp.ROCKER_HUB_WIDTH/2),v),prism(profile,12,pt(0,0,-6),v),sphere(kp.PAD_RADIUS,pt(tip+kp.PAD_RADIUS)),
                    revolve(cup_section(),cup,hd),cylinder(10.53,20,pt(vl.PIVOT_T,vl.PIVOT_U,-10),v,op='cut'),
                    revolve(cup_clearance_section(),cup,hd,op='cut',label='Ball socket and articulated mouth through complete forging')]
            rp=parts[name+'Rocker'+str(n)];rp['features']=rocker;rp['label']=f'Cylinder {n} / {name} rounded contact rocker / inferred cup and pad';rp['placement']=kp.local_rigid_frame(frame,v,st['beta'],pivot)
            for suffix in ['Valve','Retainer','KeeperA','KeeperB']+(['RotocoilRim'] if name=='Exhaust' else []):
                p=parts[name+suffix+str(n)];p['placement']=kp.local_rigid_frame(frame,v,0,translation=kp.scale(axis,-st['valve_lift']))
            for kind,wire in [('Outer',2.),('Inner',1.4)]:
                f=parts[name+kind+'Spring'+str(n)]['features'][0];f['height']=a.value('spring_installed')-st['valve_lift']-2*wire;f['pitch']=f['height']/6
            parts[name+'RockerShaft'+str(n)]['features'][0]['height']=36.;parts[name+'RockerShaft'+str(n)]['features'][0]['origin']=list(pt(vl.PIVOT_T,vl.PIVOT_U,-18))
            for side in [-1,1]:
                start=kp.RETAINER_INNER_FACE if side>0 else -kp.RETAINER_INNER_FACE-kp.RETAINER_WIDTH;wc=12.75*side
                ret=[tube(13,9.55,kp.RETAINER_WIDTH,pt(vl.PIVOT_T,vl.PIVOT_U,start),v)]
                # Foot extrusion in the valve/vertical plane, through collar width.
                ret.append(prism([(128,-66),(140,-66),(140,-54),(128,-54)],kp.RETAINER_WIDTH,pt(0,0,start),v))
                ret.append(cylinder(2.6,25,pt(117,-62,wc),axis,op='cut'))
                local('ShaftRetainer'+('A' if side<0 else 'B'),'shaft retainer collar','rocker_retention',ret,['A-4-17:12'])
                washer_start=round(kp.ROCKER_HUB_WIDTH/2+.15 if side>0 else -kp.ROCKER_HUB_WIDTH/2-.15-kp.THRUST_WASHER_WIDTH,8)
                local('ThrustWasher'+('A' if side<0 else 'B'),'thin rocker thrust washer','rocker_retention',[tube(12,9.55,kp.THRUST_WASHER_WIDTH,pt(vl.PIVOT_T,vl.PIVOT_U,washer_start),v)],['A-4-17:51'])
                local('RetainerScrew'+('A' if side<0 else 'B'),'retainer screw','rocker_retention',[cylinder(2.5,23.7,pt(117,-62,wc),axis),cylinder(4.2,2,pt(140.7,-62,wc),axis)],['A-4-17:6'])
                local('RetainerTab'+('A' if side<0 else 'B'),'tab locking washer envelope','rocker_retention',[tube(4.5,2.6,.7,pt(140,-62,wc),axis)],['A-4-17:7'])
                # Stock joins each internal mounting boss to its adjacent wall.
                w0=12.75 if side>0 else -24
                head['features'] += [prism([[-(w0+11.25),-69],[-w0,-69],[-w0,-57.2],[-(w0+11.25),-57.2]],10,pt(118),axis,label='Retainer boss lateral support web'),
                                    cylinder(5.5,10,pt(118,-62,wc),axis,label='Retainer screw mounting boss'),cylinder(2.6,25,pt(116,-62,wc),axis,op='cut',label='Retainer screw pilot')]
            # Head housing collar and fitted seal seats, identical local recipe.
            head['features'] += [segment(17,kp.add(housing_head,kp.scale(hd,-20)),kp.add(housing_head,kp.scale(hd,3)),label='Pushrod housing cast collar'),
                                 segment(12.15,kp.add(housing_head,kp.scale(hd,-120)),kp.add(housing_head,kp.scale(hd,4)),op='cut',label='Pushrod housing passage through head/fin stock'),
                                 segment(15.6,kp.add(housing_head,kp.scale(hd,-21)),kp.add(housing_head,kp.scale(hd,-5)),op='cut',label='Housing bead and washer entrance seat'),
                                 segment(14.2,kp.add(housing_head,kp.scale(hd,-5)),kp.add(housing_head,kp.scale(hd,-1)),op='cut',label='Housing packing seat')]
            start=kp.add(case,kp.scale(hd,-15));end=kp.add(housing_head,kp.scale(hd,2))
            tube_fs=[segment('housing_outer_radius',start,end,'housing_inner_radius')]
            for c,t in [(case,17),(housing_head,-8)]:tube_fs.append(segment(14.5,kp.add(c,kp.scale(hd,t)),kp.add(c,kp.scale(hd,t+2)),10.1))
            local('PushrodHousing','beaded oil-return housing','pushrod_housings',tube_fs,['A-4-17:14'])
            for suffix,c,t,h,r,callout,mat in [('CaseSeal',case,-4,4,14.1,17,'rubber'),('HeadPacking',housing_head,-5,4,14.1,18,'rubber'),('CaseWasher',case,0,1,15.5,16,'steel'),('SpringWasher',case,16,1,15.5,16,'steel'),('HeadWasher',housing_head,-6,1,15.5,16,'steel')]:
                local(suffix,suffix+' envelope','pushrod_housings',[segment(r,kp.add(c,kp.scale(hd,t)),kp.add(c,kp.scale(hd,t+h)),11.6)],[f'A-4-17:{callout}'],mat)
            local('HousingSpring','housing seating spring','pushrod_housings',[helix(13.4,.8,15,kp.add(case,hd),hd,5,True)],['A-4-17:15'])
            # Rod ends follow the single closed-length solution, in world space.
            rod_dir=kp.unit(kp.sub(st['cup'],st['socket']));r=a.value('pushrod_ball_radius')
            rod=[segment('pushrod_outer_radius',kp.add(st['socket'],kp.scale(rod_dir,3)),kp.add(st['cup'],kp.scale(rod_dir,-3))),sphere(r,st['socket']),sphere(r,st['cup']),segment('pushrod_oil_radius',kp.add(st['socket'],kp.scale(rod_dir,-r-1)),kp.add(st['cup'],kp.scale(rod_dir,r+1)),op='cut')]
            a.add(name+'Pushrod'+str(n),f'Cylinder {n} / {name} hollow pushrod and forged ball ends','pushrods',rod,['A-4-17:13'])
            # Case stock/bores derive from the same raw housing line.
            def world(p):
                x,y,z=p;z=-z
                if n%2==0:x,z=-x,-z
                return x,y,z+layout.station(n)
            cs=parts['CrankcaseRight' if n%2 else 'CrankcaseLeft'];c0,c1=world(kp.add(case,kp.scale(hd,-25))),world(case)
            cs['features'] += [segment(17,c0,c1,label='Housing lateral casting boss'),segment(12.15,world(kp.add(case,kp.scale(hd,-40))),world(kp.add(case,kp.scale(hd,2))),op='cut',label='Pushrod housing case seat'),segment(14.2,world(kp.add(case,kp.scale(hd,-4))),world(kp.add(case,hd)),op='cut',label='Housing O-ring case seat')]
            self_lifter(a,st,params)
    for part in [parts['CrankcaseRight'],parts['CrankcaseLeft']]:
        side=1 if part['id'].endswith('Right') else -1
        for st in poses:
            if (st['n']%2==1)!=(side>0):continue
            z=vl.follower_station(st['name'],st['n'],layout)
            part['features'].append(cylinder('tappet_guide_diameter/2',152,[0,'case_cam_y',z],(side,0,0),op='cut',label='Precision hydraulic lifter guide'))
            # Oil return path to the sump is simplified; main gallery not claimed.
    sp['valvetrain_pose']=dict(crank_angle_deg=theta,cam_rate=kp.gtsio_cam_rate(),profile_status='illustrative harmonic support envelope; OEM timing not recovered',lobes=kp.lobes(layout),poses=[{k:v for k,v in st.items() if k not in ['pivot','raw_axis','raw_pad']} for st in poses])
    sp['valvetrain_pose']['rocker_endplay_mm']=kp.rocker_endplay()

def self_lifter(a,st,params):
    n=st['n'];name=st['name'];sign=1 if n%2 else -1;axis=(sign,0,0);face=abs(st['follower_face']);cy=params['case_cam_y']['value'];z=st['socket'][2]
    pt=lambda t:(sign*(face+t),cy,z)
    tag=name+str(n)
    def add(suffix,label,fs,keys):return a.add('Lifter'+suffix+tag,label+' / '+tag,'hydraulic_lifters',fs,['A-4-10:'+str(k) for k in keys]+(['A-4-17:39'] if suffix=='Body' else []))
    body=[cylinder('tappet_body_diameter/2',50,pt(0),axis),cylinder(8.3,45,pt(6),axis,op='cut'),tube(13,11.99,2,pt(24),axis,op='cut',label='External feed groove'),cylinder(1.4,27,kp.add(pt(25),(0,-13.5,0)),(0,1,0),op='cut'),tube(8.8,8.3,1.6,pt(46.2),axis,op='cut')]
    add('Body','Ground lifter body and fitted guide surface',body,[1,9,10,11,15])
    add('Plunger','Hollow hydraulic plunger',[revolve([[1.5,18],[8.25,18],[8.25,38],[6.5,38],[6.5,20],[1.5,20]],pt(0),axis),cylinder(1.2,17,kp.add(pt(25),(0,-8.5,0)),(0,1,0),op='cut')],[6,12,13,14])
    add('PlungerSpring','Plunger return spring',[helix(6,.55,12,pt(6),axis,6)],[2])
    add('CheckHousing','Check-valve cage',[tube(3.2,2.6,6.4,pt(11),axis),tube(3.2,1.5,.6,pt(11),axis),cylinder(.8,7,kp.add(pt(14),(0,-3.5,0)),(0,1,0),op='cut')],[3,16])
    add('CheckSpring','Check-valve spring',[helix(1.7,.3,5.65,pt(12),axis,5)],[4])
    add('CheckPlate','Check-valve plate',[cylinder(2.3,.35,pt(17.65),axis)],[5])
    socket=[cylinder(8.2,8,pt(38),axis),cylinder('tappet_socket_oil_diameter/2',10,pt(37),axis,op='cut'),sphere(4.85,pt(45),'cut'),dict(primitive='cone',operation='cut',radius1=4.85,radius2=8.3,height=5,origin=list(pt(45)),axis=list(axis))]
    add('Socket','New-variant shouldered ball socket',socket,[7])
    ring=[tube(8.65,7.8,1.4,pt(46.3),axis),box(170,2,4,[0 if sign>0 else -170,cy-1,z+7.6],op='cut')]
    add('Ring','Split socket retaining ring',ring,[8])
