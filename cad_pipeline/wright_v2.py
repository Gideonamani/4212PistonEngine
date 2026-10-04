"""Source-led static Wright assembly. Read revision-2/research.md before changing it.

Hobbs supplies construction; drawings/mesh guide estimates. This is not a
manufacturing drawing recovery or certified operating mechanism.
"""
import hashlib,json,math
from pathlib import Path
from cad_pipeline.spec import validate_spec
from cad_pipeline.research_gate import review
R=Path(__file__).resolve().parents[1];S=R/'cad-studies/wright-1903/revision-2'

def chain_path(c1,c2,r1,r2,count=38):
    """Equal arc-length closed layout; curved-span chord pitch is approximate."""
    dx,dz=c2[0]-c1[0],c2[1]-c1[1];distance=math.hypot(dx,dz);a=math.atan2(dz,dx);alpha=math.asin((r2-r1)/distance)
    top=a+math.pi/2+alpha;bottom=a-math.pi/2-alpha
    p=lambda c,r,t:(c[0]+r*math.cos(t),c[1]+r*math.sin(t))
    path=[p(c1,r1,top),p(c2,r2,top)]
    for k in range(1,241):path.append(p(c2,r2,top-(math.pi+2*alpha)*k/240))
    path.append(p(c1,r1,bottom))
    for k in range(1,241):path.append(p(c1,r1,bottom-(math.pi-2*alpha)*k/240))
    length=[math.hypot(q[0]-p[0],q[1]-p[1]) for p,q in zip(path,path[1:])];total=sum(length);result=[]
    for k in range(count):
        target=k*total/count;at=0
        for i,l in enumerate(length):
            if at+l>=target:
                t=(target-at)/l;result.append(tuple(path[i][j]*(1-t)+path[i+1][j]*t for j in range(2)));break
            at+=l
    return result,total

