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
scope='Drawing-led, unscaled GTSIO-520-H teaching reconstruction. Flanges and shaft seats meet in the assembled pose. Dimensions, teeth, case contour and pad positions illustrative. Grey display stands hold relocated front/optional modules; their omitted engine transfers are not physical shafts. Function markers are not accessory replicas.'
reference='GTSIO reviewed manual: H photo A-4-4; drive train A-4-8; parts A-4-11/13/15/16/18; H C-3-1/2/3/6 and C-3-1 fuel figure.'
DRAWING='Drawing-led form; dimensions and hidden surfaces reconstructed'
MARKER='Functional endpoint marker; actual accessory body not reconstructed'
FIXTURE='Teaching display fixture; not an engine part or transmission'
interfaces=[]
def cyl(r,h,x=0,y=0,z=0):return Part.makeCylinder(r,h,A.Vector(x,y,z))
def ring(ro,ri,h,x=0,y=0,z=0):return cyl(ro,h,x,y,z).cut(cyl(ri,h+2,x,y,z-1))
def union(*shapes):
 s=shapes[0]
 for other in shapes[1:]:s=s.fuse(other)
 # Keep Boolean face seams. OCC's removeSplitter can invalidate this multi-boss
 # casting at coplanar intersections; seams do not duplicate solid volume.
 return s
def rounded_box(w,h,depth,x,y,z,r=4):
 return union(Part.makeBox(w-2*r,h,depth,A.Vector(x+r,y,z)),Part.makeBox(w,h-2*r,depth,A.Vector(x,y+r,z)),*[cyl(r,depth,x+dx,y+dy,z) for dx in (r,w-r) for dy in (r,h-r)])
def bolt_holes(shape,points,z,h,r=2):
 for x,y in points:shape=shape.cut(cyl(r,h+2,x,y,z-1))
 return shape
def spline(r,h,x,y,z,teeth=10):
 # Visible longitudinal teeth; exact tooth count and engagement are unmeasured.
 base=cyl(r-.7,h,x,y,z)
 for k in range(teeth):
  tooth=Part.makeBox(1.2,.9,h,A.Vector(x+r-1.2,y-.45,z));tooth.rotate(A.Vector(x,y,z),A.Vector(0,0,1),k*360/teeth);base=base.fuse(tooth)
 return base.removeSplitter()
def transverse(shape,x,y,z):
 shape.rotate(A.Vector(),A.Vector(0,1,0),90);shape.translate(A.Vector(x,y,z));return shape
def add(id,label,group,shape,pivot=(0,0,0),rate=0,stage=2,offset=(0,0,100),description='',axis=(0,0,1),evidence='A-4-8',form=DRAWING,role='engine-study'):
 assert shape.isValid() and len(shape.Solids)==1 and shape.Volume>0,f'{id}: valid={shape.isValid()}, solid volumes={[s.Volume for s in shape.Solids]}'
 if group not in groups:groups[group]=doc.addObject('App::DocumentObjectGroup',group.replace('-','_'))
 o=doc.addObject('PartDesign::Feature',id);o.Label=label;o.Shape=shape;groups[group].addObject(o)
 for name,value in [('Evidence',evidence),('DimensionStatus',scope),('ShapeStatus',form),('Function',description),('PresentationRole',role)]:
  o.addProperty('App::PropertyString',name,'Evidence');setattr(o,name,value)
 o.addProperty('App::PropertyFloat','IllustrativeSignedRate','Motion');o.IllustrativeSignedRate=rate
 vertices,triangles=shape.tessellate(.8)
 entries.append(dict(id=id,label=label,group=group,description=description,evidence=evidence,shape_status=form,role=role,pivot_mm=pivot,axis=axis,rate=rate,stage=stage,offset_mm=offset,vertices_mm=[[v.x,v.y,v.z] for v in vertices],triangles=triangles,volume_mm3=shape.Volume))

def joint(a,b,kind='mount-face',clearance=.02):
 # Independent native reopening repeats these geometric checks before release.
 interfaces.append(dict(a=a,b=b,kind=kind,max_gap_mm=clearance))

def bevel(id,label,group,x,y,z,r0,r1,h,rate,axis=(0,0,1),bore=5.1):
 # Drawing-supported 90-degree bevel form. Tooth count/flanks are unmeasured;
 # the cone is an un-toothed pitch-form study, not a manufactured gear.
 cone=Part.makeCone(r0,r1,h).cut(cyl(bore,h+2,z=-1))
 if axis==(-1,0,0):cone.rotate(A.Vector(),A.Vector(0,1,0),-90)
 cone.translate(A.Vector(x,y,z))
 add(id,label,group,cone,(x,y,z),rate,offset=(0,-55,155),axis=axis,description='Documented bevel transfer; smooth pitch-cone form. Tooth form, cone angles and dimensions illustrative.',evidence='A-4-16 items 24/47')
