"""Check the fixed passages affected by the isolated pushrod-layout rebuild."""
from pathlib import Path
import hashlib,json
import FreeCAD as App

repo=Path(__file__).resolve().parents[1]
candidate=json.loads((repo/'data/pushrod-candidate.json').read_text())
source=repo/candidate['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==candidate['candidate_sha256']
doc=App.openDocument(str(source))
report={'source_sha256':candidate['candidate_sha256'],'scope':'Closed assembly; only listed pairs',
        'intersection_tolerance_mm3':1e-5,'interfaces':[]}
cache={}
def world(name):
    if name not in cache:
        body=doc.getObject(name);shape=body.Shape.copy()
        shape.Placement=body.getParentGeoFeatureGroup().getGlobalPlacement().multiply(shape.Placement)
        cache[name]=shape
    return cache[name]
try:
    doc.recompute()
    for label in ['Intake','Exhaust']:
        pairs=[(label+'PushrodHousing',target) for target in ['CylinderHead',label+'RockerHousing',label+'RockerCover',label+'RockerGasket']]
        pairs += [(label+'RockerArm',label+'RockerShaft')]
        pairs += [(label+'PushrodHousing',label+suffix+'PushrodSeal') for suffix in ['Lower','Upper']]
        pairs += [(label+'Pushrod',target) for target in ['CylinderHead',label+'RockerCover',label+'RockerGasket']]
        for a,b in pairs:
            volume=world(a).common(world(b)).Volume
            item={'a':a,'b':b,'intersection_mm3':volume,'minimum_distance_mm':world(a).distToShape(world(b))[0]}
            report['interfaces'].append(item)
            print(a,b,volume,flush=True)
    report['passed']=all(r['intersection_mm3']<=report['intersection_tolerance_mm3'] for r in report['interfaces'])
    (repo/'data/pushrod-candidate-interfaces.json').write_text(json.dumps(report,indent=2)+'\n')
finally: App.closeDocument(doc.Name)
