"""GTSIO-520-H documented relationships with explicitly illustrative CAD dimensions.
Run with the installed FreeCAD Python. Never modifies the existing engine masters.
"""
from pathlib import Path
import sys, json, math, os, uuid
sys.path.append(r'C:/Program Files/FreeCAD 1.1/bin')
import FreeCAD as A, Part
R = Path(__file__).resolve().parents[1]
OUT = R/'cad-studies/accessory-drives'; OUT.mkdir(parents=True, exist_ok=True)
doc = A.newDocument('GTSIO520H_Accessory_Drives')
entries = []
scope = 'GTSIO-520-H relationship study. All dimensions, tooth profiles, pad locations and explosion travel are illustrative. Remote outputs are relocated for visibility. Not a maintenance assembly sequence.'
reference = 'GTSIO-520 reviewed manual: A-3-2, Figures A-4-8, A-4-11, A-4-13, A-4-15, A-4-16; H difference data C-3-1 to C-3-3 and C-3-6.'
groups = {}
def cyl(r,h,x=0,y=0,z=0): return Part.makeCylinder(r,h,A.Vector(x,y,z))
def ring(ro,ri,h,x,y,z): return cyl(ro,h,x,y,z).cut(cyl(ri,h+2,x,y,z-1))
def add(id,label,group,shape,pivot=(0,0,0),rate=0,stage=2,offset=(0,0,100),description='',axis=(0,0,1),evidence='A-4-8'):
    assert shape.isValid() and len(shape.Solids)==1 and shape.Volume>0, id
    if group not in groups: groups[group]=doc.addObject('App::DocumentObjectGroup',group.replace('-','_'))
    o=doc.addObject('PartDesign::Feature',id);o.Label=label;o.Shape=shape;groups[group].addObject(o)
    for name,value in [('Evidence',evidence),('DimensionStatus',scope),('Function',description)]:
        o.addProperty('App::PropertyString',name,'Evidence');setattr(o,name,value)
    o.addProperty('App::PropertyFloat','IllustrativeSignedRate','Motion');o.IllustrativeSignedRate=rate
    vertices,triangles=shape.tessellate(.6)
    entries.append(dict(id=id,label=label,group=group,description=description,evidence=evidence,pivot_mm=pivot,axis=axis,rate=rate,stage=stage,offset_mm=offset,vertices_mm=[[v.x,v.y,v.z] for v in vertices],triangles=triangles,volume_mm3=shape.Volume))
def gear(id,label,group,x,y,z,r,teeth,rate,description,evidence='A-4-8',offset=(0,0,110)):
    pts=[]
    for k in range(teeth*8):
        a=2*math.pi*k/(teeth*8);rad=r+1.8 if k%8 in (2,3,4,5) else r-1.8
        pts.append(A.Vector(x+rad*math.cos(a),y+rad*math.sin(a),z))
    pts.append(pts[0]);shape=Part.Face(Part.makePolygon(pts)).extrude(A.Vector(0,0,8)).cut(cyl(5,10,x,y,z-1))
    add(id,label,group,shape,(x,y,z),rate,2,offset,description+' Tooth count and profile are illustrative.',evidence=evidence)
    return shape
# Rear housing: real material volume, open central chamber, shaft exits and mounting holes.
housing=Part.makeBox(230,250,40,A.Vector(-100,-160,-12)).cut(Part.makeBox(216,236,42,A.Vector(-93,-153,-5)))
axes=[(0,0,7),(0,-90,7),(0,60,6),(-40,90,6),(40,90,6),(60,0,7),(42,-90,6)]
for x,y,r in axes: housing=housing.cut(cyl(r,60,x,y,-20))
cover=Part.makeBox(230,250,4,A.Vector(-100,-160,28))
for x,y,r in axes: cover=cover.cut(cyl(r+1,8,x,y,26))
for x in (-88,118):
    for y in (-148,78):
        housing=housing.cut(cyl(2.5,50,x,y,-15));cover=cover.cut(cyl(2.5,8,x,y,26))
        add('Fastener'+str(len(entries)),'Housing fastener','housing',cyl(2,45,x,y,-12).fuse(cyl(4,3,x,y,33)),stage=1,offset=(0,0,170),description='Representative stud, washer seat and fastening interface; pattern illustrative.',evidence='A-4-11')
