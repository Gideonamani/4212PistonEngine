"""Drawing-led, unscaled GTSIO accessory study. Run with FreeCAD's Python.
Forms follow reviewed manual illustrations, not measured perspective drawings.
See docs/accessory-shape-review.md for the feature audit and remaining gaps.
"""
from pathlib import Path
import sys, json, math, os, uuid
sys.path.append(r'C:/Program Files/FreeCAD 1.1/bin')
import FreeCAD as A, Part
R=Path(__file__).resolve().parents[1];OUT=R/'cad-studies/accessory-drives';OUT.mkdir(parents=True,exist_ok=True)
doc=A.newDocument('GTSIO520H_Accessory_Drives');entries=[];groups={}
scope='Drawing-led, unscaled GTSIO-520-H teaching reconstruction. Dimensions, teeth, case contour and pad positions illustrative. Front alternator/governor and optional outputs relocated. Function markers are not accessory replicas.'
reference='GTSIO reviewed manual: H photo A-4-4; drive train A-4-8; parts A-4-11/13/15/16/18; H C-3-1/2/3/6 and C-3-1 fuel figure.'
DRAWING='Drawing-led form; dimensions and hidden surfaces reconstructed'
MARKER='Functional endpoint marker; actual accessory body not reconstructed'
def cyl(r,h,x=0,y=0,z=0):return Part.makeCylinder(r,h,A.Vector(x,y,z))
def ring(ro,ri,h,x=0,y=0,z=0):return cyl(ro,h,x,y,z).cut(cyl(ri,h+2,x,y,z-1))
def union(*shapes):
 s=shapes[0]
 for other in shapes[1:]:s=s.fuse(other)
 return s.removeSplitter()
def rounded_box(w,h,depth,x,y,z,r=4):
 return union(Part.makeBox(w-2*r,h,depth,A.Vector(x+r,y,z)),Part.makeBox(w,h-2*r,depth,A.Vector(x,y+r,z)),*[cyl(r,depth,x+dx,y+dy,z) for dx in (r,w-r) for dy in (r,h-r)])
def bolt_holes(shape,points,z,h,r=2):
 for x,y in points:shape=shape.cut(cyl(r,h+2,x,y,z-1))
 return shape.removeSplitter()
def spline(r,h,x,y,z,teeth=10):
 # Visible longitudinal teeth; exact tooth count and engagement are unmeasured.
 base=cyl(r-.6,h,x,y,z)
 for k in range(teeth):
  tooth=Part.makeBox(1.2,1.2,h,A.Vector(x+r-.9,y-.6,z));tooth.rotate(A.Vector(x,y,z),A.Vector(0,0,1),k*360/teeth);base=base.fuse(tooth)
 return base.removeSplitter()
def transverse(shape,x,y,z):
 shape.rotate(A.Vector(),A.Vector(0,1,0),90);shape.translate(A.Vector(x,y,z));return shape
def add(id,label,group,shape,pivot=(0,0,0),rate=0,stage=2,offset=(0,0,100),description='',axis=(0,0,1),evidence='A-4-8',form=DRAWING):
 assert shape.isValid() and len(shape.Solids)==1 and shape.Volume>0,id
 if group not in groups:groups[group]=doc.addObject('App::DocumentObjectGroup',group.replace('-','_'))
 o=doc.addObject('PartDesign::Feature',id);o.Label=label;o.Shape=shape;groups[group].addObject(o)
 for name,value in [('Evidence',evidence),('DimensionStatus',scope),('ShapeStatus',form),('Function',description)]:
  o.addProperty('App::PropertyString',name,'Evidence');setattr(o,name,value)
 o.addProperty('App::PropertyFloat','IllustrativeSignedRate','Motion');o.IllustrativeSignedRate=rate
 vertices,triangles=shape.tessellate(.8)
 entries.append(dict(id=id,label=label,group=group,description=description,evidence=evidence,shape_status=form,pivot_mm=pivot,axis=axis,rate=rate,stage=stage,offset_mm=offset,vertices_mm=[[v.x,v.y,v.z] for v in vertices],triangles=triangles,volume_mm3=shape.Volume))