def gear(id,label,group,x,y,z,r,teeth,rate,description,evidence='A-4-8',offset=(0,0,110),web=False,splined=False,hub_height=12,cup_height=0):
 pts=[]
 for k in range(teeth*8):
  a=2*math.pi*k/(teeth*8);rad=r+1.8 if k%8 in (2,3,4,5) else r-1.8;pts.append(A.Vector(x+rad*math.cos(a),y+rad*math.sin(a),z))
 pts.append(pts[0]);shape=Part.Face(Part.makePolygon(pts)).extrude(A.Vector(0,0,8))
 if web:
  shape=shape.cut(ring(r-5,10,3,x,y,z+6))
  for k in range(6):
   a=2*math.pi*k/6;shape=shape.cut(cyl(max(2,r*.09),10,x+r*.53*math.cos(a),y+r*.53*math.sin(a),z-1))
  shape=shape.fuse(cyl(9,hub_height,x,y,z))
 if cup_height:shape=shape.fuse(ring(r,13.2,cup_height,x,y,z+8))
 shape=shape.cut(spline(5,16,x,y,z-1) if splined else cyl(5.2,16,x,y,z-1)).removeSplitter()
 add(id,label,group,shape,(x,y,z),rate,2,offset,description+' Teeth and web proportions illustrative.',evidence=evidence)
# A-4-18 identifies two CRANKCASE halves. The rear region is cropped here.
# This contour is an inferred casting envelope, not a traced orthographic view.
def case_outline(depth,z,inset=0):
 # Cast lobes follow the drive bays instead of the former broad pill-shaped slab.
 # This envelope is inferred around A-4-8; A-4-18 is not an orthographic tracing.
 return union(rounded_box(76-2*inset,176-2*inset,depth,-38+inset,-97+inset,z,10),*[cyl(r-inset,depth,x,y,z) for x,y,r in [(0,0,40),(0,-90,70),(0,60,40),(-40,90,29),(40,90,29),(60,0,40),(42,-90,35)]])
case=case_outline(57,-24).cut(case_outline(51,-25,7))
mount_points={'mag-left':[(-56,74),(-56,106),(-24,74),(-24,106)],'mag-right':[(24,74),(24,106),(56,74),(56,106)],'fuel':[(28,-104),(56,-76)],'oil':[(-40,-105),(-40,-75),(14,-105),(14,-75)],'starter':[(34,-22),(86,-22),(34,22),(86,22)]}
for x in (-40,40):case=case.fuse(rounded_box(44,44,6,x-22,68,33))
case=case.fuse(rounded_box(36,40,6,24,-110,33)).fuse(rounded_box(64,42,6,-45,-111,33,7))
case=case.fuse(rounded_box(64,54,6,28,-27,33,7))
for x,y,r in [(0,0,7),(0,-90,5.3),(0,60,6),(-40,90,13),(40,90,13),(60,0,9),(42,-90,7)]:case=case.cut(cyl(r,70,x,y,-27))
for points in mount_points.values():case=bolt_holes(case,points,26,14,2.2)
for x in (-40,40):case=case.fuse(ring(27,5.2,4,x,90,-24))
case_fasteners=[(-18,42),(18,42),(-60,-120),(60,-120)]
case=bolt_holes(case,case_fasteners,23,12,2.2)
case=case.removeSplitter()
add('AccessoryHousing','Left crankcase - cropped rear region','housing',case.common(Part.makeBox(200,400,100,A.Vector(-200,-200,-40))),stage=3,offset=(0,0,0),description='Lobed split casting with connected mounting pads and open drive bays. Full cylinder-barrel region and nose omitted. Contour/depth/pad positions inferred around the documented train.',evidence='A-4-18 items 126/127; A-4-8; C-3-1')
# Stable ID retained for saved selections; no invented inspection cover remains.
add('HousingCover','Right crankcase - cropped rear region','housing',case.common(Part.makeBox(200,400,100,A.Vector(.3,-200,-40))),stage=1,offset=(220,0,90),description='Right crankcase half, replacing the invented inspection cover. Side separation is pedagogical, not the approved disassembly sequence.',evidence='A-4-18 items 126/127; C-3-1')
for i,(x,y) in enumerate(case_fasteners):
 add('Fastener'+str(i),'Representative case fastener','housing',union(cyl(2,9,x,y,24),cyl(4,3,x,y,33)),stage=1,offset=(0,0,150),description='Head seats on the casting; shank enters its hole. Size and placement illustrative.',evidence='A-4-18')
 joint('Fastener'+str(i),'AccessoryHousing' if x<0 else 'HousingCover')
