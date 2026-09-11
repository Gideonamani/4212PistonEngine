"""Screen the entire maximum cue envelope against native solids, never saving CAD."""
from pathlib import Path
import hashlib,json,time,argparse
import FreeCAD as App
import Part
repo=Path(__file__).resolve().parents[1]
candidate=json.loads((repo/'data/spring-seat-candidate.json').read_text())
landmarks=json.loads((repo/'data/cycle-landmarks.json').read_text())
source=repo/candidate['candidate_file'];sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert sha==candidate['candidate_sha256']==landmarks['source_sha256']
target=repo/'data/cycle-region-solid-audit.json'
report={'source_sha256':sha,'passed':False,'audit_complete':False,'checks':[],
 'scope':'Complete maximum cue cylinder against head/barrel and 29 valve lifts per train; sampled valve positions, not CFD'}
parser=argparse.ArgumentParser();parser.add_argument('--resume',action='store_true');args=parser.parse_args()
prior_region=None
if args.resume:
 prior=json.loads(target.read_text());assert prior['source_sha256']==sha and not prior['audit_complete']
 assert all(c['intersection_mm3']<=1e-5 for c in prior['checks'])
 assert len({(c['part'],c['lift_mm']) for c in prior['checks']})==len(prior['checks'])
 prior_region=prior['maximum_region'];report['checks']=prior['checks'];report['maximum_region']=prior_region
def save():
 tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(report,indent=2)+'\n')
 for attempt in range(8):
  try:tmp.replace(target);return
  except PermissionError:
   if attempt==7:raise
   time.sleep(.1*(attempt+1))
save();print('Opening CAD for volume check',flush=True);doc=App.openDocument(str(source))
def world(name):
 b=doc.getObject(name);s=b.Shape.copy();s.Placement=b.getParentGeoFeatureGroup().getGlobalPlacement().multiply(s.Placement);return s
def check(name,shape,lift=None):
 if any(c['part']==name and c['lift_mm']==lift for c in report['checks']):return
 report['active_check']={'part':name,'lift_mm':lift};save();print('Checking',name,lift,flush=True)
 volume=region.common(shape).Volume
 report['checks'].append({'part':name,'lift_mm':lift,'intersection_mm3':volume});save()
 if volume>1e-5:raise RuntimeError('Cue region intersects '+name+': '+str(volume))
try:
 doc.Motion.set('B2','0 deg');doc.recompute()
 c=landmarks['chamber'];r=doc.Parameters.Stroke.Value/2;length=doc.Parameters.RodLength.Value
 offset=world('PistonBody').BoundBox.XMax-doc.Piston.getGlobalPlacement().Base.x
 assert abs(offset-c['piston_front_offset_mm'])<1e-6
 start=length-r+offset+c['piston_margin_mm'];end=c['front_x_mm']
 region=Part.makeCylinder(c['radius_mm'],end-start,App.Vector(start,0,0),App.Vector(1,0,0))
 assert region.isValid() and len(region.Solids)==1
 report['maximum_region']={'start_x_mm':start,'end_x_mm':end,'radius_mm':c['radius_mm'],
  'piston_clearance_basis':'Every dynamic cue starts 1 mm beyond the translated piston maximum X; maximum envelope used only for stationary solids and valve sweep screening'}
 if prior_region is not None:assert prior_region==report['maximum_region']
 check('CylinderHead',world('CylinderHead'));check('CylinderBarrel',world('CylinderBarrel'))
 for label in ['Intake','Exhaust']:
  closed=world(label+'Valve');axis=doc.getObject(label+'Valve').getGlobalPlacement().Rotation.multVec(App.Vector(1,0,0))
  for i in range(29):
   lift=i/4;shape=closed.copy();shape.translate(-axis*lift);check(label+'Valve',shape,lift)
 assert len(report['checks'])==60
 report.pop('active_check',None);report['passed']=True;report['audit_complete']=True;save()
 print('Passed complete cue region at all sampled valve lifts',flush=True)
except Exception as error:
 report['error']=str(error);save();raise
finally:App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