def make_spec():
    inv=json.loads((S/'inventory.json').read_text());review(inv)
    params={}
    def par(n,v,refs=('H1',),why='Teaching dimension estimated from the reviewed construction; not a transcribed production dimension.',status='inferred',unit='mm',method=None):
        params[n]=dict(value=v,unit=unit,status=status,source_ids=list(refs),rationale=why)
        if method:params[n]['method']=method
    for n,v,loc in [('bore',101.6,'pp.10–11, 4 in.'),('stroke',101.6,'pp.10–11, 4 in.'),('liner_wall',5.55625,'p.60, 7/32 in.'),('valve_diameter',50.8,'p.58, 2 in.'),('valve_lift',7.9375,'p.57, 5/16 in.')]:par(n,v,why='Hobbs '+loc+'; exact inch-to-mm conversion.',status='specified')
    fit=json.loads((R/'cad-studies/wright-1903/primitive-fits.json').read_text())['regions'];circles=[f['fit'] for f in fit]
    pitch=sum(circles[i+1]['center'][1]-circles[i]['center'][1] for i in range(3))*10/3;radius=sum(f['radius'] for f in circles)*10/4
    par('pitch',round(pitch,3),('M1',),'Mean exterior housing pitch at inferred scale; inherits scale uncertainty.','measured',method='Four reviewed valve-box circles; adjacent Y centers averaged times 10.')
    par('valve_box_radius',round(radius,3),('M1',),'Exterior valve-box radius; low-resolution scan estimate.','measured',method='Four independent reviewed circle fits; mean radius times 10; residuals in parent study.')
    par('mesh_to_mm',10,('M1',),'Candidate imported cm interpretation; no independent visible dimension yet certifies the transform.',unit='ratio')
    for n,v in [('rod_length',245),('piston_length',150),('piston_head_offset',65),('piston_clearance',.3),('sleeve_start',175),('sleeve_length',190),('case_wall',7),('case_radius',116),('valve_x',415),('valve_z',48),('journal_radius',14),('pin_radius',10),('cam_radius',9),('cam_x',350),('cam_z',-105),('ignition_x',391),('ignition_z',-68),('flywheel_radius',190),('chain_pitch',25.4),('spring_wire',1.5),('spring_pitch',5),('valve_stem_radius',3),('cam_base_radius',15)]:par(n,v)
    par('chain_pitch',25.4,why='1-inch pitch teaching estimate from sprocket envelope. Source confirms tooth counts, not this pitch; curved-span chord pitch remains approximate.')
    for n,v,refs in [('crank_teeth',6,('L1','N1')),('cam_teeth',12,('L1','N1')),('cylinders',4,('H1','L1'))]:par(n,v,refs,'Source count; geometry does not authenticate tooth flank shape.','specified','count')
    parts=[]
    def cy(r,h,o,axis=(0,0,1),op='add',label='Cylinder'):return dict(primitive='cylinder',radius=r,height=h,origin=o,axis=list(axis),operation=op,label=label)
    def tube(ro,ri,h,o,axis=(0,0,1),op='add',label='Annulus'):return dict(primitive='tube',radius=ro,inner_radius=ri,height=h,origin=o,axis=list(axis),operation=op,label=label)
    def bx(l,w,h,o,op='add',label='Block'):return dict(primitive='box',length=l,width=w,height=h,origin=o,operation=op,label=label)
    def xz(points,h,y=0,op='add',label='Section'):return dict(primitive='prism',points=[[x,f'-({z})'] for x,z in points],height=h,origin=[0,y,0],axis=[0,1,0],operation=op,label=label)
    def he(r,wire,pitch,h,o,axis=(0,0,1)):return dict(primitive='helix',radius=r,wire_radius=wire,pitch=pitch,height=h,origin=o,axis=list(axis),operation='add',label='Swept spring wire')
    def add(id,label,group,features,mat='steel'):
        parts.append(dict(id=id,label=label,group=group,features=features,material=mat,evidence='Pending inventory linkage'))
    def bolt(id,label,group,r,h,o,axis=(0,0,1)):
        add(id,label,group,[cy(r,h,o,axis),cy(r*1.8,4,o,axis)],'steel')
    length='3*pitch+120';y0=-60
    outer=[(-116,0),(-108,-45),(-78,-91),(-23,-116),(85,-108),(175,-88),(365,-66),(365,66),(175,66),(60,101),(-25,114),(-83,81),(-110,35)]
    bay=[(-107,0),(-99,-42),(-72,-82),(-21,-106),(85,-99),(168,-80),(168,160),(-130,160)]
    case=[xz(outer,length,y0,label='One-piece cast body section'),xz(bay,'3*pitch+106',-53,'cut','Open crank space'),bx(182,'3*pitch+106',112,[176,-53,-56],'cut','Shared water-jacket cavity')]
    # Integral ribs and bearing seats. Three intermediate keyed access ribs.
    for i in range(3):
        y=f'({i}+.5)*pitch-4'
        case += [xz([(-106,-2),(-99,-42),(-72,-82),(-21,-106),(85,-99),(168,-80),(168,63),(47,78),(-64,42)],8,y,label='Internal bearing rib'),cy('journal_radius+3',10,[0,f'({y})-1',0],(0,1,0),'cut','Rib bearing opening'),xz([(-15,0),(0,15),(65,80),(-65,80)],10,f'({y})-1','cut','Keyed cap/shaft access'),cy(5,30,[80,f'({y})-1',-98],(0,1,0),'cut','Sump compartment drain')]
    for i in range(4):
        y=f'{i}*pitch'
        case.append(cy('bore/2+liner_wall+.25',220,[155,y,0],(1,0,0),'cut','Liner socket'))
        case.append(bx(6,76,17,[218,f'({y})-38',65],label='Integral hot-plate baffle'))
    for i,(x,y) in enumerate([(-65,-60),(335,-60),(-65,'3*pitch+20'),(335,'3*pitch+20')],1):
        case += [bx(24,40,110,[x,y,-168],label='Integral mounting leg'),bx(58,48,10,[x-17,f'({y})-4',-170],label='Mounting foot'),cy(4.4,14,[x+12,f'({y})+20',-172],op='cut',label='Mounting hole')]
        bolt(f'MountBolt{i}',f'Mounting bolt {i}','crankcase',4,20,[x+12,f'({y})+20',-174])
    # Three camshaft support lugs and three ignition support lugs stay on the casting.
    stations=[-48,'1.5*pitch','3*pitch+48']
    for y in stations:
        case += [bx(32,16,54,[334,f'({y})-8',-119],label='Cam bearing lug'),cy(12.6,20,['cam_x',f'({y})-10','cam_z'],(0,1,0),'cut','Cam bearing seat'),bx(50,16,20,[350,f'({y})-8',-75],label='Ignition lug bridge'),bx(26,16,35,[378,f'({y})-8',-85],label='Ignition bearing lug'),cy(8.5,20,['ignition_x',f'({y})-10','ignition_z'],(0,1,0),'cut','Ignition shaft seat')]
    for i in range(4):case += [bx(26,8,75,[360,f'{i}*pitch-4',-140],label='Rocker pivot support'),cy(4.2,18,[382,f'{i}*pitch-9',-126],(0,1,0),'cut','Rocker pivot bore')]
    case += [cy(16,30,[270,'pitch/2',-83],(0,0,1),label='Lower water connection boss'),cy(10,38,[270,'pitch/2',-85],op='cut',label='Coolant inlet passage')]
    for y in [0,'3*pitch']:case+=[cy(16,14,[285,y,64],label='Upper water-return boss'),cy(10,30,[285,y,54],op='cut',label='Water return passage')]
    # Bound the baffled induction chamber with integral ribs; sheet lid is separate.
    case += [bx(168,4,18,[207,-43,65],label='Hot-plate front perimeter rib'),bx(168,4,18,[207,'3*pitch+39',65],label='Hot-plate rear perimeter rib'),bx(4,'3*pitch+88',18,[207,-43,65],label='Hot-plate inner perimeter rib'),bx(4,'3*pitch+88',18,[371,-43,65],label='Hot-plate outlet perimeter rib')]
    for i in range(4):case.append(cy(60.6,4,[362,f'{i}*pitch',0],(1,0,0),'cut','Liner head-flange counterbore'))
    for yp in [-48,.5*pitch,1.5*pitch,2.5*pitch,3*pitch+48]:
        case.append(cy(17.1,26,[0,yp-13,0],(0,1,0),'cut','Main bearing/journal through seat'))
        caprelief=[(29.5*math.cos(math.pi/4+k*math.pi/24),29.5*math.sin(math.pi/4+k*math.pi/24)) for k in range(25)]
        case.append(xz(caprelief,20,yp-10,'cut','Diagonal upper-cap assembly relief'))
    add('Crankcase','Integral casting, jacket, ribs, baffles and feet','crankcase',case,'aluminium')
    # Thin source-contour closure: polygonal approximation retains sloping crown.
    cover=[xz([(-116,0),(-110,35),(-83,81),(-25,114),(60,101),(175,66),(175,68),(60,103),(-25,116),(-85,83),(-112,37),(-118,0)],length,y0,label='Thin steel top closure')]
    add('Cover','Sloping sheet-steel crankcase cover','cover',cover)
    end=[xz(outer,3,-63),cy('journal_radius+.3',5,[0,-64,0],(0,1,0),'cut','Crankshaft clearance')]
    add('EndPlate','Detachable timing-end access plate','bearings',end,'aluminium')
    # Five main stations at each side of the four throws. 45-degree split caps/shells.
    mainys=[-.5*pitch,.5*pitch,1.5*pitch,2.5*pitch,3.5*pitch]
    for i,y in enumerate(mainys):
        yp=-48 if i==0 else ('3*pitch+48' if i==4 else f'{i-.5}*pitch')
        cap=[xz([(-27,27),(-34,20),(-6,-8),(22,20),(29,13),(49,33),(21,59)],16,f'({yp})-8'),cy('journal_radius+3',18,[0,f'({yp})-9',0],(0,1,0),'cut','Main bearing seat')]
        # Cap outline anchored around the diagonal, with an overlapping rounded ring.
        cap=[cy(29,16,[0,f'({yp})-8',0],(0,1,0)),xz([(-50,-50),(50,-50),(50,50)],18,f'({yp})-9','cut','45-degree bearing-cap split'),cy('journal_radius+3',18,[0,f'({yp})-9',0],(0,1,0),'cut')]
        add(f'MainCap{i}',f'Main bearing cap {i+1}, diagonal split','bearings',cap,'aluminium')
        for side in ['Lower','Upper']:
            cutpts=[(-50,-50),(50,-50),(50,50)] if side=='Upper' else [(-50,-50),(50,50),(-50,50)]
            shell=[tube('journal_radius+3','journal_radius+.2',15,[0,f'({yp})-7.5',0],(0,1,0)),xz(cutpts,17,f'({yp})-8.5','cut','Diagonal split')]
            add(f'MainBearing{i}_{side}',f'Main bearing {i+1} {side.lower()} lining','bearings',shell,'babbitt')
    # Straight pin/cheek crankshaft, deliberately without counterweights.
    crank=[cy('journal_radius',61,[0,-80,0],(0,1,0))]
    for i,sign in enumerate([1,-1,-1,1]):
        y=f'{i}*pitch';cx=f'{sign}*stroke/2'
        xmin='-journal_radius' if sign==1 else '-stroke/2-journal_radius'
        for dy in [-19,11]:crank += [bx('stroke/2+2*journal_radius',8,'2*journal_radius',[xmin,f'({y})+{dy}','-journal_radius'],label='Crank cheek'),cy('journal_radius',8,[cx,f'({y})+{dy}',0],(0,1,0),label='Rounded crank cheek')]
        crank.append(cy('journal_radius',22,[cx,f'({y})-11',0],(0,1,0),label='Crankpin'))
        crank.append(cy('journal_radius','pitch-38' if i<3 else 160,[0,f'({y})+19',0],(0,1,0),label='Main journal'))
    add('Crankshaft','Four-throw plain crankshaft, no counterweights','crankshaft',crank)
    # Cylinders, ring pins, separate rod cap/bolts and pin clamp.
    for i,sign in enumerate([1,-1,-1,1],1):
        y=f'{i-1}*pitch';cx=f'{sign}*stroke/2';px=f'({cx})+rod_length'
        sleeve=[tube('bore/2+liner_wall','bore/2','sleeve_length',['sleeve_start',y,0],(1,0,0)),cy('bore/2+liner_wall+4',2,[363,y,0],(1,0,0),label='Head-end flange'),cy(25,43,[364,y,0],(1,0,0),label='Threaded transfer boss'),cy(20,45,[363,y,0],(1,0,0),'cut','Gas transfer bore'),cy(3,15,[200,y,46],label='Upper thrust oil drilling',op='cut'),bx(10,18,25,[172,f'({y})-9',-70],'cut','Assembly tool slot')]
        add(f'Sleeve{i}',f'Short cast-iron liner {i} and head boss','cylinders',sleeve,'cast_iron')
        add(f'HeadGasket{i}',f'Common liner/case/box gasket {i}','cylinders',[tube(62,25.2,2,[365,y,0],(1,0,0))],'gasket')
        piston=[cy('(bore-piston_clearance)/2','piston_length',[f'({px})+piston_head_offset-piston_length',y,0],(1,0,0)),cy('(bore-piston_clearance)/2-5','piston_length-9',[f'({px})+piston_head_offset-piston_length-.1',y,0],(1,0,0),'cut','Hollow skirt')]
        for side in [-1,1]:piston.append(cy(16,21,[px,f'({y})+{side}*24',0],(0,side,0),label='Pin boss'))
        piston.append(cy('pin_radius+.1',110,[px,f'({y})-55',0],(0,1,0),'cut','Pin bore'))
        for k in range(3):
            x=f'({px})+{41+7*k}';piston.append(tube('bore/2+1','(bore-piston_clearance)/2-2',4,[x,y,0],(1,0,0),'cut','Compression-ring groove'))
            add(f'Ring{i}_{k}',f'Piston {i} compression ring {k+1}','pistons',[tube('bore/2-.05','bore/2-2',3.8,[f'({x})+.1',y,0],(1,0,0)),bx(5,7,1.2,[f'({x})-.5',f'({y})+bore/2-5',-.6],'cut','Pinned split gap')],'cast_iron')
            add(f'RingPeg{i}_{k}',f'Piston {i} ring peg {k+1}','pistons',[cy(.5,5,[f'({x})+2',f'({y})+bore/2-4',0],(0,1,0))])
        add(f'Piston{i}',f'Long cast-iron piston {i}','pistons',piston,'cast_iron')
        add(f'WristPin{i}',f'Locked wrist pin {i}','pistons',[cy('pin_radius',90,[px,f'({y})-45',0],(0,1,0))])
        bolt(f'PinLock{i}',f'Wrist-pin setscrew {i}','pistons',2.5,12,[px,f'({y})+35',10],(0,0,1))
        add(f'RodTube{i}',f'Connecting rod {i} seamless steel tube','rods',[tube(8,5,'rod_length-36',[f'({cx})+18',y,0],(1,0,0))])
        big=[cy(26,18,[cx,f'({y})-9',0],(0,1,0)),bx(24,18,52,[f'({cx})-12',f'({y})-9',-26]),cy(10,26,[cx,y,0],(1,0,0)),cy('journal_radius+.2',20,[cx,f'({y})-10',0],(0,1,0),'cut'),bx(40,25,80,[f'({cx})-40',f'({y})-12.5',-40],'cut','Split cap face'),cy(8.1,25,[f'({cx})+3',y,0],(1,0,0),'cut','Thread engagement socket')]
        add(f'BigEnd{i}',f'Rod {i} phosphor-bronze big end','rods',big,'bronze')
        cap=[cy(26,18,[cx,f'({y})-9',0],(0,1,0)),bx(24,18,52,[f'({cx})-12',f'({y})-9',-26]),cy('journal_radius+.2',20,[cx,f'({y})-10',0],(0,1,0),'cut'),bx(40,25,80,[cx,f'({y})-12.5',-40],'cut','Cap split')]
        add(f'BigCap{i}',f'Rod {i} separate bronze bearing cap','rods',cap,'bronze')
        add(f'BigShim{i}',f'Rod {i} big-end shim','rods',[bx(.4,18,52,[f'({cx})-.2',f'({y})-9',-26]),cy('journal_radius+.2',20,[cx,f'({y})-10',0],(0,1,0),'cut')],'bronze')
        # Two disconnected shim strips are intentionally kept connected by a narrow outside bridge.
        parts[-1]['features']=[xz([(float(sign)*50.8-.2,-26),(float(sign)*50.8+.2,-26),(float(sign)*50.8+.2,26),(float(sign)*50.8-.2,26)],18,f'({y})-9'),cy('journal_radius+.2',20,[cx,f'({y})-10',0],(0,1,0),'cut'),bx(1,1,52,[f'({cx})-.5',f'({y})-9',-26],label='Shim carrier bridge')]
        # One thin upper shim is a single part; lower matching shim is represented by the cap gap.
        parts[-1]['features']=[bx(.4,18,10,[f'({cx})-.2',f'({y})-9',16])]
        for suffix,z in [('A',21),('B',-21)]:bolt(f'BigBolt{suffix}{i}',f'Rod {i} big-end bolt/nut {suffix}','rods',3.2,34,[f'({cx})-17',y,z],(1,0,0))
        add(f'BigLock{i}',f'Rod {i} nut locking strip','rods',[bx(2,7,50,[f'({cx})-19',f'({y})-3.5',-25])])
        little=[tube(20,'pin_radius+.2',18,[px,f'({y})-9',0],(0,1,0)),cy(10,27,[f'({px})-27',y,0],(1,0,0)),cy('pin_radius+.2',20,[px,f'({y})-10',0],(0,1,0),'cut'),cy(8.1,21,[f'({px})-30',y,0],(1,0,0),'cut','Thread engagement socket'),bx(1.2,22,22,[px,f'({y})-11',7],'cut','Little-end clamp split')]
        add(f'LittleEnd{i}',f'Rod {i} split bronze little end','rods',little,'bronze')
        bolt(f'LittleClamp{i}',f'Rod {i} little-end clamping bolt','rods',2.5,20,[f'({px})-10',y,16],(1,0,0))
        for suffix,x in [('A',f'({cx})+21'),('B',f'({px})-21')]:add(f'RodPin{suffix}{i}',f'Rod {i} threaded-joint retaining pin {suffix}','rods',[cy(1.5,20,[x,f'({y})-10',0],(0,1,0))])
    # Four transverse valve boxes. Lower slots are obround longitudinal apertures.
    for i in range(1,5):
        y=f'{i-1}*pitch';x='valve_x'
        housing=[tube('valve_box_radius','valve_box_radius-5',130,[x,y,-65]),cy(29,50,[367,y,0],(1,0,0),label='Liner/jacket mating boss'),cy(62,4,[367,y,0],(1,0,0),label='Common-joint clamping flange'),cy(25.3,40,[366,y,0],(1,0,0),'cut','Liner engagement bore'),cy(20,53,[366,y,0],(1,0,0),'cut','Gas transfer bore'),cy(12,18,['valve_x+25',y,0],(1,0,0),label='Igniter neck'),cy(5.3,25,['valve_x+22',y,0],(1,0,0),'cut','Igniter bearing bore')]
        for k in range(8):
            a=2*math.pi*k/8;dx,dz=math.cos(a),math.sin(a);origin=[f'valve_x+{dx*(radius-8)}',f'({y})+{dz*(radius-8)}',-54]
            # Three overlapping drills create each longitudinal port; no disconnected cut tools.
            for zz in [-54,-50,-46]:housing.append(cy(3,13,[origin[0],origin[1],zz],(dx,dz,0),'cut','Exhaust obround aperture'))
        add(f'ValveBox{i}',f'Uncooled transverse combustion/valve box {i}','valve_boxes',housing,'cast_iron')
        for v,sg in [('Intake',1),('Exhaust',-1)]:
            axis=(0,0,sg);z=sg*48
            head=[cy('valve_diameter/2',2.5,[x,y,z],axis),dict(primitive='cone',radius1='valve_diameter/2',radius2='valve_diameter/2-2',height=2,origin=[x,y,sg*50.5],axis=list(axis),operation='add',label='Estimated 45-degree seating face'),cy('valve_stem_radius+.1',6,[x,y,sg*47],axis,'cut','Separate stem joint')]
            add(f'{v}Head{i}',f'{v} valve {i} separate cast-iron head','valves',head,'cast_iron')
            add(f'{v}Stem{i}',f'{v} valve {i} steel stem','valves',[cy('valve_stem_radius',69,[x,y,sg*46],axis)])
            cage=[tube('valve_box_radius-5.15','valve_diameter/2+.15',32,[x,y,sg*48],axis),cy('valve_box_radius-5.15',2,[x,y,sg*50.5],axis,label='Valve seat land'),dict(primitive='cone',radius1='valve_diameter/2+.15',radius2='valve_diameter/2-1.85',height=2,origin=[x,y,sg*50.5],axis=list(axis),operation='cut',label='Estimated conical cage seat'),cy('valve_box_radius-5.15',5,[x,y,sg*75],axis),cy('valve_stem_radius+.2',9,[x,y,sg*73],axis,'cut','Guide bore')]
            for k in range(4):
                a=k*math.pi/2;dx,dy=math.cos(a),math.sin(a)
                # Wide radial cuts leave four narrow legs between seat and guide.
                tool=bx(26,26,19,[2,-13,54],op='cut',label='Cage gas-flow window');tool['axis']=[0,0,1]
                # Polygon in global XY avoids implicit box rotations and mirrors lower z.
                p2=[]
                for u,w in [(2,-11),(42,-11),(42,11),(2,11)]:p2.append([f'valve_x+{u*dx-w*dy}',f'({y})+{u*dy+w*dx}'])
                cage.append(dict(primitive='prism',points=p2,height=19,origin=[0,0,54 if sg==1 else -73],axis=[0,0,1],operation='cut',label='Four-legged cage window'))
            add(f'{v}Cage{i}',f'{v} valve {i} four-legged seat/guide cage','valves',cage,'cast_iron')
            add(f'{v}Retainer{i}',f'{v} cage {i} retaining ring nut','valves',[tube('valve_box_radius','valve_stem_radius+1',5,[x,y,sg*80],axis)],'steel')
            add(f'{v}Spring{i}',f'{v} valve {i} helical spring','valves',[he(9,'spring_wire','spring_pitch',25.5,[x,y,sg*86.5],axis)])
            add(f'{v}SpringWasher{i}',f'{v} valve {i} spring washer','valves',[tube(12,'valve_stem_radius+.2',2.5,[x,y,sg*113],axis)])
    # Source hollow exhaust shaft, solid breaker shaft, bearings and actual rollers.
    add('Camshaft','Hollow exhaust camshaft','camshafts',[tube('cam_radius',5,length,['cam_x',y0,'cam_z'],(0,1,0))])
    add('IgnitionShaft','Solid make-and-break camshaft','camshafts',[cy(5,length,['ignition_x',y0,'ignition_z'],(0,1,0))])
    for i,y in enumerate(stations):
        add(f'CamBearing{i}',f'Exhaust camshaft plain bearing {i+1}','bearings',[tube(12.5,'cam_radius+.2',15,['cam_x',f'({y})-7.5','cam_z'],(0,1,0))],'babbitt')
        add(f'IgnitionBearing{i}',f'Ignition shaft bearing {i+1}','bearings',[tube(8.4,5.2,15,['ignition_x',f'({y})-7.5','ignition_z'],(0,1,0))],'babbitt')
    for suffix,y in [('A',-57),('B',-39)]:add('CamWasher'+suffix,'Camshaft locating washer '+suffix,'camshafts',[tube(14,'cam_radius',2,['cam_x',y,'cam_z'],(0,1,0))])
    for i in range(1,5):
        y=f'{i-1}*pitch'
        # Downward lobe and cam roller meet at z=-120. Local lobe law is estimated.
        cam=[cy('cam_base_radius',10,['cam_x',f'({y})-5','cam_z'],(0,1,0)),cy(11,10,['cam_x',f'({y})-5',-110],(0,1,0)),cy('cam_radius',12,['cam_x',f'({y})-6','cam_z'],(0,1,0),'cut')]
        add(f'ExhaustCam{i}',f'Exhaust cam lobe {i}, illustrative dwell profile','camshafts',cam)
        # Cheeks carry cam roller (350,-131), pivot (382,-126), valve roller (415,-125).
        outline=[(337,-138),(351,-142),(385,-137),(423,-135),(428,-125),(419,-117),(381,-116),(349,-121),(337,-128)]
        for suffix,dy in [('Left',-8),('Right',6)]:
            feats=[xz(outline,2,f'({y})+{dy}')]
            for xx,zz,rr in [(350,-131,3),(382,-126,4),(415,-125,3)]:feats.append(cy(rr,4,[xx,f'({y})+{dy-1}',zz],(0,1,0),'cut','Axle/pivot hole'))
            add(f'Rocker{suffix}{i}',f'Exhaust rocker {i} sheet-steel {suffix.lower()} cheek','rockers',feats)
        for stem,xx,zz,rr in [('Cam',350,-131,10),('Valve',415,-125,10)]:
            add(f'{stem}Roller{i}',f'Rocker {i} {stem.lower()} roller','rockers',[tube(rr,3.15,12,[xx,f'({y})-6',zz],(0,1,0))])
            add(f'{stem}RollerAxle{i}',f'Rocker {i} {stem.lower()} roller axle','rockers',[cy(3,16,[xx,f'({y})-8',zz],(0,1,0))])
        add(f'RockerPivot{i}',f'Rocker {i} pivot axle','rockers',[cy(4,23,[382,f'({y})-11.5',-126],(0,1,0))])
        add(f'IgnitionCam{i}',f'Bent-strip igniter cam {i}','ignition',[xz([(382,-69),(383,-59),(393,-53),(400,-59),(401,-69),(399,-69),(398,-60),(393,-56),(385,-61),(384,-69)],8,f'({y})-4'),tube(7,5.1,8,[391,f'({y})-4',-68],(0,1,0)),cy(5.2,10,[391,f'({y})-5',-68],(0,1,0),'cut')])
    # Timing sprockets with roller pockets. Profile is explicitly not a manufactured tooth form.
    sr=25.4;br=25.4/(2*math.sin(math.pi/12))
    def wheel(id,label,group,cx,cz,rad,teeth,y,width,bore):
        features=[cy(rad+3,width,[cx,y,cz],(0,1,0)),cy(bore,width+2,[cx,y-1,cz],(0,1,0),'cut')]
        for k in range(teeth):
            a=k*2*math.pi/teeth;features.append(cy(4.3,width+2,[cx+rad*math.cos(a),y-1,cz+rad*math.sin(a)],(0,1,0),'cut','Roller pocket / illustrative tooth'))
        add(id,label,group,features)
    wheel('CrankSprocket','6-tooth crank timing sprocket','timing',0,0,sr,6,-80,10,14.2)
    wheel('CamSprocket','12-tooth exhaust timing sprocket','timing',350,-105,br,12,-80,10,9.2)
    points,total=chain_path((0,0),(350,-105),sr,br,38)
    chainids=[]
    for k,p in enumerate(points):
        q=points[(k+1)%len(points)];dx,dz=q[0]-p[0],q[1]-p[1];l=math.hypot(dx,dz);nx,nz=-dz/l,dx/l
        outline=[(p[0]-dx/l*5+nx*5,p[1]-dz/l*5+nz*5),(q[0]+dx/l*5+nx*5,q[1]+dz/l*5+nz*5),(q[0]+dx/l*5-nx*5,q[1]+dz/l*5-nz*5),(p[0]-dx/l*5-nx*5,p[1]-dz/l*5-nz*5)]
        for side,y in [('A',-83),('B',-69)]:
            id=f'ChainPlate{k}_{side}';chainids.append(id)
            features=[xz(outline,2,y)]
            for pt in [p,q]:features.append(cy(2.7,4,[pt[0],y-1,pt[1]],(0,1,0),'cut','Roller pin aperture'))
            add(id,f'Timing chain link {k+1} plate {side}','timing',features)
        id=f'ChainRoller{k}';chainids.append(id);add(id,f'Timing chain roller {k+1}','timing',[tube(4.1,2.6,12,[p[0],-81,p[1]],(0,1,0))])
    add('ChainTensioner','Hardwood timing-chain tensioner block','timing',[bx(12,16,35,[170,-91,-88])],'wood')
    add('TensionerBracket','Adjustable chain tensioner bracket','timing',[bx(5,28,42,[166,-97,-94]),cy(3,10,[165,-84,-73],(1,0,0),'cut')])
    # Spur gear pair tangent at centers; sleeve includes a physical 45-degree slot.
    gearrad=math.hypot(41,37)/2
    wheel('ExhaustGear','Exhaust-to-ignition spur driver','ignition',350,-105,gearrad,18,-58,8,9.2)
    wheel('IgnitionGear','Sliding ignition spur gear and slotted sleeve','ignition',391,-68,gearrad,18,-58,8,5.2)
    parts[-1]['features'] += [tube(10,5.2,34,[391,-50,-68],(0,1,0)),dict(primitive='prism',points=[[385,-46],[397,-34],[397,-28],[385,-40]],height=25,origin=[0,0,-81],axis=[0,0,1],operation='cut',label='45-degree sleeve slot')]
    add('IgnitionDrivePin','Ignition shaft pin in sleeve slot','ignition',[cy(2.5,22,[380,-38,-68],(1,0,0))])
    add('IgnitionGearSpring','Sliding ignition gear return spring','ignition',[he(7.5,1.1,4,18,[391,-16,-68],(0,1,0))])
    add('AdvanceCam','Spark timing lever cam','ignition',[cy(12,8,[391,-62,-92],(0,1,0)),cy(3,10,[391,-63,-92],(0,1,0),'cut')])
    add('AdvanceLever','Spark advance/retard hand lever','ignition',[xz([(386,-94),(396,-94),(401,-156),(397,-178),(383,-178),(380,-170)],6,-65),cy(3,8,[391,-66,-92],(0,1,0),'cut')])
    add('AdvanceBracket','Spark-control pivot bracket','ignition',[bx(24,10,24,[379,-72,-103]),cy(3.2,12,[391,-73,-92],(0,1,0),'cut')],'aluminium')
    # Chamber contacts and paired snap mechanism, insulated feed and parallel busbar.
    for i in range(1,5):
        y=f'{i-1}*pitch'
        add(f'FixedElectrode{i}',f'Chamber {i} insulated fixed electrode','ignition',[cy(2.5,47,[396,f'({y})+14',8],(1,0,0)),cy(4,3,[396,f'({y})+14',8],(1,0,0))],'platinum')
        add(f'ElectrodeInsulator{i}',f'Chamber {i} electrode insulator','ignition',[tube(6,2.7,16,[437,f'({y})+14',8],(1,0,0))],'insulator')
        add(f'IgniterBearing{i}',f'Chamber {i} oscillating igniter bearing','ignition',[tube(5.1,2.6,22,[437,y,0],(1,0,0))],'bronze')
        add(f'IgniterSeal{i}',f'Chamber {i} igniter sealing disc','ignition',[tube(8,2.7,1,[458,y,0],(1,0,0))],'gasket')
        add(f'MovingContact{i}',f'Chamber {i} moving contact and shaft','ignition',[cy(2.5,56,[402,y,0],(1,0,0)),bx(4,14,3,[400,y,0]),cy(2,6,[400,f'({y})+12',3])],'steel')
        add(f'IgniterLever{i}',f'Chamber {i} external igniter shaft lever','ignition',[bx(4,8,47,[455,f'({y})-4',-44]),cy(7,4,[455,y,0],(1,0,0)),cy(2.6,6,[454,y,0],(1,0,0),'cut')])
        add(f'TripLever{i}',f'Chamber {i} cam-loaded snap lever','ignition',[xz([(387,-63),(395,-67),(460,-44),(459,-34),(390,-55)],8,f'({y})-4'),cy(3,10,[456,f'({y})-5',-40],(0,1,0),'cut')])
        add(f'IgnitionMainSpring{i}',f'Chamber {i} igniter mainspring','ignition',[he(5,1,4,20,[450,f'({y})-16',-34],(0,1,0))])
        add(f'IgnitionInterSpring{i}',f'Chamber {i} lever inter-spring','ignition',[he(5.2,.8,3.5,14,[450,f'({y})-12',-43],(0,1,0))])
        add(f'BusLink{i}',f'Busbar branch to igniter {i}','ignition',[cy(1.7,18,[445,f'({y})+14',8],(1,0,0))],'copper')
    # Bent busbar runs outside the chambers; small round section avoids ghost plate.
    add('Busbar','Common positive busbar, four parallel branches','ignition',[cy(2, '3*pitch+30',[464,-15,8],(0,1,0))],'copper')
    # Flywheel web/rim/hub/key. Drive wheels remain at engine-side shaft only.
    fy='3*pitch+70'
    fly=[cy('flywheel_radius',7,[0,fy,0],(0,1,0)),tube('flywheel_radius','flywheel_radius-18',18,[0,f'({fy})-5',0],(0,1,0)),cy(28,35,[0,f'({fy})-14',0],(0,1,0)),cy(14.2,39,[0,f'({fy})-16',0],(0,1,0),'cut'),bx(5,40,3,[-2.5,f'({fy})-16',12],'cut','Keyway')]
    add('Flywheel','Cast-iron rim/web/hub flywheel','flywheel',fly,'cast_iron')
    add('FlywheelKey','Flywheel shaft key','flywheel',[bx(4.8,30,3,[-2.4,f'({fy})-10',12])])
    for suffix,y in [('A',3*pitch+112),('B',3*pitch+136)]:wheel('PropellerDrive'+suffix,'Engine-side propeller drive sprocket '+suffix,'flywheel',0,0,31,8,y,8,14.2)
    # Shallow steel intake and baffled hot plate share the casting's hot wall.
    mixer=[bx(166,'3*pitch+86',2,[209,-43,83]),cy(20,5,[270,'1.5*pitch',82],op='cut',label='Air-can inlet')]
    add('HotPlateCover','Sheet-steel hot-plate vaporizer cover','induction',mixer)
    add('AirCan','Open beaded air inlet / gravity-fuel can','induction',[tube(22,20,83,[270,'1.5*pitch',85]),tube(24,20,3,[270,'1.5*pitch',165]),tube(24,20,3,[270,'1.5*pitch',85]),cy(3.2,8,[245,'1.5*pitch',153],(1,0,0),'cut','Gravity-fuel nozzle opening')])
    manifold=[bx(90,'3*pitch+88',19,[373,-44,61]),bx(86,'3*pitch+84',15,[375,-42,63],'cut','Low sheet-steel intake gallery')]
    for i in range(4):manifold.append(cy('valve_box_radius+.25',5,['valve_x',f'{i}*pitch',60],op='cut',label='Open suction-valve connection'))
    manifold.append(bx(5,50,14,[371,'1.5*pitch-25',64],'cut','Hot-plate outlet into intake box'))
    for i in range(4):manifold.append(cy('valve_box_radius-5',5,['valve_x',f'{i}*pitch',77],op='cut',label='Guide clearance in manifold lid'))
    add('IntakeManifold','Low sheet-steel intake manifold','induction',manifold)
    # Generic connected pipe made of overlapping hollow cylindrical legs.
    def pipe(id,label,group,points,ro,ri,mat='copper'):
        outer=[];inner=[]
        for p,q in zip(points,points[1:]):
            d=[q[j]-p[j] for j in range(3)];l=math.sqrt(sum(v*v for v in d));axis=[v/l for v in d]
            outer.append(cy(ro,l+ro,p,axis));inner.append(cy(ri,l+2*ro,[p[j]-axis[j]*ro for j in range(3)],axis,'cut','Continuous pipe bore'))
        add(id,label,group,outer+inner,mat)
    mid=1.5*pitch
    pipe('FuelLine','Gravity fuel line and nozzle','induction',[(230,mid,215),(230,mid,153),(270,mid,153)],3,1.5)
    for name,z in [('FuelShutoff',197),('FuelMeter',177)]:add(name,'Fuel '+('on/off cock' if name=='FuelShutoff' else 'metering cock'),'induction',[cy(6,13,[230,mid,z]),cy(2.5,15,[230,mid,z-1],op='cut'),bx(22,4,3,[219,mid-2,z+12])],'bronze')
    for name,y in [('WaterReturnA',0),('WaterReturnB',3*pitch)]:add(name,'Upper water-return fitting '+name[-1],'cooling',[tube(13,10,24,[285,y,76])],'bronze')
    add('WaterInlet','Lower jacket water-feed fitting','cooling',[tube(13,10,16,[270,'pitch/2',-99])],'bronze')
    pipe('WaterHoseIn','Lower radiator feed hose stub','cooling',[(270,pitch/2,-98),(270,-45,-98),(270,-45,-160)],14,10,'rubber')
    for name,y in [('WaterHoseA',0),('WaterHoseB',3*pitch)]:pipe(name,'Upper radiator return hose '+name[-1],'cooling',[(285,y,95),(285,y,160),(330,y,160)],14,10,'rubber')
    # Rebuilt-engine lubrication accessory: pump chamber, two illustrative spur gears.
    pump=[bx(45,42,28,[235,-64,-142]),cy(11,24,[248,-44,-144],op='cut'),cy(11,24,[269,-44,-144],op='cut')]
    add('OilPumpCase','Rebuilt-engine oil-pump casing','lubrication',pump,'aluminium')
    add('OilPumpCover','Oil-pump detachable cover','lubrication',[bx(45,42,3,[235,-64,-145]),cy(3,5,[248,-44,-146],op='cut')])
    for i,x in enumerate([248,269],1):
        teeth=[cy(10,18,[x,-44,-141]),cy(2.8,20,[x,-44,-142],op='cut')]
        for k in range(12):
            a=2*math.pi*k/12;teeth.append(cy(1.4,20,[x+10*math.cos(a),-44+10*math.sin(a),-142],op='cut',label='Approximate pump tooth gap'))
        add(f'OilPumpGear{i}',f'Oil pump gear {i}, illustrative profile','lubrication',teeth)
    # Do not fabricate the disputed drive route: section/dimensions are unavailable.
    pipe('OilReturnGallery','Sump oil return gallery','lubrication',[(75,-44,-109),(75,3*pitch+20,-109)],4,2)
    pipe('OilFeedHose','Pump delivery hose','lubrication',[(270,-44,-128),(310,-44,-128),(310,-44,62),(200,-44,62)],4,2,'rubber')
    add('OilFeedUnion','Oil-pump delivery union','lubrication',[tube(5,2,14,[270,-44,-133])],'bronze')
    pipe('OilDistributor','Four-cylinder oil distributor','lubrication',[(200,-44,62),(200,3*pitch+10,62)],4,2)
    distributor=next(p for p in parts if p['id']=='OilDistributor')
    for i in range(4):distributor['features'].append(cy(1.4,20,[200,f'{i}*pitch',46],op='cut',label='Oil-jet branch opening'))
    for i in range(1,5):add(f'OilJet{i}',f'Cylinder {i} upper thrust oil jet','lubrication',[tube(2.8,1.4,18,[200,f'{i-1}*pitch',46])],'bronze')
    # Purchased generator exterior; friction wheel tangent to the flywheel's right rim.
    gy=3*pitch+77;mx=230
    add('MagnetoBase','Generator mounting base and feet','generator',[bx(95,65,14,[196,gy-34,-140]),bx(60,48,27,[214,gy-25,-126])],'aluminium')
    mag=[xz([(202,-65),(202,25),(210,45),(226,54),(245,54),(266,43),(279,25),(279,-65),(270,-65),(270,20),(261,35),(244,43),(228,43),(216,35),(211,20),(211,-65)],32,gy-16)]
    add('MagnetoMagnet','Generator horseshoe permanent magnet','generator',mag)
    for i,x in enumerate([207,274],1):add(f'MagnetoCoil{i}',f'Generator coil {i} envelope','generator',[tube(19,6,67,[x,gy,-75])],'copper')
    add('MagnetoArmature','Generator armature envelope','generator',[cy(18,45,[230,gy-22.5,-75],(0,1,0))])
    add('MagnetoShaft','Generator armature shaft','generator',[cy(4,80,[230,gy-50,-75],(0,1,0))])
    # Offset generator wheel is driven via shaft extension; contact x,z chosen radially.
    wheelcenter=(math.sqrt(230**2-75**2),-75);wheelradius=230-190
    add('MagnetoDriveWheel','Generator friction wheel at flywheel rim','generator',[cy(wheelradius,9,[wheelcenter[0],gy-10,wheelcenter[1]],(0,1,0)),cy(4.2,11,[wheelcenter[0],gy-11,wheelcenter[1]],(0,1,0),'cut')],'rubber')
    # Keep shaft and armature centered on the tangent wheel's true axis.
    for id in ['MagnetoShaft','MagnetoArmature']:
        for f in next(p for p in parts if p['id']==id)['features']:f['origin'][0]=wheelcenter[0]
    oiler=[cy(4,28,[wheelcenter[0],gy+18,-65]),cy(11,23,[wheelcenter[0],gy+18,-40]),cy(12,3,[wheelcenter[0],gy+18,-17])]
    add('SightOiler','Generator sight-feed lubricator','generator',oiler,'bronze')
    pipe('GeneratorLead','Generator positive lead to busbar','ignition',[(270,gy,-90),(464,gy,-90),(464,gy,8),(464,3*pitch,8)],1.8,.4,'copper')
    pipe('GroundLead','Generator ground lead to casting foot','ignition',[(214,gy,-112),(214,gy-60,-150),(335,3*pitch+40,-150)],1.8,.4,'copper')
    # Final component mapping reflects explicitly reviewed chain link count, not hidden extras.
    for c in inv['components']:
        if c['id']=='S06':c['part_ids']=['CrankSprocket','CamSprocket']+chainids
        if c['id']=='14':
            c.update(disposition='deferred',part_ids=[],decision='Narrative crankshaft worm/cross-shaft route selected as research direction; conflicting Figure 5 cam drive and unavailable drive dimensions prevent defensible placed geometry. Acquire chosen-lineage drive drawing.')
    (S/'inventory.json').write_text(json.dumps(inv,indent=2)+'\n')
    for p in parts:
        refs=[c for c in inv['components'] if p['id'] in c['part_ids']]
        if not refs:raise ValueError('Unplanned component '+p['id'])
        p['evidence']='; '.join('H1 '+c['locator']+' ['+c['id']+']: '+c['decision'] for c in refs)+' Dimensions/profile not otherwise specified are estimates; see revision-2/research.md.'
    report=review(inv,[p['id'] for p in parts]);(S/'coverage-plan.json').write_text(json.dumps(report,indent=2)+'\n');(S/'research-readiness.json').write_text(json.dumps(report,indent=2)+'\n')
    views=[dict(id='cutaway',title='Crankcase open: bearings, rods and liners',hide_groups=['cover','crankcase','induction','cooling','generator'],direction=[1,-1,1.15]),
           dict(id='cylinder-detail',title='Cylinder 1: liner, piston and pinned rings',parts=[p['id'] for p in parts if p['group'] in ['cylinders','pistons','rods'] and (p['id'].endswith('1') or p['id'].startswith(('Ring1_','RingPeg1_')))],direction=[1,-1,.8]),
           dict(id='valve-detail',title='Valve box 1: open cages and helical springs',parts=[p['id'] for p in parts if p['group']=='valves' and p['id'].endswith('1')],direction=[1,-1,.35]),
           dict(id='rocker-detail',title='Rocker 1: two cheeks and two rollers',parts=[p['id'] for p in parts if p['group']=='rockers' and p['id'].endswith('1')]+['ExhaustCam1','ExhaustStem1'],direction=[1,-1,.55]),
           dict(id='igniter-detail',title='Igniter 1: insulated electrode and snap levers',parts=[p['id'] for p in parts if p['group']=='ignition' and p['id'].endswith('1')]+['IgnitionCam1'],direction=[1,-1,.6]),
           dict(id='timing-control',title='Sliding gear, 45-degree slot and timing lever',parts=['ExhaustGear','IgnitionGear','IgnitionDrivePin','IgnitionGearSpring','AdvanceCam','AdvanceLever','AdvanceBracket'],direction=[1,-1,.6])]
    spec=dict(schema_version=1,model_id='wright-research-revision-2',units='mm',input_mode='mixed',scope='Source-led detailed static teaching reconstruction of the surviving rebuilt Wright horizontal engine. Manufacturing dimensions, cam laws and exact 1903 authenticity remain unverified.',coordinate_frame='Cylinder +X, shaft +Y, Z up; mesh candidate mm=10*(raw-[-46,1.2,-21]).',sources=inv['sources'],parameters=params,parts=parts,
      research=dict(inventory_path=str((S/'inventory.json').relative_to(R)).replace('\\','/'),inventory_sha256=hashlib.sha256((S/'inventory.json').read_bytes()).hexdigest()),
      presentation=dict(header='WRIGHT ENGINE | RESEARCH REVISION 2',footer='Surviving rebuilt configuration | Manufacturing dimensions include estimates',group_titles={'timing':'6/12 sprockets, chain and hardwood tensioner','cylinders':'Short liners, head joints and gaskets','valves':'Open cages, two-piece valves and springs','induction':'Baffled hot-plate mixer and steel intake box'},views=views),
      assumptions=['Science Museum direct-thread rod lineage selected.','Oil pump is disputed for 1903; rebuilt accessory shown, conflicting placed drive geometry deferred.','Chain pitch, curved-span link spacing and tooth flanks illustrative.','Static TDC/BDC pose; ignition/exhaust events not certified.','No modern carburetor, water pump, high-tension plugs, compression release or later barrel exhaust.'])
    validate_spec(spec);(S/'part-spec.json').write_text(json.dumps(spec,indent=2)+'\n')
    (S/'chain-layout.json').write_text(json.dumps(dict(points_xz_mm=points,arc_length_mm=total,nominal_pitch_mm=25.4,chord_lengths_mm=[math.dist(p,points[(k+1)%len(points)]) for k,p in enumerate(points)],scope='Equal arc-length static chain layout, not certified uniform roller pitch'),indent=2)+'\n')
    return spec

if __name__=='__main__':
    spec=make_spec();print('Planned',len(spec['parts']),'parts;',sum(len(p['features']) for p in spec['parts']),'features')
