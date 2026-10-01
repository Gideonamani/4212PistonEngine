"""FreeCAD solid teaching studies; manual relationships, illustrative dimensions in mm."""
from pathlib import Path
import sys,json,math,hashlib
sys.path.append(r'C:/Program Files/FreeCAD 1.1/bin')
import FreeCAD as A,Part
R=Path(__file__).resolve().parents[1];OUT=R/'cad-studies';OUT.mkdir(exist_ok=True)
def cylinder(radius,height,x=0,y=0,z=0):return Part.makeCylinder(radius,height,A.Vector(x,y,z))
def tube(ro,ri,h,z=0):return cylinder(ro,h,z=z).cut(cylinder(ri,h+2,z=z-1))
def spring(radius,pitch,height,z=0):
 helix=Part.makeHelix(pitch,height,radius)
 edge=Part.makeCircle(.55,A.Vector(radius,0,0),A.Vector(0,1,0))
 shape=Part.Wire(helix.Edges).makePipeShell([Part.Wire([edge])],True,False)
 shape.translate(A.Vector(0,0,z));return shape

def build(name,reference,parts,stages):
 folder=OUT/name;folder.mkdir(exist_ok=True);doc=A.newDocument(name.replace('-','_'));entries=[]
 for identifier,label,group,shape,offset,stage,note in parts:
  assert shape.isValid() and len(shape.Solids)==1 and shape.Volume>0,identifier
  obj=doc.addObject('PartDesign::Feature',identifier);obj.Label=label;obj.Shape=shape
  obj.addProperty('App::PropertyString','Evidence','Reference');obj.Evidence=reference
  obj.addProperty('App::PropertyString','DimensionStatus','Reference');obj.DimensionStatus='Illustrative teaching dimensions; not a manufacturer dimensional reconstruction.'
  vertices,triangles=shape.tessellate(.12)
  entries.append({'id':identifier,'label':label,'group':group,'description':note,'vertices_mm':[[v.x,v.y,v.z] for v in vertices],'triangles':triangles,'offset_m':offset,'stage':stage,'volume_mm3':shape.Volume})
 doc.recompute();doc.saveAs(str(folder/(name+'.FCStd')));Part.export(doc.Objects,str(folder/(name+'.step')))
 profile={'schema_version':1,'model_id':name,'reference':reference,'scope':'Manual-based mechanism teaching study. All dimensions and operating travel are illustrative; not a maintenance procedure or pressure simulation.','duration_seconds':10,'stages':stages,'parts':{p['id']:{'stage':p['stage'],'offset_m':p['offset_m']} for p in entries}}
 (folder/'geometry.json').write_text(json.dumps({'parts':entries,'reference':reference,'scope':profile['scope']}));(R/'web'/ (name+'-motions.json')).write_text(json.dumps(profile,indent=2))
 (folder/'cad-verification.json').write_text(json.dumps({'passed':True,'parts':len(entries),'all_valid_single_solids':True,'dimensions':'illustrative','reference':reference},indent=2));A.closeDocument(doc.Name)
 return entries
stages=[{'label':'Assembled','progress':0,'note':'Inspect the assembled mechanism.'},{'label':'Retainer and socket','progress':33.333333,'note':'Locate the retaining ring and pushrod socket.'},{'label':'Plunger and return spring','progress':66.666667,'note':'Locate the oil reservoir and plunger return spring.'},{'label':'Check valve internals','progress':100,'note':'Follow the check-valve housing, plate and spring.'}]
body=cylinder(10,45).cut(cylinder(8,44,z=3));body=body.cut(cylinder(10.2,2,z=30).cut(cylinder(9.3,2,z=30)))
port=Part.makeCylinder(1.2,6,A.Vector(7,0,31),A.Vector(1,0,0));body=body.cut(port)
plunger=tube(7.85,5,19,17);plunger=plunger.cut(Part.makeCylinder(1,7,A.Vector(3,0,31),A.Vector(1,0,0)))
socket=tube(7.85,2,5,37);socket=socket.cut(Part.makeSphere(5,A.Vector(0,0,43)))
ring=tube(8.2,7.2,1,43).cut(Part.makeBox(2,12,3,A.Vector(-1,0,42)))
parts=[('LifterBody','Hydraulic tappet body','body',body,[0,0,0],3,'Contains the internal oil reservoir, oil inlet and guiding bore.'),('PlungerSpring','Plunger return spring','plunger',spring(5,2,10,4),[0,.065,0],2,'Biases the plunger outward during clearance compensation.'),('CheckHousing','Check-valve housing','check-valve',tube(5,2.8,4,14),[.022,.09,0],3,'Carries the check plate and its spring.'),('CheckSpring','Check-valve spring','check-valve',spring(1.7,1.2,3.6,14),[-.022,.09,0],3,'Illustrative spring bias at the internal check valve.'),('CheckPlate','Check-valve plate','check-valve',cylinder(3,.7,z=17.6),[0,.10,0],3,'Closes to trap oil under load; opens to allow replenishment.'),('Plunger','Hydraulic plunger','plunger',plunger,[0,.07,0],2,'Hollow plunger provides a reservoir and transmits force through trapped oil.'),('Socket','Pushrod socket','plunger',socket,[0,.09,0],1,'Receives the pushrod end and provides an oil discharge passage.'),('RetainingRing','Retaining ring','body',ring,[0,.115,0],1,'Retains the plunger/socket assembly inside the body.')]
build('hydraulic-tappet','GTSIO-520 reviewed manual, Figure A-4-10, printed A-4-7, items 1-16. Geometry and travel illustrative.',parts,stages)
# IO-520 permold two external gears: visual tooth profile, not a gear manufacturing definition.
def gear(cx,phase):
 points=[];teeth=12;pitch=12
 for k in range(teeth*8):
  theta=2*math.pi*k/(teeth*8)+phase;region=k%8;r=13.8 if region in (2,3,4,5) else 10.3
  points.append(A.Vector(cx+r*math.cos(theta),r*math.sin(theta),7))
 points.append(points[0]);return Part.Face(Part.makePolygon(points)).extrude(A.Vector(0,0,8)).cut(cylinder(3.05,10,x=cx,z=6))