gear('CrankGear','Crankshaft gear','core',0,0,0,30,24,1,'Torque input. Rear-frame sign inferred from external meshes and front-facing magneto pads (A-3-3 / C-3-2), not a directly quoted crank-rotation specification.',web=True)
add('CrankShaft','Crankshaft rear stub','core',union(cyl(4.8,55,0,0,-30),cyl(8,6,0,0,-6)),(0,0,0),1,offset=(0,0,-75),description='Shortened shaft and stepped journal; collar seats below the gear. Full crank throws omitted.')
gear('CamGear','Camshaft gear','core',0,-90,0,60,48,-.5,'Crank-driven cam gear with internal spline seat for the oil/tach shaft.',web=True,splined=True)
gear('CamCluster','Camshaft fuel-pump cluster gear','fuel',0,-90,12,16,16,-.5,'Cluster drives fuel pump; chosen teeth do not establish manufacturer fuel ratio.',splined=True)
add('CamShaft','Camshaft rear stub and flange','core',union(cyl(4.8,30,0,-90,-30),cyl(9,5,0,-90,-5)),(0,-90,0),-.5,offset=(0,-30,-70),description='Shortened camshaft seats at the front of its gear. The oil/tach shaft enters the gear internal splines, not an overlapping solid camshaft.',evidence='A-3-2; A-4-8')
gear('IdlerGear','Idler gear assembly','core',0,60,0,30,24,-1,'Crank to both magneto gears; schematic idler speed.',web=True)
add('IdlerPin','Idler support pin and mounting head','core',union(cyl(4.8,36,0,60,-10),cyl(5.9,7,0,60,26),cyl(12,6,0,60,33)),offset=(0,0,100),description='Fixed pin extends into the rear wall; mounting head seats on the case. A-4-8 item 13 / A-4-18 item 28; dimensions inferred.')
joint('IdlerPin','AccessoryHousing');joint('IdlerPin','HousingCover')
for side,x in [('Left',-40),('Right',40)]:
 group='magneto-'+side.lower();points=[(x+dx,90+dy) for dx in (-16,16) for dy in (-16,16)]
 gear(side+'MagGear',side+' magneto drive gear',group,x,90,0,20,16,1.5,'H 1.5:1 CW facing the FRONT magneto pad. Positive rear-frame spin appears CW from the opposite end.',evidence='A-3-3; A-4-11; C-3-2')
 add(side+'MagShaft',side+' splined accessory shaft',group,spline(4.8,86,x,90,-32),(x,90,0),-1.5,axis=(0,0,-1),description='Continuous shaft reaches front magneto function marker and rear accessory adapter. Signed rate uses the front-facing pad axis; spline dimensions unmeasured.',evidence='A-3-3; A-4-11 items 16/20/22')
 pad=union(rounded_box(44,44,5,x-22,68,40),cyl(19,8,x,90,40),cyl(13,7,x,90,33)).cut(cyl(8,17,x,90,32)).cut(cyl(13,5,x,90,45))
 add(side+'MagAdapter',side+' accessory drive adapter',group,bolt_holes(pad,points,39,12),stage=1,offset=(0,0,95),description='Four-corner flange and locating spigot seat on the case. Stepped bushing/seal bore follows item 12; dimensions inferred.',evidence='A-4-11 item 12')
 add(side+'MagGasket',side+' adapter gasket',group,bolt_holes(rounded_box(44,44,1,x-22,68,39).cut(cyl(13,3,x,90,38)),points,38,3),stage=1,offset=(0,0,83),description='Separate four-hole gasket between two seated faces.',evidence='A-4-11 item 13')
 add(side+'MagBushing',side+' adapter bushing',group,ring(8,5.2,12,x,90,33),stage=1,offset=(0,0,108),description='Sleeve seats in the small step of the adapter bore.',evidence='A-4-11 item 14')
 add(side+'MagSeal',side+' adapter oil seal',group,ring(13,5.2,3,x,90,45),stage=1,offset=(0,0,120),description='Seal seats in the larger bore step; shaft passes through it.',evidence='A-4-11 item 15')
 add(side+'Magneto',side+' magneto - front function marker',group,ring(15,5.2,8,x,90,-32),stage=1,offset=(0,0,-100),description='FUNCTION MARKER seated on the front pad, following A-3-3. This ring is not a Bendix body replica; the case front is cropped and its pad dimensions inferred. Supplies ignition energy.',evidence='A-3-3; C-3-2; FAA 4-1',form=MARKER)
 for a,b in [(side+'MagGasket','AccessoryHousing' if x<0 else 'HousingCover'),(side+'MagGasket',side+'MagAdapter'),(side+'MagBushing',side+'MagAdapter'),(side+'MagSeal',side+'MagAdapter'),(side+'Magneto','AccessoryHousing' if x<0 else 'HousingCover')]:joint(a,b)
 joint(side+'MagShaft',side+'MagBushing','shaft-seat',.45)
