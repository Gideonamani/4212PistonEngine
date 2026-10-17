"""Split hollow castings, main inserts, cylinder decks and open oil sump."""
import math
from cad_pipeline.gtsio_valvetrain_pose import GTSIO_STATIC_TIMING
from cad_pipeline import gtsio_layout as k
from cad_pipeline.gtsio_assembly import cylinder,tube,box,prism

DECK_PATTERN=[(-78,-32),(-78,32),(-40,66),(40,66),(78,32),(78,-32),(40,-66),(-40,-66)]
CYLINDER_DECK_PATTERN=[(-78,-32),(-78,32),(-42,72),(42,72),(78,32),(78,-32),(42,-72),(-42,-72)]


def add(a,layout=k,deck_pattern=DECK_PATTERN,deck_halfspan=72.,stud_end=180.):
    k=layout;core_length=3*k.BAY_PITCH+k.MAIN_WIDTH
    upper_stations=(4.,k.BAY_PITCH/2,k.BAY_PITCH,1.5*k.BAY_PITCH,2*k.BAY_PITCH,2.5*k.BAY_PITCH,core_length-4)
    a.parameter('main_seat_diameter',2.8165*k.INCH,'Table6 PDF103: crankcase main-bearing seat 2.8160-2.8170 in midpoint',True)
    a.parameter('main_running_clearance',.0025*k.INCH,'B-2 row39 PDF93 .001-.004 in midpoint diametral running clearance',True)
    a.parameter('main_shell_width',0,'Ends clear the existing journal roots and a 0.2 mm modelling margin',expression='main_width-2*main_root_radius-.4')
    a.parameter('case_inner_radius',116.,'Estimated cavity from rotating-core and damper envelope plus clearance')
    a.parameter('case_cam_y',GTSIO_STATIC_TIMING['cam_centre'][1],'Estimated below-crank axis from the shared GTSIO timing declaration')
    a.parameter('cam_seat_diameter',1.2505*k.INCH,'Table6 PDF103: camshaft bore 1.2500-1.2510 in midpoint',True)
    a.parameter('case_split_gap',.05,'Small modelling split clearance; silk-thread/sealant film not modelled as a gasket')
    a.parameter('cylinder_deck',152.,'Estimated deck projection from case contour and barrel/piston packaging')
    a.parameter('cylinder_pilot_radius',71.0,'Estimated barrel pilot OD, above the source-backed 66.7 mm bore radius')
    a.parameter('case_start',-14.,'Estimated rear casting flange station')
    a.parameter('case_length',core_length+28.,'Recalibrated core length plus end castings')
    a.parameter('case_mount_bolt_radius',4.5,'Illustrative cylinder attachment shank; no thread-size claim')
    outline=[[-132,-116],[-122,78],[-97,145],[-45,156],[45,156],[97,145],[122,78],[132,-116],[94,-157],[-94,-157]]
    for side,name,callout in [(1,'Right','A-4-18:127'),(-1,'Left','A-4-18:126')]:
        fs=[prism(outline,'case_length',[0,0,'case_start'],label='Contoured cast envelope'),
            cylinder(40.,'case_length',[0,'case_cam_y','case_start'],label='Camshaft tunnel casting'),
            cylinder('case_inner_radius',core_length+4.,[0,0,0],op='cut',label='Open crank/rod/damper cavity'),
            cylinder(31.,'case_length+2',[0,'case_cam_y','case_start-1'],op='cut',label='Cam-lobe chamber')]
        for bay in range(4):
            fs.append(prism(outline,'main_width',[0,0,bay*k.BAY_PITCH],label='Integral main-bearing support web'))
        # Three pilot decks on each bank; trim the flange so adjacent pitches fit.
        for n in (range(1,7,2) if side>0 else range(2,7,2)):
            z=k.station(n)
            h=deck_halfspan;points=[[-93,-h+12],[-70,-h],[70,-h],[93,-h+12],[93,h-12],[70,h],[-70,h],[-93,h-12]]
            # For X-axis extrusion, local X is -global Z and local Y global Y.
            deck_points=[[-v,u] for u,v in points]
            fs.append(prism(deck_points,42.,[side*110,0,z],axis=[side,0,0],label='Eight-position cylinder mounting deck'))
            fs.append(cylinder('cylinder_pilot_radius+.12',115.,[side*80,0,z],axis=[side,0,0],op='cut',label='Open cylinder pilot seat'))
            for y,dz in deck_pattern:
                fs.append(cylinder('case_mount_bolt_radius+.06',45.,[side*109,y,z+dz],axis=[side,0,0],op='cut',label='Cylinder attachment bore'))
        # Restored seats pass through the added webs and any deck intersections.
        fs.append(cylinder('main_seat_diameter/2','case_length+2',[0,0,'case_start-1'],op='cut',label='Line-bored main-bearing seats'))
        fs.append(cylinder('cam_seat_diameter/2','case_length+2',[0,'case_cam_y','case_start-1'],op='cut',label='Line-bored cam journals'))
        for bay in range(3):
            fs.append(box(144.,100.,k.BAY_PITCH-k.MAIN_WIDTH,[-72,-235,bay*k.BAY_PITCH+k.MAIN_WIDTH],op='cut',label='Oil return bay; bearing webs retained'))
        # Front/rear mounting pads join the wall, with actual attachment holes.
        for z in (28.,core_length-42.):
            fs.append(box(34.,32.,42.,[side*100 if side>0 else -134,-157,z-21],label='Engine mount boss'))
            fs.append(cylinder(6.1,40.,[side*118,-164,z],axis=[0,1,0],op='cut',label='Mount attachment seat'))
        for z in upper_stations:
            fs.append(cylinder(8.,23.,[side*87,143,z],axis=[side,0,0],label='Upper parting bolt boss'))
            fs.append(cylinder(4.6,270.,[-135,143,z],axis=[1,0,0],op='cut',label='Upper parting fastener seat'))
        fs.append(box(450.,143.,'case_length+2',[-225,-300,'case_start-1'],op='cut',label='Flat sump mounting datum'))
        fs.append(box(300.,450.,core_length+170.,[-300 if side>0 else '-case_split_gap/2',-220,-80],op='cut',label='Vertical case parting plane'))
        if side>0:fs[-1]['length']='300+case_split_gap/2'
        a.add('Crankcase'+name,'Hollow '+name.lower()+' crankcase / decks and line-bored webs','crankcase',fs,[callout],material='aluminium',refine=False)
    for bay in range(4):
        for side,name in [(1,'Right'),(-1,'Left')]:
            fs=[tube('main_seat_diameter/2','(main_diameter+main_running_clearance)/2','main_shell_width',
                     [0,0,f'{bay*k.BAY_PITCH}+main_root_radius+.2']),
                box(110.,120.,60.,[-110 if side>0 else '-case_split_gap/2',-60,bay*k.BAY_PITCH-1],op='cut')]
            if side>0:fs[-1]['length']='110+case_split_gap/2'
            # Visible oil feed hole; case gallery routing remains a separate module.
            fs.append(cylinder(1.5,15.,[side*30,0,bay*k.BAY_PITCH+22],axis=[side,0,0],op='cut',label='Main-insert oil feed opening'))
            a.add(f'MainBearing{name}{bay+1}','Split lined main bearing '+name+' '+str(bay+1),'main_bearings',fs,['A-4-20:39'],material='babbitt')
    # Eight attachments per cylinder. Six are studs; two retain only the visible
    # through-bolt end envelope until actual long shank routing is established.
    for n in range(1,7):
        side=1 if n%2 else -1;axis=[side,0,0];z=k.station(n)
        for j,(y,dz) in enumerate(deck_pattern):
            tag=f'{n}_{j+1}';center=[side*132,y,z+dz]
            a.add('DeckStud'+tag,'Cylinder attachment '+tag,'deck_fasteners',[cylinder(4.5,stud_end-132.,center,axis)],['A-4-18:98' if j<6 else 'A-4-18:123'])
            a.washer('DeckWasher'+tag,[side*168,y,z+dz],axis,4.6,8.,1.2,'A-4-17:19','deck_fasteners')
            a.nut('DeckNut'+tag,[side*169.2,y,z+dz],axis,8.5,7.,4.65,'A-4-17:20','deck_fasteners')
    # A separate open sump, flange/gasket, drain and hollow suction tube.
    sump=[box(152.,70.,core_length-56.,[-76,-229,17]),box(180.,7.,core_length-42.,[-90,-166,10]),
          box(140.,85.,core_length-68.,[-70,-223,23],op='cut',label='Open oil volume and return mouth')]
    drain_z=core_length-84.
    sump.append(cylinder(7.,18.,[0,-233,drain_z],axis=[0,1,0],op='cut',label='Drain thread envelope'))
    a.add('OilSump','Open oil sump / mounting flange','sump',sump,['A-4-12:6'],material='aluminium')
    gasket=[box(180.,2.,core_length-42.,[-90,-159,10]),box(140.,4.,core_length-68.,[-70,-160,23],op='cut')]
    a.add('SumpGasket','Open sump flange gasket','sump',gasket,['A-4-12:7'],material='gasket')
    a.add('SumpDrainPlug','Drain plug','sump',[cylinder(6.95,12.,[0,-229,drain_z],axis=[0,1,0]),cylinder(10.,4.,[0,-233,drain_z],axis=[0,1,0])],['A-4-12:2'])
    for z in (32.,k.MAIN_WIDTH+1.5*k.CHEEK_WIDTH+k.PIN_WIDTH,k.BAY_PITCH+22.,k.BAY_PITCH+k.MAIN_WIDTH+1.5*k.CHEEK_WIDTH+k.PIN_WIDTH,2*k.BAY_PITCH+22.,core_length-62.):
        for x in (-82.,82.):
            id=f'SumpScrew{int(z)}'+('L' if x<0 else 'R')
            # Cut matching seats through both flange and cast case wall.
            for part in a.spec['parts']:
                if part['id'] in ('OilSump','SumpGasket','CrankcaseLeft','CrankcaseRight'):
                    part['features'].append(cylinder(3.65,35.,[x,-174,z],axis=[0,1,0],op='cut',label='Sump screw seat'))
            a.bolt(id,[x,-166,z],[0,1,0],21.,3.6,'A-4-12:3','sump')
    # Long main case flange attachments at the upper flange, away from rotors.
    for j,z in enumerate(upper_stations):
        for part in a.spec['parts']:
            if part['id'].startswith('Crankcase'):
                part['features'].append(cylinder(4.6,270.,[-135,143,z],axis=[1,0,0],op='cut',label='Upper parting fastener seat'))
        a.bolt('CaseThruBolt'+str(j+1),[-110,143,z],[1,0,0],233.2,4.5,'A-4-18:84','case_fasteners')
        a.washer('CaseThruWasher'+str(j+1),[110,143,z],[1,0,0],4.65,8.,1.2,'A-4-18:83','case_fasteners')
        a.nut('CaseThruNut'+str(j+1),[111.2,143,z],[1,0,0],8.5,7.,4.65,'A-4-18:81','case_fasteners')
