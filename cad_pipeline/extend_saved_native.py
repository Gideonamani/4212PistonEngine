"""Extend a verified native package, with hash-bound partial checkpoints.

Reuses unchanged native histories; changed parameters, recipes and dependent
instances trigger rebuilding. Every final part still needs independent saved,
STEP, direct-evaluator and interference validation. Checkpoints are incomplete
construction records, never accepted CAD packages.
"""
import argparse
import ast
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import FreeCAD as A
import Part
import MeshPart
from cad_pipeline.generate import build_part, build_instance, remove_part, single_valid_solid
from cad_pipeline.spec import validate_spec, freecad_expression, deflection_for
from cad_pipeline.meshing import tessellation_shape
from cad_pipeline.research_gate import check_spec_research


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def spec_hash(spec):
    return hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest()


def expression_names(value):
    if isinstance(value, dict):
        return set().union(*(expression_names(v) for v in value.values()))
    if isinstance(value, (list, tuple)):
        return set().union(*(expression_names(v) for v in value))
    if isinstance(value, str):
        try:
            return {n.id for n in ast.walk(ast.parse(value, mode='eval')) if isinstance(n, ast.Name)}
        except SyntaxError:
            pass
    return set()


def rebuild_plan(old, new, retirement=None):
    before = {p['id']: p for p in old['parts']}
    after = {p['id']: p for p in new['parts']}
    from cad_pipeline.part_retirement import validate as validate_retirement
    retired=validate_retirement(old,new,retirement)
    if old['parameters'].keys() - new['parameters'].keys():
        raise ValueError('Parameter deletion is unsupported')
    changed_parameters = set()
    for name, p in old['parameters'].items():
        q = new['parameters'][name]
        if p['unit'] != q['unit'] or (p['value'] is None) != (q['value'] is None):
            raise ValueError('Incompatible parameter change: ' + name)
        if p['value'] != q['value'] or p.get('expression') != q.get('expression'):
            changed_parameters.add(name)
    # Unchanged derived expressions can still change when an input changes.
    while True:
        dependents = {name for name, p in new['parameters'].items()
                      if expression_names(p.get('expression')) & changed_parameters}
        if dependents <= changed_parameters:
            break
        changed_parameters.update(dependents)
    rebuild = {id for id in after if before.get(id) != after[id]}
    for id, p in after.items():
        recipe = {k: p.get(k) for k in ('features', 'placement', 'dressups')}
        if expression_names(recipe) & changed_parameters:
            rebuild.add(id)
    # An unchanged instance must be relinked when its master is reconstructed.
    while True:
        dependents = {id for id, p in after.items() if p.get('geometry_instance_of') in rebuild}
        if dependents <= rebuild:
            break
        rebuild.update(dependents)
    return dict(rebuild=[p['id'] for p in new['parts'] if p['id'] in rebuild],
                reused=[p['id'] for p in new['parts'] if p['id'] not in rebuild],
                changed_parameters=sorted(changed_parameters),retired=retired)


def checkpoint(doc, output, state, built):
    directory = output / 'checkpoints' / ('parts-%06d' % len(built))
    # Never replace a valid previous checkpoint during a later save.
    if directory.exists():
        directory = output / 'checkpoints' / ('parts-%06d-retry-%d' % (len(built), len(list((output / 'checkpoints').iterdir()))))
    directory.mkdir(parents=True)
    native = directory / 'construction.FCStd'
    print('SAVING_CHECKPOINT', len(built), str(directory), flush=True)
    doc.saveAs(str(native))
    record = dict(state, complete_spec=False, built_part_ids=sorted(built),
                  native_sha256=file_hash(native), freecad_version=A.Version())
    (directory / 'checkpoint.json').write_text(json.dumps(record, indent=2) + '\n')
    print('CHECKPOINT', len(built), str(directory), flush=True)


def last_checkpoint(output, state):
    valid = []
    for path in (output / 'checkpoints').glob('*/checkpoint.json'):
        try:
            r = json.loads(path.read_text())
            if any(r.get(k) != v for k, v in state.items()):
                continue
            if r.get('complete_spec') is not False:
                continue
            if file_hash(path.parent / 'construction.FCStd') != r['native_sha256']:
                continue
            valid.append((len(r['built_part_ids']), path.stat().st_mtime_ns, path, r))
        except (OSError, ValueError, KeyError):
            continue
    if not valid:
        raise ValueError('No compatible intact checkpoint')
    _, _, path, record = max(valid)
    return path.parent / 'construction.FCStd', record


