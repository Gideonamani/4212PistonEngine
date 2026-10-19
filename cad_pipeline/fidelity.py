"""Fidelity classes: which parts and features a gate depends on (engineering), which only have to look right (visual-structure), and which may change freely (cosmetic).

The class decides the tessellation tier (B1), which gates run per iteration (B5) and what Blender may edit (docs/freecad-blender-boundary.md). It is *derived* from
records the studies already keep, so it cannot drift from them, and a person adds to it through one override file per study.

    engineering       anything a gate depends on: a part that moves or meshes, sits in the interference ledger, feeds a mass-check line or lies on a mechanism path of the
                      inventory, and any feature that makes a bore, journal, seat, groove, land, gallery, opening or other fit.
    visual-structure  the shapes a student uses to recognise a part: casting contours outside the interfaces, ribs, bosses, fastener heads. The default for a modelled part
                      that no gate depends on.
    cosmetic          blends, chamfers, edge breaks, texture, lettering. May change without re-running the engineering gates, but only if an envelope check proves no
                      interface or clearance moved.

A part is at least as critical as its most critical feature. A part whose reasons include `motion`, `gear` or `ledger` is bound to a gate by construction, so an
override cannot lower it.

Standard library only, so CI, FreeCAD's Python and Blender's Python can all run it.

Run: python scripts/derive_fidelity_classes.py            (check every study against its committed classes)
     python scripts/derive_fidelity_classes.py --write    (rewrite the classes, the report and the lesson map)
"""
import importlib.util
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from cad_pipeline.spec import FIDELITY_RANK as RANK

ROOT = Path(__file__).resolve().parents[1]

CLASSES = tuple(sorted(RANK, key=lambda c: -RANK[c]))          # engineering, visual-structure, cosmetic
LETTER = {'engineering': 'E', 'visual-structure': 'V', 'cosmetic': 'C'}
FROM_LETTER = {v: k for k, v in LETTER.items()}
GATE_BOUND = ('motion', 'gear', 'ledger')           # reasons that tie a part to a gate by construction: no override may lower them
GATES = ('rest', 'clip', 'gear')                    # rest-pose interference audit; swept audit of a baked clip; declared gear-mesh clearance
SCHEMA = 'fidelity-classes/1'

# What a feature label says about the feature. Labels are the spec's own words; a feature with none of these words inherits its part's base class.
INTERFACE_LABEL = re.compile(r'\b(bores?|journals?|seats?|grooves?|lands?|split|parting|datum|pilot|spigot|spline[ds]?|thread\w*|guides?|gaps?|holes?|openings?|apertures?|'
                             r'passages?|galler\w+|reliefs?|recess\w*|clearance|decks?|mount\w*|attachment|bush\w*|bearings?|liners?|inserts?|pins?|fit)\b', re.I)
COSMETIC_LABEL = re.compile(r'\b(chamfers?|edge breaks?|blends?|texture|lettering|knurl\w*|cosmetic)\b', re.I)
STRUCTURE_LABEL = re.compile(r'\b(boss(es)?|ribs?|webs?|flanges?|shells?|envelopes?|castings?|crown|shanks?|heads?|domes?|spokes?|wires?|jackets?|covers?|fins?|cheeks?|'
                             r'cavity|volume|stubs?|lugs?|ears?|rings?|collars?|caps?|nuts?|springs?|rods?|tubes?|pipes?)\b', re.I)


def stricter(a, b):
    return a if RANK[a] >= RANK[b] else b


def feature_class(label, base, gate_bound):
    """Class of one feature from its label. `base` is the part's class from signals other than its features; `gate_bound` keeps the swept envelope of a moving or
    meshing part engineering, because every outer surface of such a part is in a clearance."""
    label = label or ''
    if INTERFACE_LABEL.search(label):
        return 'engineering'
    if COSMETIC_LABEL.search(label):
        return 'cosmetic'
    if STRUCTURE_LABEL.search(label) and not gate_bound:
        return 'visual-structure'
    return base


def letters(classes):
    return ''.join(LETTER[c] for c in classes)


