"""Copy checked native histories into a larger engine without rebuilding them.

FreeCAD1.1 copyObject(recursive,return_all) copies dependencies, including a
duplicate Parameters object. Rebind expressions to the validated destination
controller and require identical actual tip fingerprints before retention.
Final saved/direct, STEP and all current neighboring pairs remain mandatory.
"""
import json
import re
from pathlib import Path
import FreeCAD as A
from cad_pipeline.extend_saved_native import rebuild_plan,spec_hash,expression_names
from cad_pipeline.saved_native_stock import file_sha
from cad_pipeline.static_pair_cache import fingerprint
from cad_pipeline.generate import single_valid_solid
from cad_pipeline.saved_recipe_agreement import compare

def material_agreement(a,b,id):
    if fingerprint(a)==fingerprint(b):return dict(passed=True,method='Identical actual boundary and placement fingerprints')
    measured=compare(a,b,id)
    if measured['boundary_difference_mm3'] is not None:
        measured.update(original_solid_difference_mm3=measured['boundary_difference_mm3'],original_solid_differences_valid=measured['boundary_difference_valid'])
    else:
        from cad_pipeline.partitioned_material import useful,differences as partitioned
        if useful(a,b):
            proof=partitioned(a,b)
            measured.update(original_solid_difference_mm3=proof['original_solid_difference_mm3'],original_solid_differences_valid=proof['original_solid_differences_valid'],boundary_partition=proof['partition'])
            measured['passed'] &= proof['passed']
        else:
            differences=[a.copy().cut(b.copy()),b.copy().cut(a.copy())]
            measured.update(original_solid_difference_mm3=[abs(s.Volume) for s in differences],original_solid_differences_valid=[s.isValid() for s in differences])
    measured['passed'] &= all(measured['original_solid_differences_valid']) and max(measured['original_solid_difference_mm3'])<=1e-5
    measured['method']='Boundary representation differs; actual original-solid bidirectional material differences and measured bounds required. No intersection-audit acceptance is transferred.'
    return measured

def owned(group):
    result={};pending=[group]
    while pending:
        obj=pending.pop()
        if obj.Name in result:continue
        result[obj.Name]=obj;pending.extend(getattr(obj,'Group',[]))
    return result

def copy_history(target,source,part,source_spec,target_spec):
    id=part['id'];old=next(p for p in source_spec['parts'] if p['id']==id)
    if id not in rebuild_plan(source_spec,target_spec)['reused'] or old!=part:raise ValueError('Native graft recipe/dependencies changed: '+id)
    if part.get('geometry_instance_of') or part.get('placement') or part.get('dressups'):raise ValueError('Initial graft method requires an independent unplaced primitive history')
    if getattr(target.Parameters,'Proxy',None) is not None:raise ValueError('Custom destination controllers cannot receive a native graft')
    group=source.getObject(id)
    if group is None or target.getObject(id) is not None:raise ValueError('Source group required and target identity must be absent')
    nodes=owned(group);tips=[o for o in nodes.values() if getattr(o,'StablePartID',None)==id]
    if len(tips)!=1 or not single_valid_solid(tips[0].Shape):raise ValueError('Unique valid source native tip required')
    for obj in [source.Parameters,*nodes.values()]:
        if getattr(obj,'Proxy',None) is not None:raise ValueError('Custom proxies cannot be grafted')
    for obj in nodes.values():
        if any(dep.Name not in nodes and dep.Name!='Parameters' for dep in obj.OutList):raise ValueError('Native history has an unowned dependency')
    names=expression_names({k:part.get(k) for k in ['features','placement','dressups']})&set(source_spec['parameters'])
    while True:
        expanded=names|set().union(*(expression_names(source_spec['parameters'][name].get('expression')) for name in names))
        expanded &= set(source_spec['parameters'])
        if expanded==names:break
        names=expanded
    for name in names:
        p=source_spec['parameters'][name];q=target_spec['parameters'][name]
        if p['value']!=q['value'] or p.get('expression')!=q.get('expression') or p['unit']!=q['unit']:raise ValueError('Controlling parameter changed: '+name)
        for controller in [source.Parameters,target.Parameters]:
            if abs(float(getattr(controller,name))-p['value'])>1e-10*max(1,abs(p['value'])):raise ValueError('Actual controller does not match specification: '+name)
    if 'Touched' in target.Parameters.State:raise ValueError('Destination controller must be recomputed before native graft')
    if any(target.getObject(name) is not None for name in nodes):raise ValueError('Native graft would rename an owned history object')
    original=fingerprint(tips[0].Shape);copied=target.copyObject(group,True,True)
    controllers=[o for o in copied if o.Name not in nodes]
    if len(controllers)>1 or any(o.TypeId!=source.Parameters.TypeId or getattr(o,'Proxy',None) is not None for o in controllers):raise ValueError('Unexpected copied dependencies')
    for obj in copied:
        if obj in controllers:continue
        for property,expression in obj.ExpressionEngine:
            rewritten=expression
            for controller in controllers:rewritten=re.sub(r'\b'+re.escape(controller.Name)+r'\.', 'Parameters.',rewritten)
            if rewritten!=expression:obj.setExpression(property,rewritten)
    for controller in controllers:target.removeObject(controller.Name)
    new_nodes=owned(target.getObject(id));new_tips=[o for o in new_nodes.values() if getattr(o,'StablePartID',None)==id]
    if len(new_tips)!=1:raise ValueError('Copied native identity differs')
    measured=material_agreement(tips[0].Shape,new_tips[0].Shape,id)
    if not measured['passed']:raise ValueError('Copied actual native geometry differs: '+str(measured))
    verified=fingerprint(new_tips[0].Shape)
    for obj in new_nodes.values():
        if any(dep.Document.Name!=target.Name or (dep.Name not in new_nodes and dep.Name!='Parameters') for dep in obj.OutList):raise ValueError('Copied history has external/shared dependencies')
    # Exact part descriptors were required above, so existing identity and
    # evidence properties are already correct. Do not add them a second time.
    for obj in new_nodes.values():obj.purgeTouched()
    target.recompute()
    if not single_valid_solid(new_tips[0].Shape):raise ValueError('Invalid grafted solid on recompute')
    if fingerprint(new_tips[0].Shape)!=verified:
        measured=material_agreement(tips[0].Shape,new_tips[0].Shape,id)
        if not measured['passed']:raise ValueError('Grafted geometry changed on recompute')
    return dict(id=id,objects=len(new_nodes),source_fingerprint=original,target_fingerprint=fingerprint(new_tips[0].Shape),material_agreement=measured,rebound_controllers=len(controllers),controlling_parameters=sorted(names))