def extend(source, spec, output, batch_runs=6, checkpoint_every=30, resume=False, stop_after=None, refresh=None, append_histories=False, preserve_unchanged=False,native_sources=None,retirement_path=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    validate_spec(spec)
    research = check_spec_research(spec, Path(__file__).resolve().parents[1])
    if source == output:
        raise ValueError('Preserve the base package')
    if (output / 'cad-validation.json').exists():
        raise ValueError('Output already contains a completed package')
    report = json.loads((source / 'cad-validation.json').read_text())
    if not report.get('complete_spec'):
        raise ValueError('A complete base package is required')
    for name, record in report['files'].items():
        if file_hash(source / name) != record['sha256']:
            raise ValueError('Base package hash mismatch: ' + name)
    base_native = source / (report['model_id'] + '.FCStd')
    state = dict(schema_version=1, spec_sha256=spec_hash(spec),
                 base_native_sha256=file_hash(base_native), batch_runs=batch_runs)
    if append_histories:state['append_histories']=True
    if preserve_unchanged:state['preserve_unchanged']=True
    retirement=None
    if retirement_path:
        retirement=json.loads(Path(retirement_path).read_text(encoding='utf-8'))
        if retirement.get('source_native_sha256')!=state['base_native_sha256']:raise ValueError('Retirement frozen native hash mismatch')
        state['retirement_manifest_sha256']=file_hash(retirement_path)
    sources=[]
    if native_sources:
        from cad_pipeline.graft_native_history import validate_sources
        sources=validate_sources(native_sources)
        state['native_source_manifest_sha256']=file_hash(native_sources)
        state['native_source_provenance']=[r['provenance'] for r in sources]
    output.mkdir(parents=True, exist_ok=True)
    if resume:
        native, saved = last_checkpoint(output, state)
        doc = A.openDocument(str(native))
        if spec_hash(json.loads(doc.Parameters.SpecificationJSON)) != state['spec_sha256']:
            raise ValueError('Checkpoint embedded specification mismatch')
        plan = saved['plan']
        built = set(saved['built_part_ids'])
        for key in ('preserved_histories','grafted_native_histories','refresh_measurements','refreshed_part_ids'):
            if key in saved:state[key]=saved[key]
        print('RESUMING', len(built), 'parts', flush=True)
    else:
        if list((output / 'checkpoints').glob('*/checkpoint.json')):
            raise ValueError('Use --resume for existing checkpoints')
        print('OPENING_NATIVE_BASE', str(base_native), flush=True)
        doc = A.openDocument(str(base_native))
        print('NATIVE_BASE_OPEN', len(doc.Objects), 'document objects', flush=True)
        old = json.loads(doc.Parameters.SpecificationJSON)
        if spec_hash(old) != report['spec_sha256']:
            raise ValueError('Base embedded specification mismatch')
        plan = rebuild_plan(old, spec, retirement)
        plan['appended']=[]
        if append_histories:
            from cad_pipeline.append_native_history import eligible
            before={p['id']:p for p in old['parts']}
            for part in spec['parts']:
                id=part['id']
                if id in before and id in plan['rebuild'] and eligible(before[id],part,plan['changed_parameters'],
                        any(p.get('geometry_instance_of')==id for p in spec['parts'])):
                    plan['appended'].append(id)
        print('NATIVE_PLAN', len(plan['reused']), 'reused', len(plan['rebuild']), 'rebuild', flush=True)
        for part in reversed(old['parts']):
            if part['id'] in plan['retired'] or (part['id'] in plan['rebuild'] and part['id'] not in plan['appended']):
                remove_part(doc, doc.getObject(part['id']))
        controller = doc.Parameters
        retained_parameters=0
        for name, p in spec['parameters'].items():
            if p['value'] is None:
                continue
            prior=old['parameters'].get(name)
            if prior and prior['value']==p['value'] and prior.get('expression')==p.get('expression'):
                if abs(float(getattr(controller,name))-p['value'])>1e-10*max(1,abs(p['value'])):
                    raise ValueError('Unchanged native controller differs from saved specification: '+name)
                retained_parameters+=1
                continue
            if name not in controller.PropertiesList:
                controller.addProperty('App::PropertyFloat', name, 'Design parameters', p['rationale'] + ' [' + p['unit'] + ']')
            controller.setExpression(name, None)
            setattr(controller, name, p['value'])
            if p['unit'] in ('count', 'ratio'):
                controller.setEditorMode(name, 1)
        for name, p in spec['parameters'].items():
            prior=old['parameters'].get(name)
            if p.get('expression') and not (prior and prior['value']==p['value'] and prior.get('expression')==p.get('expression')):
                controller.setExpression(name, freecad_expression(p['expression']))
        print('NATIVE_PARAMETERS_RETAINED',retained_parameters,flush=True)
        controller.ProvenanceJSON = json.dumps(spec['parameters'])
        controller.SpecificationJSON = json.dumps(spec)
        if preserve_unchanged:
            from cad_pipeline.preserve_native_prefixes import preserve
            state['preserved_histories']=preserve(doc,old,spec,retirement)
            print('PRESERVED_NATIVE_HISTORIES',len(state['preserved_histories']['retained_part_ids']),state['preserved_histories']['retained_object_count'],flush=True)
        print('RECOMPUTING_NATIVE_BASE_PARAMETERS', flush=True)
        doc.recompute()
        print('NATIVE_BASE_PARAMETERS_READY', flush=True)
        if plan['appended']:
            from cad_pipeline.append_native_history import append
            after={p['id']:p for p in spec['parts']}
            for id in plan['appended']:
                append(doc,before[id],after[id],spec['parameters'])
        built = set(plan['reused'])
        built.update(plan['appended'])
        state['plan'] = plan
        checkpoint(doc, output, state, built)
    state['plan'] = plan
    try:
        tips = {o.StablePartID: o for o in doc.Objects if hasattr(o, 'StablePartID')}
        if set(tips) != built or not built <= {p['id'] for p in spec['parts']}:
            raise ValueError('Checkpoint native identity mismatch')
        if refresh:
            by_id={p['id']:p for p in spec['parts']}
            for id in refresh:
                if id not in built or by_id[id].get('geometry_instance_of') or by_id[id].get('dressups') or any(p.get('geometry_instance_of')==id for p in spec['parts']):
                    raise ValueError('Refresh requires an existing independent primitive history: '+id)
                print('REFRESHING', id, flush=True)
                previous_shape=tips[id].Shape
                previous_box=previous_shape.optimalBoundingBox(False,False)
                previous_bounds=[[previous_box.XMin,previous_box.YMin,previous_box.ZMin],[previous_box.XMax,previous_box.YMax,previous_box.ZMax]]
                original_record=next(p for p in report['parts'] if p['id']==id)
                measurement=dict(id=id,before_volume_mm3=previous_shape.Volume,before_bounds_mm=previous_bounds,
                    base_volume_mm3=original_record['volume_mm3'],base_bounds_mm=original_record['bounds_mm'])
                print('REFRESH_DIAGNOSIS',json.dumps(measurement),flush=True)
                remove_part(doc,doc.getObject(id))
                _,tips[id]=build_part(doc,by_id[id],spec['parameters'],batch_runs)
                measurement['rebuilt_volume_mm3']=tips[id].Shape.Volume
                state.setdefault('refresh_measurements',[]).append(measurement)
                if id in plan['reused']:plan['reused'].remove(id)
                if id not in plan['rebuild']:plan['rebuild'].append(id)
            state['refreshed_part_ids']=list(refresh)
        if sources:
            from cad_pipeline.graft_native_history import apply_sources
            grafted=apply_sources(doc,spec,sources,built)
            state.setdefault('grafted_native_histories',[]).extend(grafted)
            tips={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')}
            if set(tips)!=built:raise ValueError('Grafted native identity mismatch')
        since_save = 0
        for part in spec['parts']:
            id = part['id']
            if id in built:
                continue
            print('BUILDING', id, flush=True)
            if part.get('geometry_instance_of'):
                _, tip = build_instance(doc, part, spec['parameters'], tips[part['geometry_instance_of']])
            else:
                _, tip = build_part(doc, part, spec['parameters'], batch_runs)
            tips[id] = tip
            built.add(id)
            since_save += 1
            print('BUILT', id, len(built), '/', len(spec['parts']), flush=True)
            if since_save >= checkpoint_every or (stop_after is not None and since_save >= stop_after):
                checkpoint(doc, output, state, built)
                if stop_after is not None and since_save >= stop_after:
                    return dict(complete_spec=False, part_count=len(built), checkpoint_saved=True)
                since_save = 0
        doc.recompute()
        # A boundary checkpoint already contains the complete history. Resume
        # recomputes it before export, so avoid saving the same large document
        # again when no parts were added after the last boundary checkpoint.
        if since_save or refresh:
            checkpoint(doc, output, state, built)
        records = {p['id']: p for p in json.loads((source / 'geometry.json').read_text())['parts']}
        final_records = []
        print('NATIVE_FINAL_GEOMETRY_CHECKS', len(spec['parts']), flush=True)
        for part in spec['parts']:
            id = part['id']
            shape = tips[id].Shape
            if not single_valid_solid(shape):
                raise ValueError('Invalid final recomputed single solid: ' + id)
            b = shape.optimalBoundingBox(False, False)
            bounds = [[b.XMin, b.YMin, b.ZMin], [b.XMax, b.YMax, b.ZMax]]
            if id in plan['reused']:
                record = records[id]
                if abs(record['volume_mm3'] - shape.Volume) / shape.Volume > 1e-6 or max(abs(bounds[j][i] - record['bounds_mm'][j][i]) for j in range(2) for i in range(3)) > 1e-5:
                    raise ValueError('Reused native history changed: ' + id)
            else:
                print('NATIVE_TESSELLATING_CHANGED_PART', id, flush=True)
                mesh = MeshPart.meshFromShape(Shape=tessellation_shape(shape, part), LinearDeflection=deflection_for(spec, part), AngularDeflection=.35, Relative=False)
                vertices, faces = mesh.Topology
                record = dict(vertices_mm=[list(v) for v in vertices], triangles=faces,
                              feature_count=1 if part.get('geometry_instance_of') else len(part['features']) + len(part.get('dressups', [])) + bool(part.get('placement')) + bool(part.get('placement', {}).get('mirror_normal')),
                              geometry_master_id=part.get('geometry_instance_of'))
            record.update(id=id, label=part['label'], group=part.get('group', 'other'), material=part.get('material', 'steel'), evidence=part['evidence'], volume_mm3=shape.Volume, bounds_mm=bounds)
            final_records.append(record)
            if len(final_records) % 100 == 0:
                print('NATIVE_FINAL_GEOMETRY_PROGRESS', len(final_records), flush=True)
        native = output / (spec['model_id'] + '.FCStd')
        step = output / (spec['model_id'] + '.step')
        print('SAVING_FINAL_NATIVE', str(native), flush=True)
        doc.saveAs(str(native))
        print('EXPORTING_FINAL_STEP', str(step), flush=True)
        Part.export([tips[p['id']] for p in spec['parts']], str(step))
        data = dict(schema_version=1, units='mm', coordinates='FreeCAD XYZ; divide by 1000 once in Blender', bounds_method='optimal_without_triangulation_or_shape_tolerance', model_id=spec['model_id'], scope=spec['scope'], parts=final_records, presentation=spec.get('presentation', {}))
        geometry = output / 'geometry.json'
        with geometry.open('w', encoding='utf-8') as stream:
            json.dump(data, stream, separators=(',', ':'))
        result = dict(report, model_id=spec['model_id'], geometric_validation_passed=True, historical_accuracy_verified=False,
                      complete_spec=True, part_count=len(final_records), feature_count=sum(p['feature_count'] for p in final_records),
                      research_review=research, spec_sha256=state['spec_sha256'], freecad_version=A.Version(), bounds_method=data['bounds_method'],
                      batched_boolean_runs=batch_runs,
                      incremental_native_build=dict(state, base_package=str(source), pending_independent_validation=True),
                      parts=[{k: v for k, v in p.items() if k not in ('vertices_mm', 'triangles')} for p in final_records])
        result['files'] = {p.name: dict(bytes=p.stat().st_size, sha256=file_hash(p)) for p in (native, step, geometry)}
        (output / 'cad-validation.json').write_text(json.dumps(result, indent=2) + '\n')
        print('COMPLETE', len(final_records), 'native parts', flush=True)
        return result
    finally:
        A.closeDocument(doc.Name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-package', type=Path, required=True)
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--batch-runs', type=int, default=6)
    parser.add_argument('--checkpoint-every', type=int, default=30)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--append-histories', action='store_true', help='Retain verified unchanged native prefixes and append linked features; excludes placed/dressed/shared histories')
    parser.add_argument('--preserve-unchanged', action='store_true', help='Avoid metadata-triggered re-execution of dependency-verified unchanged evaluated histories; requires final saved validation')
    parser.add_argument('--native-sources',type=Path,help='Hash-bound checked native subset manifest; copy eligible independent histories and rebind the shared controller')
    parser.add_argument('--retirements',type=Path,help='Exact hash-bound replaced-part retirement manifest; source native remains unchanged')
    parser.add_argument('--refresh', nargs='+', help='Reconstruct named independent histories from the unchanged recipe after a diagnosed reuse discrepancy')
    args = parser.parse_args()
    if args.checkpoint_every < 1:
        parser.error('checkpoint-every must be positive')
    extend(args.source_package, json.loads(args.spec.read_text()), args.output, args.batch_runs, args.checkpoint_every, args.resume, refresh=args.refresh, append_histories=args.append_histories,preserve_unchanged=args.preserve_unchanged,native_sources=args.native_sources,retirement_path=args.retirements)


if __name__ == '__main__':
    main()