gear('FuelGear','Fuel pump drive gear','fuel',42,-90,12,26,26,.5*16/26,'H later installation changed gear and added detachable coupling.',evidence='C-3-1 figure items 75/76; C-3-6')
add('FuelGearShaft','Fuel gear shaft and coupling input','fuel',union(cyl(4.8,19,42,-90,12),cyl(6,2,42,-90,20)),(42,-90,12),.5*16/26,description='Continuous gear-to-coupling input stub. Shoulder/fit reconstructed from H detachable-drive relationship.',evidence='C-3-1 figure items 75/76; C-3-6')
coupling=spline(6,20,42,-90,22).cut(cyl(5,11,42,-90,21)).cut(Part.makeBox(3,14,6,A.Vector(40.5,-97,37)))
add('FuelCoupling','H detachable fuel-pump coupling','fuel',coupling,(42,-90,12),.5*16/26,offset=(30,0,110),description='Stepped detachable coupling; end engagement profile inferred.',evidence='C-3-1 figure item 76; C-3-6')
add('FuelCaseGasket','Fuel adapter-to-case gasket','fuel',bolt_holes(rounded_box(36,40,1,24,-110,39).cut(cyl(7,3,42,-90,38)),mount_points['fuel'],38,3),stage=1,offset=(30,0,105),description='Illustrative locating gasket at the seated case interface.',evidence='C-3-1 figure; C-3-6')
add('FuelPad','H fuel-pump adapter flange','fuel',bolt_holes(rounded_box(36,40,5,24,-110,40).cut(cyl(7,8,42,-90,39)),mount_points['fuel'],39,8),stage=1,offset=(30,0,120),description='H-specific two-stud interface seated at the case. Proportions inferred.',evidence='C-3-1 figure items 69/73; C-3-6')
add('FuelSeal','Fuel-pump adapter gasket','fuel',bolt_holes(rounded_box(36,40,1,24,-110,45).cut(cyl(7,3,42,-90,44)),mount_points['fuel'],44,3),stage=1,offset=(35,0,130),description='Separate gasket between adapter and pump.',evidence='C-3-1 figure')
fuel=union(rounded_box(32,34,20,26,-107,46,5),rounded_box(24,32,15,30,-106,65,4)).cut(cyl(7,24,42,-90,45))
for yy in (-98,-82):fuel=fuel.fuse(transverse(ring(4,2,10),53,yy,61))
add('FuelPump','H fuel-pump body study','fuel',fuel.removeSplitter(),stage=1,offset=(50,0,145),description='Stepped casing volumes and external connection bosses follow H C-3-1 item 68. Hidden surfaces/fittings inferred; fuel internals omitted.',evidence='C-3-1 figure item 68 (PDF 159); C-3-6')
add('FuelPumpInput','Fuel pump input tang study','fuel',union(cyl(4.8,21,42,-90,42),Part.makeBox(2.8,10,5,A.Vector(40.6,-95,37))),(42,-90,12),.5*16/26,offset=(35,0,130),description='Input tang enters the coupling notch; internal pump drive terminates in the casing. Engagement profile illustrative.',evidence='C-3-1 figure items 68/76; C-3-6')
add('FuelInputBushing','Fuel input locating sleeve study','fuel',ring(7,5,9,42,-90,46),stage=1,offset=(40,0,135),description='Illustrative locating sleeve in the reconstructed pump input bore; not a separately identified manufacturer part.',evidence='Illustrative interface reconstruction')
for a,b in [('FuelCaseGasket','HousingCover'),('FuelCaseGasket','FuelPad'),('FuelPad','FuelSeal'),('FuelSeal','FuelPump'),('FuelInputBushing','FuelPump'),('FuelGearShaft','FuelGear'),('FuelGearShaft','FuelCoupling')]:joint(a,b)
joint('FuelPumpInput','FuelCoupling','tang-seat',.25);joint('FuelPumpInput','FuelInputBushing','shaft-seat',.25)
add('OilTachShaft','Oil pump / tach splined shaftgear','oil-tach',union(spline(4.8,20,0,-90,0),cyl(4.8,66,0,-90,20)),(0,-90,0),-.5,offset=(0,-45,110),description='Male spline enters the internal cam-gear spline and continues through pump driver to tach bevel gear. Profile unscaled.',evidence='A-3-2; A-4-8 item 8; A-4-16 item 22')
gear('OilDriver','Oil pump driver','oil-tach',0,-90,44,13,13,-.5,'Pump driver on cam-connected shaft.',evidence='A-4-16 item 22',offset=(0,-45,110))
gear('OilDriven','Oil pump driven gear','oil-tach',-26,-90,44,13,13,.5,'Opposite-running pair. Placed left of the driver to keep the separate H fuel mounting bay clear; layout unmeasured.',evidence='A-4-16 item 8',offset=(0,-45,110))
pump=rounded_box(64,42,25,-45,-111,40,7)
for x in (0,-26):pump=pump.cut(cyl(15,23,x,-90,43)).cut(cyl(5.3,27,x,-90,39))
pump=pump.cut(transverse(cyl(5.2,12),-46,-84,51))
pump=pump.cut(transverse(cyl(4,12),-46,-100,51))
points=mount_points['oil']
add('OilHousing','Oil pump cast housing study','oil-tach',bolt_holes(pump,points,39,28),stage=1,offset=(0,-65,135),description='Stepped casting and two real gear pockets. Seated on the case; positioned clear of the fuel pump. Contour/galleries unmeasured.',evidence='A-4-16 item 5')
add('OilDrivenPin','Oil driven-gear locating journal study','oil-tach',union(cyl(5.1,22,-26,-90,40),cyl(7,1,-26,-90,39)),offset=(0,-65,130),description='Illustrative shouldered support journal through the driven-gear bore; A-4-16 item 8/9 establish a supported driven-gear assembly, not these dimensions.',evidence='A-4-16 items 8/9')
add('HousingGasket','Oil pump mounting gasket','oil-tach',bolt_holes(rounded_box(64,42,1,-45,-111,39,7).cut(union(cyl(15,3,0,-90,38),cyl(15,3,-26,-90,38))),points,38,3),stage=1,offset=(0,-65,112),description='Gasket sits between the case pad and pump flange; outline inferred.',evidence='A-4-16 item 1')
add('OilCoverGasket','Oil gear-box cover gasket','oil-tach',bolt_holes(rounded_box(64,42,1,-45,-111,65,7).cut(cyl(6,3,0,-90,64)),points,64,3),stage=1,offset=(0,-75,150),description='Thin gasket closes the former cover gap; outline illustrative.',evidence='A-4-16 item 48')
add('OilCover','Oil-pump gear-box cover study','oil-tach',bolt_holes(rounded_box(64,42,4,-45,-111,66,7).cut(cyl(6,6,0,-90,65)),points,65,6),stage=1,offset=(0,-75,155),description='Cover seats on its gasket; oil/tach shaft passes through its opening.',evidence='A-4-16 item 49')
add('OilReliefBody','Oil-pressure relief housing','oil-tach',transverse(ring(8,4,24),-69,-100,51),stage=1,offset=(-35,-65,140),description='Relief housing seats on the side of the casting at an open port. Calibrated spring/plunger omitted.',evidence='A-4-16 item 15')
add('ScavengeGasket','Scavenge-body interface gasket study','oil-tach',rounded_box(50,36,1,-38,-108,70,5).cut(cyl(6,3,0,-90,69)),stage=1,offset=(0,-85,170),description='Illustrative gasket at the staged pump-body interface.',evidence='A-4-16 body/interface relationships; illustrative outline')
scavenge=union(rounded_box(50,36,25,-38,-108,71,5),transverse(ring(9,4.3,8),-44,-90,85),transverse(rounded_box(26,26,3,-13,-13,0,4),-44,-90,85))
scavenge=scavenge.cut(cyl(15,27,0,-90,70)).cut(transverse(cyl(14,20),-20,-90,85)).cut(transverse(cyl(4.3,60),-49,-90,85))
add('ScavengeBody','Scavenge / tach drive body study','oil-tach',scavenge.removeSplitter(),stage=1,offset=(0,-85,180),description='Stepped body and bored lateral tach boss. Connected chamber holds the documented bevel pair. Scavenge gears and fluid galleries omitted; depth/shape reconstructed.',evidence='A-4-16 items 26/35/39')
add('OilScreenPlug','Oil screen plug study','oil-tach',transverse(union(cyl(5,11),cyl(7,3,z=-3)),-45,-84,51),stage=1,offset=(-15,-65,140),description='Representative side plug enters a bore and its head seats on the casting. Screen and oil circuit omitted.',evidence='A-4-16 item 44')
bevel('TachDriveBevel','Tach drive bevel gear - pitch-form study','oil-tach',0,-90,73,12,6,6,-.5)
bevel('TachDrivenBevel','Tach driven bevel gear - pitch-form study','oil-tach',-6,-90,85,6,12,6,-.5,axis=(-1,0,0),bore=3.3)
add('TachOutput','Tachometer output shaft','oil-tach',union(transverse(cyl(3.1,25),-25,-90,85),transverse(cyl(4,32),-57,-90,85)),(0,-90,85),-.5,offset=(-40,-45,190),axis=(-1,0,0),description='Lateral shaft passes through the driven bevel and bored tach pad. H 0.5:1 CW facing its engine pad; geometry and layout unmeasured.',evidence='C-3-2; A-4-16 items 24/45/47')
tach_points=[(-9,-9),(-9,9),(9,-9),(9,9)]
def tach_plate(depth,x):return transverse(bolt_holes(rounded_box(26,26,depth,-13,-13,0,4).cut(cyl(4.3,depth+2,z=-1)),tach_points,-1,depth+2),x,-90,85)
add('TachPadGasket','Tach drive-pad gasket','oil-tach',tach_plate(1,-45),stage=1,offset=(-40,-55,180),description='Bored gasket between tach body and cover; dimensions illustrative.',evidence='A-4-16 item 38')
add('TachPadCover','Tach drive-pad cover','oil-tach',tach_plate(3,-48),stage=1,offset=(-50,-55,185),description='Rounded four-corner plate with output bore follows drive-pad cover item 39.',evidence='A-4-16 item 39')
for a,b in [('HousingGasket','AccessoryHousing'),('HousingGasket','OilHousing'),('OilHousing','OilCoverGasket'),('OilCoverGasket','OilCover'),('OilCover','ScavengeGasket'),('ScavengeGasket','ScavengeBody'),('OilReliefBody','OilHousing'),('OilScreenPlug','OilHousing'),('TachPadGasket','ScavengeBody'),('TachPadCover','TachPadGasket')]:joint(a,b)
for a,b,limit in [('OilTachShaft','CamGear',.35),('OilTachShaft','OilDriver',.45),('OilDrivenPin','OilDriven',.15),('OilDrivenPin','OilHousing',.25),('OilTachShaft','TachDriveBevel',.45),('TachOutput','TachDrivenBevel',.25),('TachOutput','TachPadCover',.35)]:joint(a,b,'shaft-seat',limit)
gear('StarterShaftGear','Starter shaftgear','starter',60,0,0,30,24,-1,'Crank-meshing gear remains engine-driven after clutch release.',web=True)
add('StarterDrum','Starter clutch shaftgear drum','starter',union(cyl(10,11,60,0,46),cyl(4.8,91,60,0,0)),(60,0,0),-1,offset=(65,0,110),description='Continuous shaft seats through the crank-meshing gear and case bearing; drum is inside the adapter, clear of its floor. Knurling/fits unmeasured.',evidence='A-4-15 item 12')
gear('WormWheel','Starter worm wheel','starter',60,0,73,23,32,0,'Wheel-side hub meets shaftgear drum under wrap spring.',evidence='A-4-15 item 31',offset=(65,0,130),web=True,hub_height=8)
add('WormWheelHub','Worm-wheel clutch hub','starter',ring(10,5.2,16,60,0,57),(60,0,57),0,offset=(65,0,130),description='Wheel-side hub seats against its wheel and meets the drum under the spring; dimensions inferred.',evidence='A-4-15 items 30/31')
helix=Part.makeHelix(2.5,17,10.8);profile=Part.Wire([Part.makeCircle(.8,A.Vector(10.8,0,0),A.Vector(0,1,0))]);coil=Part.Wire(helix.Edges).makePipeShell([profile],True,False);coil.translate(A.Vector(60,0,50))
add('ClutchSpring','Starter wrap-spring clutch','starter',coil,(60,0,50),0,offset=(65,0,120),description='Spans the two touching drum surfaces. Pitch, winding hand and tightening illustrative.',evidence='A-4-15 item 30; A-3-2')
worm=cyl(6,78);helix=Part.makeHelix(5,38,6);wire=Part.Wire([Part.makeCircle(1,A.Vector(6,0,0),A.Vector(0,1,0))]);worm=transverse(worm.fuse(Part.Wire(helix.Edges).makePipeShell([wire],True,False)),40,-30,77)
add('StarterWorm','Starter worm drive shaft','starter',worm,(40,-30,77),0,offset=(65,-30,130),axis=(1,0,0),description='Cross-axis worm shaft reaches into the motor input. H 32:1 CCW facing pad; thread/fit unmeasured.',evidence='A-4-15 items 38/42; C-3-2')
points=mount_points['starter']
motor_flange=transverse(bolt_holes(rounded_box(34,34,4,-17,-17,0,3),[(-13,-13),(-13,13),(13,-13),(13,13)],-1,6),103,-30,77)
adapter=union(cyl(34,44,60,0,40),transverse(cyl(12,67),40,-30,77),rounded_box(64,54,5,28,-27,40,7),motor_flange,*[cyl(5,44,x,y,40) for x,y in points])
adapter=adapter.cut(cyl(28,46,60,0,45)).cut(cyl(8,50,60,0,39)).cut(transverse(cyl(8,70),39,-30,77))
add('StarterCaseGasket','Starter adapter-to-case gasket','starter',bolt_holes(rounded_box(64,54,1,28,-27,39,7).cut(cyl(8,3,60,0,38)),points,38,3),stage=1,offset=(95,0,145),description='Mounting gasket between seated case and adapter faces.',evidence='A-4-15 item 11')
add('StarterAdapter','Starter right-angle adapter housing','starter',bolt_holes(adapter,points,39,48),stage=1,offset=(95,0,160),description='Lobed mounting foot, circular chamber and open cross-axis worm passage. Motor flange reaches its tunnel; wheel mesh opening is clear. Dimensions inferred.',evidence='A-4-15 item 29')
add('StarterCaseBushing','Starter shaft locating bearing study','starter',union(ring(9,5.2,6,60,0,33),ring(8,5.2,6,60,0,39)),stage=1,offset=(95,0,150),description='Stepped support seats in case and adapter bores, clear of the clutch drum. Needle internals omitted.',evidence='A-4-15 item 43')
cover=union(cyl(34,5,60,0,85),*[cyl(5,5,x,y,85) for x,y in points]).cut(cyl(8,8,60,0,84))
gasket=union(cyl(34,1,60,0,84),*[cyl(5,1,x,y,84) for x,y in points]).cut(cyl(8,3,60,0,83))
add('StarterCoverGasket','Starter cover-to-adapter gasket','starter',bolt_holes(gasket,points,83,4),stage=1,offset=(95,0,182),description='Lobed gasket closes the adapter-to-cover interface.',evidence='A-4-15 item 28')
add('StarterCover','Starter adapter circular cover','starter',bolt_holes(cover,points,84,8),stage=1,offset=(95,0,190),description='Circular cover with projecting bolt ears and seated oil seal.',evidence='A-4-15 item 23')
add('StarterSeal','Starter adapter oil seal','starter',ring(8,5.2,3,60,0,87),stage=1,offset=(95,0,205),description='Seal seats in the cover bore around the continued shaft.',evidence='A-4-15 item 26')
motor=union(cyl(14,43),cyl(15.5,5),cyl(15,4,0,0,40),rounded_box(34,34,4,-17,-17,0,3)).cut(cyl(6.5,15,0,0,-1))
motor=bolt_holes(motor,[(-13,-13),(-13,13),(13,-13),(13,13)],-1,6)
add('StarterMotor','Starter motor exterior study','starter',transverse(motor,107,-30,77),stage=1,offset=(125,-40,160),description='Banded cylindrical motor flange seats on the adapter. Extended worm shaft enters the input bore. Motor internals omitted.',evidence='A-4-15 item 3; C-3-1')
for a,b in [('StarterCaseGasket','HousingCover'),('StarterCaseGasket','StarterAdapter'),('StarterCaseBushing','StarterAdapter'),('StarterCaseBushing','HousingCover'),('StarterAdapter','StarterCoverGasket'),('StarterCoverGasket','StarterCover'),('StarterSeal','StarterCover'),('StarterMotor','StarterAdapter'),('WormWheelHub','WormWheel')]:joint(a,b)
joint('StarterDrum','StarterCaseBushing','shaft-seat',.45);joint('StarterDrum','StarterShaftGear','shaft-seat',.45)
joint('StarterWorm','StarterMotor','motor-input-seat',.55)
# H photograph A-4-4 places alternator on front side. This module is remote.
ax,ay=137,82;angles=[math.pi/4+k*math.pi/2 for k in range(4)]
alt_points=[(ax+24*math.cos(a),ay+24*math.sin(a)) for a in angles]
altpad=union(cyl(24,1,ax,ay,49),*[cyl(5,1,x,y,49) for x,y in alt_points]).cut(cyl(14,3,ax,ay,48))
add('AlternatorPad','Alternator mounting gasket - front display','alternator',bolt_holes(altpad,alt_points,48,4),stage=1,offset=(65,0,100),description='Item 5 is the four-lug GASKET. The matching mounting flange belongs to alternator body item 4. Front module is on a grey teaching stand; engine transfer omitted.',evidence='A-4-13 items 4/5; A-4-4 H photo')
gear('AlternatorDrivenGear','Alternator driven gear and clutch cup - remote','alternator',ax,ay,24,15,20,-3,'Driven gear/cup encloses the clutch sleeve and hub; intervening engine transfer unresolved.',evidence='A-4-13 item 10; C-3-3',offset=(65,0,85),cup_height=14)
add('AlternatorOutput','Alternator shaft - remote','alternator',union(cyl(4.8,56,ax,ay,22),cyl(7,1,ax,ay,22)),(ax,ay,29),-3,offset=(65,0,100),description='Shaft passes through the driven-gear bushing and hub into the body input seat. H 3:1 CW. Exact engine input mesh omitted.',evidence='C-3-3; A-4-13')
add('AlternatorThrustWasher','Alternator thrust washer','alternator',ring(9,5,1,ax,ay,23),stage=1,offset=(65,0,80),description='Washer seats below driven gear; nut/cotter detail omitted.',evidence='A-4-13 item 9')
add('AlternatorBushing','Alternator driven-gear bushing','alternator',ring(5.2,4.9,8,ax,ay,24),(ax,ay,24),-3,offset=(65,0,90),description='Bushing seats inside driven gear and around its shaft. Dimensions illustrative.',evidence='A-4-13 item 11')
add('AlternatorHub','Alternator gear-driven hub','alternator',ring(11,5,18,ax,ay,32),(ax,ay,32),-3,offset=(65,0,115),description='Hollow keyed hub inside clutch sleeve. Internal ribs/key shape simplified.',evidence='A-4-13 item 13')
add('AlternatorClutch','Alternator clutch sleeve study','alternator',ring(13,11.1,12,ax,ay,33),(ax,ay,33),-3,offset=(65,0,125),description='Clutch envelope nests between driven-gear cup and hub; winding/friction omitted.',evidence='A-4-13 item 12')
alt=union(cyl(22,42,ax,ay,50),cyl(24,5,ax,ay,50),cyl(24,4,ax,ay,69),cyl(23,5,ax,ay,90),*[cyl(5,5,x,y,50) for x,y in alt_points])
for a in angles:alt=alt.fuse(cyl(2,42,ax+22*math.cos(a),ay+22*math.sin(a),50))
alt=alt.cut(cyl(14,9,ax,ay,49)).cut(cyl(5,31,ax,ay,49));alt=bolt_holes(alt,alt_points,49,8)
for k in range(8):
 slot=rounded_box(9,4,8,ax+11,ay-2,49,1.5);slot.rotate(A.Vector(ax,ay,0),A.Vector(0,0,1),k*45);alt=alt.cut(slot)
