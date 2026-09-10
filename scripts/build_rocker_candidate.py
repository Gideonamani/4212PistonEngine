"""Create an isolated native-feature rocker candidate; never overwrite the master."""
from pathlib import Path
import hashlib
import json
import FreeCAD as App

repo = Path(__file__).resolve().parents[1]
source = repo.parent / 'EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Cylinder.FCStd'
output = repo / 'build/rocker-contact/GTSIO520_Rocker_Candidate.FCStd'
output.parent.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
doc = App.openDocument(str(source))
report = {'source_sha256': source_hash, 'status': 'Experimental, not promoted',
          'contact_radius_mm': 2.0,
          'evidence': 'Reconstructed smoothing radius; not a manufacturer dimension', 'parts': []}
try:
    for label in ['Intake', 'Exhaust']:
        body = doc.getObject(label + 'RockerArm')
        previous = body.Tip
        # Match the known reconstructed contact edge geometrically, not by index.
        edges = []
        for index, edge in enumerate(previous.Shape.Edges, 1):
            vertices = [v.Point for v in edge.Vertexes]
            if (len(vertices) == 2 and
                all(abs(v.x - 119.5) < 1e-6 and abs(v.z - 4) < 1e-6 for v in vertices) and
                abs(edge.Length - 12) < 1e-6):
                edges.append('Edge' + str(index))
        if len(edges) != 1:
            raise RuntimeError(f'{label}: expected one contact edge, got {edges}')
        fillet = body.newObject('PartDesign::Fillet', label + 'ContactRounding')
        fillet.Base = (previous, edges)
        fillet.Radius = report['contact_radius_mm']
        fillet.Refine = True
        doc.recompute()
        if body.Shape.isNull() or not body.Shape.isValid() or len(body.Shape.Solids) != 1:
            raise RuntimeError(f'{label}: invalid rounded rocker')
        body.Evidence += ' Experimental native 2 mm contact-edge fillet; reconstructed radius, pending dynamic contact/clearance review.'
        report['parts'].append({'id': body.StablePartID, 'feature': fillet.Name,
                                'volume_mm3': body.Shape.Volume, 'valid_single_solid': True})
        print(label, 'rounded contact feature valid', flush=True)
    doc.recompute()
    doc.saveAs(str(output))
    report['candidate_sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
    report['candidate_file'] = 'build/rocker-contact/' + output.name
    (repo / 'data/rocker-candidate.json').write_text(json.dumps(report, indent=2) + '\n')
finally:
    App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
