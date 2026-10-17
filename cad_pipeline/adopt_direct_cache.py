"""Carry unchanged, verified direct-evaluator caches into an expanded specification.

No native geometry is substituted for direct geometry. Only identical recipes
with unchanged controlling parameters are eligible. Final saved/native/direct
and assembly validation remain mandatory.
"""
import argparse
import json
from pathlib import Path
from cad_pipeline.extend_saved_native import rebuild_plan, file_hash, spec_hash
from cad_pipeline.fast_build import part_key
from cad_pipeline.spec import validate_spec, deflection_for


def adopt(old_spec, new_spec, source_cache, base_package, base_checks, output,allow_subset=False,source_spec_path=None,only=None,manifest_name='cache-adoption.json',retirement_path=None):
    validate_spec(old_spec);validate_spec(new_spec)
    source_cache,base_package,output=map(lambda p:Path(p).resolve(),(source_cache,base_package,output))
    if output==source_cache:raise ValueError('Preserve the original direct cache')
    report=json.loads((base_package/'cad-validation.json').read_text())
    subset=report.get('complete_spec') is not True
    if subset and not allow_subset:raise ValueError('A complete base package is required')
    checks=json.loads(Path(base_checks).read_text())
    native=base_package/(report['model_id']+'.FCStd')
    if not checks['passed'] or checks['native_sha256']!=file_hash(native) or report['spec_sha256']!=spec_hash(old_spec):
        raise ValueError('Base saved/direct verification does not match the old specification')
    for name,record in report['files'].items():
        if file_hash(base_package/name)!=record['sha256']:raise ValueError('Base package changed: '+name)
    retirement=json.loads(Path(retirement_path).read_text(encoding='utf-8')) if retirement_path else None
    if retirement and retirement.get('source_native_sha256')!=file_hash(native):raise ValueError('Retirement frozen native mismatch')
    plan=rebuild_plan(old_spec,new_spec,retirement)
    eligible=set(plan['reused']);before={p['id']:p for p in old_spec['parts']}
    checked_ids=None
    source_agreements={r['id']:r for r in checks.get('agreement',checks.get('agreements',[]))}
    if subset:
        if source_spec_path is None or file_hash(source_spec_path)!=checks.get('spec_sha256') or json.loads(Path(source_spec_path).read_text(encoding='utf-8'))!=old_spec:raise ValueError('Subset source specification file must match passed checks')
        agreements=checks.get('agreements',checks.get('agreement',[]))
        checked_ids={r['id'] for r in agreements if r.get('passed')}
        native_ids={p['id'] for p in report['parts']}
        if len(checked_ids)!=len(agreements) or not checked_ids<=native_ids:raise ValueError('Subset agreement identities must be unique passed native parts')
        eligible &= checked_ids
    if only is not None:
        selected=set(only)
        if len(selected)!=len(only) or not selected<=eligible:raise ValueError('Selected direct caches must be unique checked unchanged parts')
        eligible=selected
    if Path(manifest_name).name!=manifest_name or not manifest_name.endswith('.json'):raise ValueError('Cache manifest must be a local JSON filename')
    for name in ('part-cache','brep-cache'):(output/name).mkdir(parents=True,exist_ok=True)
    adopted=[];missing=[];scoped_agreements=[];doc=None
    if subset:
        import FreeCAD as A
        import Part
        from cad_pipeline.saved_recipe_agreement import compare
        # The passed reopening report binds this exact archive. Read its saved
        # evaluated tips here; this is construction-cache verification, not a
        # replacement for the target engine's independent full recompute.
        doc=A.openDocument(str(native))
        native_shapes={o.StablePartID:o.Shape.copy() for o in doc.Objects if hasattr(o,'StablePartID')}
        A.closeDocument(doc.Name)
        if set(native_shapes)!=native_ids:raise ValueError('Subset native identities changed')
    for part in new_spec['parts']:
        id=part['id']
        if id not in eligible:continue
        old_key=part_key(before[id],old_spec['parameters'],deflection_for(old_spec,before[id]))
        old_json=source_cache/'part-cache'/(id+'.json')
        old_brep=source_cache/'brep-cache'/(id+'-'+old_key+'.brep')
        if not old_json.exists() or not old_brep.exists():missing.append(id);continue
        data=json.loads(old_json.read_text())
        if data['key']!=old_key:missing.append(id);continue
        record=data['record']
        if record.get('id')!=id or record.get('solids')!=1 or not record.get('valid') or record.get('volume_mm3',0)<=0:
            raise ValueError('Invalid cached direct solid: '+id)
        if not subset:
            checked=source_agreements.get(id,{})
            if not checked.get('passed') or checked.get('direct_brep_sha256')!=file_hash(old_brep):raise ValueError('Direct cache changed since passed agreement: '+id)
        if subset:
            measured=compare(native_shapes[id],Part.read(str(old_brep)),id)
            measured['direct_brep_sha256']=file_hash(old_brep)
            if not measured['passed']:raise ValueError('Subset cache differs from actual checked native solid: '+id)
            scoped_agreements.append(measured)
        new_key=part_key(part,new_spec['parameters'],deflection_for(new_spec,part))
        target=output/'brep-cache'/(id+'-'+new_key+'.brep')
        target.write_bytes(old_brep.read_bytes())
        data['key']=new_key
        (output/'part-cache'/(id+'.json')).write_text(json.dumps(data,separators=(',',':')))
        adopted.append(dict(id=id,old_key=old_key,new_key=new_key,brep_sha256=file_hash(target)))
        if len(adopted)%200==0:print('DIRECT_CACHE_ADOPTION_PROGRESS',len(adopted),flush=True)
    record=dict(base_native_sha256=file_hash(native),base_spec_sha256=spec_hash(old_spec),
                new_spec_sha256=spec_hash(new_spec),adopted=adopted,missing_cache=missing,
                retired_part_ids=plan['retired'],retirement_manifest_sha256=file_hash(retirement_path) if retirement_path else None,
                source_complete_spec=not subset,source_checked_part_ids=sorted(checked_ids) if checked_ids is not None else None,
                scoped_direct_agreements=scoped_agreements,selected_part_ids=sorted(eligible) if only is not None else None,
                scope='Identical direct recipes with unchanged controlling parameters; no full-assembly acceptance')
    (output/manifest_name).write_text(json.dumps(record,indent=2)+'\n')
    return record


def main():
    p=argparse.ArgumentParser()
    for name in ('base-spec','spec','source-cache','base-package','base-checks','output'):p.add_argument('--'+name,type=Path,required=True)
    a=p.parse_args()
    result=adopt(json.loads(a.base_spec.read_text()),json.loads(a.spec.read_text()),a.source_cache,a.base_package,a.base_checks,a.output)
    print('DIRECT_CACHE_ADOPTED',len(result['adopted']),'missing',len(result['missing_cache']),flush=True)


if __name__=='__main__':main()
