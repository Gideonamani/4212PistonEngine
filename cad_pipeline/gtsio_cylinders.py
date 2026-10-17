"""Source-led finned cylinder/head, fitted valves and closed rocker assemblies.

Local X points outwards, Y is vertical, Z is parallel to the crankshaft.
Manufacturing sizes and estimated contours are distinguished in the controller.
"""
import math
from cad_pipeline.gtsio_core import cylinder, tube, prism, box, transform
from cad_pipeline.gtsio_crankcase import CYLINDER_DECK_PATTERN as DECK_PATTERN
from cad_pipeline import gtsio_valve_layout as vl


def revolve(points, origin=(0,0,0), axis=(1,0,0), op='add', label=''):
    # Keep a consistent clockwise (radius, axial station) profile convention.
    return dict(primitive='revolve',operation=op,points=list(reversed(points)),origin=list(origin),axis=list(axis),label=label)


def add(a, layout, numbers=range(1,7)):
    for name,value,why,source in [
        ('cylinder_open',94.,'Calculated packaging choice: above the 91.734 mm damper envelope and below the lowest ring at BDC',False),
        ('barrel_radius',71.,'Estimated steel barrel OD; deck pilot is 71.12 mm',False),
        ('barrel_end',256.,'Estimated barrel/head fitted interface',False),
        ('head_seat',270.,'Estimated valve seat datum; not the drawing dome gauge point',False),
        ('valve_offset',33.,'Estimated valve offset within the chamber',False),
        ('valve_stem',11.01725,'Table 6 PDF103 .4335-.4340 in midpoint',True),
        ('intake_guide_bore',11.06678,'Table 6 PDF103 .4352-.4362 in midpoint',True),
        ('exhaust_guide_bore',11.1125,'Table 6 PDF103 .4370-.4380 in midpoint',True),
        ('intake_valve_length',122.2756,'PDF92 4.804-4.824 in midpoint',True),
        ('exhaust_valve_length',122.3264,'PDF92 4.806-4.826 in midpoint',True),
        ('rocker_shaft_diameter',19.03095,'Table 6 PDF103 .7490-.7495 in midpoint',True),
        ('rocker_bush_bore',19.0754,'Table 6 PDF103 .7505-.7515 in midpoint',True),
        ('guide_outer',16.,'Estimated guide outer diameter; shrink fit omitted',False),
        ('spring_installed',vl.SPRING_INSTALLED,'Estimated installed length; sized for a 14 mm illustrative lift envelope without binding six-turn coils; distinct from manufacturer spring-test lengths',False),
    ]:a.parameter(name,value,why,source)
    for name,angle in [('intake_angle',11.5),('exhaust_angle',15.)]:
        a.parameter(name,angle,'A-4-23 PDF40 valve inclination midpoint',True);a.parameters[name]['unit']='deg'
    a.parameter('cylinder_pilot_start',0,'Case opening clears the estimated swept piston skirt, separately from the steel barrel open end',expression='rod_length-stroke/2+skirt_bottom-.2')
    for part in a.spec['parts']:
        if part['id'] in ('CrankcaseLeft','CrankcaseRight'):
            # The right split-face mesh has a T-junction between web/end seams.
            # The left mesh already exports cleanly; its refinement did not
            # pass the independent solid-boundary preservation check.
            if part['id']=='CrankcaseRight':part['mesh_refine']=True
            for f in part['features']:
                if f.get('label')=='Open cylinder pilot seat':
                    f['origin'][0]=str(f['axis'][0])+'*cylinder_pilot_start';f['height']='195-cylinder_pilot_start'
    for n in numbers:
        sign=1 if n%2 else -1;station=layout.station(n)
        state=layout.pose(n)
        for part in a.spec['parts']:
            if part['id'] in ('PinPlugA'+str(n),'PinPlugB'+str(n)):
                part['features'].append(transform(tube(90.,'pin_length/2',150.,[0,-75,0],(0,1,0),op='cut',label='Calculated cylindrical pin-plug end crown'),state['wrist'],state['piston_roll']))
        def addpart(id,label,group,fs,callouts,material='steel'):
            part=a.add(id+str(n),f'Cylinder {n} / '+label,group,fs,['A-4-17:'+str(i) for i in callouts],material)
            part['placement']=dict(origin=[0,0,station],rotation_quaternion=[0,1,0,0] if sign<0 else [0,0,0,1],mirror_normal=[0,0,1])
            return part
        flange=[[-80,-70],[-68,-93],[68,-93],[80,-70],[80,70],[68,93],[-68,93],[-80,70]]
        # For a Z->X primitive rotation local planar X maps to -global Z.
        barrel=[tube('barrel_radius','fitted_bore/2','barrel_end-cylinder_open',['cylinder_open',0,0],(1,0,0)),
                prism(flange,16.,[152,0,0],(1,0,0),label='Eight-position base flange')]
        for i in range(15):barrel.append(tube(80.,'fitted_bore/2',1.6,[178+i*4.8,0,0],(1,0,0),label='Steel barrel cooling fin'))
        barrel += [tube(72.,70.,2.,[146,0,0],(1,0,0),op='cut',label='Base seal groove')]
        for y,z in DECK_PATTERN:barrel.append(cylinder(4.56,20,[151,y,z],(1,0,0),op='cut',label='Deck stud clearance'))
        barrel.append(cylinder('fitted_bore/2','barrel_end-cylinder_open+.2',['cylinder_open-.1',0,0],(1,0,0),op='cut',label='Restore continuous bore after base flange addition'))
        addpart('CylinderBarrel','Finned steel barrel and machined flange','cylinders',barrel,[21],'steel')
        addpart('CylinderBaseSeal','Base seal in machined groove','cylinders',[tube(71.10,70.03,1.96,[146.02,0,0],(1,0,0))],[22],'rubber')
        head=[revolve([['barrel_radius+.04',248],[78,248],[88,258],[87,285],[78,310],[64,334],[0,334],[0,293],[24,291],[50,278],['fitted_bore/2',256],['barrel_radius+.04',256]],label='Estimated aluminium casting/chamber section')]
        for i in range(14):
            ry=98. if i<6 else 98.-(i-5)*3
            head.append(tube(ry,'fitted_bore/2',1.5,[252+i*5,0,0],(1,0,0),label='Broad annular head cooling fin'))
        head += [box(500,300,100,[0,-150,88],op='cut',label='Head fin axial-bank clearance flat'),
                 box(500,300,100,[0,-150,-188],op='cut',label='Opposite head fin clearance flat')]
        # Restore the permanent steel/head interface and chamber after adding fins.
        head += [cylinder('barrel_radius+.04',8.,[248,0,0],(1,0,0),op='cut'),
                 revolve([[0,255.9],['fitted_bore/2',255.9],[50,278],[24,291],[0,293]],op='cut',label='Restore combustion chamber through fins')]
        valves=[]
        for name,side,vr,throat,sr,seat_angle,face_angle in [('Intake',-1,30.5,26.5,32.,59.75,60.),('Exhaust',1,24.,20.,25.5,44.75,45.25)]:
            intake=name=='Intake';port_sign=1 if intake else -1
            base,axis,v=vl.raw_frame(name,a.parameters)
            def pt(t,u=0,w=0):return [base[i]+axis[i]*t+(u if i==1 else 0)+v[i]*w for i in range(3)]
            def disk(r,h,t,op='add',u=0,w=0):return cylinder(r,h,pt(t,u,w),axis,op)
            def sleeve(r,ri,h,t,op='add'):return tube(r,ri,h,pt(t),axis,op)
            def oval(t,height,radius,op='add',flat=None):
                # A vertical stadium joins the stem pocket to the lower pushrod cup.
                outline=[]
                for center,start in [(0.,-math.pi/2),(vl.CUP_U,math.pi/2)]:
                    outline += [(center+radius*math.cos(start+j*math.pi/16),radius*math.sin(start+j*math.pi/16)) for j in range(17)]
                if flat is not None:outline=[(u,max(-flat,min(flat,w))) for u,w in outline]
                # Identical sections call for an extrusion. Analytic planar
                # faces also avoid needless ruled B-spline STEP surfaces.
                return prism([[-w,u] for u,w in outline],height,pt(t),axis,op,label='Inclined vertical rocker box / lower pushrod pocket')
            spring_start=vl.SPRING_TOP-a.value('spring_installed');platform=spring_start-2
            head += [disk(sr+3,32,2),disk(24,10,platform-10),oval(platform,150-platform,24)]
            # A-12-7 PDF80 explicitly requires five attaching sets per cover.
            holes=[(21.,0.),(-12.,-19.),(-12.,19.),(-60.,-19.),(-60.,19.)]
            head += [oval(platform,152-platform,22,'cut'),disk(22.,118-platform,platform,'cut'),disk(sr+.03,6.04,-.02,'cut'),disk(vr+.05,5.02,-5.02,'cut'),
                     disk(throat,39,-6,'cut'),disk('guide_outer/2+.03',48,28,'cut'),
                     # Cross the casting's revolution seam. Ending the tool
                     # exactly on Y=0 made native/STEP topology disagree.
                     cylinder(19 if intake else 16,106,pt(22,-port_sign),(0,port_sign,0),op='cut',label=name+' crossing port')]
            # Shaft bores are fitted into the two box walls.
            pivot=pt(vl.PIVOT_T,vl.PIVOT_U,0)
            head.append(cylinder('rocker_shaft_diameter/2+.03',52,pt(vl.PIVOT_T,vl.PIVOT_U,-26),v,op='cut',label=name+' rocker support bore'))
            for u,w in holes:head.append(disk(4.5,7,143,u=u,w=w))
            for u,w in holes:head.append(disk(2.1,16,141,'cut',u,w))
            drop=2*math.tan(math.radians(seat_angle));face_drop=2*math.tan(math.radians(face_angle))
            addpart(name+'Seat','Conical '+name.lower()+' seat insert','valves',
                    [revolve([[vr+.03,0],[sr,0],[sr,6],[throat,6],[vr-drop+.03,2]],base,axis)],[50 if intake else 49],'steel')
            length=a.value(name.lower()+'_valve_length');tip=length-3
            addpart(name+'Valve',name+' valve / inclined closed pose','valves',
                    [revolve([[0,-3],[vr,-3],[vr,0],[vr-face_drop,2],['valve_stem/2',12],['valve_stem/2',name.lower()+'_valve_length-3'],[0,name.lower()+'_valve_length-3']],base,axis)],[30 if intake else 29])
            addpart(name+'Guide','Fitted '+name.lower()+' bronze guide','valves',[sleeve('guide_outer/2',name.lower()+'_guide_bore/2',45,30)],[48],'bronze')
            addpart(name+'LowerInnerRetainer','Inner spring foot retainer','valves',[sleeve(13.,8.15,2.,platform)],[28])
            addpart(name+'SpringFoot','Outer spring foot washer','valves',[sleeve(21.,13.1,2.,platform)],[51])
            # The final native mirror reverses winding, so pre-reverse the coils.
            for kind,r,w,left in [('Outer',15.5,2.,True),('Inner',10.5,1.4,False)]:
                # Native/direct helix evaluators use the same explicit handedness.
                fs=[dict(primitive='helix',operation='add',radius=r,wire_radius=w,pitch=f'(spring_installed-2*{w})/6',height=f'spring_installed-2*{w}',origin=pt(spring_start+w),axis=list(axis),left_handed=left,label='Estimated installed '+kind.lower()+' coil')]
                addpart(name+kind+'Spring',name+' '+kind.lower()+' spring','valve_springs',fs,[26 if kind=='Outer' else 27])
            addpart(name+'Retainer',name+' upper spring retainer','valves',
                    [revolve([[8,110],[20,110],[20,114],[7.02,114],[7.53,112],[8,112]],base,axis)],[25 if intake else 24])
            if not intake:addpart(name+'RotocoilRim','Exhaust rotocoil exterior rim','valves',[sleeve(21,7.02,2,114)],[24])
            for half in (-1,1):
                keys=[revolve([['valve_stem/2+.01',112],[7.5,112],[6.3,117],['valve_stem/2+.01',117]],base,axis),
                      box(600,200.05,400,[0,-.05 if half<0 else -200,-200],op='cut',label='Separate tapered keeper half')]
                addpart(name+'Keeper'+('A' if half<0 else 'B'),'Split tapered valve keeper','valves',keys,[23])
            shaft=[cylinder('rocker_shaft_diameter/2',48,pt(vl.PIVOT_T,vl.PIVOT_U,-24),v)]
            addpart(name+'RockerShaft','Ground rocker shaft','rockers',shaft,[8])
            addpart(name+'RockerBush','Rocker pivot sleeve','rockers',[tube(10.5,'rocker_bush_bore/2',14,pt(vl.PIVOT_T,vl.PIVOT_U,-7),v)],[10],'bronze')
            profile=[(tip,-3),(tip,3),(tip+6,3),(143,vl.PIVOT_U),(134,vl.PIVOT_U-3),(vl.CUP_T+6,vl.CUP_U),(vl.CUP_T,vl.CUP_U-3),(124,vl.PIVOT_U)]
            rocker=[cylinder(13.,14,pt(vl.PIVOT_T,vl.PIVOT_U,-7),v),prism(profile,12,pt(0,0,-6),v,label='Downward forged lever / estimated pushrod cup datum'),
                    cylinder(10.53,20,pt(vl.PIVOT_T,vl.PIVOT_U,-10),v,op='cut')]
            addpart(name+'Rocker','Forged rocker and fitted pivot bore','rockers',rocker,[11])
            gasket=[oval(150,.6,24),oval(149.9,.8,22,'cut')]
            cover_height=4.5;cover_top=150.6+cover_height
            cover=[oval(150.6,cover_height,24,flat=22.5),oval(150.6,cover_height-1.2,22.8,'cut',flat=21.3)]
            for u,w in holes:
                gasket.append(disk(3.5,.6,150,u=u,w=w));cover.append(disk(3.5,cover_height,150.6,u=u,w=w))
            for u,w in holes:
                gasket.append(disk(2.1,2,149.5,'cut',u,w));cover.append(disk(2.1,7,150,'cut',u,w))
            addpart(name+'CoverGasket','Rocker cover gasket','rocker_covers',gasket,[5],'gasket')
            addpart(name+'RockerCover','Hollow stamped steel rocker cover','rocker_covers',cover,[4],'steel')
            for index,(u,w) in enumerate(holes,1):
                fs=[disk(2.,cover_top+1.4-141.6,141.6,u=u,w=w),disk(3.3,1.6,cover_top+1.4,u=u,w=w)]
                addpart(name+'CoverScrew'+str(index),'Rocker cover screw','rocker_covers',fs,[1])
                for tag,t,callout in [('Plain',cover_top,3),('Lock',cover_top+.7,2)]:
                    addpart(name+'Cover'+tag+'Washer'+str(index),tag+' cover washer envelope','rocker_covers',[tube(3.4,2.04,.7,pt(t,u,w),axis)],[callout])
        # Upper and lower 18 mm plug interfaces. Helical inserts and plug threads
        # are represented by fitted smooth tubes; porcelain and terminal are separate.
        for side in (-1,1):
            tag='Upper' if side>0 else 'Lower';axis=(0,side,0)
            head += [cylinder(13.5,15,[285,side*77,0],axis),cylinder(9.15,97,[285,-side,0],axis,op='cut',label=tag+' 18 mm plug seat'),
                     cylinder(12.5,55,[285,side*92,0],axis,op='cut',label=tag+' plug flange fin spotface')]
            addpart(tag+'PlugInsert','18 mm spark-plug insert envelope','spark_plugs',[tube(9.1,8.45,25,[285,side*67,0],axis)],[42])
            hexagon=[[12*math.cos(j*math.pi/3),12*math.sin(j*math.pi/3)] for j in range(6)]
            plug=[cylinder(8.4,31,[285,side*62,0],axis),prism(hexagon,7,[285,side*93,0],axis),cylinder(7.55,23,[285,side*100,0],axis),cylinder(.8,7,[285,side*55,0],axis)]
            addpart(tag+'PlugShell','Spark-plug steel shell and centre electrode','spark_plugs',plug,[43])
            # Insulator occupies the hollowed shell bore, not its material.
            a.spec['parts'][-1]['features'].append(cylinder(7.45,23,[285,side*100,0],axis,op='cut'))
            addpart(tag+'PlugCeramic','Spark-plug insulator','spark_plugs',[cylinder(7.4,25,[285,side*100,0],axis)],[43],'insulator')
            addpart(tag+'PlugTerminal','Spark-plug terminal','spark_plugs',[cylinder(3.2,4,[285,side*125,0],axis)],[43])
            addpart(tag+'PlugWasher','Spark-plug sealing washer','spark_plugs',[tube(11.8,8.45,1,[285,side*92,0],axis)],[51],'copper')
        casting=addpart('CylinderHead','Finned aluminium head / hollow integral rocker boxes','cylinder_heads',head,[21],'aluminium')
        casting['boolean_refine']=False;casting['boolean_batch_runs']=6
        if n!=1:casting['geometry_instance_of']='CylinderHead1'
