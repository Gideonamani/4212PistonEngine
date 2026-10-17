"""Refresh the contour study from immutable R2/R3 sources without starting CAD."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from cad_pipeline.spec import evaluate

STUDY = Path('cad-studies/gtsio520-h-static/crankcase-contours')
R2 = Path('build/gtsio520-systems-r2')
R3 = Path('build/gtsio520-systems-r3')


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


def binding(path):
    return dict(path=Path(path).as_posix(), bytes=Path(path).stat().st_size, sha256=sha(path))


def numeric(value, parameters):
    if isinstance(value, list):
        return [numeric(v, parameters) for v in value]
    return evaluate(value, parameters)


def roles(feature):
    label = feature.get('label', '').lower()
    result = []
    if feature['operation'] == 'add':
        result.append('necessary stock / verify after contour construction')
    if any(w in label for w in ('line-bored', 'pilot seat', 'attachment bore', 'seat', 'guide', 'pad', 'parting', 'datum')):
        result.append('machined interface / retain datum and dimensions')
    if any(w in label for w in ('gallery', 'feed', 'crossfeed', 'oil connection', 'transfer', 'closure')):
        result.append('pressure oil space / preserve connected void and enclosing stock')
    if any(w in label for w in ('clearance', 'chamber', 'envelope', 'sweep', 'cavity')):
        result.append('guest or moving clearance / preserve full envelope')
    if 'oil return' in label:
        result.append('open return space / distinct from pressure band; full return unproved')
    if not result:
        result.append('individual construction / explicit review required')
    return result


def refresh():
    handoff = read(STUDY / 'session-handoff-status.json')
    bindings = []
    for expected in [handoff['preserved_source_native'], *handoff['evidence']]:
        actual = binding(expected['path'])
        if actual != expected:
            raise ValueError('Changed handoff source: ' + expected['path'])
        bindings.append(actual)
    source, recipe = read(R2 / 'part-spec.json'), read(R3 / 'part-spec.json')
    audit = read(R2 / 'cad/saved-shape-checks.json')
    if (audit['passed'] or audit['parts'] != 1440 or audit['pairs'] != 5715 or audit['overlaps']
            or {r['id'] for r in audit['agreement_issues']} != {'CrankcaseLeft'}
            or audit['agreement_issues'][0]['boundary_difference_mm3'] != [0.0002857142857142303, 0.]):
        raise ValueError('Unexpected R2 scope; preserve the known failure')
    reopen = read(R2 / 'cad/reopen-validation.json')
    interfaces = read(R2 / 'cad/interface-checks.json')
    context = read(R3 / 'context-checks.json')
    galleries = read(R3 / 'gallery-direct-checks.json')
    if not all(r['passed'] for r in [reopen, interfaces, context, galleries]):
        raise ValueError('Expected the recorded scoped source passes')
    if (len(interfaces['checks']) != 31 or context['pairs'] != 348 or context['overlaps']
            or context['spec_sha256'] != sha(R3 / 'part-spec.json')
            or galleries['spec_sha256'] != sha(R3 / 'part-spec.json')):
        raise ValueError('Unexpected source report coverage or binding')
    if list((R3 / 'cad').glob('*.FCStd')) or list((R3 / 'cad/checkpoints').glob('*/checkpoint.json')):
        raise ValueError('R3 native state changed; review before refreshing')
    before = {p['id']: p for p in source['parts']}
    after = {p['id']: p for p in recipe['parts']}
    changed = [i for i in after if before[i] != after[i]]
    if changed != ['CrankcaseLeft'] or source['parameters'] != recipe['parameters']:
        raise ValueError('R3 is expected to append only the left-case core finish')
    inventory_path = Path(recipe['research']['inventory_path'])
    inventory = read(inventory_path)
    if sha(inventory_path) != recipe['research']['inventory_sha256']:
        raise ValueError('Research inventory changed')
    callouts = [r for r in inventory['components'] if r['id'].startswith('A-4-18:')]
    if len(callouts) != 143:
        raise ValueError('Complete A-4-18 legend required')
    cases = {}
    for identity in ['CrankcaseLeft', 'CrankcaseRight']:
        part = after[identity]
        metadata = R3 / 'development/part-cache' / (identity + '.json')
        cache = read(metadata)
        brep = R3 / 'development/brep-cache' / (identity + '-' + cache['key'] + '.brep')
        if not cache['record']['valid'] or cache['record']['solids'] != 1:
            raise ValueError('Invalid direct case')
        ledger = []
        for index, feature in enumerate(part['features'], 1):
            dimensions = {k: numeric(v, recipe['parameters']) for k, v in feature.items()
                          if k in ('radius', 'inner_radius', 'height', 'length', 'width', 'origin', 'axis', 'points', 'sections')}
            recipe_sha = hashlib.sha256(json.dumps(feature, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            ledger.append(dict(feature_index=index, label=feature.get('label', ''), roles=roles(feature),
                               primitive=feature['primitive'], operation=feature['operation'],
                               evaluated_mm=dimensions, recipe_sha256=recipe_sha))
        cases[identity] = dict(feature_count=len(ledger), source_native_feature_count=len(before[identity]['features']),
            source_native_agreement='failed' if identity == 'CrankcaseLeft' else 'passed',
            direct_metadata=binding(metadata), direct_brep=binding(brep),
            bounds_mm=cache['record']['bounds_mm'], volume_mm3=cache['record']['volume_mm3'],
            deck_origins_mm=[numeric(f['origin'], recipe['parameters']) for f in part['features']
                             if f.get('label') == 'Eight-position cylinder mounting deck'],
            feature_ledger=ledger)
    face = R3 / 'face-pair-r3'
    face_report = read(face / 'native-checks.json')
    face_spec = read(face / 'source-part-spec.json')
    face_native = face / 'native' / (face_spec['model_id'] + '.FCStd')
    face_step = face / 'native' / (face_spec['model_id'] + '.step')
    if (not face_report['passed'] or face_report['native_sha256'] != sha(face_native)
            or face_report['step_sha256'] != sha(face_step)
            or face_report['spec_sha256'] != sha(face / 'source-part-spec.json')):
        raise ValueError('Accepted independent face study changed')
    face_bindings = [binding(face / p) for p in ['native-checks.json', 'direct-checks.json', 'source-part-spec.json', 'inventory.json']]
    face_bindings += [binding(face_native), binding(face_step)]
    result = dict(recorded_at=datetime.now(timezone.utc).isoformat(),
        scope='Refreshed source/interface ledger. R2 is a complete editable reference with a preserved left-case agreement failure; R3 is a direct-only development recipe. Neither is an accepted integrated release.',
        source_spec=str(R3 / 'part-spec.json'), source_spec_sha256=sha(R3 / 'part-spec.json'),
        preserved_native=binding(handoff['preserved_source_native']['path']), handoff_bindings=bindings,
        source_inventory=binding(inventory_path), manual=binding('../Notes/gtsio520_series.pdf'),
        native_source_scope=handoff['r2_evidence'], development_recipe_scope=handoff['r3_evidence'],
        native_source_report_bindings=[binding(R2 / 'cad' / n) for n in ['saved-shape-checks.json', 'reopen-validation.json', 'interface-checks.json']],
        parts=cases, current_interface_parameters=recipe['parameters'],
        callout_type_coverage=dict(total=143, dispositions=dict(Counter(r['disposition'] for r in callouts)),
            interpretation='Callout types, not quantities; the complete original mapping is preserved.'),
        reviewed_component_rows=callouts, unchanged_face_study=dict(accepted_separately=True, files=face_bindings,
            policy='Preserve native histories, geometry, boolean_refine:false and edit/STEP/24-pose evidence; do not repeat an unchanged study.'),
        carried_forward_gates=['new-case saved/direct agreement', 'saved native edit/reopen', 'STEP',
            'every current bounding neighbor', 'support stock', 'pressure galleries and closures',
            'separate pushrod/guide return route to sump', 'installed-drive envelopes', 'actual GLB and editable Blender evidence map'],
        readiness=dict(source_preparation_complete=True, contour_geometry_started=False,
            baseline_native_acceptance_pending=True, old_queue_remains_stopped=True,
            next_geometry='Representative bay fixture after source-reasoning record; R3 completion is not a prerequisite',
            source_fidelity='Estimated contour reconstruction; exact H curvature and casting part number unestablished'))
    old = STUDY / 'current-state.json'
    archive = STUDY / 'current-state-groundwork.json'
    if old.exists() and not archive.exists():
        archive.write_bytes(old.read_bytes())
    write(old, result)
    receipt = {k: v for k, v in result.items() if k not in ('parts', 'current_interface_parameters', 'reviewed_component_rows')}
    receipt['case_feature_counts'] = {k: v['feature_count'] for k, v in cases.items()}
    receipt['unchanged_non_case_recipes'] = sum(before[i] == after[i] for i in after if not i.startswith('Crankcase'))
    receipt['current_state_sha256'] = sha(old)
    write(STUDY / 'source-verification.json', receipt)
    print('CONTOUR_SOURCE_LEDGER_REFRESHED', receipt['case_feature_counts'], 'handoff hashes', len(bindings), flush=True)
    return result


if __name__ == '__main__':
    refresh()