def classify(inputs):
    """Classes of every part and, where the spec is known, every feature.

    inputs: parts [{id}], moving {id}, gear {id: [mesh]}, ledger {id}, mass {id: line}, paths {id: [path]}, features {id: [{label, class?}]}, declared {id: class},
    overrides [{parts|match, class, reason, feature?}]. Returns {'parts': [{id, class, why, features?}], 'conflicts': [...], 'overrides_applied': [...]}.
    """
    rows, conflicts, applied = [], [], []
    for part in inputs['parts']:
        pid = part['id']
        reasons = []
        if pid in inputs.get('moving', ()):
            reasons.append('motion')
        if pid in inputs.get('gear', {}):
            reasons.append('gear')
        if pid in inputs.get('ledger', ()):
            reasons.append('ledger')
        if pid in inputs.get('mass', {}):
            reasons.append('mass:' + inputs['mass'][pid])
        reasons += ['path:' + p for p in inputs.get('paths', {}).get(pid, [])]
        base = 'engineering' if reasons else 'visual-structure'
        bound = [r for r in reasons if r.split(':')[0] in GATE_BOUND]
        feature_classes = []
        for feature in inputs.get('features', {}).get(pid, []):
            derived = feature_class(feature.get('label'), base, bool(bound))
            declared = feature.get('class')
            if declared and RANK[declared] < RANK[derived]:
                conflicts.append(f'{pid}: feature {feature.get("label")!r} declares {declared} but is {derived}')
            feature_classes.append(stricter(declared, derived) if declared else derived)
        for rule in inputs.get('overrides', []):
            if 'feature' in rule and _matches(rule, pid):
                index = rule['feature']
                if index >= len(feature_classes):
                    raise ValueError(f'override for {pid}: no feature {index}')
                _may_lower(pid, feature_classes[index], rule['class'], bound)
                feature_classes[index] = rule['class']
                applied.append(f'{pid} feature {index} -> {rule["class"]}: {rule["reason"]}')
        derived = base
        for fc in feature_classes:
            derived = stricter(derived, fc)
        if derived == 'engineering' and not reasons:
            reasons.append('feature')
        declared = inputs.get('declared', {}).get(pid)
        if declared and RANK[declared] < RANK[derived]:
            conflicts.append(f'{pid}: declares {declared} but is {derived} ({", ".join(reasons)})')
        final = stricter(declared, derived) if declared else derived
        for rule in inputs.get('overrides', []):
            if 'feature' not in rule and _matches(rule, pid):
                _may_lower(pid, final, rule['class'], bound)
                final = rule['class']
                applied.append(f'{pid} -> {rule["class"]}: {rule["reason"]}')
        row = {'id': pid, 'class': final, 'why': reasons or ['default']}
        if pid in inputs.get('features', {}):
            row['features'] = letters(feature_classes)
        rows.append(row)
    return {'parts': rows, 'conflicts': conflicts, 'overrides_applied': applied}


def _may_lower(pid, current, wanted, bound):
    if RANK[wanted] < RANK[current] and bound:
        raise ValueError(f'override for {pid}: bound to a gate by {", ".join(bound)}; cannot lower {current} to {wanted}')


def _matches(rule, pid):
    if 'parts' in rule and pid in rule['parts']:
        return True
    return 'match' in rule and re.fullmatch(rule['match'], pid) is not None


def check_overrides(overrides, part_ids):
    """Every override names real parts, a real class and a reason; an override that matches nothing is a mistake."""
    errors = []
    for i, rule in enumerate(overrides):
        where = f'class_overrides[{i}]'
        if rule.get('class') not in CLASSES:
            errors.append(f'{where}: class must be one of {CLASSES}')
        if not str(rule.get('reason', '')).strip():
            errors.append(f'{where}: a reason is required')
        if ('parts' in rule) == ('match' in rule):
            errors.append(f'{where}: give either parts or match')
        for pid in rule.get('parts', []):
            if pid not in part_ids:
                errors.append(f'{where}: unknown part {pid}')
        if 'match' in rule and not any(re.fullmatch(rule['match'], pid) for pid in part_ids):
            errors.append(f'{where}: pattern {rule["match"]!r} matches no part')
    return errors


