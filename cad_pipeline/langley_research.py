"""Record the reviewed Langley / Manly-Balzer research inventory before the feature plan.

The inventory is the commitment: every part ID named here must be built by the specification, and every part the
specification builds must be named here (`research_gate.review` checks both ways). Weight-table coverage is checked here
because that table, not a figure key, is the source list for this engine.
"""
import hashlib,json
from pathlib import Path
from cad_pipeline.research_gate import review
R=Path(__file__).resolve().parents[1];STUDY=R/'cad-studies/langley-manly-balzer-1903'
RESEARCH=R/'build/langley-research'

# Manly's "Detailed weight of new large engine" (M1 p. 250), checked against the page image. Grammes. `engine` marks the
# lines inside the printed 56,323 g total (124.17 lb), the "engine proper".
WEIGHT_TABLE=[
 ('W01','Crank shaft',5225,True),
 ('W02','Connecting rods (total)',5005,True),
 ('W03','Pistons (five)',1652+1647+1655+1660+1646,True),
 ('W04','Cylinders (five, including exhaust and inlet valves, oil cups, etc.)',4768+4685+4638+4637+4796,True),
 ('W05','Port crank chamber drum, including cam, cam gears, punch rods, etc.',5225,True),
 ('W06','Starboard crank chamber drum',3440,True),
 ('W07','Spark plugs (5)',450,True),
 ('W08','Outlet water pipe',450,True),
 ('W09','Inlet water pipe',360,True),
 ('W10','Inlet gas manifold',1700,True),
 ('W11','Primary and secondary sparkers and wires',512,True),
 ('W12','Balance arm with braces, starboard',1040,True),
 ('W13','Balance arm with braces, port',1067,True),
 ('W14','Starboard fly wheel',3946,False),
 ('W15','Port fly wheel',3234,False),
 ('W16','Spark coil and batteries',6800,False),
 ('W17','Carburetor',3751,False),
 ('W18','Inlet gas pipe from carburetor to manifold',756,False),
 ('W19','Gasoline tank',1004,False),
 ('W20','Water tank',717,False),
 ('W21','Water circulating pump and shaft',807,False),
 ('W22','Radiator',7700,False)]
PRINTED_TOTALS=dict(engine=56323,engine_and_flywheels=63503,power_plant=85038)

def five(prefix,suffix=''):return [f'{prefix}{i}{suffix}' for i in range(1,6)]
def five_each(prefix,subs):return [f'{prefix}{i}_{s}' for i in range(1,6) for s in subs]

def sources():
    local={p.name:dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(RESEARCH.glob('*')) if p.is_file() and p.suffix in ('.pdf','.txt')} if RESEARCH.is_dir() else {}
    return dict(
     M1={'url':'https://archive.org/details/langleymemoironm00langrich','title':'Manly, Langley Memoir on Mechanical Flight, Part II (1897-1903), Smithsonian Contributions to Knowledge vol. 27 no. 3','date':'1911','variant':'large 1901 engine, drawings Plates 78-81, tests 1902-1904','local_files':{k:v for k,v in local.items() if k.startswith('memoir')}},
     A1={'url':'https://doi.org/10.5479/si.AnnalsFlight.6','title':"Meyer (ed.), Langley's Aero Engine of 1903, Smithsonian Annals of Flight 6",'date':'1971','variant':'documentary history of the rotary and radial stages; reprints M1 ch. X; 1933 affidavits are partisan','local_files':{k:v for k,v in local.items() if k.startswith('annals')},'note':'low-resolution PDF supplied by the user; the repository sits behind a bot-verification page that was not bypassed'},
     N1={'url':'https://www.airandspace.si.edu/collection-objects/langley-manly-balzer-radial-5-engine/nasm_A19080003000','title':'NASM object record A19080003000','variant':'museum record of the surviving engine','note':'automated fetch returned HTTP 403; known only from a search-result excerpt'},
     W1={'url':'https://en.wikipedia.org/wiki/Manly%E2%80%93Balzer_engine','title':'Wikipedia: Manly-Balzer engine','variant':'secondary; cross-check only'},
     E1={'url':'https://enginehistory.org/Piston/Before1925/EarlyEngines/M/M.shtml','title':'AAHS Engine History: Selected Early Engines, M','variant':'secondary; cross-check only'},
     U1={'title':'Commissioning brief (6 October 2026)','variant':'claims checked in research.md, section Corrections'})