def validate_sources(manifest):
    data=json.loads(Path(manifest).read_text(encoding='utf-8'));result=[]
    for entry in data['sources']:
        package=Path(entry['package']);spec_path=Path(entry['spec']);checks_path=Path(entry['checks'])
        report=json.loads((package/'cad-validation.json').read_text(encoding='utf-8'));checks=json.loads(checks_path.read_text(encoding='utf-8'));spec=json.loads(spec_path.read_text(encoding='utf-8'))
        if not report.get('geometric_validation_passed') or list(report['freecad_version'])!=list(A.Version()):raise ValueError('Native graft method requires the checked current FreeCAD version')
        native=package/(report['model_id']+'.FCStd')
        if not checks['passed'] or checks['native_sha256']!=file_sha(native) or checks['spec_sha256']!=file_sha(spec_path) or report['spec_sha256']!=spec_hash(spec):raise ValueError('Native graft source does not match passed checks')
        for name,record in report['files'].items():
            if file_sha(package/name)!=record['sha256']:raise ValueError('Native graft package changed: '+name)
        agreements=checks.get('agreements',checks.get('agreement',[]));checked={r['id'] for r in agreements if r['passed']};native_ids={p['id'] for p in report['parts']}
        if len(checked)!=len(agreements) or not checked<=native_ids:raise ValueError('Source native agreements must be unique, passed and present')
        selected=entry.get('part_ids',sorted(checked))
        if not set(selected)<=checked&native_ids or checks.get('step_solids')!=len(native_ids):raise ValueError('Source graft identities/STEP coverage are not checked')
        result.append(dict(entry=entry,spec=spec,native=native,ids=selected,provenance=dict(native_sha256=file_sha(native),spec_sha256=file_sha(spec_path),checks_sha256=file_sha(checks_path))))
    return result

def apply_sources(target,spec,sources,built):
    results=[]
    for record in sources:
        ids=[id for id in record['ids'] if id not in built]
        if not ids:continue
        source=A.openDocument(str(record['native']))
        try:
            if spec_hash(json.loads(source.Parameters.SpecificationJSON))!=spec_hash(record['spec']):raise ValueError('Source embedded native specification differs')
            for id in ids:
                part=next(p for p in spec['parts'] if p['id']==id)
                copied=copy_history(target,source,part,record['spec'],spec);copied.update(record['provenance']);results.append(copied);built.add(id)
                print('GRAFTED_CHECKED_NATIVE_HISTORY',id,copied['objects'],flush=True)
        finally:A.closeDocument(source.Name)
    return results
