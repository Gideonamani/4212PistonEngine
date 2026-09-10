"""Audit the fixed seat/head with native coil compression; checkpoint each result."""
from pathlib import Path
import hashlib,json
import FreeCAD as App
import Part

repo=Path(__file__).resolve().parents[1]
candidate=json.loads((repo/'data/spring-seat-candidate.json').read_text())
source=repo/candidate['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==candidate['candidate_sha256']
doc=App.openDocument(str(source))
output=repo/'data/spring-seat-audit.json'
report={'source_sha256':candidate['candidate_sha256'],'audit_complete':False,'passed':False,'poses':[],'interfaces':[],
        'scope':'Three native coil poses and listed interfaces; not load, fatigue or full valve-train certification'}
def checkpoint():output.write_text(json.dumps(report,indent=2)+'\n')
def world(name):
    b=doc.getObject(name);s=b.Shape.copy();s.Placement=b.getParentGeoFeatureGroup().getGlobalPlacement().multiply(s.Placement);return s
try:
    doc.recompute();installed=doc.Parameters.SpringLength.Value
    fixed={};coils={}
    for label in ['Intake','Exhaust']:
        fixed[label]={'head':world('CylinderHead'),'guide':world(label+'ValveGuide'),'retainer':world(label+'SpringRetainer')}
        for which in ['Inner','Outer']:
            coil=doc.getObject(label+which+'Coil');wire=doc.getObject(label+which+'WireSketch').Geometry[0]
            coils[label+which]=(coil,wire.Radius,coil.Height.Value/coil.Pitch.Value)
            coil.setExpression('Height',None);coil.setExpression('Pitch',None)
    for lift in [0,3.5,7]:
        for coil,radius,turns in coils.values():
            coil.Height=installed-lift-2*radius;coil.Pitch=(installed-lift-2*radius)/turns
        print('Recomputing coils at lift',lift,flush=True);doc.recompute()
        for label in ['Intake','Exhaust']:
            shapes={which:world(label+which+'Spring') for which in ['Inner','Outer']}
            for which,shape in shapes.items():
                coil,radius,turns=coils[label+which]
                row={'train':label,'spring':which,'lift_mm':lift,'pitch_gap_mm':coil.Pitch.Value-2*radius,
                     'valid_single_solid':not shape.isNull() and shape.isValid() and len(shape.Solids)==1}
                report['poses'].append(row)
                if not row['valid_single_solid'] or row['pitch_gap_mm']<=1e-6:
                    checkpoint();raise RuntimeError('Spring envelope failed')
            axis=doc.getObject(label+'Valve').getGlobalPlacement().Rotation.multVec(App.Vector(1,0,0))
            ret=fixed[label]['retainer'].copy();ret.translate(-axis*lift)
            for name,a,b in [('inner/head',shapes['Inner'],fixed[label]['head']),('outer/head',shapes['Outer'],fixed[label]['head']),
                             ('inner/guide',shapes['Inner'],fixed[label]['guide']),('inner/outer',shapes['Inner'],shapes['Outer']),
                             ('inner/retainer',shapes['Inner'],ret),('outer/retainer',shapes['Outer'],ret)]:
                print('Checking',label,lift,name,flush=True)
                report['active_interface']={'train':label,'lift_mm':lift,'pair':name};checkpoint()
                volume=a.common(b).Volume
                report['interfaces'].append({'train':label,'lift_mm':lift,'pair':name,'intersection_mm3':volume})
                checkpoint();print('Intersection',volume,flush=True)
                if volume>=1e-5:raise RuntimeError('Spring interface failed: '+name)
    report.pop('active_interface',None)
    report['audit_complete']=True;report['passed']=True;checkpoint()
finally:App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest()==candidate['candidate_sha256']