# ------------------------------------------------------------------------------------------------------------------------------ gates

def mesh_pairs(meshes, ids):
    """{part id: [(driver, driven)]} for the declared gear meshes whose both gears are parts of the study."""
    pairs = defaultdict(list)
    for a, b in meshes:
        if a in ids and b in ids:
            pairs[a].append((a, b))
            pairs[b].append((a, b))
    return dict(pairs)


def gate_coverage(parts, moving, meshed, audits, asset_sha256):
    """Which gates currently cover each part. An audit record counts only when it was run on the study's present asset (same SHA-256) and audited every part.

    rest: the part is in a current rest-pose audit and could be intersected. clip: the part moves and a current audit swept a clip that moved at least as many parts as the
    study's motion declares. gear: every mesh the part belongs to appears in a current audit with its clearance met.
    Returns ({id: {gate: 'current' | None}}, notes) where notes explain every record that did not count.
    """
    ids = [p['id'] for p in parts]
    cover = {pid: {'rest': None, 'clip': None, 'gear': None} for pid in ids}
    notes = []
    for record in audits:
        name, audit = record['name'], record['audit']
        if audit.get('asset_sha256') != asset_sha256:
            notes.append(f'{name}: audited a different file ({audit.get("parts")} parts, sha {str(audit.get("asset_sha256"))[:10]}); not counted')
            continue
        if audit.get('parts') != len(ids):
            notes.append(f'{name}: audited {audit.get("parts")} parts but the study has {len(ids)}; not counted')
            continue
        unchecked = set(audit.get('unverified_parts', []))
        for pid in ids:
            if pid not in unchecked:
                cover[pid]['rest'] = 'current'
        clips = [c for c in audit.get('clips', {}).values() if c.get('moving_parts', 0) >= len(moving) > 0]
        if clips:
            for pid in moving:
                cover[pid]['clip'] = 'current'
        elif audit.get('clips') and moving:
            notes.append(f'{name}: the swept clip moved fewer parts than the {len(moving)} the motion declares; clip coverage not counted')
        measured = {(g['driver'], g['driven']): g for g in audit.get('gear_meshes', [])}
        for pid, pairs in meshed.items():
            if all(pair in measured and measured[pair].get('ok') for pair in pairs):
                cover[pid]['gear'] = 'current'
    return cover, notes


def required_gates(row, moving, meshed):
    """Gates an engineering part must be covered by: the rest audit always, the swept audit if it moves, the gear clearance if it meshes."""
    if row['class'] != 'engineering':
        return ()
    need = ['rest']
    if row['id'] in moving:
        need.append('clip')
    if row['id'] in meshed:
        need.append('gear')
    return tuple(need)


def coverage_gaps(rows, cover, moving, meshed, waivers, asset_sha256):
    """(open, waived, expired): engineering parts missing a required gate, split by whether a waiver for the present asset accepts the gap."""
    active = [w for w in waivers if w.get('asset_sha256') == asset_sha256]
    expired = [w for w in waivers if w.get('asset_sha256') != asset_sha256]
    open_, waived = [], []
    for row in rows:
        for gate in required_gates(row, moving, meshed):
            if cover[row['id']][gate] == 'current':
                continue
            hit = next((w for w in active if w['gate'] == gate and (w['parts'] == 'all' or row['id'] in w['parts'])), None)
            (waived if hit else open_).append((row['id'], gate))
    return open_, waived, expired


def check_waivers(waivers):
    errors = []
    for i, w in enumerate(waivers):
        where = f'coverage_waivers[{i}]'
        if w.get('gate') not in GATES:
            errors.append(f'{where}: gate must be one of {GATES}')
        if not re.fullmatch(r'[0-9a-f]{64}', str(w.get('asset_sha256', ''))):
            errors.append(f'{where}: asset_sha256 must be the SHA-256 of the asset the gap was accepted for')
        if w.get('parts') != 'all' and not (isinstance(w.get('parts'), list) and w['parts']):
            errors.append(f'{where}: parts must be "all" or a list of part ids')
        for key in ('reason', 'clears_when'):
            if not str(w.get(key, '')).strip():
                errors.append(f'{where}: {key} is required')
    return errors


