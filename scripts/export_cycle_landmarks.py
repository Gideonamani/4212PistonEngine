"""Extract current CAD cue frames and screen a conservative chamber display region."""
from pathlib import Path
import hashlib,json,math
import FreeCAD as App
repo=Path(__file__).resolve().parents[1]
candidate=json.loads((repo/'data/spring-seat-candidate.json').read_text())
source=repo/candidate['candidate_file'];sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert sha==candidate['candidate_sha256']
doc=App.openDocument(str(source));target=repo/'data/cycle-landmarks.json'
report={'source_sha256':sha,'audit_complete':False,'passed':False,'ports':{},'chamber':{},'checks':[],
        'scope':'CAD-derived port axes and sampled chamber cue region; illustrative flow, not CFD'}
def world(name):
 b=doc.getObject(name);s=b.Shape.copy();s.Placement=b.getParentGeoFeatureGroup().getGlobalPlacement().multiply(s.Placement);return s
try:
 doc.Motion.set('B2','0 deg');doc.recompute()
 head=world('CylinderHead');barrel=world('CylinderBarrel')
 piston_offset=world('PistonBody').BoundBox.XMax-doc.Piston.getGlobalPlacement().Base.x
 for label in ['Intake','Exhaust']:
  feature=doc.getObject(label+'CrossPort');sk=feature.Profile[0] if isinstance(feature.Profile,tuple) else feature.Profile
  frame=sk.getGlobalPlacement();axis=frame.Rotation.multVec(App.Vector(0,0,1))
  start=frame.Base;mouth=start+axis*feature.Length.Value
  # The external cue stays outside the full pocket's end; the arrow points along the real axis.
  points=[mouth+axis*d for d in [0,8,16,24]]
  if any(head.isInside(p,1e-6,True) for p in points):raise RuntimeError(label+' cue enters head material')
  report['ports'][label.lower()]={'inner_origin_mm':list(start),'outward_axis':list(axis),'outer_endpoint_mm':list(mouth),
    'radius_mm':sk.Geometry[0].Radius,'feature':feature.Name,'geometry_status':'Reconstructed CAD passage'}
 report['chamber']={'radius_mm':doc.Parameters.Bore.Value*.22,
  'front_x_mm':doc.Parameters.BarrelStart.Value+doc.Parameters.BarrelLength.Value+8,
  'piston_front_offset_mm':piston_offset,'piston_margin_mm':1,
  'display_status':'Conservative central cue region; does not represent total chamber volume'}
 closed={label:world(label+'Valve') for label in ['Intake','Exhaust']}
 axes={label:doc.getObject(label+'Valve').getGlobalPlacement().Rotation.multVec(App.Vector(1,0,0)) for label in closed}
 radius=doc.Parameters.Stroke.Value/2;rod=doc.Parameters.RodLength.Value
 for angle in range(0,721,30):
  theta=math.radians(angle);px=radius*math.cos(theta)+math.sqrt(rod*rod-(radius*math.sin(theta))**2)
  phase=angle%720
  lifts={'Intake':7*math.sin(math.pi*phase/180)**2 if 0<phase<180 else 0,
         'Exhaust':7*math.sin(math.pi*(phase-540)/180)**2 if 540<phase<720 else 0}
  shapes=[head,barrel]
  for label in closed:
   shape=closed[label].copy();shape.translate(-axes[label]*lifts[label]);shapes.append(shape)
  start=px+piston_offset+1;end=report['chamber']['front_x_mm'];r=report['chamber']['radius_mm']
  if start>=end:raise RuntimeError('Empty chamber cue interval')
  count=0
  for ix in range(5):
   x=start+(end-start)*ix/4
   for radial in [0,.5,1]:
    for j in range(12):
     p=App.Vector(x,r*radial*math.cos(j*math.pi/6),r*radial*math.sin(j*math.pi/6))
     if any(s.isInside(p,1e-6,True) for s in shapes):raise RuntimeError(f'Cue point in solid at {angle}: {list(p)}')
     count+=1
  report['checks'].append({'angle_deg':angle,'samples_outside_head_barrel_valves':count,'piston_front_clearance_mm':1})
 report['audit_complete']=True;report['passed']=True;target.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2),flush=True)
finally:App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