add('AlternatorBody','Gear-driven alternator exterior - front remote','alternator',alt.removeSplitter(),stage=1,offset=(65,0,165),description='Four-lug body flange, banded casing, tie ribs and elongated ventilation openings. Gasket touches its face; shaft enters its locating bore. Rotor/stator omitted; all depth/proportions inferred.',evidence='A-4-13 item 4; A-4-4 H photo')
for a,b in [('AlternatorPad','AlternatorBody'),('AlternatorBushing','AlternatorDrivenGear'),('AlternatorThrustWasher','AlternatorDrivenGear'),('AlternatorThrustWasher','AlternatorOutput')]:joint(a,b)
for a,b,c in [('AlternatorOutput','AlternatorBushing',.15),('AlternatorClutch','AlternatorDrivenGear',.25),('AlternatorClutch','AlternatorHub',.15),('AlternatorOutput','AlternatorHub',.25),('AlternatorOutput','AlternatorBody',.25)]:joint(a,b,'shaft-or-clutch-seat',c)

def display_stand(id,label,group,x,y,pad_z,opening):
 # These neutral tripods make the separate teaching modules visibly supported.
 # They must never be cited as engine mounting hardware or torque transfers.
 angles=[k*2*math.pi/3 for k in range(3)]
 shape=union(ring(27,18,4,x,y,-28),ring(27,opening,4,x,y,pad_z-4),*[cyl(2.8,pad_z+20,x+23*math.cos(a),y+23*math.sin(a),-24) for a in angles])
 add(id,label,group,shape,stage=3,offset=(0,0,0),description='Author-created display stand. Supports a relocated module; no engine shaft or gearbox is implied by these posts. Actual engine transfer remains omitted.',evidence='Teaching presentation fixture; no manufacturer geometry claim',form=FIXTURE,role='teaching-fixture')

