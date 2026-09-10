"""Inspect raw Boolean recess results separately from PartDesign history."""
from pathlib import Path
import hashlib,json
import FreeCAD as App
import Part
repo=Path(__file__).resolve().parents[1]
parent=json.loads((repo/'data/spring-candidate.json').read_text());source=repo/parent['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==parent['candidate_sha256']
doc=App.openDocument(str(source));report={'source_sha256':parent['candidate_sha256'],'steps':[],'native_steps':[]}
try:
    body=doc.CylinderHead;shape=body.Shape.copy()
    report['restored_head']={'volume_mm3':body.Shape.Volume,'valid':body.Shape.isValid()}
    doc.recompute()
    report['recomputed_head']={'volume_mm3':body.Shape.Volume,'valid':body.Shape.isValid()}
    shape.Placement=body.getParentGeoFeatureGroup().getGlobalPlacement().multiply(shape.Placement)
    for label in ['Intake','Exhaust']:
        datum=doc.getObject(label+'Valve').getGlobalPlacement();axis=datum.Rotation.multVec(App.Vector(1,0,0))
        base=datum.multVec(App.Vector(65,0,0))
        tool=Part.makeCylinder(18.5,53,base,axis)
        print('Raw cut',label,flush=True);shape=shape.cut(tool).removeSplitter()
        row={'train':label,'valid':shape.isValid(),'solids':len(shape.Solids),'faces':len(shape.Faces),'volume_mm3':shape.Volume}
        report['steps'].append(row)
        if not row['valid']:
            path=repo/'.local'/('invalid-'+label.lower()+'-spring-recess.brep');shape.exportBrep(str(path))
            try: row['kernel_check']=str(shape.check())
            except Exception as error:row['kernel_check']=str(error)
        print(json.dumps(row),flush=True)
        (repo/'data/spring-recess-diagnosis.json').write_text(json.dumps(report,indent=2)+'\n')
    for label in ['Intake','Exhaust']:
        datum=doc.getObject(label+'Valve').getGlobalPlacement();axis=datum.Rotation.multVec(App.Vector(1,0,0))
        base=datum.multVec(App.Vector(65,0,0))
        feature=body.newObject('PartDesign::SubtractiveCylinder',label+'DiagnosticRecess')
        feature.Radius=18.5;feature.Height=53;feature.Placement=App.Placement(base,App.Rotation(App.Vector(0,0,1),axis));feature.Refine=True
        doc.recompute()
        row={'train':label,'head_volume_mm3':body.Shape.Volume,'head_valid':body.Shape.isValid(),
             'base_feature':feature.BaseFeature.Name if feature.BaseFeature else None,
             'tool_volume_mm3':feature.AddSubShape.Volume,'tool_bounds':str(feature.AddSubShape.BoundBox),
             'expected_tool_bounds':str(Part.makeCylinder(18.5,53,base,axis).BoundBox)}
        report['native_steps'].append(row);print(json.dumps(row),flush=True)
        (repo/'data/spring-recess-diagnosis.json').write_text(json.dumps(report,indent=2)+'\n')
finally:App.closeDocument(doc.Name)
