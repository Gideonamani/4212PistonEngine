"""Add native spring-seat recesses to the isolated spring candidate."""
from pathlib import Path
import hashlib,json
import FreeCAD as App

repo=Path(__file__).resolve().parents[1]
parent=json.loads((repo/'data/spring-candidate.json').read_text())
source=repo/parent['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==parent['candidate_sha256']
doc=App.openDocument(str(source))
out=repo/'build/spring-seat/GTSIO520_Spring_Seat_Candidate.FCStd'
out.parent.mkdir(parents=True,exist_ok=True)
report={'status':'Experimental; spring interface audit pending','parent_sha256':parent['candidate_sha256'],
        'candidate_file':'build/spring-seat/'+out.name,'recess_type':'Circular pocket above spring-seat floor; guide support below floor retained','features':[]}
try:
    p=doc.Parameters
    outer=p.SpringOuterRadius.Value+p.SpringOuterWire.Value+1
    for label in ['Intake','Exhaust']:
        valve=doc.getObject(label+'Valve')
        datum=valve.getGlobalPlacement()
        axis=datum.Rotation.multVec(App.Vector(1,0,0))
        floor=datum.multVec(App.Vector(p.SpringSeatStation.Value,0,0))
        inv=doc.CylinderHead.getGlobalPlacement().inverse()
        plane=App.Placement(inv.multVec(floor),App.Rotation(App.Vector(0,0,1),inv.Rotation.multVec(axis)))
        print('Building',label,'spring recess',flush=True)
        tool_body=doc.addObject('PartDesign::Body',label+'SpringRecessTool')
        tool_body.addProperty('App::PropertyBool','ConstructionOnly','Export');tool_body.ConstructionOnly=True
        tool_body.Placement=doc.Cylinder.getGlobalPlacement().inverse().multiply(App.Placement(floor,App.Rotation(App.Vector(0,0,1),axis)))
        cutter=tool_body.newObject('PartDesign::AdditiveCylinder',label+'SpringRecessCylinder')
        cutter.setExpression('Radius','Parameters.SpringOuterRadius + Parameters.SpringOuterWire + 1 mm')
        cutter.setExpression('Height','Parameters.SpringLength + 8 mm')
        doc.recompute()
        pocket=doc.CylinderHead.newObject('PartDesign::Boolean',label+'SpringSeatRecess')
        assert 'Cut' in pocket.getEnumerationsOfProperty('Type')
        pocket.Type='Cut';pocket.Group=[tool_body];pocket.Refine=True;doc.recompute()
        report['features'].append({'name':pocket.Name,'outer_radius_mm':outer,
                                  'seat_station_mm':p.SpringSeatStation.Value,'depth_mm':cutter.Height.Value,
                                  'native_type':pocket.TypeId})
    doc.CylinderHead.Evidence+=' Experimental circular spring-seat recesses clear the reconstructed spring envelope by 1 mm radially. Guide support below the seat floor remains; separate valve guides are unchanged. Floor follows SpringSeatStation; pocket dimensions are reconstructed, not manufacturing instructions.'
    doc.recompute()
    bodies=[b for b in doc.Objects if b.TypeId=='PartDesign::Body' and not getattr(b,'ConstructionOnly',False)]
    invalid=[b.Name for b in bodies if b.Shape.isNull() or not b.Shape.isValid() or len(b.Shape.Solids)!=1]
    if invalid:
        report['invalid_bodies']=[{'name':b.Name,'valid':b.Shape.isValid(),'solids':len(b.Shape.Solids),
                                   'solid_volumes_mm3':[s.Volume for s in b.Shape.Solids]} for b in bodies if b.Name in invalid]
        (repo/'data/spring-seat-boolean-failure.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report['invalid_bodies']),flush=True)
        raise RuntimeError('Invalid bodies '+str(invalid))
    report['valid_single_solid_bodies']=len(bodies)
    report['unconstrained_sketches']=[s.Name for s in doc.Objects if s.TypeId=='Sketcher::SketchObject' and not s.FullyConstrained]
    doc.saveAs(str(out));report['candidate_sha256']=hashlib.sha256(out.read_bytes()).hexdigest()
    (repo/'data/spring-seat-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
finally:App.closeDocument(doc.Name)
