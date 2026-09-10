"""Create and audit a reconstructed spring envelope inside the manual's test-length range."""
from pathlib import Path
import hashlib,json
import FreeCAD as App

repo=Path(__file__).resolve().parents[1]
parent=json.loads((repo/'data/housing-candidate.json').read_text())
reference=json.loads((repo/'data/valve-spring-reference.json').read_text())
source=repo/parent['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==parent['candidate_sha256']
# Keep this illustrative 7 mm stroke within both springs' tabulated test-length intervals.
low=max(min(p['compressed_length_mm'] for p in s['test_points']) for s in reference['springs'].values())+7
high=min(max(p['compressed_length_mm'] for p in s['test_points']) for s in reference['springs'].values())
installed=45.
assert low<=installed<=high
doc=App.openDocument(str(source))
out=repo/'build/spring-envelope/GTSIO520_Spring_Candidate.FCStd'
out.parent.mkdir(parents=True,exist_ok=True)
report={'status':'Experimental, not manufacturer installed dimensions','parent_sha256':parent['candidate_sha256'],
        'candidate_file':'build/spring-envelope/'+out.name,'selected_installed_length_mm':installed,
        'test_interval_screen_for_7mm_lift_mm':[low,high], 'spring_seat_station_mm':65,
        'rationale':'Reconstructed length chosen inside both manual test intervals over illustrative 7 mm lift; not inferred as factory installation',
        'poses':[],'interfaces':[]}
def world(name):
    b=doc.getObject(name);s=b.Shape.copy()
    s.Placement=b.getParentGeoFeatureGroup().getGlobalPlacement().multiply(s.Placement)
    return s
try:
    p=doc.Parameters;cell=p.getCellFromAlias('SpringLength');row=cell[1:]
    p.set(cell,'45 mm');p.set('C'+row,'Reconstructed')
    p.set('D'+row,'45 mm teaching envelope keeps 7 mm illustrative compression inside both B-4 test-length intervals; not a manufacturer installed dimension.')
    newrow=2
    while p.getContents('A'+str(newrow)):newrow+=1
    for column,value in zip('ABCD',['SpringSeatStation','65 mm','Derived reconstruction','Retainer station 110 mm minus selected installed spring envelope 45 mm']):
        p.set(column+str(newrow),value)
    p.setAlias('B'+str(newrow),'SpringSeatStation')
    for label in ['Intake','Exhaust']:
        doc.getObject(label+'SpringPlatform').setExpression('Length','Parameters.SpringSeatStation - 63 mm')
        for which in ['Inner','Outer']:
            sk=doc.getObject(label+which+'WireSketch')
            for index,c in enumerate(sk.Constraints):
                if c.Type=='DistanceX':sk.setExpression(f'Constraints[{index}]',f'Parameters.SpringSeatStation + Parameters.Spring{which}Wire')
            doc.getObject(label+which+'Spring').Evidence+=' Experimental 45 mm installed envelope with fixed seat at local 65 mm; chosen within B-4 test-length intervals for illustrative 7 mm lift, not a manufacturer installation dimension.'
    doc.CylinderHead.Evidence+=' Experimental spring platforms end at reconstructed station 65 mm to support the 45 mm spring envelope; retainer and valve dimensions unchanged.'
    doc.recompute()
    bodies=[b for b in doc.Objects if b.TypeId=='PartDesign::Body']
    invalid=[b.Name for b in bodies if b.Shape.isNull() or not b.Shape.isValid() or len(b.Shape.Solids)!=1]
    if invalid:raise RuntimeError('Invalid closed bodies: '+str(invalid))
    report['valid_single_solid_bodies']=len(bodies)
    report['unconstrained_sketches']=[s.Name for s in doc.Objects if s.TypeId=='Sketcher::SketchObject' and not s.FullyConstrained]
    doc.saveAs(str(out));report['candidate_sha256']=hashlib.sha256(out.read_bytes()).hexdigest()
    report['audit_complete']=False
    (repo/'data/spring-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Closed spring candidate saved',flush=True)
    for lift in [0,3.5,7]:
        p.set(cell,f'{installed-lift} mm');doc.recompute()
        for label in ['Intake','Exhaust']:
            for which in ['Inner','Outer']:
                body=doc.getObject(label+which+'Spring');coil=doc.getObject(label+which+'Coil')
                wire=doc.getObject(label+which+'WireSketch').Geometry[0]
                report['poses'].append({'train':label,'spring':which,'lift_mm':lift,'envelope_mm':installed-lift,
                    'pitch_mm':coil.Pitch.Value,'wire_diameter_mm':2*wire.Radius,
                    'axial_pitch_minus_wire_mm':coil.Pitch.Value-2*wire.Radius,
                    'valid_single_solid':not body.Shape.isNull() and body.Shape.isValid() and len(body.Shape.Solids)==1})
            axis=doc.getObject(label+'Valve').getGlobalPlacement().Rotation.multVec(App.Vector(1,0,0))
            retainer=world(label+'SpringRetainer');retainer.translate(-axis*lift)
            inner,outer=world(label+'InnerSpring'),world(label+'OuterSpring')
            pairs=[('inner/head',inner,world('CylinderHead')),('outer/head',outer,world('CylinderHead')),
                   ('inner/guide',inner,world(label+'ValveGuide')),('inner/outer',inner,outer),
                   ('inner/retainer',inner,retainer),('outer/retainer',outer,retainer)]
            for name,a,b in pairs:
                print('Checking',label,lift,name,flush=True)
                volume=a.common(b).Volume
                report['interfaces'].append({'train':label,'lift_mm':lift,'pair':name,'intersection_mm3':volume})
                print(label,lift,name,volume,flush=True)
                (repo/'data/spring-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
                if volume>=1e-5:
                    report['sampled_gate_passed']=False
                    report['status']='Rejected: native spring interface intersection; audit stopped at first failure'
                    (repo/'data/spring-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
                    raise RuntimeError(f'{label} {lift} {name}: {volume} mm3 intersection')
    report['sampled_gate_passed']=all(r['valid_single_solid'] and r['axial_pitch_minus_wire_mm']>1e-6 for r in report['poses']) and all(r['intersection_mm3']<1e-5 for r in report['interfaces'])
    report['audit_complete']=True
    report['limitations']=['Three lift samples only','Positive axial pitch gap is a screen, not full 3D coil-clearance certification',
                           'Wire diameter, turn count, end treatment and load response remain reconstructed/unvalidated']
    (repo/'data/spring-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
finally:App.closeDocument(doc.Name)