# --------------------------------------------------------------------------------------------------------------------------- the studies

def _json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def _module(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _mechanism_paths(inventories):
    """{part id: [mechanism id]}: the parts of every component listed on a mechanism path of the inventory (the nearest structured interface record)."""
    paths = defaultdict(list)
    for inventory in inventories:
        components = {c['id']: c for c in inventory['components']}
        for mechanism in inventory.get('mechanisms', []):
            for cid in mechanism['components']:
                for pid in components.get(cid, {}).get('part_ids', []):
                    if mechanism['id'] not in paths[pid]:
                        paths[pid].append(mechanism['id'])
    return dict(paths)


def _spec_features(path):
    """({part id: [{label, class?}]}, {part id: declared class}) from a part-spec.json; pattern features count as one feature of the pattern."""
    spec = _json(path)
    features, declared = {}, {}
    for part in spec['parts']:
        features[part['id']] = [{'label': f.get('label', ''), **({'class': f['class']} if 'class' in f else {})} for f in part['features']]
        if 'class' in part:
            declared[part['id']] = part['class']
    return features, declared


STUDIES = {
    'langley-manly-balzer-1903': dict(
        folder='cad-studies/langley-manly-balzer-1903',
        contract='web/langley-manly-balzer-1903-contract.json',
        spec='cad-studies/langley-manly-balzer-1903/part-spec.json',
        inventories=['cad-studies/langley-manly-balzer-1903/inventory.json'],
        policy='cad-studies/langley-manly-balzer-1903/interference-policy.json',
        audits=['cad-studies/langley-manly-balzer-1903/*interference-audit*.json'],
        mass_check='cad-studies/langley-manly-balzer-1903/mass-check.json',
        classes='cad-studies/langley-manly-balzer-1903/fidelity-classes.json',
        overrides='cad-studies/langley-manly-balzer-1903/fidelity-overrides.json',
        title='Langley / Manly-Balzer 1903 (358 parts)'),
    'gtsio520-h-r10': dict(
        folder='cad-studies/gtsio520-h-static',
        contract='web/gtsio520-r10-contract.json',
        spec='cad-studies/gtsio520-h-static/part-spec.json',      # the 395-part foundation: the only part-spec of R10 kept in Git (the full one is a build output)
        inventories=['cad-studies/gtsio520-h-static/drive-development/inventory.json'],
        policy='cad-studies/gtsio520-h-static/interference-policy.json',
        audits=['cad-studies/gtsio520-h-static/**/*interference-audit*.json'],           # any record kept in the study folder, so a new audit of the shipped file is seen at once
        mass_check=None,
        classes='cad-studies/gtsio520-h-static/fidelity-classes.json',
        overrides='cad-studies/gtsio520-h-static/fidelity-overrides.json',
        title='GTSIO-520-H R10 mechanism study (1,396 parts)'),
}


def load_inputs(name):
    """Gather the records of one study into the inputs `classify` and `gate_coverage` take."""
    cfg = STUDIES[name]
    contract = _json(cfg['contract'])
    parts = [{'id': p['id'], 'group': p.get('group', '')} for p in contract['parts']]
    ids = {p['id'] for p in parts}
    policy = _json(cfg['policy'])
    ledger = set()
    for entry in policy.get('known_defects', []):
        ledger |= {entry['a'], entry['b']}
    ledger |= {w['part'] for w in policy.get('unverified_waivers', [])}
    if name == 'langley-manly-balzer-1903':
        sys.path.insert(0, str(ROOT))
        from cad_pipeline.langley_bodies import body
        moving = {pid for pid in ids if body(pid) != 'static'}
        meshes = [(m['driver'], m['driven']) for m in contract.get('gearMeshes', [])]
        mass_lines = _module('scripts/langley_mass_check.py', 'langley_mass_check').LINES
        mass = {}
        for pid in sorted(ids):
            for line, _, pattern in mass_lines:
                if re.match(pattern, pid):
                    mass[pid] = line
                    break
    else:
        moving = {p['id'] for p in contract['parts'] if not str(p.get('body', 'fixed:')).startswith('fixed:')}
        sys.path.insert(0, str(ROOT / 'scripts'))
        gears = _module('scripts/accessory_gears.py', 'accessory_gears')
        meshes = list(gears.GTSIO_STATIC_DRIVE_MESHES) + list(gears.GTSIO_ACCESSORY_MESHES)
        mass = {}
    meshed = mesh_pairs(meshes, ids)
    gear = {pid: [f'{a}/{b}' for a, b in pairs] for pid, pairs in meshed.items()}
    if name == 'gtsio520-h-r10':
        # Gears that turn with a meshed one on a shared shaft (the 'rigid' links of the accessory declaration) are in the train too.
        for pid in gears.solve_gtsio_accessory_drive():
            if pid in ids and pid not in gear:
                gear[pid] = ['shaft']
    features, declared = _spec_features(cfg['spec'])
    features = {pid: f for pid, f in features.items() if pid in ids}
    overrides_doc = json.loads((ROOT / cfg['overrides']).read_text(encoding='utf-8')) if (ROOT / cfg['overrides']).is_file() else {}
    audit_paths = sorted(p.relative_to(ROOT).as_posix() for pattern in cfg['audits'] for p in ROOT.glob(pattern))
    audits = [{'name': Path(a).parent.name + '/' + Path(a).name, 'audit': _json(a)} for a in audit_paths]
    return dict(name=name, cfg=cfg, parts=parts, ids=ids, moving=moving, gear=gear, meshed=meshed, meshes=meshes, ledger=ledger & ids, mass=mass,
                paths={pid: p for pid, p in _mechanism_paths([_json(i) for i in cfg['inventories']]).items() if pid in ids},
                features=features, declared=declared, overrides=overrides_doc.get('class_overrides', []),
                waivers=overrides_doc.get('coverage_waivers', []), lesson_focus=overrides_doc.get('lesson_focus', {}),
                asset_sha256=contract['asset_sha256'], audits=audits, audit_paths=audit_paths, mass_check=_json(cfg['mass_check']) if cfg.get('mass_check') else None)


def derive(name):
    inputs = load_inputs(name)
    errors = check_overrides(inputs['overrides'], inputs['ids']) + check_waivers(inputs['waivers'])
    if errors:
        raise ValueError(f'{name}: ' + '; '.join(errors))
    result = classify(inputs)
    result['inputs'] = inputs
    return result


# ------------------------------------------------------------------------------------------------------------------------------ files

NOTE = ('Derived by `python scripts/derive_fidelity_classes.py --write`; do not edit by hand. One row per part: its class, why (the signals that decide it), and, where the spec is '
        'known, one letter per feature in spec order (E engineering, V visual-structure, C cosmetic). Add exceptions to {overrides}, not here. Guide: docs/fidelity-classes.md.')


def counts(result):
    parts = Counter(r['class'] for r in result['parts'])
    features = Counter(FROM_LETTER[ch] for r in result['parts'] for ch in r.get('features', ''))
    return {'parts': {c: parts.get(c, 0) for c in CLASSES}, 'features': {c: features.get(c, 0) for c in CLASSES},
            'parts_with_known_features': sum(1 for r in result['parts'] if 'features' in r)}


def sidecar_text(name, result):
    cfg = STUDIES[name]
    head = {'schema': SCHEMA, 'study': name, '_note': NOTE.format(overrides=cfg['overrides']), 'counts': counts(result)}
    body = json.dumps(head, indent=1)[:-2]
    rows = ',\n'.join('  ' + json.dumps(r, separators=(',', ':')) for r in result['parts'])
    return body + ',\n "parts": [\n' + rows + '\n ]\n}\n'


def write_text(path, text):
    with open(ROOT / path, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(text)
