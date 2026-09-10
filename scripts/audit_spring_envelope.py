"""Recompute native coils at proposed lengths in memory; never save the source."""
from pathlib import Path
import hashlib,json
import FreeCAD as App

repo=Path(__file__).resolve().parents[1]
candidate=json.loads((repo/'data/housing-candidate.json').read_text())
source=repo/candidate['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==candidate['candidate_sha256']
doc=App.openDocument(str(source))
report={'source_sha256':candidate['candidate_sha256'],'scope':'Native reconstructed spring envelope; not stress, fatigue or manufacturer lift validation','poses':[]}
try:
    initial=doc.Parameters.SpringLength.Value
    cell=doc.Parameters.getCellFromAlias('SpringLength')
    for lift in [0,3.5,7]:
        doc.Parameters.set(cell,f'{initial-lift} mm');doc.recompute()
        for label in ['Intake','Exhaust']:
            for which in ['Inner','Outer']:
                body=doc.getObject(label+which+'Spring')
                coil=doc.getObject(label+which+'Coil')
                wire=doc.getObject(label+which+'WireSketch').Geometry[0]
                row={'train':label,'spring':which,'lift_mm':lift,'installed_envelope_mm':initial-lift,
                     'wire_diameter_mm':2*wire.Radius,'pitch_mm':coil.Pitch.Value,
                     'turns':coil.Height.Value/coil.Pitch.Value,
                     'axial_pitch_minus_wire_mm':coil.Pitch.Value-2*wire.Radius,
                     'valid_shape':not body.Shape.isNull() and body.Shape.isValid(),
                     'solid_count':len(body.Shape.Solids),'volume_mm3':body.Shape.Volume}
                report['poses'].append(row);print(json.dumps(row),flush=True)
    report['envelope_gate_passed']=all(r['valid_shape'] and r['solid_count']==1 and r['axial_pitch_minus_wire_mm']>1e-6 for r in report['poses'])
    report['limitations']=['Positive axial pitch margin alone does not establish minimum 3D coil clearance',
                           'Wire diameter, turn count and installed length are reconstructed',
                           'A zero or negative pitch margin fails this screening gate even if the kernel returns a valid solid',
                           'Retainer/seat fit, coil-end detail and spring load must be reviewed separately']
    (repo/'data/spring-envelope-audit.json').write_text(json.dumps(report,indent=2)+'\n')
finally:App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest()==candidate['candidate_sha256']
