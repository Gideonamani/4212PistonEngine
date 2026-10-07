"""Part cards: what the project knows about a family of mechanical parts, checked against the studies that built them.

A card file `knowledge/part-cards/<family>.json` holds one family (piston, connecting rod, valve, ...) with its variants (types).
Each variant carries the six fields of docs/ai-mechanical-engineer.md section 4 (dimensions, construction, function, envelope,
intent, manufacturing), the interfaces it offers to its neighbours, and the instances: the parts of a finished study that are
built to this variant. The validator ties the card to those studies: every source it cites exists in the study, every part id it
names exists in the study's part spec, every inventory component it names exists. A card cannot drift from the evidence quietly.

Standard library only, so CI, FreeCAD's Python and Blender's Python can all run it.

Run: python -m cad_pipeline.intent.part_card            (validate every card, list the gallery)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / 'knowledge' / 'part-cards'
STUDIES = ROOT / 'cad-studies'

SCHEMA_VERSION = 1

# Dimension statuses are the ones the specs already use (specified, measured, inferred) plus derived (computed from other values)
# and illustrative (a teaching choice that makes no claim about the object).
DIMENSION_STATUS = ('specified', 'measured', 'derived', 'inferred', 'illustrative')
CLAIM_STATUS = ('documented', 'derived', 'inferred', 'illustrative')
RECIPE_STATUS = ('none', 'candidate', 'extracted')

# The feature vocabulary of cad_pipeline/generate.py: what a construction step may name.
PRIMITIVES = ('box', 'cylinder', 'tube', 'cone', 'sphere', 'prism', 'helix', 'revolve')
OPERATIONS = ('add', 'cut')

# How a part meets its neighbour. Extend at a review, not ad hoc; the gallery's assembler will rely on it.
INTERFACE_KINDS = ('fixed', 'revolute', 'prismatic', 'cylindrical', 'sliding-contact', 'gear-mesh', 'cam-follower', 'seat', 'threaded', 'spring')


def _text(value):
    return isinstance(value, str) and value.strip() != ''


def _study_data(study, cache):
    """Sources, part ids and inventory components of a study, or None when its files are missing."""
    if study in cache:
        return cache[study]
    base = STUDIES / study
    data = None
    if (base / 'inventory.json').is_file() and (base / 'part-spec.json').is_file():
        inventory = json.loads((base / 'inventory.json').read_text(encoding='utf-8'))
        spec = json.loads((base / 'part-spec.json').read_text(encoding='utf-8'))
        spec_sources = spec.get('sources') or {}
        if not isinstance(spec_sources, dict):
            spec_sources = {s.get('id'): s for s in spec_sources}
        data = {
            'sources': set(inventory.get('sources', {})) | set(spec_sources),
            'parts': {p['id'] for p in spec['parts']},
            'components': {c['id']: set(c.get('part_ids', [])) for c in inventory['components']},
        }
    cache[study] = data
    return data


def _check_evidence(path, evidence, cache, errors):
    if not isinstance(evidence, list) or not evidence:
        errors.append(f'{path}: evidence must be a non-empty list')
        return
    for i, ref in enumerate(evidence):
        where = f'{path}.evidence[{i}]'
        if not isinstance(ref, dict) or not all(_text(ref.get(k)) for k in ('study', 'source', 'locator')):
            errors.append(f'{where}: needs study, source and locator')
            continue
        data = _study_data(ref['study'], cache)
        if data is None:
            errors.append(f'{where}: unknown study {ref["study"]!r}')
        elif ref['source'] not in data['sources']:
            errors.append(f'{where}: source {ref["source"]!r} is not a source of {ref["study"]}')


def _check_claims(path, claims, cache, errors):
    if not isinstance(claims, list) or not claims:
        errors.append(f'{path}: needs at least one claim')
        return
    for i, claim in enumerate(claims):
        where = f'{path}[{i}]'
        if not isinstance(claim, dict) or not _text(claim.get('statement')):
            errors.append(f'{where}: needs a statement')
            continue
        _check_status(where, claim, CLAIM_STATUS, cache, errors)


def _check_status(where, item, allowed, cache, errors):
    """documented/specified/measured need evidence; derived/inferred/illustrative need the basis they rest on."""
    status = item.get('status')
    if status not in allowed:
        errors.append(f'{where}: status {status!r} is not one of {allowed}')
    elif status in ('documented', 'specified', 'measured'):
        _check_evidence(where, item.get('evidence'), cache, errors)
    elif not _text(item.get('basis')):
        errors.append(f'{where}: a {status} item needs a basis saying what it rests on')


def validate_variant(card_family, variant, cache):
    errors = []
    vid = variant.get('id', '?')
    p = f'{vid}'
    if not (_text(vid) and vid.startswith(card_family + '/')):
        errors.append(f'{p}: id must start with "{card_family}/"')
    for key in ('name', 'applies_to'):
        if not _text(variant.get(key)):
            errors.append(f'{p}: missing {key}')
    if not variant.get('distinguishing_features'):
        errors.append(f'{p}: needs distinguishing_features')

    dimensions = variant.get('dimensions')
    if not isinstance(dimensions, list) or not dimensions:
        errors.append(f'{p}.dimensions: needs at least one dimension')
    else:
        names = set()
        for i, d in enumerate(dimensions):
            where = f'{p}.dimensions[{i}]'
            if not _text(d.get('name')) or not _text(d.get('unit')):
                errors.append(f'{where}: needs name and unit')
            if d.get('name') in names:
                errors.append(f'{where}: duplicate dimension {d.get("name")!r}')
            names.add(d.get('name'))
            if d.get('value') is not None and not isinstance(d.get('value'), (int, float)):
                errors.append(f'{where}: value must be a number or null')
            _check_status(where, d, DIMENSION_STATUS, cache, errors)

    construction = variant.get('construction')
    if not isinstance(construction, list) or not construction:
        errors.append(f'{p}.construction: needs at least one step')
    else:
        for i, step in enumerate(construction):
            where = f'{p}.construction[{i}]'
            if step.get('primitive') not in PRIMITIVES:
                errors.append(f'{where}: primitive {step.get("primitive")!r} is not one of {PRIMITIVES}')
            if step.get('operation') not in OPERATIONS:
                errors.append(f'{where}: operation {step.get("operation")!r} is not one of {OPERATIONS}')
            if i == 0 and step.get('operation') != 'add':
                errors.append(f'{where}: the first step must add material')
            if not _text(step.get('note')):
                errors.append(f'{where}: needs a note')

    function = variant.get('function')
    if not isinstance(function, dict) or not _text(function.get('role')) or not _text(function.get('motion')):
        errors.append(f'{p}.function: needs role and motion')
    else:
        interfaces = function.get('interfaces')
        if not isinstance(interfaces, list) or not interfaces:
            errors.append(f'{p}.function.interfaces: needs at least one interface')
        else:
            for i, itf in enumerate(interfaces):
                where = f'{p}.function.interfaces[{i}]'
                if not _text(itf.get('name')) or not _text(itf.get('mates_with')):
                    errors.append(f'{where}: needs name and mates_with')
                if itf.get('kind') not in INTERFACE_KINDS:
                    errors.append(f'{where}: kind {itf.get("kind")!r} is not one of {INTERFACE_KINDS}')

    _check_claims(f'{p}.envelope', variant.get('envelope'), cache, errors)
    _check_claims(f'{p}.intent', variant.get('intent'), cache, errors)

    manufacturing = variant.get('manufacturing')
    if not isinstance(manufacturing, dict) or not _text(manufacturing.get('process')) or not _text(manufacturing.get('material')):
        errors.append(f'{p}.manufacturing: needs process and material')
    else:
        _check_status(f'{p}.manufacturing', manufacturing, CLAIM_STATUS, cache, errors)

    recipe = variant.get('recipe')
    if not isinstance(recipe, dict) or recipe.get('status') not in RECIPE_STATUS:
        errors.append(f'{p}.recipe: needs a status in {RECIPE_STATUS}')
    elif recipe['status'] != 'none':
        if not (_text(recipe.get('path')) and (ROOT / recipe['path']).exists()):
            errors.append(f'{p}.recipe: path {recipe.get("path")!r} does not exist')

    instances = variant.get('instances')
    if not isinstance(instances, list) or not instances:
        errors.append(f'{p}.instances: a variant must be built at least once')
    else:
        for i, inst in enumerate(instances):
            where = f'{p}.instances[{i}]'
            data = _study_data(inst.get('study', ''), cache)
            if data is None:
                errors.append(f'{where}: unknown study {inst.get("study")!r}')
                continue
            unknown = [pid for pid in inst.get('part_ids', []) if pid not in data['parts']]
            if not inst.get('part_ids'):
                errors.append(f'{where}: needs part_ids')
            if unknown:
                errors.append(f'{where}: part ids not in the study spec: {unknown}')
            missing = [c for c in inst.get('components', []) if c not in data['components']]
            if not inst.get('components') or missing:
                errors.append(f'{where}: components must name inventory entries (missing: {missing or "none given"})')
            else:
                covered = set().union(*(data['components'][c] for c in inst['components']))
                outside = [pid for pid in inst.get('part_ids', []) if pid not in covered]
                if outside:
                    errors.append(f'{where}: part ids not in the named components: {outside}')
            if not _text(inst.get('validation')):
                errors.append(f'{where}: needs a validation statement taken from the study record')

    if not isinstance(variant.get('gaps'), list):
        errors.append(f'{p}.gaps: must be a list (empty only if nothing is unknown)')
    return errors


def validate_card(card, cache=None):
    cache = {} if cache is None else cache
    errors = []
    family = card.get('family')
    if card.get('schema_version') != SCHEMA_VERSION:
        errors.append(f'{family}: schema_version must be {SCHEMA_VERSION}')
    for key in ('family', 'summary'):
        if not _text(card.get(key)):
            errors.append(f'card: missing {key}')
    variants = card.get('variants')
    if not isinstance(variants, list) or not variants:
        errors.append(f'{family}: needs at least one variant')
        return errors
    seen = set()
    for variant in variants:
        if variant.get('id') in seen:
            errors.append(f'{variant.get("id")}: duplicate variant id')
        seen.add(variant.get('id'))
        errors.extend(validate_variant(family, variant, cache))
    return errors


def load_cards(directory=CARDS):
    return [json.loads(path.read_text(encoding='utf-8')) for path in sorted(Path(directory).glob('*.json'))]


def validate_all(directory=CARDS):
    cache, errors, ids = {}, [], {}
    for card in load_cards(directory):
        errors.extend(validate_card(card, cache))
        for v in card.get('variants', []):
            if v.get('id') in ids:
                errors.append(f'{v.get("id")}: id also used in family {ids[v["id"]]}')
            ids[v.get('id')] = card.get('family')
    return errors


def gallery(directory=CARDS):
    """Family, variant and instance listing: the data a gallery page would be generated from."""
    rows = []
    for card in load_cards(directory):
        for v in card['variants']:
            studies = sorted({i['study'] for i in v['instances']})
            rows.append((card['family'], v['id'], v['name'], len(v['instances']), ', '.join(studies), v['recipe']['status']))
    return rows


def main():
    errors = validate_all()
    for row in gallery():
        print(' | '.join(str(c) for c in row))
    if errors:
        print(f'\n{len(errors)} problem(s):', file=sys.stderr)
        for e in errors:
            print('  ' + e, file=sys.stderr)
        return 1
    print('\nAll part cards validate against their studies.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