add('AccessoryHousing','Accessory housing / rear case study','housing',housing,stage=3,offset=(0,0,0),description='Solid shell with open chamber and bored exits. Outline is illustrative; compare FAA Figure 1-6 and manufacturer interfaces.',evidence='FAA 1-7; A-4-11')
add('HousingCover','Housing inspection cover','housing',cover,stage=1,offset=(-240,0,160),description='Illustrative removable teaching cover, not an identified manufacturer part.')
gasket=Part.makeBox(230,250,1,A.Vector(-100,-160,27)).cut(Part.makeBox(216,236,3,A.Vector(-93,-153,26)))
add('HousingGasket','Housing perimeter gasket study','housing',gasket,stage=1,offset=(-220,0,145),description='Illustrative sealing boundary. Manufacturer pad gaskets are represented separately.',evidence='A-4-11')
gear('CrankGear','Crankshaft gear','core',0,0,0,30,24,-1,'Main torque input; A-4-8 item 1.')
add('CrankShaft','Crankshaft rear stub','core',cyl(4.8,55,0,0,-30),(0,0,0),-1,offset=(0,0,-75),description='Shortened crankshaft; complete crank throws omitted.')
gear('CamGear','Camshaft gear','core',0,-90,0,60,48,.5,'Driven directly by crankshaft gear; half-speed four-stroke cam relationship.')
gear('CamCluster','Camshaft fuel-pump cluster gear','fuel',0,-90,12,16,16,.5,'Bolted cluster drives fuel pump; chosen tooth numbers do not establish a manufacturer fuel-pump ratio.')
add('CamShaft','Camshaft stub','core',cyl(4.8,55,0,-90,-30),(0,-90,0),.5,offset=(0,-30,-70),description='Camshaft stub and splined drive interface; valve internals are in the existing cylinder model.')
gear('IdlerGear','Idler gear assembly','core',0,60,0,30,24,1,'Crankshaft to both magneto gears; idler speed chosen for the schematic tooth layout.')
add('IdlerPin','Idler support pin','core',cyl(4.8,26,0,60,-10),offset=(0,0,100),description='Fixed support pin, A-4-8 item 13.')
for side,x in [('Left',-40),('Right',40)]:
    group='magneto-'+side.lower()
    gear(side+'MagGear',side+' magneto drive gear',group,x,90,0,20,16,-1.5,'H verified drive 1.5:1, clockwise facing engine drive pad. Internal splines also supply optional upper-rear accessories.',evidence='A-3-2; C-3-2')
    add(side+'MagShaft',side+' magneto splined shaft',group,cyl(4.8,44,x,90,4),(x,90,0),-1.5,offset=(0,0,110),description='Representative internal spline coupling; spline dimensions illustrative.',evidence='A-3-2; A-4-11')
    pad=Part.makeBox(44,44,8,A.Vector(x-22,68,34)).cut(cyl(13,12,x,90,32))
    for dx in (-16,16):
        for dy in (-16,16):pad=pad.cut(cyl(2,12,x+dx,90+dy,32))
    add(side+'MagAdapter',side+' magneto/accessory adapter',group,pad,stage=1,offset=(0,0,100),description='Bored mounting pad with representative stud holes.',evidence='A-4-11 items 12-15')
    add(side+'MagSeal',side+' adapter oil seal',group,ring(13,5.2,2,x,90,42),stage=1,offset=(0,0,115),description='Solid annular seal with a preserved shaft opening.',evidence='A-4-11 item 15')
    add(side+'Magneto',side+' magneto envelope',group,ring(19,8,42,x,90,48),stage=1,offset=(0,0,150),description='External envelope only: engine-driven ignition energy for spark plugs. Two separate magnetos; no inferred distributor internals.',evidence='C-3-2; FAA 4-1')
