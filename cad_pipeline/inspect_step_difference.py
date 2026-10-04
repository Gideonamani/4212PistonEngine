"""Measure boundary correspondence for solids with STEP mass discrepancies."""
import argparse,json,hashlib
from pathlib import Path
import FreeCAD as A,Part

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);a=p.parse_args();folder=a.package;report=json.loads((folder/'cad-validation.json').read_text());doc=A.openDocument(str(folder/(report['model_id']+'.FCStd')))
    objects=sorted((o.Shape.Volume,o.StablePartID,o.Shape) for o in doc.Objects if hasattr(o,'StablePartID'));exchange=Part.Shape();exchange.read(str(folder/(report['model_id']+'.step')));solids=sorted(exchange.Solids,key=lambda s:s.Volume);results=[]
    step_records=[(s.Volume,s.CenterOfMass,s) for s in solids]
    for (volume,id,native),paired in zip(objects,solids):
        if abs(volume-paired.Volume)/volume<=1e-4:continue
        # Equal repeated parts can change volume sort order after STEP import.
        # Match the suspect part by its physical location before sampling.
        candidates=[(center,s) for v,center,s in step_records if abs(volume-v)/volume<.001];center=native.Solids[0].CenterOfMass
        step=min(candidates,key=lambda pair:(pair[0]-center).Length)[1]
        error=abs(volume-step.Volume)/volume
        if error<=1e-4:continue
        def sample(shape):
            points=[v.Point for v in shape.Vertexes]
            for face in shape.Faces:
                distance,pairs,info=face.distToShape(Part.Vertex(face.CenterOfMass))
                if pairs:points.append(pairs[0][0])
            return points
        forward=max(Part.Vertex(pt).distToShape(step)[0] for pt in sample(native));reverse=max(Part.Vertex(pt).distToShape(native)[0] for pt in sample(step))
        nb=native.optimalBoundingBox(False,False);sb=step.optimalBoundingBox(False,False);bounds_error=max(abs(getattr(nb,k)-getattr(sb,k)) for k in ('XMin','XMax','YMin','YMax','ZMin','ZMax'))
        result=dict(id=id,relative_volume_error=error,absolute_volume_difference_mm3=abs(volume-step.Volume),sampled_boundary_error_mm=max(forward,reverse),optimal_bounds_error_mm=bounds_error,native_vertices=len(native.Vertexes),native_faces=len(native.Faces),step_vertices=len(step.Vertexes),step_faces=len(step.Faces),scope='All vertices plus closest boundary point to each face centroid, sampled in both directions; not a continuous Hausdorff proof')
        results.append(result);print(json.dumps(result),flush=True)
    hashes={name:hashlib.sha256((folder/name).read_bytes()).hexdigest() for name in (report['model_id']+'.FCStd',report['model_id']+'.step')}
    (folder/'step-boundary-checks.json').write_text(json.dumps(dict(parts=results,source_hashes=hashes,sampling_method='all_vertices_and_projected_face_centroids_bidirectional',scope='Investigate the original strict volume failure; do not infer manufacturing accuracy'),indent=2)+'\n');A.closeDocument(doc.Name)
if __name__=='__main__':main()