housing=Part.makeBox(64,42,20,A.Vector(-20,-21,0))
for x in (0,24):housing=housing.cut(cylinder(14.5,16,x=x,z=5)).cut(cylinder(3.1,26,x=x,z=-5))
for y in (-14,14):housing=housing.cut(Part.makeCylinder(3,50,A.Vector(-22,y,11),A.Vector(1,0,0)))
cover=Part.makeBox(64,42,3,A.Vector(-20,-21,20))
for x in (0,24):cover=cover.cut(cylinder(3.2,5,x=x,z=19))
for x in (-15,39):
 for y in (-16,16):
  housing=housing.cut(cylinder(1.7,22,x,y,-1));cover=cover.cut(cylinder(1.7,5,x,y,19))
reliefHousing=cylinder(7,30,x=12,y=-32,z=0).cut(cylinder(4.5,26,x=12,y=-32,z=5))
reliefHousing=reliefHousing.cut(Part.makeCylinder(1.5,12,A.Vector(12,-40,8),A.Vector(0,1,0)))
reliefSpring=spring(3,2,12,12);reliefSpring.translate(A.Vector(12,-32,0))
parts=[('PumpHousing','Oil pump housing','pump',housing,[0,0,0],3,'Two gear pockets and illustrative inlet/outlet passages.'),('DriveGear','Driver gear','gears',gear(0,0),[-.012,.03,0],2,'Driven by the engine accessory train; teeth are schematic, not an involute manufacturing profile.'),('DrivenGear','Driven gear','gears',gear(24,math.pi/12),[.012,.03,0],2,'Rotates opposite the driver; oil travels around the outside of the gear pair.'),('DriveShaft','Driver shaft','gears',cylinder(3,34,z=-4),[-.012,.03,0],2,'Supports and drives the driver gear.'),('DrivenShaft','Driven gear shaft','gears',cylinder(3,25,x=24,z=0),[.012,.03,0],2,'Supports the driven gear.'),('PumpCover','Pump cover','pump',cover,[0,.065,0],1,'Closes the gear chambers; remove in overview to inspect the pair.'),('ReliefHousing','Pressure relief housing','relief',reliefHousing,[.075,0,0],3,'Separate illustrative housing for the spring-loaded pressure relief mechanism.'),('ReliefPlunger','Pressure relief plunger','relief',cylinder(4.3,6,x=12,y=-32,z=6),[.075,.05,0],3,'Illustrative opening travel; pressure is not calculated.'),('ReliefSpring','Pressure relief spring','relief',reliefSpring,[.075,.075,0],3,'Biases the relief plunger toward its seat.'),('ReliefAdjuster','Relief adjusting plug','relief',cylinder(5,5,x=12,y=-32,z=27),[.075,.105,0],3,'Shows the spring adjustment location without prescribing a pressure setting.')]
for x in (-15,39):
 for y in (-16,16):parts.append((f'CoverBolt{len(parts)}','Cover fastening screw','pump',cylinder(1.5,23,x,y,2).fuse(cylinder(3,2,x,y,25)),[0,.09,0],1,'Illustrative cover fastening location.'))
stages=[{'label':'Assembled','progress':0,'note':'Locate the pump and relief assembly.'},{'label':'Cover and fasteners','progress':33.333333,'note':'Reveal the gear chambers.'},{'label':'Gear and shaft pair','progress':66.666667,'note':'Inspect the opposite rotating gears and their shafts.'},{'label':'Relief valve','progress':100,'note':'Locate the plunger, spring and adjusting plug.'}]
build('oil-pump','IO-520 overhaul, Figure 4-19 and section 7-7 (permold full-flow-filter engine). Simplified pump/relief study; filter and tachometer drive omitted.',parts,stages)
print('CAD_STUDIES_VERIFIED',flush=True)