gear('FuelGear','Fuel pump drive gear','fuel',42,-90,12,26,26,-.5*16/26,'Documented cluster-to-pump mesh; numerical fuel ratio here is illustrative, not specified in the reviewed H table.')
add('FuelCoupling','Fuel pump detachable coupling','fuel',ring(7,3,20,42,-90,22),(42,-90,12),-.5*16/26,offset=(30,0,110),description='H later pump installation uses a coupling and changed drive gear; old-style pump differs.',evidence='C-3-6; C-3-3 figure item 76')
add('FuelPump','Fuel pump envelope','fuel',ring(20,8,35,42,-90,46),stage=1,offset=(50,0,130),description='Engine-driven pump supplies the continuous-flow injection system. Fuel internals omitted.',evidence='C-3-2; C-3-6')
add('OilTachShaft','Oil pump / tach splined shaftgear','oil-tach',cyl(4.8,70,0,-90,8),(0,-90,0),.5,offset=(0,-45,110),description='Splined into cam gear; transmits torque to oil pump and tach drive.',evidence='A-3-2; A-4-8 item 8')
gear('OilDriver','Oil pump driver','oil-tach',0,-90,55,13,13,.5,'Representative pump driver on cam-connected shaft.',evidence='A-4-16 item 22',offset=(0,-45,110))
gear('OilDriven','Oil pump driven gear','oil-tach',26,-90,55,13,13,-.5,'Opposite-running external gear pair; equal tooth sizes are illustrative.',evidence='A-4-16 item 8',offset=(0,-45,110))
pump=Part.makeBox(64,38,16,A.Vector(-19,-109,51))
for x in (0,26):pump=pump.cut(cyl(15,14,x,-90,54)).cut(cyl(5,20,x,-90,50))
add('OilHousing','Oil pump housing','oil-tach',pump,stage=1,offset=(0,-65,130),description='Two actual gear cavities; section cuts must preserve the empty pockets. Full bypass, relief and scavenge internals omitted.',evidence='A-4-16')
add('TachOutput','Tachometer output shaft','oil-tach',cyl(4,24,0,-90,78),(0,-90,78),-.5,offset=(0,-45,110),description='H verified 0.5:1 clockwise facing drive pad. Relocated output represents omitted bevel transfer; not a coaxial connection to the cam shaft.',evidence='C-3-2; A-4-16 items 24,47')
gear('StarterShaftGear','Starter shaftgear / drum','starter',60,0,0,30,24,1,'Meshes with crank gear; engine back-drives this shaft after clutch disengages.')
add('StarterDrum','Starter clutch drum','starter',cyl(10,22,60,0,10),(60,0,0),1,offset=(65,0,110),description='Knurled drum simplified; spring grips during cranking.',evidence='A-3-2; A-4-15')
gear('WormWheel','Starter worm wheel','starter',60,0,14,23,32,0,'Worm wheel and clutch spring transmit starting torque. Wheel tooth count is illustrative.',evidence='A-4-15 item 31',offset=(65,0,110))
helix=Part.makeHelix(2.5,17,10.8);profile=Part.Wire([Part.makeCircle(.8,A.Vector(10.8,0,0),A.Vector(0,1,0))]);coil=Part.Wire(helix.Edges).makePipeShell([profile],True,False);coil.translate(A.Vector(60,0,14))
add('ClutchSpring','Starter wrap-spring clutch','starter',coil,(60,0,14),0,offset=(65,0,110),description='Tightens to grip drum during starting, relaxes after start. Coil dimensions and visual tightening are illustrative.',evidence='A-3-2; A-4-15 item 30')
worm=cyl(6,42);helix=Part.makeHelix(5,38,6);wire=Part.Wire([Part.makeCircle(1,A.Vector(6,0,0),A.Vector(0,1,0))]);worm=worm.fuse(Part.Wire(helix.Edges).makePipeShell([wire],True,False));worm.rotate(A.Vector(0,0,0),A.Vector(0,1,0),90);worm.translate(A.Vector(40,-30,22))
add('StarterWorm','Starter worm drive shaft','starter',worm,(40,-30,22),0,offset=(65,-30,100),axis=(1,0,0),description='Right-angle worm arrangement schematic. H starter drive 32:1 CCW facing pad; exact worm geometry not reconstructed.',evidence='C-3-2; A-4-15')
motor=ring(14,6.5,45,0,0,0);motor.rotate(A.Vector(0,0,0),A.Vector(0,1,0),90);motor.translate(A.Vector(82,-30,22))
add('StarterMotor','Starter motor envelope','starter',motor,stage=1,offset=(80,-40,110),description='Electrical energy enters here during starting; motor internals omitted.',evidence='A-4-15; FAA 5-6')
# Remote endpoint modules: deliberately no fabricated intervening gear mesh.
for id,label,group,x,y,r,rate,note,ev in [
 ('Alternator','Alternator','alternator',110,65,19,-3,'H 3:1 CW. Gear-driven assembly with hub and clutch shown in A-4-13; transfer geometry to this relocated endpoint unresolved. Do not substitute the general generator pulley sentence for H alternator geometry.','C-3-3; A-4-13'),
 ('Vacuum','Optional vacuum pump','vacuum',-78,10,15,1.14,'H 1.14:1 CCW; deice and autopilot drive listings also 1.14:1. Installation dependent. Optional accessory transfer ratio is documented, internal adapter gearing is not reconstructed.','C-3-3; A-3-2'),
 ('Governor','Propeller governor (front remote output)','governor',-75,-115,16,-.809,'H 0.809:1 CW. Camshaft front bevel pair drives governor; relocated here for teaching. Controls oil to propeller pitch mechanism.','C-3-3; A-3-2')]:
    add(id+'Output',label+' output shaft',group,cyl(4,26,x,y,40),(x,y,40),rate,offset=(x*.5,0,100),description=note,evidence=ev)
    add(id+'Pad',label+' mounting pad',group,ring(r+5,6,6,x,y,35),stage=1,offset=(x*.5,0,80),description='Representative open flange; actual position, bolt pattern and connection dimensions unknown.',evidence=ev)
    add(id+'Body',label+' envelope',group,ring(r,7,30,x,y,67),stage=1,offset=(x*.5,0,130),description=note+' External envelope only.',evidence=ev)
doc.recompute()
# Save to a fresh filename before replacing our generated source: FreeCAD's Windows
# backup handling can reject overwriting an existing FCStd even when it is writable.
temporary=OUT/('build-'+uuid.uuid4().hex+'.FCStd')
doc.saveAs(str(temporary));os.replace(temporary,OUT/'accessory-drives.FCStd')
Part.export([o for o in doc.Objects if o.TypeId=='PartDesign::Feature'],str(OUT/'accessory-drives.step'))
(OUT/'geometry.json').write_text(json.dumps(dict(parts=entries,scope=scope,reference=reference)))
(OUT/'cad-verification.json').write_text(json.dumps(dict(passed=True,parts=len(entries),all_valid_single_solids=True,scope=scope),indent=2))
print('ACCESSORY_CAD_VALID',len(entries),flush=True)