def gear(id,label,group,x,y,z,r,teeth,rate,description,evidence='A-4-8',offset=(0,0,110),web=False):
 pts=[]
 for k in range(teeth*8):
  a=2*math.pi*k/(teeth*8);rad=r+1.8 if k%8 in (2,3,4,5) else r-1.8;pts.append(A.Vector(x+rad*math.cos(a),y+rad*math.sin(a),z))
 pts.append(pts[0]);shape=Part.Face(Part.makePolygon(pts)).extrude(A.Vector(0,0,8))
 if web:
  shape=shape.cut(ring(r-5,10,3,x,y,z+6))
  for k in range(6):
   a=2*math.pi*k/6;shape=shape.cut(cyl(max(2,r*.09),10,x+r*.53*math.cos(a),y+r*.53*math.sin(a),z-1))
  shape=shape.fuse(cyl(9,12,x,y,z))
 shape=shape.cut(cyl(5,16,x,y,z-1)).removeSplitter()
 add(id,label,group,shape,(x,y,z),rate,2,offset,description+' Teeth and web proportions illustrative.',evidence=evidence)
# A-4-18 identifies two CRANKCASE halves. The rear region is cropped here.
# This contour is an inferred casting envelope, not a traced orthographic view.
def case_outline(depth,z,inset=0):
 return union(rounded_box(154-2*inset,99-2*inset,depth,-67+inset,24+inset,z,10),cyl(84-inset,depth,0,0,z),cyl(75-inset,depth,0,-90,z))
case=case_outline(57,-24).cut(case_outline(51,-25,7))
for x,y,r in [(0,0,7),(0,-90,9),(0,60,6),(-40,90,13),(40,90,13),(60,0,8),(42,-90,7)]:case=case.cut(cyl(r,65,x,y,-27))
for x,y,r in [(-40,90,22),(40,90,22),(0,-90,21),(60,0,18)]:case=case.fuse(ring(r,13 if y==90 else 9,5,x,y,30))
case=case.removeSplitter()
add('AccessoryHousing','Left crankcase - cropped rear region','housing',case.common(Part.makeBox(200,400,100,A.Vector(-200,-200,-40))),stage=3,offset=(0,0,0),description='Split casting, stepped bored bosses, rear wall and chamber. Full cylinder-barrel region and nose omitted. Exact rear contour/depth/pad positions inferred.',evidence='A-4-18 items 126/127; C-3-1')
# Stable ID retained for saved selections; no invented inspection cover remains.
add('HousingCover','Right crankcase - cropped rear region','housing',case.common(Part.makeBox(200,400,100,A.Vector(.3,-200,-40))),stage=1,offset=(220,0,90),description='Right crankcase half, replacing the invented inspection cover. Side separation is pedagogical, not the approved disassembly sequence.',evidence='A-4-18 items 126/127; C-3-1')
for i,(x,y) in enumerate([(-59,114),(59,114),(-58,-134),(58,-134)]):
 add('Fastener'+str(i),'Representative case fastener','housing',union(cyl(2,12,x,y,24),cyl(4,3,x,y,34)),stage=1,offset=(0,0,150),description='Representative fastener: size and placement illustrative.',evidence='A-4-18')
