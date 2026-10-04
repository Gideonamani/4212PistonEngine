"""Record the reviewed Wright research inventory before the revision-2 feature plan."""
import hashlib,json
from pathlib import Path
from datetime import datetime,timezone
from cad_pipeline.research_gate import review
R=Path(__file__).resolve().parents[1];STUDY=R/'cad-studies/wright-1903/revision-2'

def main():
    sources={
      'H1':{'url':'https://www.gutenberg.org/files/38739/38739-h/38739-h.htm','title':"Hobbs, The Wright Brothers' Engines and Their Design",'date':'1971','variant':'1903 discussion; surviving rebuilt engine; incompatible drawing sets'},
      'L1':{'url':'https://tile.loc.gov/storage-services/service/mss/mss46706/mss46706-04134/mss46706-04134.pdf','title':'Library of Congress Wright papers engine file (67 scanned pages)','variant':'mixed dates; locators mandatory'},
      'N1':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/timing-system/','title':'NASA Glenn Timing System','variant':'teaching computer model'},
      'N2':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/electrical-system/','title':'NASA Glenn Electrical System','variant':'teaching computer model'},
      'N3':{'url':'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/cooling-system/','title':'NASA Glenn Cooling System','variant':'1903 engine/airframe explanation'},
      'A1':{'url':'https://www.si.edu/object/archives/sova-nasm-1986-0152','title':'NASM.1986.0152 drawing collection finding aid','variant':'multiple drawing lineages; sheets not acquired'},
      'A2':{'url':'https://collection.sciencemuseumgroup.org.uk/objects/co30309/replica-of-1903-wright-brothers-aero-engine','title':'Science Museum 1951-20 working replica','variant':'1951 replica'},
      'M1':{'path':'web/wright-1903-engine.glb','sha256':hashlib.sha256((R/'web/wright-1903-engine.glb').read_bytes()).hexdigest(),'title':'Existing joined exterior mesh','variant':'museum-derived exterior; internal construction invisible'}
    }
    components=[]
    def c(n,name,function,interfaces,parts,decision,disposition='simplified',refs=('H1',),locator=None):
        components.append(dict(id=str(n),name=name,function=function,interfaces=interfaces,part_ids=parts,decision=decision,disposition=disposition,source_ids=list(refs),locator=locator or 'Figure 5, key '+str(n)))
    four=lambda prefix:[prefix+str(i) for i in range(1,5)]
    bearings=[f'MainCap{i}' for i in range(5)];shells=[f'MainBearing{i}_{s}' for i in range(5) for s in ('Lower','Upper')]
    c(1,'End bearing cap','Retain crankshaft end bearing','End plate and main journal',['MainCap0'],'45-degree split cap; attachment sizes estimated')
    c(2,'Cam end bearing cap','Retain timing-end cam bearing','End plate and exhaust shaft',['CamBearing0'],'Three shaft supports; caps simplified')
    c(3,'Detachable end plate','Permit shaft installation','End wall, end bearings',['EndPlate'],'Separate plate; keyhole shaft access; screw holes shown')
    c(4,'End access aperture','Permit bearing/shaft assembly','End plate and casting',['Crankcase'],'Keyhole relief belongs to casting, not a separate part')
    c(5,'Intermediate rib apertures','Support bearing and permit assembly','Intermediate ribs and crankshaft',['Crankcase'],'Three internal keyed ribs; bearing bores and reliefs')
    c(6,'Intermediate bearing caps and lining','Close plain main bearings','Ribs, journals, bolts',bearings[1:4]+shells,'Separate caps and split babbitt liners; 45-degree construction')
    c(7,'Split rib bearing seats','Carry alternating crank loads','Casting ribs, caps',['Crankcase'],'Integral bearing supports; detailed casting radii estimated')
    c(8,'Splash/drip bearing feeds','Distribute lubricant','Main journals and sump',['Crankcase'],'Oil pockets/scuppers represented; flow quantity unverified')
    c(9,'Sump compartment returns','Collect oil','Rib compartments and gallery',['Crankcase'],'Drain openings communicate with return gallery')
    c(10,'Oil return gallery','Connect sump returns','Four compartment drains and pump',['OilReturnGallery'],'External educational pipe representation; buried passage route approximate')
    c(11,'Oil pump','Circulate oil in surviving assembly','Return/feed and worm cross shaft',['OilPumpCase','OilPumpCover','OilPumpGear1','OilPumpGear2'],'Rebuilt-engine accessory; original 1903 inclusion disputed')
    c(12,'Pump feed union','Join pump to distribution hose','Pump outlet and feed hose',['OilFeedUnion'],'Union and pipe bore represented')
    c(13,'Oil delivery hose and cylinder feeds','Oil upper thrust faces','Pump, distributor and liner holes',['OilFeedHose','OilDistributor']+four('OilJet'),'Four jet drillings; no pressure-fed main bearings claimed')
    c(14,'Oil pump drive','Drive selected accessory','Crank worm, cross shaft and pump',[],'Narrative crankshaft worm/cross-shaft route selected as research direction; conflicting Figure 5 cam drive and unavailable drive dimensions prevent defensible placed geometry. Acquire chosen-lineage drive drawing.',disposition='deferred',locator='Figure 5 key 14; p.28 narrative conflict')
    c(15,'Big-end nuts, lock strips and shims','Close and secure bearing','Split rod ends and crankpins',four('BigCap')+four('BigShim')+four('BigLock')+four('BigBoltA')+four('BigBoltB'),'Cap split, shim, two bolt/nut assemblies and locking strip; threads omitted')
    c(16,'Wrist-pin lock','Prevent pin movement in piston','Piston boss and pin',four('PinLock'),'Setscrew shown; nominal engagement only')
    c(17,'Ring retaining pegs','Prevent ring rotation','Piston grooves and split rings',[f'RingPeg{i}_{k}' for i in range(1,5) for k in range(3)],'Three pins aligned with ring gaps; small clearances estimated')
    c(18,'Threaded liner','Form short bore and partial head','Case, box boss and gasket',four('Sleeve'),'Nominal bore/wall; engagement lands and oil holes; thread pitch unresolved')
    c(19,'Open air can','Admit air and gravity fuel','Hot-plate mixer and fuel nozzle',['AirCan'],'Open both ends, rim beads and entering fuel pipe')
    c(20,'Gravity fuel supply','Meter and shut off fuel','External tank and open air can',['FuelLine','FuelShutoff','FuelMeter'],'Engine-side pipe and two distinct cocks; tank outside assembly')
    c(21,'Hot-plate vaporizer','Vaporize and route charge','Hot casting wall, ribs, can, intake box',['Crankcase','HotPlateCover'],'Integral vertical baffles with sheet-steel cover, not standalone carburetor body')
    c(22,'Make-and-break igniter assembly','Ignite charge on contact separation','Busbar, chamber and lever shaft',four('FixedElectrode')+four('MovingContact'),'Fixed electrode and moving contact remain distinct')
    c(23,'Fixed positive electrode','Carry insulated feed into chamber','Busbar and moving contact',four('FixedElectrode')+four('ElectrodeInsulator'),'Insulated bushing and internal tip; platinum category on tips')
    c(24,'Movable contact','Close then snap open circuit','Oscillating shaft and fixed tip',four('MovingContact'),'Internal lever/contact mounted on oscillating shaft')
    c(25,'Igniter shaft lever','Transmit breaker motion','Moving contact shaft and paired lever',four('IgniterLever'),'Separate lever, through-neck shaft and bearing')
    c(26,'Cam/snap lever','Load release springs','Ignition cam and igniter lever',four('TripLever'),'Visible lever pair; exact snap timing unverified')
    c(27,'Igniter shaft bearing','Guide and seal oscillation','Chamber neck and shaft',four('IgniterBearing'),'Bronze support sleeve with through bore')
    c(28,'Chamber neck','Carry sealed igniter penetration','Valve box and igniter bearing',four('ValveBox'),'Integral boss and through bore')
    c(29,'Ignition main spring','Store contact-opening energy','Snap levers and chamber bracket',four('IgnitionMainSpring'),'Real helical wire; dimensions/rate estimated')
    c(30,'Inter-spring','Couple/load paired lever action','Igniter and trip levers',four('IgnitionInterSpring'),'Separate helical spring; topology shown, stiffness unverified')
    c(31,'Bent-strip ignition cams','Actuate snap mechanism','Ignition shaft and trip lever',four('IgnitionCam'),'Bent-section approximation; no certified timing law')
    c(32,'Positive busbar','Feed four parallel igniters','Generator feed and four electrode terminals',['Busbar']+four('BusLink'),'Dogleg bar clears boxes; each chamber gets separate connection')
    c(33,'Valve cage retaining rings','Clamp cages on shoulders','Cage and threaded valve-box mouth',[f'{v}Retainer{i}' for i in range(1,5) for v in ('Intake','Exhaust')],'Ring nuts shown separately; thread helices omitted')
    c(34,'Igniter sealing disc','Seal contact penetration','Chamber neck and oscillating shaft',four('IgniterSeal'),'Thin separate seal; material/construction estimate')
    c(35,'Exhaust apertures','Discharge after lower cage','Exhaust cage window space and atmosphere',four('ValveBox'),'Eight obround apertures per housing; count read from mesh/figures, exact machining dimensions estimated')
    c(36,'Hollow exhaust camshaft','Transmit half-speed valve motion','Chain, separate cams, three bearings',['Camshaft']+four('ExhaustCam')+[f'CamBearing{i}' for i in range(3)]+['CamWasherA','CamWasherB'],'Hollow shaft and locating washers; separate cam parts')
    c(37,'Sliding ignition gear/sleeve','Drive and adjust breaker phase','Equal spur gear, pin and spring',['IgnitionGear','IgnitionGearSpring','ExhaustGear'],'1:1 gear pair and 45-degree sleeve slot; tooth flanks illustrative')
    c(38,'Solid ignition shaft','Carry bent strip cams','Sliding gear, support bearings and four cams',['IgnitionShaft']+[f'IgnitionBearing{i}' for i in range(3)],'Solid small bar; support lug geometry estimated')
    c(39,'Angled sleeve slot and pin','Convert axial slide into relative rotation','Ignition sleeve and shaft pin',['IgnitionGear','IgnitionDrivePin'],'Actual inclined slot and driven transverse pin, not a solid envelope')
    c(40,'Spark advance lever cam','Set gear axial position','Sliding sleeve and opposing spring',['AdvanceCam','AdvanceLever','AdvanceBracket'],'Pivot/cam/handle assembly; pilot use conflict retained')
    c(41,'Separate exhaust cams','Lift rocker roller','Hollow shaft and roller',four('ExhaustCam'),'Rounded lobe silhouette approximates rapid rise/dwell; profile not authenticated')
    c(42,'Rocker rollers','Reduce sliding contact','Cam, lever cheeks and valve stem',four('CamRoller')+four('ValveRoller'),'Two actual rollers per rocker with separate axles')
    c(43,'Two-cheek rocker','Transfer lift to exhaust valve','Pivot axle and both roller axles',four('RockerLeft')+four('RockerRight')+four('RockerPivot')+four('CamRollerAxle')+four('ValveRollerAxle'),'Native planar profiles with three axle holes; source Fig.6 construction')
    c(44,'Generator magnet/coil assembly','Supply low-tension ignition','Armature shaft, friction drive and base',['MagnetoBase','MagnetoMagnet','MagnetoCoil1','MagnetoCoil2','MagnetoArmature','GeneratorLead','GroundLead'],'Visible horseshoe, two coil bodies, armature and leads; winding/poles unresolved')
    c(45,'Generator friction drive','Drive armature off flywheel rim','Flywheel and generator shaft',['MagnetoDriveWheel','MagnetoShaft'],'Wheel tangent to flywheel; friction material inferred')
    c(46,'Generator sight-feed lubricator','Oil generator sleeve bearing','Generator stationary bearing',['SightOiler'],'Cup, stem and cap represented; interior metering unresolved')
    c(47,'Hardwood chain tensioner','Support timing-chain span','Timing-end bracket and chain',['ChainTensioner','TensionerBracket'],'Block chosen from H1 rather than NASA tension wheel')
    c('S01','Casting and upper cover','Enclose crank/jacket','Ribs, liners, feet and closure',['Crankcase','Cover']+bearings+['MainCap4']+four('MountBolt'),'One-piece sloping hollow casting; steel top closure',locator='pp.14–16; Figures 2,5,6')
    c('S02','Piston/pin/rings','Seal and transmit gas force','Liner, bronze little end and pin',four('Piston')+four('WristPin')+[f'Ring{i}_{k}' for i in range(1,5) for k in range(3)],'Long cast iron piston; three compression rings above pin; no bottom scraper',locator='pp.19–20; Figure 6')
    c('S03','Three-piece connecting rods','Transmit reversing load','Pin, crankpin and locking bolts',four('RodTube')+four('BigEnd')+four('LittleEnd')+four('LittleClamp')+four('RodPinA')+four('RodPinB'),'Science Museum direct-thread lineage; no Smithsonian adapters',locator='pp.26–27; Figures 5–7')
    c('S04','Crankshaft/flywheel/drive wheels','Convert/load/smooth power','Five main bearings and external propeller chains',['Crankshaft','Flywheel','FlywheelKey','PropellerDriveA','PropellerDriveB'],'No counterweights; surviving shaft/flywheel are from 1904–05',locator='pp.7,27–28; Figures 2,5')
    c('S05','Valves, seats and open cages','Admit and exhaust charge','Box shoulders, manifold and rocker',[f'{v}{suffix}{i}' for i in range(1,5) for v in ('Intake','Exhaust') for suffix in ('Head','Stem','Cage','Spring','SpringWasher')],'Cast-iron heads/cages; steel separate stems; four windows per cage; real helical springs',locator='pp.17–20,57–58; Figures 5–7')
    c('S06','Timing chain and sprockets','Maintain 2:1 speed','Crank and cam axes',['CrankSprocket','CamSprocket','TimingChain'],'Rollers/plates and cut tooth pockets; pitch layout solved; flank/contact engineering remains approximate',refs=('H1','L1','N1'),locator='p.21; Figure 5; L1 p.65')
    c('S07','Water/gas joint gaskets','Seal common head joint','Case flange, liner and valve box',four('HeadGasket'),'Separate annular gasket; exact material/compression unknown',locator='p.16; Figure 6')
    c('S08','Intake manifold','Distribute hot mixture','Mixer outlet and four suction cages',['IntakeManifold'],'Shallow sheet-steel box with four open connections, not aluminum',locator='p.23; Figures 5,6')
    c('S09','Coolant fittings/hoses','Feed bottom and return at top','Jacket and external radiator',['WaterInlet','WaterReturnA','WaterReturnB','WaterHoseIn','WaterHoseA','WaterHoseB'],'Three engine-side open connections; radiator belongs to airframe',refs=('H1','N3'),locator='Figure 6; NASA cooling system')
    c('S10','External service equipment','Feed fuel/coolant and start ignition','Fuel cock, coolant hoses and generator',[],'Radiator, elevated tank, starting dry cells/coil and long propeller chains require airframe installation study','outside_scope',('H1','N2','N3'),'pp.24–25; NASA cooling/electrical')
    c('S11','Later-engine features','Identify excluded variants','Cylinder/case redesign',[],'No compression release, fuel pump, auxiliary barrel exhaust or vertical-cylinder components','outside_scope',('H1',),'pp.29–33,34–56')
    mechanisms=[
      dict(id='load',source_ids=['H1'],components=['6','7','15','16','S02','S03','S04'],path='piston -> locked pin -> bronze little end -> steel tube -> split bronze big end -> crankpin -> cheeks/journals -> five split main bearings -> casting ribs/feet',checks=['nominal throw','pin/rod alignment','five main station alignment','split cap and shell construction','ring position inside short liner']),
      dict(id='gas',source_ids=['H1'],components=['18','19','20','21','33','35','S05','S07','S08'],path='gravity nozzle + air can -> baffled hot plate -> low manifold -> suction inlet cage/valve -> chamber/liner -> exhaust valve/cage -> wall apertures',checks=['continuous open ports','four cage windows','retainer shoulders','valve head diameter/lift','jacket excludes valve boxes']),
      dict(id='timing',source_ids=['H1','L1','N1'],components=['36','41','42','43','47','S06'],path='crank 6T -> roller chain -> cam 12T -> separate lobe -> cam roller -> two cheeks/pivot -> valve roller -> exhaust stem',checks=['2:1 tooth ratio','integer chain pitch closure','roller/cam and roller/stem tangency','three cam bearing stations']),
      dict(id='ignition',source_ids=['H1','N2'],components=['22','23','24','25','26','27','29','30','31','32','37','38','39','40','44','45','46'],path='flywheel friction rim -> generator -> positive lead/busbar -> insulated electrode -> moving contact -> grounded engine; 1:1 gears -> sliding sleeve/pin -> strip cams -> paired levers/springs -> contact snap',checks=['equal gear pitch diameters/centers','inclined slot with shaft pin','four individual bus links','fixed/moving contact separation','drive-wheel/flywheel tangency']),
      dict(id='oil',source_ids=['H1'],components=['8','9','10','11','12','13','14','46'],path='sump compartments -> gallery -> selected rebuilt pump -> feed union/hose -> distributor/four jets -> upper liner thrust faces -> splash/drip returns',checks=['four jets communicate with liner holes','pump inlet/outlet opens','cross shaft route kept distinct from contradictory cam-drive key']),
      dict(id='coolant',source_ids=['H1','N3'],components=['18','S07','S09'],path='external radiator -> lower hose/inlet -> shared jacket around barrels -> two upper returns -> external radiator',checks=['three open jacket connections','no water pump','uncooled valve boxes','liner wall and gasket joint'])
    ]
    inventory=dict(schema_version=1,target='Surviving rebuilt horizontal four-cylinder engine; Science Museum construction lineage',
      decision='Ready for detailed static teaching CAD with explicitly estimated manufacturing details; exact 1903 reproduction and operating dynamics remain unverified.',
      reviewed_at=datetime.now(timezone.utc).isoformat(),sources=sources,expected_callouts=[str(i) for i in range(1,48)],components=components,mechanisms=mechanisms,
      reviewed_locators=['H1 pp.1–8,9–28,29–33,57–64; relevant variant differences pp.34–56','H1 Figures 1–7; all Figure 5 keyed numbers','L1 contact sheet all pages; enlarged pp.1,4,7,63,65–67','N1/N2/N3 full mechanical-operation sections','A1/A2 catalogue lineage/access records'],
      conflicts=[dict(topic='Oil pump',decision='Surviving accessory; narrative crankshaft worm/cross shaft selected; original 1903 presence unresolved; Fig.5 key cam drive not adopted'),dict(topic='Rod joints',decision='Science Museum direct-thread steel tube to bronze ends; Smithsonian adapter/brazed route excluded'),dict(topic='Timing tensioner',decision='H1 hardwood block rather than N1 wheel'),dict(topic='Pilot advance/firing phases',decision='Control hardware represented; in-flight use and phase certification withheld'),dict(topic='Bearing materials',decision='H1 direct phosphor bronze rod ends; babbitt main/cam shells')],
      gaps=[dict(topic=t,blocks_selected_scope=False,next_evidence=e,modelling_consequence=c) for t,e,c in [
       ('Exact dimensions/threads','Acquire a complete chosen-lineage dimensioned drawing set','Nominal documented bore/stroke/valves/wall retained; other dimensions labelled estimates'),
       ('Cam law and phases','Chosen-lineage timing drawings and measurements','Static lobes; no authenticated running animation'),
       ('Mesh scale/global agreement','Independent visible dimension with scan correspondence','Candidate 10 mm/import-unit; limited ROI comparisons; no whole-mesh recovery claim'),
       ('Spring properties','Wire diameter, coil count and load/deflection measurements','Helical visual geometry estimated; no spring rate claim'),
       ('Generator/pump internals','Accessory-specific drawings','Named visible structure and illustrative internals; no performance certification')]])
    STUDY.mkdir(parents=True,exist_ok=True);(STUDY/'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
    (STUDY/'research-readiness.json').write_text(json.dumps(review(inventory),indent=2)+'\n')
    root=R/'build/wright-reconstruction-v2/research';files={p.name:dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in root.iterdir() if p.suffix in ('.html','.pdf','.jpg')}
    (STUDY/'source-manifest.json').write_text(json.dumps(dict(access_date='2026-10-04',sources=sources,local_research_root=str(root.relative_to(R)),files=files,unavailable=['Official Smithsonian PDF returned service interruption; no local source acquired']),indent=2)+'\n')
    print(json.dumps(review(inventory),indent=2))
if __name__=='__main__':main()
