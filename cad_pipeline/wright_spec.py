"""Research + mesh measurement -> explicit first Wright reconstruction spec.
Builds semantic solids rather than a faceted copy of the joined scan.
"""
import json,math
from pathlib import Path

R=Path(__file__).resolve().parents[1];STUDY=R/'cad-studies/wright-1903'

def main():
    fit=json.loads((R/'build/wright-reconstruction/source/primitive-fits.json').read_text())
    circles=[r['fit'] for r in fit['regions']];pitch=sum(circles[i+1]['center'][1]-circles[i]['center'][1] for i in range(3))/3*10
    radius=sum(c['radius'] for c in circles)/4*10
    sources={
      'mesh':{'path':'web/wright-1903-engine.glb','sha256':'e626ab347a7f587fee2169f81ac3516185aef033adf32c920533f85293b52daf','locator':'Imported XYZ; mesh-rois.json and primitive-fits.json'},
      'nasa-bore':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bore-and-stroke-old/','locator':'Bore and Stroke, 4 inches each; four cylinders'},
      'nasa-case':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/crankcase/','locator':'Crankcase, cylinder/water-jacket structure and sheet steel closure'},
      'nasa-valves':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/combustion-chamber/','locator':'Suction intake; cam-actuated exhaust; cages'},
      'nasa-timing':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/timing-system/','locator':'Six/twelve timing sprockets; ratio 2:1'},
      'nasa-ignition':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/electrical-system/','locator':'Low-tension make-and-break, friction drive'},
      'hobbs':{'url':'https://repository.si.edu/bitstream/handle/10088/18675/SAoF-0005-Lo_res.pdf','locator':'Hobbs, The Wright Brothers Engines and Their Design; printed pp. 5-8,16-26; Figures 5-7'},
      'museum-scale':{'url':'https://airandspace.si.edu/collection-objects/wright-flyer-1903/nasm_A19610048000','locator':'3D mesh download lists scale in cm'},
    }
    params={}
    def param(name,value,status='inferred',refs=(),rationale='First teaching candidate; dimension needs a dimensioned drawing.',unit='mm',method=None):
        params[name]=dict(value=value,unit=unit,status=status,source_ids=list(refs),rationale=rationale)
        if method:params[name]['method']=method
    param('bore',101.6,'specified',['nasa-bore'],'4 in converted exactly to mm; nominal historical bore, not scan interior measurement.')
    param('stroke',101.6,'specified',['nasa-bore'],'4 in converted exactly to mm.')
    param('pitch',round(pitch,3),'measured',['mesh'],'Mean Y spacing of four reviewed valve-box fits, assuming cm scale.',method='Average adjacent fit centers times 10; reviewed exterior ROIs; see primitive-fits.json.')
    param('valve_box_radius',round(radius,3),'measured',['mesh'],'Mean exterior housing radius after ROI filtering; low-resolution scan estimate.',method='Mean four deduplicated circle radii times 10; individual residuals retained.')
    param('mesh_to_mm',10,'inferred',['museum-scale'],'Parent museum download reports cm; cropped engine file has no standalone calibration. Confirm against a known external dimension.',unit='ratio')
    for name,val in [('wall',7),('rod_length',240),('piston_clearance',.3),('piston_length',130),('sleeve_length',240),('sleeve_start',135),('sleeve_wall',5.6),('case_radius',122),('jacket_end',375),('case_top',110),('valve_x',430),('flywheel_radius',190),('journal_radius',14),('pin_radius',10),('cam_radius',9)]:param(name,val)
    param('cylinders',4,'specified',['nasa-bore'],'Documented four-cylinder arrangement.',unit='count')
    param('crank_sprocket_teeth',6,'specified',['nasa-timing'],'Reference tooth count; pitch-form disk only in first candidate.',unit='count')
    param('cam_sprocket_teeth',12,'specified',['nasa-timing'],'Reference tooth count; pitch-form disk only in first candidate.',unit='count')
    parts=[]
    def cyl(r,h,o,axis=(0,0,1),op='add',label='Cylinder'):
        return dict(primitive='cylinder',operation=op,radius=r,height=h,origin=o,axis=list(axis),label=label)
    def box(l,w,h,o,op='add',label='Block'):
        return dict(primitive='box',operation=op,length=l,width=w,height=h,origin=o,label=label)
    def ring(ro,ri,h,o,axis=(0,0,1)):
        return [cyl(ro,h,o,axis),cyl(ri,h,o,axis,'cut','Through bore')]
    def add(id,label,group,features,material='steel',evidence='Inferred dimensions; source-grounded component role; see research.md.'):
        parts.append(dict(id=id,label=label,group=group,features=features,material=material,evidence=evidence))
    length='3*pitch+140'
    # Single casting: lower curved crankcase + box water jacket, open upper crank bays.
    case=[cyl('case_radius',length,[0,-70,0],(0,1,0)),box('jacket_end',length,220,[0,-70,-110]),
          cyl('case_radius-wall','3*pitch+126',[0,-63,0],(0,1,0),'cut','Crank bay'),
          box('case_radius*2','3*pitch+126',130,['-case_radius',-63,0],'cut','Upper cover opening'),
          box('jacket_end-150','3*pitch+126',180,[140,-63,-90],'cut','Jacket cavity')]
    for i in range(4):case.append(cyl('bore/2+sleeve_wall+.3','jacket_end-100',[100,f'{i}*pitch',0],(1,0,0),'cut','Sleeve opening'))
    for x in [-110,330]:
        for y in [-70,'3*pitch+30']:
            case.append(box(50,40,85,[x,y,-170],label='Cast mounting leg'));case.append(box(80,60,12,[x-15,f'({y})-10',-178],label='Mounting foot'))
    for y in [-60,'3*pitch+52']:case.append(cyl(18,30,[310,y,105],label='Water outlet boss'))
    add('Crankcase','Crankcase and integral water jacket','crankcase',case,'aluminium','NASA crankcase; simplified casting envelope inferred from scan. Internal webs, detailed threads and galleries unresolved.')
    cover=ring('case_radius','case_radius-2',length,[0,-70,0],(0,1,0))+[box('case_radius*2+4','3*pitch+144','case_radius+2',['-case_radius-2',-72,'-case_radius-2'],'cut','Remove lower half')]
    add('Cover','Curved sheet-steel crankcase cover','cover',cover,'steel','NASA crankcase closure; thickness and contour approximated.')
    # Four native hollow sleeves and hollow cast-iron pistons. Static TDC/BDC illustration.
    for i,sign in enumerate([1,-1,-1,1]):
        y=f'{i}*pitch';cx=f'{sign}*stroke/2';px=f'{cx}+rod_length'
        sleeve=[cyl('bore/2+sleeve_wall','sleeve_length',['sleeve_start',y,0],(1,0,0)),cyl('bore/2','sleeve_length',['sleeve_start',y,0],(1,0,0),'cut'),
                cyl('bore/2+sleeve_wall+5',8,['sleeve_start+sleeve_length',y,0],(1,0,0)),cyl(22,10,['sleeve_start+sleeve_length-1',y,0],(1,0,0),'cut','Transfer port')]
        add(f'Sleeve{i+1}',f'Cylinder liner {i+1}','cylinders',sleeve,'cast_iron','NASA nominal bore; Hobbs short separate cast-iron barrels. Length/head/boss/thread form inferred.')
        piston=[cyl('(bore-piston_clearance)/2','piston_length',[f'({px})-65',y,0],(1,0,0)),cyl('(bore-piston_clearance)/2-6','piston_length-10',[f'({px})-65',y,0],(1,0,0),'cut','Hollow skirt')]
        # Pin-support bosses connect to the inner skirt at both sides.
        for side in [-1,1]:piston.append(cyl(18,20,[px,f'({y})+{side}*25',0],(0,side,0),label='Pin boss'))
        piston.append(cyl('pin_radius+.15',120,[px,f'({y})-60',0],(0,1,0),'cut','Wrist-pin bore'))
        for k in range(3):
            groove=dict(primitive='tube',operation='cut',radius='bore/2+1',inner_radius='(bore-piston_clearance)/2-2',height=4,origin=[f'({px})+{40+8*k}',y,0],axis=[1,0,0],label='Ring groove')
            piston.append(groove)
        add(f'Piston{i+1}',f'Cast-iron piston {i+1}','pistons',piston,'cast_iron','Historical cast-iron piston form; length, wall, three groove dimensions and clearance inferred.')
        for k in range(3):
            ring_features=[dict(primitive='tube',operation='add',radius='bore/2-.05',inner_radius='(bore-piston_clearance)/2-1.9',height=3.8,origin=[f'({px})+{40.1+8*k}',y,0],axis=[1,0,0]),box(6,12,.6,[f'({px})+{39+8*k}',f'({y})+bore/2-4',-.3],'cut','Ring split')]
            add(f'Ring{i+1}_{k+1}',f'Piston {i+1} ring {k+1}','pistons',ring_features,'cast_iron','Three rings above the pin; inferred groove, ring and gap dimensions. Retainer pegs not reconstructed.')
        add(f'WristPin{i+1}',f'Wrist pin {i+1}','pistons',[cyl('pin_radius',90,[px,f'({y})-45',0],(0,1,0))],'steel')
        # Tube and bronze ends are separate named solids, matching documented built-up rod construction.
        add(f'RodTube{i+1}',f'Connecting rod steel tube {i+1}','rods',ring(8,5,'rod_length-30',[f'({cx})+15',y,0],(1,0,0)),'steel','Hobbs p.26 built-up rod; dimensions, end fastening and static pose illustrative.')
        for which,x,r,ri in [('BigEnd',cx,27,14.3),('LittleEnd',px,23,'pin_radius+.2')]:
            end=ring(r,ri,18,[x,f'({y})-9',0],(0,1,0))+[cyl(10,22,[f'({x})+{0 if which=="BigEnd" else -22}',y,0],(1,0,0),label='Tube socket')]
            end.append(cyl(ri,20,[x,f'({y})-10',0],(0,1,0),'cut','Reopen bearing bore'))
            end.append(cyl(8.1,15,[f'({x})+{15 if which=="BigEnd" else -30}',y,0],(1,0,0),'cut','Tube socket bore'))
            add(f'{which}{i+1}',f'Bronze rod {which.lower()} {i+1}','rods',end,'bronze','Hobbs built-up rod end material; socket, bearing dimensions and cap split simplified.')
    # Four throws with five main journal stations, no straight shaft through the throws.
    crank=[cyl('journal_radius',52,[0,-70,0],(0,1,0))]
    for i,sign in enumerate([1,-1,-1,1]):
        y=f'{i}*pitch';cx=f'{sign}*stroke/2';xmin='-journal_radius' if sign==1 else '-stroke/2-journal_radius'
        for delta in [-18,10]:crank.append(box('stroke/2+2*journal_radius',8,'journal_radius*2',[xmin,f'({y})+{delta}','-journal_radius'],label='Crank web'))
        crank.append(cyl('journal_radius',20,[cx,f'({y})-10',0],(0,1,0),label='Crankpin'))
        crank.append(cyl('journal_radius','pitch-36' if i<3 else 70,[0,f'({y})+18',0],(0,1,0),label='Main journal'))
    add('Crankshaft','Four-throw crankshaft','crankshaft',crank,'steel','NASA power train arrangement; stroke controls throw. Journal sizes and static 0/180/180/0 phases illustrative, not established firing order.')
    # Perpendicular vertical valve boxes; opposite inlet/exhaust ends.
    for i in range(4):
        y=f'{i}*pitch';x='valve_x'
        chamber=[cyl('valve_box_radius',150,[x,y,-75]),cyl(26,51,[383,y,0],(1,0,0),label='Cylinder connection boss'),
                 cyl('valve_box_radius-6',152,[x,y,-76],op='cut',label='Chamber bore'),cyl(22,53,[382,y,0],(1,0,0),'cut','Gas transfer')]
        for k in range(8):
            angle=k*math.pi/4;dx=math.cos(angle);dy=math.sin(angle)
            chamber.append(cyl(3,20,[f'valve_x+{dx*(radius-12)}',f'({y})+{dy*(radius-12)}',-57],(dx,dy,0),'cut','Exhaust outlet'))
        add(f'ValveBox{i+1}',f'Combustion chamber / valve box {i+1}','valve_boxes',chamber,'cast_iron','Hobbs perpendicular valve-box construction and exhaust ports; scanned exterior guides radius; interior contours and apertures simplified.')
        for name,z,axis in [('Intake',54,(0,0,1)),('Exhaust',-54,(0,0,-1))]:
            valve=[cyl(23,3,[x,y,z],axis,label='Valve head'),cyl(3,68,[x,y,z],axis,label='Valve stem')]
            add(f'{name}Valve{i+1}',f'{name} valve {i+1}','valves',valve,'steel','NASA suction intake/cam-driven exhaust; head/stem union simplified; seat angle unknown.')
            cage=ring('valve_box_radius-6',24,18,[x,y,z],axis)
            add(f'{name}Cage{i+1}',f'{name} valve cage {i+1}','valves',cage,'cast_iron','NASA valve cages; first candidate annular support, four legs and threads omitted.')
            zs=78 if name=='Intake' else -112
            add(f'{name}SpringEnvelope{i+1}',f'{name} spring envelope {i+1}','valves',ring(9,7,34,[x,y,zs]),'steel','Space envelope only: spring wire/turn count/stiffness not reconstructed.')
    add('Camshaft','Exhaust camshaft','camshafts',[cyl('cam_radius',length,[350,-70,-108],(0,1,0))],'steel','NASA chain-driven exhaust camshaft. True cam lobes and event timing not modelled.')
    add('IgnitionShaft','Ignition breaker camshaft','camshafts',[cyl(5,length,[393,-70,-73],(0,1,0))],'steel','NASA ignition shaft; cam profiles, spur gears and timing adjustment omitted.')
    for i in range(4):
        add(f'Rocker{i+1}',f'Exhaust rocker arm {i+1}','camshafts',[box(85,12,8,[345,f'{i}*pitch-6',-120]),cyl(13,12,[357,f'{i}*pitch-6',-116],(0,1,0))],'steel','NASA cam-driven exhaust rocker; flat lever envelope, pivot clearance and roller contact unresolved.')
    # Pitch disks retain the documented 2:1 ratio; chain deliberately omitted, not invented teeth.
    add('CrankTimingDisk','Timing sprocket - 6-tooth pitch envelope','timing',ring(27,14.2,10,[0,-81,0],(0,1,0)),'steel','NASA 6 teeth; disk has no tooth profile and is not a usable sprocket.')
    add('CamTimingDisk','Timing sprocket - 12-tooth pitch envelope','timing',ring(54,9.2,10,[350,-81,-108],(0,1,0)),'steel','NASA 12 teeth; chosen radius ratio 2:1; chain and tooth flanks omitted.')
    # Rim/web/hub one solid; bore fits the same main shaft nominal clearance.
    fw=ring('flywheel_radius',14.2,16,[0,'3*pitch+62',0],(0,1,0))+[cyl('flywheel_radius',8,[0,'3*pitch+58',0],(0,1,0)),cyl(14.2,24,[0,'3*pitch+56',0],(0,1,0),'cut')]
    add('Flywheel','Engine flywheel','flywheel',fw,'cast_iron','NASA power train; approximate scan silhouette, diameter inferred. Restored engine flywheel history differs from lost original.')
    manifold=[box(80,'3*pitch+90',20,[390,-45,75]),box(68,'3*pitch+78',8,[396,-39,81],'cut','Intake gallery')]
    for i in range(4):manifold.append(cyl(25,22,['valve_x',f'{i}*pitch',74],op='cut',label='Intake opening'))
    add('IntakeManifold','Intake manifold','induction',manifold,'aluminium','NASA combustion chamber and scan top manifold; rectangular shell/ports are teaching approximations.')
    mix=[box(170,'3*pitch+80',18,[160,-40,110]),box(156,'3*pitch+66',11,[167,-33,118],'cut','Mixing chamber'),cyl(25,65,[245,'1.5*pitch',112]),cyl(20,67,[245,'1.5*pitch',111],op='cut',label='Open air inlet')]
    add('FuelMixer','Surface fuel-mixing chamber and air inlet','induction',mix,'aluminium','NASA heated surface carburetor role; baffles, metering connection and transfer passage unresolved.')
    for i,y in enumerate([-60,'3*pitch+52']):add(f'WaterPort{i+1}',f'Water outlet connector {i+1}','cooling',ring(16,12,42,[310,y,112]),'bronze','NASA two upper water outlets; scan routing pipes omitted, connector dimensions inferred.')
    add('OilPump','Oil-pump housing envelope','lubrication',[box(60,55,48,[200,-65,-172]),cyl(18,12,[230,-37.5,-124])],'steel','Hobbs lubrication pump; internal gears, oil galleries and drive unresolved.')
    # External purchased generator: space/form study, not a modern high-tension magneto.
    mag=[box(95,90,90,[240,'3*pitch+145',-140]),box(95,90,18,[240,'3*pitch+145',-38]),box(18,90,102,[240,'3*pitch+145',-140]),box(18,90,102,[317,'3*pitch+145',-140])]
    add('Magneto','Low-tension ignition generator envelope','ignition',mag,'steel','NASA electrical system; U-magnet housing approximation. Coils, friction wheel and mounting link not reconstructed; pose provisional.')
    add('IgnitionBus','Ignition bus bar','ignition',[box(4,'3*pitch+30',8,['valve_x+valve_box_radius+5',-15,-15])],'bronze','NASA low-tension bus; individual insulated contacts and leads omitted.')
    spec=dict(schema_version=1,model_id='wright-1903-reconstruction',units='mm',input_mode='mixed',
              scope='First evidence-led teaching reconstruction of the scanned Wright engine. Nominal historical bore/stroke and exterior measurements ground the model; hidden dimensions, casting internals and interfaces remain inferred. Not an exact replica. No operating simulation.',
              coordinate_frame='X cylinder axes from crankshaft toward valve boxes; Y crankshaft; Z up. Mesh alignment approximate raw origin [-46,1.2,-21] cm, scale 10 mm/cm.',
              sources=sources,parameters=params,parts=parts,assumptions=['Mesh cm scale provisional for this cropped file.','Hidden parts constructed from references with estimated dimensions.','Static TDC/BDC pose, not measured firing phases.','No gear teeth, timing chain, real cam profiles, spring wire, galleries, threads or full mounting interfaces.'])
    STUDY.mkdir(parents=True,exist_ok=True);(STUDY/'part-spec.json').write_text(json.dumps(spec,indent=2)+'\n')
    print('Wrote',len(parts),'parts, pitch',pitch,'housing radius',radius)

if __name__=='__main__':main()
