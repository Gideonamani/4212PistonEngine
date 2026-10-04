"""Independent saved CAD/STEP reopening, solid count and volume round-trip checks."""
import argparse,json,sys,math,hashlib
from pathlib import Path
import FreeCAD as A
import Part
from step_roundtrip import accept_boundary_exception

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--step-boundary-exception',type=Path);a=p.parse_args();folder=a.package
    report=json.loads((folder/'cad-validation.json').read_text())
    if report.get('complete_spec') is False:raise ValueError('A development subset cannot be validated as a complete assembly')
    for name,record in report['files'].items():
        if hashlib.sha256((folder/name).read_bytes()).hexdigest()!=record['sha256']:raise ValueError('Saved package hash mismatch: '+name)
    model=report['model_id'];doc=A.openDocument(str(folder/(model+'.FCStd')));doc.recompute()
    tips=[o for o in doc.Objects if hasattr(o,'StablePartID')]
    if len(tips)!=report['part_count']:raise ValueError('Native part count mismatch')
    records={p['id']:p for p in report['parts']};max_bounds_error=0;max_record_volume_error=0;differences=[]
    if set(records)!={o.StablePartID for o in tips}:raise ValueError('Native/report identity mismatch')
    for o in tips:
        if o.Shape.isNull() or not o.Shape.isValid() or len(o.Shape.Solids)!=1 or o.Shape.Volume<=0:raise ValueError(o.Name)
        if any(state in ('Invalid','Error') for state in o.State):raise ValueError('Feature error: '+o.Name+str(o.State))
        record=records[o.StablePartID];b=o.Shape.optimalBoundingBox(False,False) if report.get('bounds_method')=='optimal_without_triangulation_or_shape_tolerance' else o.Shape.BoundBox;bounds=[[b.XMin,b.YMin,b.ZMin],[b.XMax,b.YMax,b.ZMax]]
        bounds_error=max(abs(bounds[j][i]-record['bounds_mm'][j][i]) for j in range(2) for i in range(3));volume_error=abs(o.Shape.Volume-record['volume_mm3'])/o.Shape.Volume
        max_bounds_error=max(max_bounds_error,bounds_error);max_record_volume_error=max(max_record_volume_error,volume_error)
        if bounds_error>1e-5 or volume_error>1e-6:differences.append(dict(id=o.StablePartID,bounds_error_mm=bounds_error,relative_volume_error=volume_error,native_bounds_mm=bounds,record_bounds_mm=record['bounds_mm']))
    if differences:
        (folder/'metadata-differences.json').write_text(json.dumps(dict(max_bounds_error_mm=max_bounds_error,max_relative_volume_error=max_record_volume_error,parts=differences),indent=2)+'\n')
        raise ValueError('Saved CAD differs from tessellation/report metadata: bounds='+str(max_bounds_error)+' mm; volume='+str(max_record_volume_error))
    step=Part.Shape();step.read(str(folder/(model+'.step')))
    if not step.isValid() or len(step.Solids)!=len(tips):raise ValueError('STEP solid mismatch')
    native_volume=sum(o.Shape.Volume for o in tips);delta=abs(native_volume-step.Volume)/native_volume
    volume_tolerance=1e-5
    # Preserve every solid-volume comparison, not just the aggregate. A mass
    # discrepancy alone does not identify whether geometry or integration changed.
    native_volumes=sorted(o.Shape.Volume for o in tips);step_volumes=sorted(s.Volume for s in step.Solids)
    worst_part=max(abs(a-b)/a for a,b in zip(native_volumes,step_volumes))
    exception=None
    if delta>volume_tolerance or worst_part>1e-4:
        labelled=sorted((o.Shape.Volume,o.StablePartID) for o in tips)
        pairs=[dict(native_id=id,native_volume_mm3=v,step_volume_mm3=s,relative_error=abs(v-s)/v) for (v,id),s in zip(labelled,step_volumes)]
        (folder/'step-differences.json').write_text(json.dumps(dict(total_relative_error=delta,worst_relative_error=worst_part,pairs=sorted(pairs,key=lambda p:-p['relative_error'])),indent=2)+'\n')
        if delta>volume_tolerance or not a.step_boundary_exception:
            raise ValueError('STEP volume roundtrip mismatch: total='+str(delta)+'; worst='+str(worst_part))
        hashes={name:report['files'][name]['sha256'] for name in (model+'.FCStd',model+'.step')}
        evidence=json.loads((folder/'step-boundary-checks.json').read_text())
        policy=json.loads(a.step_boundary_exception.read_text())
        exception=accept_boundary_exception(pairs,evidence,policy,hashes)
    bb=Part.makeCompound([o.Shape for o in tips]).BoundBox
    result=dict(passed=True,native_reopened=True,step_valid=True,parts=len(tips),relative_volume_error=delta,native_record_bounds_error_mm=max_bounds_error,native_record_relative_volume_error=max_record_volume_error,
                total_volume_relative_tolerance=volume_tolerance,worst_solid_relative_volume_error=worst_part,solid_volume_relative_tolerance=1e-4,
                assembly_extents_mm=[bb.XLength,bb.YLength,bb.ZLength],source_fidelity='Not established by these checks',
                strict_solid_volume_check_passed=worst_part<=1e-4,step_boundary_exception=exception,
                validation_status='passed_with_documented_step_mass_exception' if exception else 'passed')
    A.closeDocument(doc.Name);(folder/'reopen-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':main()