gear('CrankGear','Crankshaft gear','core',0,0,0,30,24,-1,'Main torque input, item 1.',web=True)
add('CrankShaft','Crankshaft rear stub','core',union(cyl(4.8,55,0,0,-30),cyl(8,6,0,0,-5)),(0,0,0),-1,offset=(0,0,-75),description='Shortened shaft and stepped journal; full crank throws omitted.')
gear('CamGear','Camshaft gear','core',0,-90,0,60,48,.5,'Crank-driven cam gear; half-speed four-stroke relationship.',web=True)
gear('CamCluster','Camshaft fuel-pump cluster gear','fuel',0,-90,12,16,16,.5,'Cluster drives fuel pump; chosen teeth do not establish manufacturer fuel ratio.')
add('CamShaft','Camshaft splined rear stub','core',spline(4.8,55,0,-90,-30),(0,-90,0),.5,offset=(0,-30,-70),description='Longitudinal spline form follows A-4-8; counts/profile unmeasured.')
gear('IdlerGear','Idler gear assembly','core',0,60,0,30,24,1,'Crank to both magneto gears; schematic idler speed.',web=True)
add('IdlerPin','Idler support pin','core',union(cyl(4.8,26,0,60,-10),cyl(8,4,0,60,-10)),offset=(0,0,100),description='Fixed stepped support pin, A-4-8 item 13.')
for side,x in [('Left',-40),('Right',40)]:
 group='magneto-'+side.lower();points=[(x+dx,90+dy) for dx in (-16,16) for dy in (-16,16)]
 gear(side+'MagGear',side+' magneto drive gear',group,x,90,0,20,16,-1.5,'H 1.5:1 CW facing pad. Gear/shaft form from A-4-11, not magneto internals.',evidence='A-4-11; C-3-2')
 add(side+'MagShaft',side+' splined accessory shaft',group,spline(4.8,44,x,90,4),(x,90,0),-1.5,description='Visible longitudinal spline; exact engagement unknown.',evidence='A-4-11 items 16/20/22')
 pad=union(rounded_box(44,44,5,x-22,68,34),ring(19,13,8,x,90,34)).cut(cyl(13,14,x,90,32))
 add(side+'MagAdapter',side+' accessory drive adapter',group,bolt_holes(pad,points,33,12),stage=1,offset=(0,0,95),description='Rounded four-corner flange, raised circular seal bore and bolt holes follow item 12. Proportions unscaled.',evidence='A-4-11 item 12')
 add(side+'MagGasket',side+' adapter gasket',group,bolt_holes(rounded_box(44,44,1,x-22,68,33).cut(cyl(13,3,x,90,32)),points,32,3),stage=1,offset=(0,0,83),description='Separate four-hole gasket with centre opening.',evidence='A-4-11 item 13')
 add(side+'MagBushing',side+' adapter bushing',group,ring(8,5.2,12,x,90,26),stage=1,offset=(0,0,108),description='Separate bore sleeve; dimensions inferred.',evidence='A-4-11 item 14')
 add(side+'MagSeal',side+' adapter oil seal',group,ring(13,5.2,2,x,90,40),stage=1,offset=(0,0,120),description='Annular oil seal with actual shaft opening.',evidence='A-4-11 item 15')
 add(side+'Magneto',side+' magneto - function marker',group,ring(15,9,8,x,90,54),stage=1,offset=(0,0,150),description='FUNCTION MARKER, not the shape of a Bendix magneto. Reviewed drawings do not resolve its external form/distributor. Supplies ignition energy.',evidence='C-3-2; FAA 4-1',form=MARKER)