def build():
    components=[]
    def c(cid,name,function,interfaces,parts,decision,disposition='modelled',refs=('M1',),locator='',covers=()):
        components.append(dict(id=cid,name=name,function=function,interfaces=interfaces,part_ids=list(parts),decision=decision,disposition=disposition,source_ids=list(refs),locator=locator,covers=list(covers)))
    # --- crank system
    c('L01','Hollow crankshaft and single crank pin','Carry the load of five rods and deliver torque and oil','Two bronze main bushings, master sleeve, balance-arm flanges, worm wheel, cam pinion, ignition ring',['Crankshaft','CrankPlug','CrankOilPipe'],'One steel forging: hollow shaft in two halves, a crank arm each side of the pin (the shaft runs in a bearing in each drum head), one hollow crank pin carrying the cone-nut threads that were left from the pure-slipper design; oil path drilled through shaft, arm and pin; arm and pin proportions measured from Plate 78','modelled',('M1','A1'),'M1 pp. 237-239, 245-246; Plate 78',['W01'])
    c('L02','Main bearing bushings','Carry the shaft in each drum hub','Drum hubs, shaft journals, oil grooves',['PortMainBushing','StbdMainBushing'],'Bronze bushings with the circular oil groove on the port side','modelled',('M1',),'M1 p. 239; Plate 78',['W01','W05','W06'])
    c('L03','Coupling flanges','Join the transmission shafts to the crankshaft and clamp the balance arms','Crankshaft ends, balance arms, transmission shafts (outside)',['CouplingFlangePort','CouplingFlangeStbd'],'Flange pair at each shaft end; bolt circle estimated; transmission shafts excluded','simplified',('M1',),'M1 p. 247; Plates 78, 80',['W12','W13'])
    c('L04','Balance arms with braces','Balance the reciprocating masses at a large radius for little weight','Coupling flanges, braces',['BalanceArmPort','BalanceArmStbd','BalanceBracePort','BalanceBraceStbd','BalanceBracePlatePort','BalanceBracePlateStbd','BalanceBraceCollarPort','BalanceBraceCollarStbd'],'Flat arm bolted between the flanges ending in a lozenge lug, inclined tube brace at about 30 degrees to a plate on the lug and a collar on the shaft; sizes measured from Plates 79 and 80','modelled',('M1',),'M1 pp. 246-247; Plates 78-80',['W12','W13'])
    # --- connecting rods
    c('L05','Master connecting rod, split sleeve and bronze lining','Carry load directly to the crank pin and carry the four slipper shoes on its sleeve','Crank pin, gudgeon pin, link shoes, cone nuts',['MasterRod','MasterSleeveCap','MasterLiningUpper','MasterLiningLower'],'7/8 in solid steel rod whose forged upper sleeve half is integral; cap half; bronze lining split at right angles to the sleeve; sleeve turned round except where the rod joins it; threads for the cone nuts; how the halves are held together is not drawn clearly enough to state','modelled',('M1','A1'),'M1 pp. 237-238; A1 pp. 113, 186; Plate 78',['W02'])
    c('L06','Link rods with bronze slipper shoes','Carry piston load into the master sleeve while sliding on it','Gudgeon pins, master sleeve, cone nuts',[f'LinkRod{i}' for i in range(2,6)]+[f'LinkShoe{i}' for i in range(2,6)],'7/8 in rods with a 5/8 in hole; bronze shoe about 55 to 60 degrees wide, width and rod length measured together from Plate 78 (closure check in operating-motion.md)','modelled',('M1',),'M1 pp. 237-238, 240; Plate 78',['W02'])
    c('L07','Little-end bushings','Bear the gudgeon pins','Rod heads, gudgeon pins',five('WristBush'),'Bronze bushings with oil grooves in all five rod heads','modelled',('M1',),'M1 p. 240',['W02'])
    c('L08','Sleeve cone nuts and jam nuts','Hold the four shoes on the sleeve and allow wear adjustment','Sleeve threads, shoe flanks',['ConeNutPort','ConeNutStbd','JamNutPort','JamNutStbd'],'One tapered nut at each end of the sleeve locked by a jam nut; thread detail not modelled','modelled',('M1',),'M1 p. 238; Plate 78',['W02'])
    # --- pistons
    c('L09','Pistons','Transmit gas load; cast iron, domed two-rib crown, thin walls','Liner, rings, gudgeon pin',five('Piston'),'Cast-iron piston with domed crown and two deep thin reinforcing ribs; clearance 0.127 mm at the middle and 0.19 mm at the ends; wall and crown thickness measured, the lighter set drawn','modelled',('M1',),'M1 pp. 239-240; Plate 78',['W03'])
    c('L10','Piston rings','Seal the piston','Piston grooves, liner',five_each('PistonRing',['1','2','3','4']),'Four lap-joint rings narrower than their grooves by 0.0508 to 0.0889 mm (documented), 1/64 in lap clearance; ring section estimated','modelled',('M1',),'M1 p. 240',['W03'])
    c('L11','Gudgeon pins and retainers','Join piston to rod','Piston bosses, bushings, rod head',five('GudgeonPin')+five_each('PinRetainer',['a','b']),'Hollow case-hardened steel tubes 7/8 in outside diameter (bore not given); retaining screws shown at both ends in Plate 78, count and form read from the plate','modelled',('M1',),'M1 p. 240; Plate 78',['W03'])
    # --- cylinders
    c('L12','Cylinder shells with integral heads','Contain the pressure','Liner, flange, combustion chamber, jacket, spark plug',five('CylShell'),'Seamless 1/16 in steel shell with domed head formed integral (cold-drawn closed-end tube, M1 and A1); plug boss in the dome','modelled',('M1','A1'),'M1 p. 235; A1 pp. 102, 104; Plate 78',['W04'])
    c('L13','Cylinder mounting flanges','Bolt each cylinder to the drum rings','Shell, drum rings, bolts',five('CylFlange'),'Flange screwed and brazed on near the shell bottom; drilled with a jig to fit the drum rings (A1 p. 180)','modelled',('M1','A1'),'M1 p. 235; A1 p. 180; Plates 78, 79',['W04'])
    c('L14','Cast-iron liners','Wearing surface for the piston','Shell bore, piston',five('CylLiner'),'1/16 in wall, shrunk into the shell and bored in place','modelled',('M1','A1'),'M1 pp. 234-235; A1 p. 180',['W04'])
    c('L15','Forged combustion chambers with exhaust chamber and outlet','Carry the valves and the side port into the cylinder; keep exhaust off the port bearing','Shell (brazed), jacket, inlet seat, exhaust seat, guide',five('Chamber')+five('ExhaustOutlet'),'Machined from a solid steel forging and brazed to the shell near the top; chamber below the exhaust seat with a side outlet; internal passages read from Plate 78','modelled',('M1',),'M1 pp. 235, 240; Plate 78',['W04'])
    c('L16','Sheet-steel water jackets','Contain coolant around shell and chamber','Shell, chamber, jacket ring, water stubs',five('Jacket')+five('JacketRing')+five('WaterInletStub')+five('WaterOutletStub'),'0.020 in sheet steel brazed on, ending in a ring that encircles the cylinder near mid-length; inlet and outlet stubs read from Plate 78','modelled',('M1','A1'),'M1 pp. 235-236; Plate 78',['W04','W08','W09'])
    c('L17','Automatic inlet valves, seats and springs','Admit mixture on suction with no drive','Chamber, removable cast-iron seat, nut, manifold branch',five('InletValve')+five('InletSeat')+five('InletSeatNut')+five('InletSpring')+five('InletSpringCap'),'Cast-iron seat held by a nut in the upper part of each chamber; valve with a stem, a spring and a cap; lift illustrative','modelled',('M1','A1'),'M1 p. 240; A1 p. 186; Plate 78',['W04'])
    c('L18','Exhaust valves, guides and springs','Release exhaust when struck by the punch rod','Chamber, seat, guide, punch rod',five('ExhaustValve')+five('ExhaustSeat')+five('ExhaustGuide')+five('ExhaustSpring')+five('ExhaustSpringCollar')+five('ExhaustSpringNut'),'Stem passes through a long coil spring and ends 1/64 in above the punch rod; lift illustrative; seat angle and head diameter measured','modelled',('M1',),'M1 pp. 237, 240; Plate 78',['W04'])
    c('L19','Spark plugs','Ignite each charge','Shell dome boss, wire',five('PlugShell')+five('PlugInsulator')+five('PlugElectrode'),'Central plug in each dome with the metal part extended about 3/4 in beyond the porcelain and a platinum wire counter-electrode (M1 pp. 221-222); form read from Plate 78','modelled',('M1',),'M1 pp. 221-222; Plate 78',['W07'])
    c('L20','Piston oil cups and tubes','Gravity-feed oil to each piston','Cylinder wall, tube through wall',five('OilCup')+five('OilCupTube'),'Crescent-shaped cups of 0.003 in sheet steel, riveted and soldered, holding about an hour of oil; tubes through the wall at equal intervals','simplified',('M1',),'M1 p. 239',['W04'])
    c('L21','Cylinder-to-drum bolts','Clamp the flanges to the drum rings','Flanges, drum rings',five_each('CylBolt',['1','2','3','4']),'Four bolts per flange; count and circle are an estimate from Plates 78 and 79','simplified',('M1',),'Plates 78, 79',['W04','W05','W06'])
    # --- drums and gearing
    c('L22','Port crank-chamber drum (head, hub and knee brackets)','Support the shaft and the cylinders on the exhaust side and carry the valve gear','Port bushing, flanges, port bed plate, cam ring, punch-rod guides',['PortDrum','PortDrumBushingFlange'],'Built-up steel drum with symmetric hub, two cylinder rings and knee brackets; flanged bushing with tongues and grooves joins the hub to the bed plate with a gap for the cam and punch rods','modelled',('M1','A1'),'M1 p. 237; A1 p. 180; Plate 78',['W05'])
    c('L23','Starboard crank-chamber drum','Support the shaft on the ignition side','Starboard bushing, flanges, bed plate','StbdDrum StbdDrumBolts1 StbdDrumBolts2 StbdDrumBolts3 StbdDrumBolts4'.split(),'Drum like the port one; the starboard bed plate web is drawn against its face by bolts','modelled',('M1',),'M1 p. 237; Plate 78',['W06'])
    c('L24','Double-pointed ring cam','Lift all five exhaust valves','Port hub, rollers, gear train',['CamRing'],'Annular cam journalled on the exterior of the port hub, two lobes, driven by a train of gears on studs on the drum; a tooth ring at its outboard end takes the drive (the form of the teeth is not documented and is drawn external); profile illustrative (slant was reduced on 8 January 1902)','modelled',('M1','A1'),'M1 p. 237; A1 p. 108; Plates 78, 79',['W05'])
    c('L25','Cam reduction gear train','Drive the cam at one quarter crank speed in reverse','Crankshaft pinion, studs on the drum, cam ring teeth',['CamPinion','CamGearLarge','CamGearSmall','CamIdler','CamStud'],'Reversing train of three external meshes (pinion to large gear, small gear to idler, idler to cam-ring teeth), net 1:4 reverse; tooth counts 24/48/18/20/36 (pinion, large gear, small gear, idler, cam-ring teeth) derived to give exactly 1:4 with no two gears of a plane overlapping, layout interpreted from a very crowded plate','modelled',('M1',),'M1 pp. 237, 246; Plate 79',['W05'])
    c('L26','Punch rods, rollers and guides','Transmit cam lift to the exhaust stems','Cam ring, guide, exhaust stem 1/64 in above',five('PunchRod')+five('PunchRoller')+five('PunchGuide'),'Hardened rollers on the cam; rods slide in guides on the port drum; 1/64 in gap documented','modelled',('M1','A1'),'M1 p. 237; A1 p. 180; Plates 78, 79',['W05'])
    c('L27','Port lubrication','Feed the port bearing, hollow shaft and crank pin','Port hub groove, crankshaft',['PortOilCup','PortOilCupTube'],'Small oil cup on the port bed plate feeding the hub groove','simplified',('M1',),'M1 p. 239; Plate 78',['W05'])
    # --- ignition
    c('L28','Ignition drive sleeve and gears','Drive the sparker cam and distributor from the crankshaft','Starboard hub, ring on the crankshaft, sparker gear, distributor gear',['SparkSleeve','SparkSleeveRing','SparkGearLarge','SparkPinion'],'Gear formed on a sleeve that telescopes over the starboard hub and ends in a ring fixed to the crankshaft; gear train read from Plate 81, tooth counts to be read or derived to give 2.5x and 0.5x','modelled',('M1',),'M1 pp. 237, 241; Plate 81',['W11'])
    c('L29','Primary sparker','Make and break the primary circuit five times in two revolutions','Sparker cam, pawl and spring, contact, coil (outside)',['SparkerCam','SparkerPawl','SparkerSpring','SparkerBracket','SparkerContact'],'One-lobe cam at 2.5x acting on a pawl on a spring; wire contact; read from Plate 81','modelled',('M1',),'M1 p. 241; Plate 81',['W11'])
    c('L30','Secondary distributor and wires','Distribute the high-tension spark to the five plugs','Distributor disc, five-section commutator, wires, plugs',['DistributorDisc','DistributorBrush','CommutatorBody']+five('CommutatorSegment')+five('SparkWire'),'Disc at 0.5x with a brush over a five-section commutator in hard rubber (after red fibre failed); wires insulated by telescoped rubber tubing; routing illustrative','modelled',('M1',),'M1 pp. 241-242; Plate 81',['W11','W07'])
    c('L31','Spark timing handle','Adjust the timing of the spark','Sparker bracket, bed plate',['SparkTimingLever','SparkTimingClamp'],'Long handle with a wing nut visible in Plate 81; role interpreted from the plate (not captioned); only the portion inside the assembly is modelled','simplified',('M1',),'Plate 81',['W11'])
    # --- bed plates, start, pump drive
    c('L32','Bed plates','Carry each drum and hang the engine on the Aerodrome frame','Drums, frame tubes (outside)',['PortBedPlate','StbdBedPlate'],'Elongated-diamond steel tubing with a sheet-steel web brazed to the tubes (A1 p. 179 affidavit, consistent with Plate 81); frame tubes and clamps excluded','simplified',('M1','A1'),'A1 p. 179; Plates 79-81',['W05','W06'])
    c('L33','Starting mechanism','Let the aviator restart the engine in the air','Worm wheel on the crankshaft, sliding worm, tubular shaft, two brackets',['WormWheel','StartWorm','StartShaft','StartBracketUpper','StartBracketLower','StartPawlPlug'],'Sliding worm on a tongued and grooved tubular shaft, spring pawl plug and release wire; shaft ends at the Aerodrome cross-frame where the ratchet crank begins (the crank and ratchet are outside)','simplified',('M1',),'M1 p. 244; Plates 79, 80',['W05'])
    c('L34','Pump drive','Drive the circulating pump at three times engine speed','Bevel gear on the worm-wheel hub, pinion, vertical splined shaft',['PumpBevelGear','PumpBevelPinion','PumpShaftUpper','PumpShaftBearing'],'Bevel pair and the upper part of the vertical shaft with its telescoping splined joint; the pump and the lower shaft are outside the assembly','simplified',('M1',),'M1 pp. 241, 244; Plates 79, 80',['W05','W21'])
    # --- pipes
    c('L35','Inlet gas manifold','Distribute mixture to the five automatic inlet valves','Five inlet seats, carburetor connection (outside)',['InletRingA','InletRingB','InletRingC']+['InletFlangeA1','InletFlangeA2','InletFlangeB1','InletFlangeB2','InletFlangeC1','InletFlangeC2','CarbConnection','AirValvePipe','AirValveSleeve'],'Tube bent to a circle with five branches (the branch tubes are part of the three segments), cut in three places and joined by flanges; rotating sleeve air valve on the vertical pipe; the connection to the carburetor ends at the assembly boundary','modelled',('M1',),'M1 p. 240; Plates 79, 80',['W10'])
    c('L36','Water inlet manifold','Deliver coolant to the five jackets','Jacket inlet stubs, vertical riser to the pump (outside)',['WaterInletRing','WaterInletRiser'],'Circular manifold on the starboard side meeting the five inlet stubs (the short rubber connections are omitted); riser stops at the assembly boundary','modelled',('M1',),'M1 p. 240; Plates 79, 80',['W09'])
    c('L37','Water outlet manifold','Collect heated water from the jackets and return it to the radiators','Jacket outlet stubs, two connections to the radiators (outside)',['WaterOutletRing','WaterOutletConnectionFront','WaterOutletConnectionRear'],'Circular manifold on the port side with two connections, meeting the five outlet stubs (rubber connections omitted); radiators outside','modelled',('M1',),'M1 p. 240; Plates 79, 80',['W08'])
    # --- outside the selected assembly
    # --- flywheels and shaft stubs (in scope by the user's decision of 6 October 2026; outside the 124.17 lb engine proper)
    c('L40','Flywheels (two) with tangent wire spokes','Smooth the torque fluctuations after the transmission shafts overheated without them','Crankshaft hubs, spokes, rims, balance arms (clear)',['FlywheelRimPort','FlywheelRimStbd','FlywheelHubPort','FlywheelHubStbd']+[f'FlywheelSpoke{s}{i}' for s in ('Port','Stbd') for i in range(1,25)],'Final form: aluminium casting rims of U section, special steel hubs on the crankshaft, 24 tangent wire spokes of No. 10 coppered steel wire (24 documented for the starboard wheel; port assumed equal); 33 in diameter documented for the first steel rims and assumed for the aluminium ones; rim weight inversely proportional to distance from the crank-pin centre (table: starboard 3,946 g, port 3,234 g); spoke crossing pattern read from Plates 83 and 84','modelled',('M1','A1'),'M1 pp. 242-243, 248; A1 p. 111; Plates 82-84',['W14','W15'])
    c('L47','Transmission-shaft stubs','Show where the transmission shafts couple to the engine','Coupling flanges, Aerodrome frame (outside)',['TransShaftStubPort','TransShaftStubStbd'],'Short tubular stubs of 1.5 in outside diameter beyond each coupling flange (M1 p. 242); the shafts, gears and propellers are outside','simplified',('M1',),'M1 p. 242; Plates 78, 80',['W12','W13'])
    out=[
         ('L41','Spark coil and batteries','Supply primary current','W16','Separate accessory in the weight table','outside_scope'),
         ('L42','Carburetor and its inlet pipe','Mix fuel and air (tupelo-wood tank warmed by air from the cylinders)','W17 W18','Separate accessories; the carburetor is a design study of its own (M1 pp. 224-225)','outside_scope'),
         ('L43','Gasoline tank and water tank','Store fuel and coolant','W19 W20','Separate accessories','outside_scope'),
         ('L44','Circulating pump and lower shaft','Circulate coolant','W21','Pump outside the assembly; upper shaft and bevel gears are inside (L34)','outside_scope'),
         ('L45','Radiator (finned tubes)','Reject heat','W22','Separate accessory sized for the Aerodrome frame','outside_scope'),
         ('L46','Aerodrome frame, transmission shafts, gears and propellers','Carry the engine and deliver thrust','','The bed plates attach to the frame tubes; the frame is not part of the engine','outside_scope')]
    for cid,name,function,w,decision,disp in out:
        c(cid,name,function,'Assembly boundary',[],decision,disp,('M1',),'M1 p. 250 weight table' if w else 'M1 Chapter V',w.split())
    mech=[
     dict(id='load',source_ids=['M1','A1'],components=['L01','L02','L05','L06','L07','L08','L09','L11','L22','L23','L32'],path='piston -> gudgeon pin -> bronze bushing -> rod (master direct; link rod through its slipper shoe on the master sleeve) -> split sleeve and bronze lining -> crank pin -> crank arm -> hollow shaft -> two bronze bushings -> drums -> bed plates',checks=['stroke and bore','rod diameters and hole','one pin carries five rods','shoe arcs never overlap at any crank angle (rod length and shoe width together)','master rod and four link rods give identical piston strokes']),
     dict(id='exhaust_valve_train',source_ids=['M1','A1'],components=['L01','L18','L24','L25','L26'],path='crank pinion -> compound reversing gear train -> double-lobed ring cam (-1/4 speed) -> five punch-rod rollers and rods -> 1/64 in gap -> exhaust stem -> valve head -> spring return',checks=['cam speed -1/4','two lobes','firing order 1-3-5-2-4 closure','gap 0.397 mm','lift illustrative']),
     dict(id='intake',source_ids=['M1','A1'],components=['L17','L35','L15'],path='carburetor (outside) -> circular manifold in three flanged segments -> five branches -> removable cast-iron seats -> automatic inlet valves (suction, spring) -> chamber -> cylinder',checks=['five branches','three flanges','seat held by nut','automatic: no drive']),
     dict(id='exhaust',source_ids=['M1'],components=['L15','L18'],path='cylinder -> exhaust valve -> chamber below the seat -> side outlet away from the port bearing',checks=['outlet clear of the port main bearing']),
     dict(id='cooling',source_ids=['M1'],components=['L16','L36','L37'],path='pump (outside) -> starboard circular manifold -> five jackets -> port circular manifold -> two connections to the radiators (outside)',checks=['starboard inlet, port outlet','sheet-steel jackets 0.020 in']),
     dict(id='ignition',source_ids=['M1','A1'],components=['L19','L28','L29','L30','L31'],path='crankshaft -> sleeve and ring -> sparker gear -> one-lobe cam (2.5x) lifts pawl and breaks the primary circuit five times per two revolutions -> coil (outside) -> distributor brush (0.5x) on five-section commutator -> wire -> plug',checks=['2.5x','0.5x','five segments','144 degree spacing of breaks']),
     dict(id='lubrication',source_ids=['M1'],components=['L01','L05','L20','L27'],path='port oil cup -> hub groove -> hole in hollow shaft -> pipe in plug -> hole in crank arm -> hollow pin -> holes -> master bushing -> holes -> under the four shoes; five piston cups -> tubes -> pistons; centrifugal oil along the rods to the gudgeon pins',checks=['oil path drilled continuous','holes under shoes']),
     dict(id='torque_smoothing',source_ids=['M1','A1'],components=['L01','L03','L04','L40','L47'],path='crankshaft -> hubs -> 24 tangent wire spokes each -> aluminium U-section rims (inertia); balance arms bolted between the coupling flanges at 30 degrees brace',checks=['24 spokes per wheel','rim mass per table (3,946 g starboard, 3,234 g port)','balance arm clear of rim and spokes at every angle']),
     dict(id='start_and_pump',source_ids=['M1'],components=['L33','L34'],path='crank handle (outside) -> ratchet -> tubular shaft -> sliding worm -> worm wheel on crankshaft; bevel gear on its hub -> pinion -> vertical splined shaft -> pump at 3x (outside)',checks=['pump 3x','worm held out of mesh by pawl'])]
    conflicts=[
     dict(topic='Connecting rod weight',decision='Table prints 5,005 g but the printed total needs 5,070 g (page image checked); mass check targets the total 56,323 g'),
     dict(topic='Engine weight figures (124.17, 125, 130, 136, 207.47, 207.5, 209.6 lb)',decision='Different inclusion boundaries; target is Manly\'s table of the engine proper, 124.17 lb'),
     dict(topic='Cylinder construction wording',decision='Seamless steel shell (M1, A1) over "spun" (brief) and "drawn from steel plates" (secondary); copper jackets rejected, sheet steel 0.020 in (M1)'),
     dict(topic='Radial and master-rod priority',decision='Model describes the engine as built; priority claims are recorded in research.md as contested (Millet 1889, Corliss 1857, Balzer 1894 rotary radial wagon)'),
     dict(topic='Slipper bearing versus knuckle-pin master rod',decision='Slipper shoes sliding on the master sleeve (M1 p. 238); not a pinned master-and-link rod; all five pistons have identical strokes'),
     dict(topic='Cylinder numbering and rotation',decision='Firing order 1-3-5-2-4 documented; consecutive numbering in the direction of crank rotation adopted as modelling choice; cylinder 1 at the top'),
     dict(topic='1903 versus 1901',decision='Built and drawn 1901, tested 1902-1904, flown (launched) 1903; museum label 1901, NASM record 1903'),
     dict(topic='Balzer versus Manly credit',decision='Affidavits of 1933 used only for construction facts that agree with M1')]
    gaps=[dict(topic=t,blocks_selected_scope=False,next_evidence=e,modelling_consequence=m) for t,e,m in [
     ('Connecting rod length, shoe width and cylinder geometry','Plate 78 measured per half with the documented bore, stroke and wall thicknesses as scales (measurements.json)','Values labelled measured with a stated spread; the shoe-clearance closure check must pass'),
     ('Valve lift, timing, cam profile and spring rates','NASM measurements of the surviving engine or Manly notebooks in the NASM Langley papers','Illustrative, labelled in the contract and the interface'),
     ('Gear tooth counts for the cam, ignition and starting drives','Full-resolution Plate 79 and Plate 81 and NASM photographs','Tooth counts read where legible, otherwise derived to give the documented ratios exactly'),
     ('Compression ratio of the final engine','Plate 78 chamber volume measured; Manly memoranda','Estimated from the drawing, not stated as documented'),
     ('Whether the surviving museum engine matches the 1901 drawings in every detail','Examination of the object or its full NASM photograph set','Model follows the Memoir drawings; no claim about the physical object'),
     ('Small parts not drawn clearly (sleeve halves joint, retainer form, bolt counts)','Full-resolution plates, Annals figures at full size','Estimated or omitted, each named in its component decision')]]
    inventory=dict(schema_version=1,
     target='Large five-cylinder 5 x 5.5 in water-cooled stationary radial built 1901 for Langley Aerodrome A, engine proper per Manly\'s weight table, as drawn in Plates 78-81',
     decision='Ready for a detailed teaching reconstruction of the engine proper and its flywheels with measured and illustrative values explicitly labelled; not a manufacturing reproduction, not an authenticated operating animation, and not checked against the surviving object.',
     reviewed_at='2026-10-06',sources=sources(),expected_callouts=[],weight_table=[dict(id=i,name=n,grams=g,engine_proper=e) for i,n,g,e in WEIGHT_TABLE],printed_totals=PRINTED_TOTALS,
     components=components,mechanisms=mech,
     reviewed_locators=['M1 Ch. VIII pp. 218-225 and Ch. X pp. 234-250 read in full, weight table and rod/pin sentence checked on page images','M1 Plates 78, 79, 80, 81 inspected at page-render resolution (Plate 78 scale 1/2, Plates 79-81 scale 1/4)','A1 Introduction, Ch. 1-2, 5, 7 and Summary read; Ch. 6 pp. 104-119 and Ch. 8 pp. 157-166, 179-183 read; Ch. 3-4 only at cited passages','M1 Plates 82-84 (test-frame photographs) viewed at thumbnail resolution for the flywheel arrangement only','Not inspected: M1 Ch. IX, A1 Figures 22 and 37-43 at full size'],
     conflicts=conflicts,gaps=gaps)
    return inventory