display_stand('AlternatorDisplayStand','Teaching stand - front alternator / transfer omitted','alternator',ax,ay,49,18)
joint('AlternatorDisplayStand','AlternatorPad','display-seat')
for id,label,group,x,y,r,rate,note,ev in [('Vacuum','Optional vacuum output','vacuum',-109,10,15,1.14,'H 1.14:1 CCW; accessory/adapter internals not shown.','C-3-3; A-3-2'),('Governor','Governor front remote output','governor',-107,-124,16,-.809,'H 0.809:1 CW. Front cam bevel pair documented; governor body not shown.','C-3-3; A-3-2')]:
 add(id+'Output',label+' shaft marker',group,cyl(4,36,x,y,30),(x,y,40),rate,offset=(x*.5,0,100),description=note+' Relocated shaft display, located in the pad and function marker.',evidence=ev,form=MARKER)
 add(id+'Pad',label+' interface marker',group,ring(r+5,4.3,6,x,y,35),stage=1,offset=(x*.5,0,80),description='Conceptual bored interface on grey teaching stand, not manufacturer flange geometry.',evidence=ev,form=MARKER)
 add(id+'Body',label+' function marker',group,union(ring(7,4.3,20,x,y,41),ring(r,4.3,8,x,y,61)),stage=1,offset=(x*.5,0,130),description='FUNCTION MARKER with display sleeve seated on its pad, not an actual accessory body. '+note+' Shaft reaches its bore; exact engine transfer not modelled.',evidence=ev,form=MARKER)
 display_stand(id+'DisplayStand','Teaching stand - '+group+' / transfer omitted',group,x,y,35,10)
 joint(id+'DisplayStand',id+'Pad','display-seat');joint(id+'Body',id+'Pad','display-seat');joint(id+'Output',id+'Pad','shaft-seat',.35);joint(id+'Output',id+'Body','shaft-seat',.35)
doc.recompute();temporary=OUT/('build-'+uuid.uuid4().hex+'.FCStd');doc.saveAs(str(temporary));os.replace(temporary,OUT/'accessory-drives.FCStd')
Part.export([o for o in doc.Objects if o.TypeId=='PartDesign::Feature'],str(OUT/'accessory-drives.step'))
(OUT/'geometry.json').write_text(json.dumps(dict(parts=entries,scope=scope,reference=reference,interfaces=interfaces)),encoding='utf8')
(OUT/'cad-verification.json').write_text(json.dumps(dict(passed=True,parts=len(entries),all_valid_single_solids=True,scope=scope),indent=2),encoding='utf8')
print('ACCESSORY_CAD_VALID',len(entries),flush=True)
