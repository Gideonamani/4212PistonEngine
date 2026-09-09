"""Audit the legacy illustrative motion against current CAD; never save the master."""
from pathlib import Path
import json,math,hashlib
import FreeCAD as App
repo=Path(__file__).resolve().parents[1]
source=repo.parent/'EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Cylinder.FCStd'
frames=json.loads((repo/'data/valve-frames.json').read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest()==frames['source_sha256']
doc=App.openDocument(str(source))
def world(name):
    body=doc.getObject(name);shape=body.Shape.copy()
    shape.Placement=body.getParentGeoFeatureGroup().getGlobalPlacement().multiply(shape.Placement)
    return shape
def move(shape,placement):
    result=shape.copy();result.Placement=placement.multiply(result.Placement);return result
def inspect(a,b):
    distance,points,_=a.distToShape(b)
    return {'minimum_distance_mm':distance,'intersection_volume_mm3':a.common(b).Volume,
            'nearest_points_mm':[[list(p),list(q)] for p,q in points[:1]]}
report={'source_sha256':frames['source_sha256'],'purpose':'Test existing illustrative video motion, not certify operation','poses':[]}
try:
    doc.recompute()
    for label in ['Intake','Exhaust']:
        f=frames['trains'][label.lower()];axis=App.Vector(*f['valve_axis']);pivot=App.Vector(*f['rocker_pivot_mm']);rockaxis=App.Vector(*f['rocker_axis'])
        valve,rocker,guide,housing=[world(label+suffix) for suffix in ['Valve','RockerArm','ValveGuide','RockerHousing']]
        for lift in [0,3.5,7]:
            rot=App.Rotation(rockaxis,-math.degrees(math.asin(lift/22)))
            rocker_delta=App.Placement(pivot-rot.multVec(pivot),rot)
            v=move(valve,App.Placement(-axis*lift,App.Rotation()));r=move(rocker,rocker_delta)
            item={'train':label,'lift_mm':lift,'rocker_angle_deg':-math.degrees(math.asin(lift/22)),
                  'valve_rocker':inspect(v,r),'valve_guide':inspect(v,guide),'rocker_housing':inspect(r,housing)}
            report['poses'].append(item);print(json.dumps(item),flush=True)
    report['status']='Measured; review results before choosing or revising the animation law'
    (repo/'data/valve-contact-audit.json').write_text(json.dumps(report,indent=2)+'\n')
finally:App.closeDocument(doc.Name)