def check_weight_coverage(inventory):
    """Every weight-table line must be covered by a component, and the printed sums must close (with the known misprint)."""
    covered={w for c in inventory['components'] for w in c['covers']}
    missing=[w['id'] for w in inventory['weight_table'] if w['id'] not in covered]
    if missing:raise ValueError('Weight-table lines without a component: '+', '.join(missing))
    engine=sum(w['grams'] for w in inventory['weight_table'] if w['engine_proper'])
    return dict(engine_lines_sum=engine,printed_engine_total=PRINTED_TOTALS['engine'],misprint_grams=PRINTED_TOTALS['engine']-engine)

def part_ids(inventory):return sorted({p for c in inventory['components'] for p in c['part_ids']})

def main():
    inv=build();result=review(inv);weight=check_weight_coverage(inv)
    ids=part_ids(inv);dup=len(ids)!=sum(len(c['part_ids']) for c in inv['components'])
    STUDY.mkdir(parents=True,exist_ok=True)
    (STUDY/'inventory.json').write_text(json.dumps(inv,indent=2)+'\n')
    result.update(weight_table=weight,planned_parts=len(ids),parts_listed_in_more_than_one_component=dup)
    (STUDY/'research-readiness.json').write_text(json.dumps(result,indent=2)+'\n')
    manifest=dict(access_date='2026-10-06',sources=inv['sources'],local_research_root=str(RESEARCH.relative_to(R)),
      unavailable=['repository.si.edu (Cloudflare bot verification; not bypassed; the user supplied the PDF)','NASM object page (HTTP 403 to automated fetch)','Full-resolution Annals PDF (not supplied)','Smithsonian Archives Langley papers (not requested)'])
    (STUDY/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
