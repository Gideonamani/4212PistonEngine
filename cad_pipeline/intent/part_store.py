"""The part store: definitions, instances and systems under knowledge/part-cards/parts/ (docs/part-store.md).

One store holds what the project knows about each part, at three levels:

    definition  what a kind of part is. A `student` block (what a learner may read once the instructor has reviewed it: plain title,
                function, made-of, where it sits, what it works with, a look-for prompt, the lessons that mention it; each claim with a
                status and a source or basis) and an `engineering` block that never ships to the browser.
    instance    which of one model's part ids is which definition, with the system it belongs to, an optional wording of its own and its
                own review state. Written as id patterns (rules) for a big model and as explicit rows for a small one.
    system      the flat list a learner filters by (store.json).

The family cards beside it (knowledge/part-cards/<family>.json, cad_pipeline/intent/part_card.py) stay the engineering description of
a family and its variants; a definition may name the variant that describes it (`engineering.variant`).

Rules that hold for every record, checked here:
- every claim has a status (specified, derived, inferred, illustrative). Specified and derived claims name a source; inferred and
  illustrative ones state a basis. A guess is never recorded as a source. `unsourced` is a status for values carried over from an older
  table that no source read supports; it may appear only in `engineering.legacyValues`, which never ships, and never in text a learner reads.
- no part number, specification, placeholder or catalogue row in anything a learner reads (the catalogue rows live outside Git);
- every instance maps to a definition, every part id of a model has exactly one, and every definition is used by some model;
- a record is `draft` until the instructor marks it `reviewed` (with reviewer and date), and a reviewed record has no placeholder text,
  no unsourced value, and no draft record under it.

Standard library only, so CI, FreeCAD's Python and Blender's Python can all run it.

Run: python -m cad_pipeline.intent.part_store                    validate the store
     python -m cad_pipeline.intent.part_store --refresh-lessons  rewrite each definition's lesson mentions from the lesson packs
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORE_DIR = ROOT / 'knowledge' / 'part-cards' / 'parts'

SCHEMA_STORE = 'part-store/1'
SCHEMA_DEFINITIONS = 'part-definitions/1'
SCHEMA_INSTANCES = 'part-instances/1'

STUDENT_STATUS = ('specified', 'derived', 'inferred', 'illustrative')
SOURCED_STATUS = ('specified', 'derived')
ENGINEERING_STATUS = STUDENT_STATUS + ('unsourced',)
REVIEW_STATES = ('draft', 'reviewed')
ALIGNMENT = ('confirmed', 'gtsio_only', 'io520_only', 'mismatch', 'not_found')
CATALOGUE_BASIS = ('io520', 'gtsio', 'derived')
OVERRIDABLE = ('function', 'madeOf', 'sits')

# Word limits for the student text. scripts/part_store.mjs holds the same numbers for the shipped file.
LIMITS = {'title': 4, 'function': 22, 'madeOf': 8, 'sits': 28, 'lookFor': 22, 'context': 3}

# A catalogue part number (not a form number such as X-30040A), a PartStream/H1B mention, or a reference to the old card.
CATALOGUE_DATA = re.compile(r'(?<![-\w])\d{5,6}[A-Z]?\d*\b|H1B|PartStream|earlier card')
PART_NUMBER_PATTERNS = [
    re.compile(p, flags) for p, flags in (
        (r'P/N', re.I), (r'\bAN\d', 0), (r'\bMS\d', 0), (r'\bX\d{4}', 0),
        (r'\b\d{5,6}[A-Z]?\d*\b', 0),
        (r'\bQTY\b', re.I), (r'\bTODO\b', re.I), (r'\bTBD\b', re.I), (r'lorem', re.I), (r'placeholder', re.I),
    )
]
SPEC_PATTERNS = [
    re.compile(p, re.I) for p in (
        r'\bAMS\s?\d', r'\bNPT', r'\bUNJ?F', r'carburi[sz]', r'case-hardened', r'nitrid', r'Rockwell', r'\bHRC\b', r'\bpsi\b', r'\blbf\b', r'ft-?lb',
    )
]
BANNED_STUDENT = PART_NUMBER_PATTERNS + SPEC_PATTERNS
# Text that stands in for content. A placeholder may not reach a learner at all, so these are refused on every record.
PLACEHOLDER_PHRASES = [re.compile(p, re.I) for p in (r'not yet written', r'retained source identity', r'to be written', r'\?\?\?')]
# Keys that belong to the catalogue rows or the old register, which stay out of Git.
FORBIDDEN_ENGINEERING_KEYS = ('ipcIo520', 'gtsioOnlineIpcH1b', 'priorData', 'note')

SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _text(value):
    return isinstance(value, str) and value.strip() != ''


def _words(value):
    return len(re.findall(r'\S+', value))


def _read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def load_store(directory=STORE_DIR):
    directory = Path(directory)
    sets = [_read(p) for p in sorted((directory / 'definitions').glob('*.json'))]
    return {
        'store': _read(directory / 'store.json'),
        'sets': sets,
        'definitions': [d for s in sets for d in s['definitions']],
        'instances': [_read(p) for p in sorted((directory / 'instances').glob('*.json'))],
    }


def model_part_ids(instance_doc, root=ROOT):
    ids_from = instance_doc['idsFrom']
    data = _read(Path(root) / ids_from['file'])
    return [item[ids_from['key']] for item in data[ids_from['list']]]


def compile_pattern(pattern):
    """The data stores JavaScript named groups, (?<cyl>...); Python spells them (?P<cyl>...)."""
    return re.compile('^(?:' + re.sub(r'\(\?<(?![=!])', '(?P<', pattern) + ')$')


def resolve_instances(instance_doc, part_ids):
    """Each part id to its definition(s), by an explicit row or an id pattern: (hits by part id, unmatched ids, ambiguous ids)."""
    rules = [(rule, [compile_pattern(p) for p in rule['match']]) for rule in instance_doc.get('rules', [])]
    explicit = {row['id']: row for row in instance_doc.get('parts', [])}
    hits, unmatched, ambiguous = {}, [], []
    for pid in part_ids:
        found = []
        if pid in explicit:
            found.append(explicit[pid]['definition'])
        for rule, regs in rules:
            if any(r.match(pid) for r in regs):
                found.append(rule['definition'])
        if not found:
            unmatched.append(pid)
        elif len(found) > 1:
            ambiguous.append(pid)
        else:
            hits[pid] = found[0]
    return hits, unmatched, ambiguous


# ---- claims ----------------------------------------------------------------------------------------------------------------------------

def _cites_catalogue(value):
    return bool(CATALOGUE_DATA.search(value or ''))


def check_claim(where, claim, limit, errors, allow_unsourced=False):
    """A claim for a learner: text, a status, and a source (specified, derived) or a basis (inferred, illustrative)."""
    if not isinstance(claim, dict) or not _text(claim.get('text')):
        errors.append(f'{where}: missing text')
        return
    status = claim.get('status')
    allowed = ENGINEERING_STATUS if allow_unsourced else STUDENT_STATUS
    if status not in allowed:
        errors.append(f'{where}: status {status!r} is not one of {allowed}')
        return
    needs_source = status in SOURCED_STATUS
    if needs_source and not _text(claim.get('source')):
        errors.append(f'{where}: a {status} claim needs a source')
    if not needs_source and not _text(claim.get('basis')):
        errors.append(f'{where}: a {status} claim needs a basis saying what it rests on')
    if claim.get('source') and claim.get('basis'):
        errors.append(f'{where}: has both a source and a basis')
    for key in ('source', 'basis'):
        if _cites_catalogue(claim.get(key)):
            errors.append(f'{where}: the {key} cites a part number or the retired H1B capture: {claim[key]}')
    if limit and _words(claim['text']) > limit:
        errors.append(f'{where}: {_words(claim["text"])} words, limit {limit}: {claim["text"]}')
    for pattern in BANNED_STUDENT + PLACEHOLDER_PHRASES:
        if pattern.search(claim['text']):
            errors.append(f'{where}: text matches {pattern.pattern!r}: {claim["text"]}')


def _all_text(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _all_text(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from _all_text(item)


def _check_review(where, record, errors):
    state = record.get('review')
    if state not in REVIEW_STATES:
        errors.append(f'{where}: review {state!r} is not one of {REVIEW_STATES}')
    elif state == 'reviewed':
        if not _text(record.get('reviewed_by')):
            errors.append(f'{where}: a reviewed record needs reviewed_by')
        if not DATE.match(str(record.get('reviewed_on', ''))):
            errors.append(f'{where}: a reviewed record needs reviewed_on as YYYY-MM-DD')


# ---- definitions -----------------------------------------------------------------------------------------------------------------------

def validate_definition(d, ctx):
    errors = []
    did = d.get('id', '?')
    if not (_text(d.get('id')) and SLUG.match(d['id'])):
        errors.append(f'{did}: id must be a lower-case slug')
    _check_review(did, d, errors)
    if not _text(d.get('family')):
        errors.append(f'{did}: missing family')
    terms = d.get('lessonTerms')
    if not isinstance(terms, list) or any(not _text(t) or t != t.lower() for t in terms):
        errors.append(f'{did}: lessonTerms must be a list of lower-case words (empty for a generic name)')

    s = d.get('student')
    if not isinstance(s, dict):
        return errors + [f'{did}: no student block']
    if s.get('system') not in ctx['systems']:
        errors.append(f'{did}: system {s.get("system")!r} is not one of the store systems')
    check_claim(f'{did}.title', s.get('title'), LIMITS['title'], errors)
    if isinstance(s.get('title'), dict) and re.search(r'\d', str(s['title'].get('text'))):
        errors.append(f'{did}.title: sizes and specifications go in the catalogue line, not the title: {s["title"]["text"]}')
    for name in ('function', 'madeOf', 'sits', 'lookFor'):
        check_claim(f'{did}.{name}', s.get(name), LIMITS[name], errors)
    if isinstance(s.get('lookFor'), dict) and s['lookFor'].get('status') != 'illustrative':
        errors.append(f'{did}.lookFor: must be illustrative')

    # A catalogue noun shared by several definitions ("Screw") needs a qualifier to tell them apart in the Parts list; a unique one must not carry one.
    title = (s.get('title') or {}).get('text')
    shared = ctx['title_counts'].get(title, 0) > 1
    context = s.get('context')
    if shared and not context:
        errors.append(f'{did}: title "{title}" is shared, so it needs a context')
    if not shared and context:
        errors.append(f'{did}: has a context but its title is unique')
    if context:
        if _words(context) > LIMITS['context']:
            errors.append(f'{did}.context: {_words(context)} words, limit {LIMITS["context"]}')
        for pattern in BANNED_STUDENT:
            if pattern.search(context):
                errors.append(f'{did}.context: matches {pattern.pattern!r}: {context}')

    works = s.get('worksWith')
    if not isinstance(works, dict) or not isinstance(works.get('ids'), list) or not 1 <= len(works['ids']) <= 6:
        errors.append(f'{did}.worksWith: needs one to six ids')
    else:
        for w in works['ids']:
            if w not in ctx['ids']:
                errors.append(f'{did}.worksWith: unknown definition {w}')
            if w == did:
                errors.append(f'{did}.worksWith: lists itself')
        if works.get('status') not in STUDENT_STATUS:
            errors.append(f'{did}.worksWith: bad status {works.get("status")!r}')
        else:
            check_claim(f'{did}.worksWith', {**works, 'text': ', '.join(works['ids'])}, None, errors)

    for alias in s.get('aliases', []):
        for pattern in BANNED_STUDENT:
            if pattern.search(alias):
                errors.append(f'{did}.aliases: matches {pattern.pattern!r}: {alias}')

    cat = s.get('catalogue')
    if cat is not None:
        if cat.get('basis') not in CATALOGUE_BASIS:
            errors.append(f'{did}.catalogue: basis must be one of {CATALOGUE_BASIS}')
        for pattern in PART_NUMBER_PATTERNS:
            if pattern.search(str(cat.get('description'))):
                errors.append(f'{did}.catalogue: matches {pattern.pattern!r}: {cat.get("description")}')
        if not _text(cat.get('note')):
            errors.append(f'{did}.catalogue: missing provenance note')

    lessons = s.get('lessons')
    if not isinstance(lessons, list) or len(lessons) > 4:
        errors.append(f'{did}.lessons: must be a list of at most four')
    else:
        for item in lessons:
            if not (isinstance(item.get('lesson'), int) and _text(item.get('title')) and isinstance(item.get('mentions'), int)):
                errors.append(f'{did}.lessons: each needs lesson, title, mentions')

    errors.extend(_validate_engineering(did, d.get('engineering'), ctx))

    if d.get('review') == 'reviewed':
        for text in _all_text(s):
            for pattern in PLACEHOLDER_PHRASES:
                if pattern.search(text):
                    errors.append(f'{did}: a reviewed record may not carry placeholder text: {text}')
        legacy = (d.get('engineering') or {}).get('legacyValues', [])
        unresolved = [v.get('field') for v in legacy if v.get('status') == 'unsourced']
        if unresolved:
            errors.append(f'{did}: a reviewed record may not keep unsourced values: {unresolved}')
    return errors


def _validate_engineering(did, e, ctx):
    errors = []
    if not isinstance(e, dict):
        return [f'{did}: no engineering block']
    for key in FORBIDDEN_ENGINEERING_KEYS:
        if key in e:
            errors.append(f'{did}: engineering.{key} must not be in the committed store (catalogue rows and old register values stay out of Git)')
    alignment = e.get('alignment') or {}
    if alignment.get('result') not in ALIGNMENT:
        errors.append(f'{did}: alignment {alignment.get("result")!r} is not one of {ALIGNMENT}')
    if not _text(alignment.get('note')):
        errors.append(f'{did}: alignment without a note')
    elif _cites_catalogue(alignment['note']):
        errors.append(f'{did}: the alignment note has a part number or the retired H1B capture: {alignment["note"]}')
    manual = len(e.get('gtsioManual') or [])
    if alignment.get('result') in ('confirmed', 'gtsio_only') and not manual:
        errors.append(f'{did}: alignment is {alignment["result"]} but there is no GTSIO manual reference')
    if alignment.get('result') in ('io520_only', 'not_found') and manual:
        errors.append(f'{did}: alignment is {alignment["result"]} but it has a GTSIO manual reference')
    variant = e.get('variant')
    if variant is not None and variant not in ctx['variants']:
        errors.append(f'{did}: engineering.variant {variant!r} is not a variant in knowledge/part-cards')
    for i, value in enumerate(e.get('legacyValues', [])):
        where = f'{did}.engineering.legacyValues[{i}]'
        if not (_text(value.get('field')) and _text(value.get('text')) and _text(value.get('from'))):
            errors.append(f'{where}: needs from, field and text')
        status = value.get('status')
        if status not in ENGINEERING_STATUS:
            errors.append(f'{where}: status {status!r} is not one of {ENGINEERING_STATUS}')
        elif status in SOURCED_STATUS and not _text(value.get('source')):
            errors.append(f'{where}: a {status} value needs a source')
        elif status not in SOURCED_STATUS and not _text(value.get('basis')):
            errors.append(f'{where}: a {status} value needs a basis (for unsourced: what was looked for and not found)')
        if value.get('disposition') not in ('kept', 'dropped'):
            errors.append(f'{where}: disposition must be kept or dropped')
    return errors


# ---- instances -------------------------------------------------------------------------------------------------------------------------

def validate_instances(doc, ctx, root=ROOT, part_ids=None):
    errors = []
    model = doc.get('model')
    if doc.get('schema') != SCHEMA_INSTANCES:
        errors.append(f'{model}: schema must be {SCHEMA_INSTANCES}')
    if not _text(model):
        return errors + ['instances: missing model']
    ids_from = doc.get('idsFrom') or {}
    if not all(_text(ids_from.get(k)) for k in ('file', 'list', 'key')):
        return errors + [f'{model}: idsFrom needs file, list and key']
    if part_ids is None:
        if not (Path(root) / ids_from['file']).is_file():
            return errors + [f'{model}: idsFrom file {ids_from["file"]} does not exist']
        part_ids = model_part_ids(doc, root)
    if len(set(part_ids)) != len(part_ids):
        errors.append(f'{model}: the model lists a part id twice')

    projection = doc.get('projection')
    if projection is not None:
        if not all(_text(projection.get(k)) for k in ('file', 'schema', 'registryUrl')):
            errors.append(f'{model}.projection: needs file, schema and registryUrl')
        elif not re.search(r'-parts/\d+$', projection['schema']):
            errors.append(f'{model}.projection: schema {projection["schema"]!r} must end in -parts/<version>')

    for i, rule in enumerate(doc.get('rules', [])):
        where = f'{model}.rules[{i}]'
        if rule.get('definition') not in ctx['ids']:
            errors.append(f'{where}: unknown definition {rule.get("definition")!r}')
        if not rule.get('match'):
            errors.append(f'{where}: no id patterns')
        for pattern in rule.get('match', []):
            try:
                compile_pattern(pattern)
            except re.error as err:
                errors.append(f'{where}: bad pattern {pattern}: {err}')

    explicit_ids = [row.get('id') for row in doc.get('parts', [])]
    if len(set(explicit_ids)) != len(explicit_ids):
        errors.append(f'{model}: a part has two explicit rows')
    for i, row in enumerate(doc.get('parts', [])):
        where = f'{model}.parts[{i}] ({row.get("id")})'
        if row.get('id') not in part_ids:
            errors.append(f'{where}: not a part id of the model')
        definition = ctx['by_id'].get(row.get('definition'))
        if definition is None:
            errors.append(f'{where}: unknown definition {row.get("definition")!r}')
            continue
        if 'instance' in row and not isinstance(row['instance'], str):
            errors.append(f'{where}: instance must be a string')
        if row.get('system') is not None and row['system'] not in ctx['systems']:
            errors.append(f'{where}: system {row["system"]!r} is not one of the store systems')
        for field, claim in (row.get('claims') or {}).items():
            if field not in OVERRIDABLE:
                errors.append(f'{where}: claims may override only {OVERRIDABLE}, not {field}')
            else:
                check_claim(f'{where}.claims.{field}', claim, LIMITS[field], errors)
        state = row.get('review')
        if state is not None:
            _check_review(where, row, errors)
        if row.get('claims') and definition.get('review') == 'reviewed' and state is None:
            errors.append(f'{where}: wording of its own under a reviewed definition needs a review state of its own')
        if state == 'reviewed' and definition.get('review') != 'reviewed':
            errors.append(f'{where}: reviewed, but its definition {definition["id"]} is a draft')

    hits, unmatched, ambiguous = resolve_instances(doc, part_ids)
    if unmatched:
        errors.append(f'{model}: {len(unmatched)} part(s) map to no definition, e.g. {unmatched[:5]}')
    if ambiguous:
        errors.append(f'{model}: {len(ambiguous)} part(s) map to several definitions, e.g. {ambiguous[:5]}')
    for i, rule in enumerate(doc.get('rules', [])):
        regs = [compile_pattern(p) for p in rule.get('match', []) if _compiles(p)]
        if regs and not any(r.match(pid) for pid in part_ids for r in regs):
            errors.append(f'{model}.rules[{i}] ({rule.get("definition")}): matches no part of the model')
    return errors


def _compiles(pattern):
    try:
        compile_pattern(pattern)
        return True
    except re.error:
        return False


# ---- the store -------------------------------------------------------------------------------------------------------------------------

def validate_store_data(loaded, part_ids_by_model=None, root=ROOT, variants=None):
    """Every rule the store must meet, for data already in memory (tests change a copy and expect the matching error)."""
    errors = []
    store = loaded['store']
    if store.get('schema') != SCHEMA_STORE:
        errors.append(f'store.json: schema must be {SCHEMA_STORE}')
    systems = store.get('systems')
    if not isinstance(systems, list) or not systems:
        errors.append('store.json: needs a flat list of systems')
        systems = []
    system_ids = [s.get('id') for s in systems]
    if len(set(system_ids)) != len(system_ids):
        errors.append('store.json: a system id is used twice')
    for s in systems:
        if not all(_text(s.get(k)) for k in ('id', 'label', 'question')) or set(s) - {'id', 'label', 'question'}:
            errors.append(f'store.json: system {s.get("id")!r} must be flat: exactly id, label and question')
    rules = store.get('rules') or {}
    if set(rules.get('statuses', {})) != set(STUDENT_STATUS):
        errors.append(f'store.json: rules.statuses must describe exactly {STUDENT_STATUS}')

    definitions = loaded['definitions']
    for s in loaded['sets']:
        if s.get('schema') != SCHEMA_DEFINITIONS:
            errors.append(f'{s.get("set")}: schema must be {SCHEMA_DEFINITIONS}')
    ids = [d.get('id') for d in definitions]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f'{dup}: duplicate definition id')
    titles = [((d.get('student') or {}).get('title') or {}).get('text') for d in definitions]
    ctx = {
        'systems': set(system_ids),
        'ids': set(ids),
        'by_id': {d.get('id'): d for d in definitions},
        'title_counts': {t: titles.count(t) for t in set(titles)},
        'variants': variants if variants is not None else _family_variants(),
    }
    for d in definitions:
        errors.extend(validate_definition(d, ctx))

    used = set()
    models = [doc.get('model') for doc in loaded['instances']]
    for dup in sorted({m for m in models if models.count(m) > 1}):
        errors.append(f'{dup}: two instance files for one model')
    for doc in loaded['instances']:
        known = (part_ids_by_model or {}).get(doc.get('model'))
        errors.extend(validate_instances(doc, ctx, root, known))
        if doc.get('idsFrom') and (known is not None or (Path(root) / doc['idsFrom'].get('file', '')).is_file()):
            ids_for_model = known if known is not None else model_part_ids(doc, root)
            hits, _, _ = resolve_instances(doc, ids_for_model)
            used.update(hits.values())
    for did in ids:
        if did not in used:
            errors.append(f'{did}: no model uses this definition (a definition enters the store with the model that needs it)')
    return errors


def _family_variants():
    from . import part_card
    return {v['id'] for card in part_card.load_cards() for v in card['variants']}


def validate_store(directory=STORE_DIR):
    return validate_store_data(load_store(directory))


def committed_text_problems(directory=STORE_DIR):
    """The committed store files must not carry catalogue rows, old-register values or part numbers anywhere, whatever the field."""
    problems = []
    for path in sorted(Path(directory).rglob('*.json')):
        text = path.read_text(encoding='utf-8')
        for key in ('ipcIo520', 'gtsioOnlineIpcH1b', 'priorData', 'rowText'):
            if key in text:
                problems.append(f'{path.name} contains {key}')
        match = CATALOGUE_DATA.search(text)
        if match:
            problems.append(f'{path.name} contains a part number or the retired H1B capture: {match.group(0)}')
    return problems


# ---- lesson mentions -------------------------------------------------------------------------------------------------------------------

_SKIP_KEYS = {'id', 'thumbnail', 'type', 'kind', 'reviewStatus', 'listed', 'models', 'sequenceNumber', 'src', 'image', 'alt', 'caption', 'credit', 'source'}


def _strings(value):
    if isinstance(value, str):
        yield from (part for part in value.split('\n') if part.strip())
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key not in _SKIP_KEYS:
                yield from _strings(item)


def lesson_corpus(root=ROOT):
    """The plain text of each numbered lesson (1 to 18), for counting how often a lesson names a part."""
    manifest = _read(Path(root) / 'web' / 'lessons-manifest.json')
    out = {}
    for pack_path in manifest['packs']:
        pack = _read(Path(root) / 'web' / pack_path.removeprefix('./'))
        for lesson in pack['lessons']:
            number = lesson.get('sequenceNumber')
            if isinstance(number, int) and 1 <= number <= 18:
                checks = [c for c in pack.get('checks', []) if c.get('lessonId') == lesson['id']]
                out[number] = {'title': lesson['title'], 'text': '\n'.join(list(_strings(lesson)) + list(_strings(checks)))}
    return out


def lessons_for(definition, corpus):
    terms = definition.get('lessonTerms') or []
    found = []
    for number, lesson in corpus.items():
        text = lesson['text'].lower()
        count = sum(len(re.findall(r'\b' + re.escape(t) + r'\b', text)) for t in terms)
        if count:
            found.append((count, number, lesson['title']))
    found.sort(key=lambda item: (-item[0], item[1]))
    return [{'lesson': number, 'title': title, 'mentions': count} for count, number, title in found[:4]]


def stale_lessons(loaded, root=ROOT):
    """Definitions whose stored lesson mentions differ from what the lesson packs say now."""
    corpus = lesson_corpus(root)
    return [d['id'] for d in loaded['definitions'] if d['student'].get('lessons') != lessons_for(d, corpus)]


def serialise(doc):
    return json.dumps(doc, indent=1, ensure_ascii=False) + '\n'


def refresh_lessons(directory=STORE_DIR, root=ROOT):
    """Rewrite each definition's lesson mentions from the lesson packs; returns the ids that changed."""
    corpus = lesson_corpus(root)
    changed = []
    for path in sorted((Path(directory) / 'definitions').glob('*.json')):
        doc = _read(path)
        for d in doc['definitions']:
            fresh = lessons_for(d, corpus)
            if d['student'].get('lessons') != fresh:
                d['student']['lessons'] = fresh
                changed.append(d['id'])
        path.write_text(serialise(doc), encoding='utf-8', newline='\n')
    return changed


def summary(loaded):
    return (f'{len(loaded["definitions"])} definition(s) in {len(loaded["sets"])} set(s), '
            f'{len(loaded["store"]["systems"])} system(s), {len(loaded["instances"])} model(s): '
            + ', '.join(doc['model'] for doc in loaded['instances']))


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if '--refresh-lessons' in argv:
        changed = refresh_lessons()
        print(f'{len(changed)} definition(s) updated' + (f': {", ".join(changed)}' if changed else ''))
        return 0
    loaded = load_store()
    errors = validate_store_data(loaded) + committed_text_problems()
    stale = stale_lessons(loaded)
    if stale:
        errors.append(f'{len(stale)} definition(s) have out-of-date lesson mentions (run: python -m cad_pipeline.intent.part_store --refresh-lessons): {stale[:5]}')
    print(summary(loaded))
    if errors:
        print(f'\n{len(errors)} problem(s):', file=sys.stderr)
        for e in errors[:60]:
            print('  ' + e, file=sys.stderr)
        return 1
    print('The part store validates.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
