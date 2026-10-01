"""Check inherited chamber cue bounds against the revised stationary CAD solids."""
from pathlib import Path
import json,hashlib
import FreeCAD as App,Part
repo=Path(__file__).resolve().parents[1]
release=repo/'releases/cylinder-reviewed-20261001.json';r=json.loads(release.read_text())
source=(repo/r['source_cad']).resolve();assert hashlib.sha256(source.read_bytes()).hexdigest()==r['cad_sha256']
doc=App.openDocument(str(source));c=json.loads((repo/'web/motion.json').read_text())['cycle_landmarks']['chamber']
start=doc.Parameters.RodLength.Value-doc.Parameters.Stroke.Value/2+c['piston_front_offset_mm']+c['piston_margin_mm']
region=Part.makeCylinder(c['radius_mm'],c['front_x_mm']-start,App.Vector(start,0,0),App.Vector(1,0,0))
checks={}
for name in ['CylinderHead','CylinderBarrel','FuelDischargeNozzle']:
 body=doc.getObject(name);shape=body.Shape.copy();shape.Placement=body.getParentGeoFeatureGroup().getGlobalPlacement().multiply(shape.Placement)
 volume=region.common(shape).Volume;assert volume<1e-5,(name,volume);checks[name]=volume
r['current_cue_static_clearance_check']={'cad_sha256':r['cad_sha256'],'passed':True,'intersection_mm3':checks,
 'scope':'Inherited maximum central chamber cue region against revised stationary solids. Prior sampled valve audit remains identified by its original source hash; no CFD claim.'}
release.write_text(json.dumps(r,indent=2)+'\n');App.closeDocument(doc.Name)
print('CURRENT_CUE_SOLIDS_CLEAR',checks,flush=True)