gear('FuelGear','Fuel pump drive gear','fuel',42,-90,12,26,26,-.5*16/26,'H later installation changed gear and added detachable coupling.',evidence='C-3-1 figure items 75/76; C-3-6')
coupling=spline(6,20,42,-90,22).cut(Part.makeBox(3,14,5,A.Vector(40.5,-97,38)))
add('FuelCoupling','H detachable fuel-pump coupling','fuel',coupling,(42,-90,12),-.5*16/26,offset=(30,0,110),description='Stepped detachable coupling; end engagement profile inferred.',evidence='C-3-1 figure item 76; C-3-6')
add('FuelPad','H fuel-pump adapter flange','fuel',bolt_holes(rounded_box(36,40,5,24,-110,41).cut(cyl(7,8,42,-90,40)),[(28,-104),(56,-76)],40,8),stage=1,offset=(30,0,120),description='H-specific two-stud interface; proportions inferred.',evidence='C-3-1 figure items 69/73; C-3-6')
add('FuelSeal','Fuel-pump adapter gasket','fuel',rounded_box(36,40,1,24,-110,46).cut(cyl(7,3,42,-90,45)),stage=1,offset=(35,0,130),description='Separate adapter seal; thickness illustrative.',evidence='C-3-1 figure')
fuel=union(rounded_box(32,34,20,26,-107,47,5),rounded_box(24,32,15,30,-106,66,4)).cut(cyl(7,24,42,-90,46))
for yy in (-98,-82):fuel=fuel.fuse(transverse(ring(4,2,10),53,yy,62))
add('FuelPump','H fuel-pump body study','fuel',fuel.removeSplitter(),stage=1,offset=(50,0,145),description='Stepped casing volumes and external connection bosses follow H C-3-1 item 68. Hidden surfaces/fittings inferred; fuel internals omitted.',evidence='C-3-1 figure item 68 (PDF 159); C-3-6')
add('OilTachShaft','Oil pump / tach splined shaftgear','oil-tach',spline(4.8,70,0,-90,8),(0,-90,0),.5,offset=(0,-45,110),description='Splined cam connection and pump drive; profile unscaled.',evidence='A-4-8 item 8; A-4-16 item 22')
gear('OilDriver','Oil pump driver','oil-tach',0,-90,55,13,13,.5,'Pump driver on cam-connected shaft.',evidence='A-4-16 item 22',offset=(0,-45,110))
gear('OilDriven','Oil pump driven gear','oil-tach',26,-90,55,13,13,-.5,'Opposite-running pair; equal tooth sizes illustrative.',evidence='A-4-16 item 8',offset=(0,-45,110))
pump=union(rounded_box(64,42,19,-19,-111,51,7),rounded_box(46,30,7,-10,-105,69,4))
for x in (0,26):pump=pump.cut(cyl(15,23,x,-90,54)).cut(cyl(5,27,x,-90,50))
points=[(-14,-105),(-14,-75),(40,-105),(40,-75)]
add('OilHousing','Oil pump cast housing study','oil-tach',bolt_holes(pump,points,50,28),stage=1,offset=(0,-65,135),description='Stepped casting, mounting holes and gear pockets follow A-4-16 item 5. Valve galleries omitted; gear cavities remain empty.',evidence='A-4-16 item 5')
add('HousingGasket','Oil pump mounting gasket','oil-tach',bolt_holes(rounded_box(64,42,1,-19,-111,50,7).cut(union(cyl(15,3,0,-90,49),cyl(15,3,26,-90,49))),points,49,3),stage=1,offset=(0,-65,112),description='Pump flange gasket replaces invented accessory-box perimeter seal; outline inferred.',evidence='A-4-16 item 1')
add('OilCover','Oil-pump gear-box cover study','oil-tach',bolt_holes(rounded_box(64,42,4,-19,-111,77,7).cut(cyl(6,6,0,-90,76)),points,76,6),stage=1,offset=(0,-75,155),description='Separate cover with drive opening; outline unscaled.',evidence='A-4-16 items 35/49')
add('OilReliefBody','Oil-pressure relief housing','oil-tach',transverse(ring(8,4,24),-42,-100,62),stage=1,offset=(-35,-65,140),description='Lateral relief housing, item 15. Internal calibrated spring and plunger omitted.',evidence='A-4-16 item 15')
add('ScavengeBody','Scavenge pump body study','oil-tach',rounded_box(36,30,19,-10,-105,82,5).cut(cyl(8,22,0,-90,81)),stage=1,offset=(0,-85,180),description='Separate body follows item 26. Scavenge gears/galleries omitted; this is not a complete pump.',evidence='A-4-16 item 26')
add('OilScreenPlug','Oil screen plug study','oil-tach',union(cyl(5,11,34,-100,61),cyl(7,3,34,-100,70)),stage=1,offset=(15,-65,140),description='Representative plug; screen mesh and oil circuit omitted.',evidence='A-4-16 item 44')
add('TachOutput','Tachometer shaft - relocated marker','oil-tach',cyl(4,24,0,-90,104),(0,-90,104),-.5,offset=(0,-45,190),description='H 0.5:1 CW facing pad. Actual bevel transfer omitted; this is not a coaxial continuation of the cam shaft.',evidence='C-3-2; A-4-16 items 24/47',form=MARKER)
gear('StarterShaftGear','Starter shaftgear','starter',60,0,0,30,24,1,'Crank-meshing gear remains engine-driven after clutch release.',web=True)
add('StarterDrum','Starter clutch shaftgear drum','starter',union(cyl(10,11,60,0,10),cyl(4.8,41,60,0,10)),(60,0,0),1,offset=(65,0,110),description='Stepped shaftgear drum/journal; knurling and fits unmeasured.',evidence='A-4-15 item 12')
gear('WormWheel','Starter worm wheel','starter',60,0,35,23,32,0,'Wheel-side hub meets shaftgear drum under wrap spring.',evidence='A-4-15 item 31',offset=(65,0,130),web=True)
add('WormWheelHub','Worm-wheel clutch hub','starter',ring(10,5.2,17,60,0,19),(60,0,19),0,offset=(65,0,130),description='Wheel-side drum receiving wrap spring; hidden dimensions inferred.',evidence='A-4-15 items 30/31')
helix=Part.makeHelix(2.5,17,10.8);profile=Part.Wire([Part.makeCircle(.8,A.Vector(10.8,0,0),A.Vector(0,1,0))]);coil=Part.Wire(helix.Edges).makePipeShell([profile],True,False);coil.translate(A.Vector(60,0,13))
add('ClutchSpring','Starter wrap-spring clutch','starter',coil,(60,0,13),0,offset=(65,0,120),description='Spans shaft drum and wheel hub. Pitch, winding hand and tightening remain illustrative.',evidence='A-4-15 item 30; A-3-2')
worm=cyl(6,42);helix=Part.makeHelix(5,38,6);wire=Part.Wire([Part.makeCircle(1,A.Vector(6,0,0),A.Vector(0,1,0))]);worm=transverse(worm.fuse(Part.Wire(helix.Edges).makePipeShell([wire],True,False)),40,-30,41)
add('StarterWorm','Starter worm drive shaft','starter',worm,(40,-30,41),0,offset=(65,-30,130),axis=(1,0,0),description='Cross-axis worm and shaft, A-4-15. H 32:1 CCW facing pad; thread profile/count unmeasured.',evidence='A-4-15 items 38/42; C-3-2')
adapter=union(ring(34,28,40,60,0,9),transverse(ring(12,8,47),40,-30,41),rounded_box(48,42,5,36,-21,9,7)).cut(cyl(8,46,60,0,8))
points=[(34,-22),(86,-22),(34,22),(86,22)]
add('StarterAdapter','Starter right-angle adapter housing','starter',bolt_holes(adapter,points,8,44),stage=1,offset=(95,0,160),description='Circular wheel chamber, cross-axis worm tunnel and flange follow item 29. Cavity/wall thickness inferred.',evidence='A-4-15 item 29')
add('StarterCover','Starter adapter circular cover','starter',bolt_holes(cyl(34,5,60,0,49).cut(cyl(8,8,60,0,48)),points,48,8),stage=1,offset=(95,0,190),description='Circular cover with oil-seal bore and flange holes; dimensions inferred.',evidence='A-4-15 item 23')
add('StarterSeal','Starter adapter oil seal','starter',ring(8,5.2,3,60,0,50),stage=1,offset=(95,0,205),description='Separate annular shaft seal.',evidence='A-4-15 item 26')
motor=union(cyl(14,43),cyl(15.5,5),cyl(15,4,0,0,40),rounded_box(34,34,4,-17,-17,0,3)).cut(cyl(6.5,15,0,0,-1))
motor=bolt_holes(motor,[(-13,-13),(-13,13),(13,-13),(13,13)],-1,6)
add('StarterMotor','Starter motor exterior study','starter',transverse(motor,86,-30,41),stage=1,offset=(125,-40,160),description='Long cylinder, end bands and four-corner flange visible in A-4-15 item 3. Motor internals omitted.',evidence='A-4-15 item 3; C-3-1')
# H photograph A-4-4 places alternator on front side. This module is remote.
ax,ay=137,82;angles=[math.pi/4+k*math.pi/2 for k in range(4)]
altpad=union(cyl(24,4,ax,ay,46),*[cyl(5,4,ax+24*math.cos(a),ay+24*math.sin(a),46) for a in angles]).cut(cyl(8,8,ax,ay,44))
add('AlternatorPad','Alternator four-lug flange - front remote','alternator',bolt_holes(altpad,[(ax+24*math.cos(a),ay+24*math.sin(a)) for a in angles],45,6),stage=1,offset=(65,0,100),description='Circular flange with four projecting bolt lugs, item 5. Front assembly relocated alongside rear drive study.',evidence='A-4-13 item 5; A-4-4 H photo')
gear('AlternatorDrivenGear','Alternator driven gear - remote','alternator',ax,ay,24,15,20,-3,'Driven gear identified; intervening engine transfer unresolved.',evidence='A-4-13 item 10; C-3-3',offset=(65,0,85))
add('AlternatorOutput','Alternator shaft - remote','alternator',cyl(4,48,ax,ay,29),(ax,ay,29),-3,offset=(65,0,100),description='H 3:1 CW facing pad. Exact input mesh/front installation not reconstructed.',evidence='C-3-3; A-4-13')
add('AlternatorHub','Alternator gear-driven hub','alternator',ring(11,5,15,ax,ay,32),(ax,ay,32),-3,offset=(65,0,115),description='Separate hollow clutch hub, item 13. Inner ribs simplified.',evidence='A-4-13 item 13')
add('AlternatorClutch','Alternator clutch sleeve study','alternator',ring(13,11.3,12,ax,ay,33),(ax,ay,33),-3,offset=(65,0,125),description='Envelope of identified clutch spring; turns/friction not inferred.',evidence='A-4-13 item 12')
alt=union(cyl(22,42,ax,ay,51),cyl(24,5,ax,ay,51),cyl(24,4,ax,ay,70),cyl(23,5,ax,ay,91))
for a in angles:alt=alt.fuse(cyl(2,42,ax+22*math.cos(a),ay+22*math.sin(a),51))
alt=alt.cut(cyl(8,12,ax,ay,50))
for k in range(8):
 a=k*math.pi/4;alt=alt.cut(cyl(3,7,ax+16*math.cos(a),ay+16*math.sin(a),50))
add('AlternatorBody','Gear-driven alternator exterior - front remote','alternator',alt.removeSplitter(),stage=1,offset=(65,0,165),description='Banded body, fastening ribs and cooling openings follow A-4-13 and H photo. Rotor/stator omitted; hidden vent depth inferred.',evidence='A-4-13 item 4; A-4-4 H photo')
for id,label,group,x,y,r,rate,note,ev in [('Vacuum','Optional vacuum output','vacuum',-109,10,15,1.14,'H 1.14:1 CCW; accessory/adapter internals not shown.','C-3-3; A-3-2'),('Governor','Governor front remote output','governor',-107,-124,16,-.809,'H 0.809:1 CW. Front cam bevel pair documented; governor body not shown.','C-3-3; A-3-2')]:
 add(id+'Output',label+' shaft marker',group,cyl(4,26,x,y,40),(x,y,40),rate,offset=(x*.5,0,100),description=note+' Relocated marker.',evidence=ev,form=MARKER)
 add(id+'Pad',label+' interface marker',group,ring(r+5,6,6,x,y,35),stage=1,offset=(x*.5,0,80),description='Conceptual interface, not manufacturer flange geometry.',evidence=ev,form=MARKER)
 add(id+'Body',label+' function marker',group,ring(r,9,8,x,y,67),stage=1,offset=(x*.5,0,130),description='FUNCTION MARKER, not an actual accessory body. '+note,evidence=ev,form=MARKER)
doc.recompute();temporary=OUT/('build-'+uuid.uuid4().hex+'.FCStd');doc.saveAs(str(temporary));os.replace(temporary,OUT/'accessory-drives.FCStd')
Part.export([o for o in doc.Objects if o.TypeId=='PartDesign::Feature'],str(OUT/'accessory-drives.step'))
(OUT/'geometry.json').write_text(json.dumps(dict(parts=entries,scope=scope,reference=reference)),encoding='utf8')
(OUT/'cad-verification.json').write_text(json.dumps(dict(passed=True,parts=len(entries),all_valid_single_solids=True,scope=scope),indent=2),encoding='utf8')
print('ACCESSORY_CAD_VALID',len(entries),flush=True)
