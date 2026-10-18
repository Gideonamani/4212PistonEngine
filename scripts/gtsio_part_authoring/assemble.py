"""Assemble data/gtsio520-part-definitions.json from the authoring modules and the source snapshots.

    python scripts/gtsio_part_authoring/assemble.py            validate and list problems
    python scripts/gtsio_part_authoring/assemble.py --write    validate, then write the definitions file
    python scripts/gtsio_part_authoring/assemble.py --check    fail if the file on disk is not what this would write

The words a learner reads are in defs_*.py; the id patterns are in patterns.py. See docs/gtsio-part-details.md.

The committed definitions file is built only from what is in Git: the student text, the GTSIO manual figure keys, the contract
locators and the alignment result and note. The IO-520 parts catalogue rows are kept out of Git (the repository is public). When
the private copies are present (data/gtsio_part_authoring/private/, see the guide), this also resolves each definition's catalogue
rows, checks them against the alignment result, and writes the full engineering block to private/definitions-engineering.json.
Without them it says so and checks the committed fields only.
"""
import json, re, sys, collections, os
sys.stdout.reconfigure(encoding='utf-8')
from lib import INPUTS, REPO, DEFS
from reviewed import REVIEWED
import patterns
import defs_structure, defs_gas, defs_power, defs_output, defs_lube, defs_ignition, defs_acc
from keys import KEYS, PDF_PAGE

PRIVATE = INPUTS / 'private'
PRIVATE_FILES = ['ipc_rows.json', 'ipc_refs.json']
HAVE_PRIVATE = all((PRIVATE / name).exists() for name in PRIVATE_FILES)

PROBLEMS = []


def prob(d, msg):
    PROBLEMS.append(f"{d['id']}: {msg}")


def norm(pn):
    return re.sub(r'[^A-Z0-9]', '', (pn or '').upper())


def private_json(name, default=None):
    path = PRIVATE / name
    return json.load(open(path, encoding='utf-8')) if path.exists() else default


# ---- IPC rows (private: the IO-520 catalogue transcription is not in Git)
IPC = []
IPC_BY_PN = collections.defaultdict(list)
IPC_REFS = {}
PRIOR = {}
ENG_NOTES = {}
if HAVE_PRIVATE:
    IPC = private_json('ipc_rows.json')
    IPC_REFS = private_json('ipc_refs.json')
    PRIOR = private_json('prior_contract_parts.json', {})
    ENG_NOTES = private_json('engineering_notes.json', {})
    # hand corrections to the OCR rows (rows the line parser misses, and descriptions it garbles), kept with the rows
    CORRECTIONS = private_json('ipc_corrections.json', {'supplement': [], 'descFix': []})
    SUPPLEMENT = CORRECTIONS['supplement']
    # page 19 holds two figures: 11 (connecting rod) then 12 (piston and rings)
    _seen_piston = False
    for _r in IPC:
        if _r['page'] == 19:
            if _r['desc'].startswith('Piston,'):
                _seen_piston = True
            _r['figure'] = 12 if _seen_piston else 11
    IPC.extend(SUPPLEMENT)
    for r in IPC:
        IPC_BY_PN[norm(r['pn'])].append(r)

# ---- lessons
# The plain text of each numbered lesson, for counting how often a lesson names a part.
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


def lesson_corpus():
    manifest = json.load(open(REPO / 'web/lessons-manifest.json', encoding='utf-8'))
    out = {}
    for pack_path in manifest['packs']:
        pack = json.load(open(REPO / 'web' / pack_path.removeprefix('./'), encoding='utf-8'))
        for lesson in pack['lessons']:
            number = lesson.get('sequenceNumber')
            if isinstance(number, int) and 1 <= number <= 18:
                checks = [check for check in pack.get('checks', []) if check.get('lessonId') == lesson['id']]
                out[str(number)] = {'title': lesson['title'], 'text': '\n'.join(list(_strings(lesson)) + list(_strings(checks)))}
    return out


NUMBERED = lesson_corpus()

GENERIC = {'Screw', 'Stud', 'Plain washer', 'Lock washer', 'Flat washer', 'Hex nut', 'Flanged nut', 'Retaining ring', 'O-ring',
           'Thrust washer', 'Dowel pin', 'Cotter pin', 'Needle bearing', 'Ball bearing', 'Oil seal', 'Hex head bolt',
           'Slotted hex nut', 'Woodruff key', 'Clutch spring', 'Locating pin', 'Tab washer', 'Adapter gasket',
           'Accessory cover gasket', 'Gear box cover gasket', 'Tach drive pad gasket'}

CAT_NOTE = {
    'io520': "From the IO-520 parts catalogue (a similar engine). The GTSIO-520-H may differ.",
    'gtsio': "From the GTSIO-520 overhaul manual's figure key.",
    'derived': "Worked out from the model; no catalogue lists it.",
}

# ---- the model's own part ids
CONTRACT = json.load(open(REPO / 'web/gtsio520-r10-contract.json', encoding='utf-8'))
CPARTS = {p['id']: p for p in CONTRACT['parts']}

JUNK_TAIL = {'2', '6', '1', '4', 'ee', 'eee', 'ew', 'we', 'wh', 'es', 'ww', 'ws', 'HH', '.', '..', '2.', '6.', '1.', '0c', 'ewe', 'wwe'}
DESC_FIX = {}
if HAVE_PRIVATE:
    DESC_FIX = {(c['pn'], c['page']): c['description'] for c in CORRECTIONS['descFix']}


def tidy(desc):
    s = desc.replace('Oi)', 'Oil').replace('Bub,', 'Hub,')
    s = re.sub(r"[»«©¥$*]+", '', s)
    toks = s.split()
    while len(toks) > 2 and (toks[-1] in JUNK_TAIL or re.fullmatch(r'[\d.]+', toks[-1]) and not re.search(r'\d', toks[-2][-1:])):
        toks.pop()
    return ' '.join(toks).strip(' .,~-_')


def qty_of(raw):
    m = re.search(r'\s(\d{1,3}|NS|RF)\)?\s+(All|[A-Z]{1,8})\W*$', raw)
    return m.group(1) if m else None


def resolve_ipc(d, ref):
    pn, frag, page = ref
    cands = []
    if pn is not None:
        cands = [r for r in IPC_BY_PN.get(norm(pn), [])]
        if frag:
            c2 = [r for r in cands if frag.lower().replace(' ', '') in r['desc'].lower().replace(' ', '')]
            if c2:
                cands = c2
    else:
        cands = [r for r in IPC if frag.lower().replace(' ', '') in r['desc'].lower().replace(' ', '')]
    if page is not None:
        c3 = [r for r in cands if r['page'] == page]
        if c3:
            cands = c3
        elif cands:
            cands = sorted(cands, key=lambda r: abs(r['page'] - page))[:1]
    if not cands:
        prob(d, f"IPC ref not found: pn={pn} frag={frag!r} page={page}")
        return None
    r = cands[0]
    desc = DESC_FIX.get((norm(r['pn']), r['page'])) or tidy(r['desc'])
    clean = bool(re.fullmatch(r"[A-Za-z0-9 ,.&:\-/()'*]+", desc)) and len(desc) > 3 and not re.search(r'(ee|eee|ew|we)', desc)
    fig = r['figure']
    m = re.match(r'^\W*(\d{1,2})-\s+\d{1,2}\s{2,}', r['raw'])
    if m:
        fig = int(m.group(1))
    return {'page': r['page'], 'figure': fig, 'index': (int(r['index']) if r['index'] and str(r['index']).isdigit() else None),
            'partNumber': None if r['pn'] == 'No Number' else r['pn'], 'description': desc, 'quantity': qty_of(r['raw']),
            'rowText': r['raw'][:160], 'ocrClean': clean}


def resolve_man(d, ref):
    fig, n = ref['_man']
    name = KEYS.get(fig, {}).get(n)
    if name is None:
        prob(d, f"manual key not found: {fig} {n}")
    return {'figure': fig, 'callout': n, 'key': name, 'pdfPage': PDF_PAGE.get(fig)}


def compile_patterns(d):
    pats = patterns.P.get(d['id'])
    if pats is None:
        prob(d, 'no pattern')
        return []
    return [re.sub(r'\(\?P<', '(?<', p) for p in pats]


def match_parts(d):
    out = []
    for pid in CPARTS:
        if any(re.fullmatch(p, pid) for p in patterns.P[d['id']]):
            out.append(pid)
    return out


MATS = json.load(open(INPUTS / 'glb_materials.json', encoding='utf-8'))


def prior_data(d, pids):
    labels = collections.Counter(); pns = collections.Counter(); specs = collections.Counter()
    for pid in pids:
        p = PRIOR.get(pid, {})
        if p.get('label'): labels[p['label']] += 1
        if p.get('partNumber'): pns[p['partNumber']] += 1
        if p.get('materialSpec'): specs[p['materialSpec']] += 1
    pn_list = []
    for pn, c in pns.most_common(6):
        rows = IPC_BY_PN.get(norm(pn), [])
        r = rows[0] if rows else None
        pn_list.append({'partNumber': pn, 'parts': c, 'inIo520Catalogue': bool(rows),
                        'io520Description': (r['desc'] if r else None)})
    return {'labels': [l for l, _ in labels.most_common(4)], 'partNumbers': pn_list,
            'materialSpecs': [s for s, _ in specs.most_common(2)]}


def lessons_for(d):
    title = d['student']['title']['text']
    terms = d.get('_terms')
    if terms is None:
        terms = [] if title in GENERIC else [title.lower()]
    terms = [t.lower() for t in terms]
    out = []
    for k, v in NUMBERED.items():
        txt = v['text'].lower()
        c = sum(len(re.findall(r'\b' + re.escape(t) + r'\b', txt)) for t in terms)
        if c:
            out.append((c, int(k), v['title']))
    out.sort(key=lambda x: (-x[0], x[1]))
    return [{'lesson': n, 'title': t, 'mentions': c} for c, n, t in out[:4]]


# What the numbered group in a part id means, where it is not just "no. N".
INSTANCE_WORDS = {k: {'n': 'throw'} for k in ('counterweight', 'damper-bushing', 'counterweight-bushing', 'damper-pin',
                                              'pin-retaining-plate', 'damper-retaining-ring')}
INSTANCE_WORDS['crankshaft-main-bearing'] = {'n': 'journal'}
INSTANCE_WORDS['crankcase-through-bolt'] = {'sets': {'CaseThru': 'case set', 'CasePrimaryThrough': 'primary set', 'FrontCaseThrough': 'front set'}}
INSTANCE_WORDS['crankcase-through-bolt-washer'] = {'sets': {'CaseThru': 'case set', 'PrimaryExternal': 'primary set'}}
INSTANCE_WORDS['crankcase-through-bolt-nut'] = {'sets': {'CaseThru': 'case set', 'PrimaryExternal': 'primary set'}}
INSTANCE_WORDS['exhaust-roto-cap'] = {'sets': {'Retainer': 'cap', 'RotocoilRim': 'rim'}}
INSTANCE_WORDS['oil-transfer-sleeve'] = {'sets': {'PropellerRear': 'rear', 'PropellerTransfer': 'forward'}}
INSTANCE_WORDS['woodruff-key'] = {'sets': {'Alternator': 'alternator', 'Governor': 'governor', 'Scavenge': 'scavenge pump'}}


# A short qualifier that tells apart definitions sharing a catalogue noun ("Screw" for nine different fasteners).
# Plain words in the part's own place in the engine; the 'sits' line carries the full sentence.
CONTEXT = {
    'crankcase-through-bolt-washer': 'through-bolt', 'rocker-cover-plain-washer': 'rocker cover', 'accessory-cover-washer': 'accessory cover',
    'alternator-mount-washer': 'alternator mount', 'tach-pad-washer': 'tach drive pad',
    'crankcase-through-bolt-lock-washer': 'through-bolt', 'rocker-cover-lock-washer': 'rocker cover', 'accessory-cover-lock-washer': 'accessory cover',
    'alternator-mount-lock-washer': 'alternator mount', 'tach-pad-lock-washer': 'tach drive pad', 'tach-access-lock-washer': 'tach gear box',
    'crankcase-through-bolt-nut': 'through-bolt', 'cylinder-base-nut': 'cylinder base',
    'front-case-nut': 'front case', 'alternator-mount-nut': 'alternator mount', 'tach-pad-nut': 'tach drive pad',
    'cylinder-base-stud': 'cylinder base', 'oil-pump-mount-bolt': 'oil pump mount', 'scavenge-cover-bolt': 'scavenge cover',
    'magneto-adapter-bolt': 'magneto adapter', 'accessory-cover-screw': 'accessory cover', 'alternator-mount-stud': 'alternator mount',
    'fuel-pump-stud': 'fuel pump mount', 'tach-pad-stud': 'tach drive pad',
    'rocker-thrust-washer': 'rocker shaft', 'alternator-thrust-washer': 'alternator shaft',
    'rocker-retainer-screw': 'rocker retainer', 'camshaft-gear-screw': 'camshaft gear', 'crankshaft-gear-screw': 'crankshaft gear',
    'quill-plate-screw': 'quill plate', 'oil-sump-screw': 'oil sump', 'idler-cluster-screw': 'idler cluster', 'starter-mount-bolt': 'starter mount',
    'alternator-face-screw': 'alternator gear', 'tach-access-screw': 'tach gear box',
    'lifter-retaining-ring': 'valve lifter', 'damper-retaining-ring': 'damper pin', 'quill-retaining-ring': 'quill shaft',
    'accessory-needle-bearing': 'accessory drive', 'starter-needle-bearing': 'starter',
}


# A reviewed id must be a definition that exists.
assert REVIEWED <= {d['id'] for d in DEFS}, sorted(REVIEWED - {d['id'] for d in DEFS})


def derived_alignment(n_ipc, n_man):
    """What the evidence alone gives, for every definition the author has not marked a mismatch or not_found."""
    if n_ipc and n_man:
        return 'confirmed'
    if n_man:
        return 'gtsio_only'
    if n_ipc:
        return 'io520_only'
    return 'not_found'


def build(private=False):
    """The definition records. `private=True` adds what is kept out of Git: the IO-520 catalogue rows, the old register's values and the engineering notes."""
    out = []
    for d in DEFS:
        rec = json.loads(json.dumps({k: v for k, v in d.items() if not k.startswith('_')}))
        pids = match_parts(d)
        eng = rec['engineering']
        eng['gtsioManual'] = [x for x in (resolve_man(d, r) for r in d['engineering']['gtsioManual']) if x]
        locs = []
        for l in d['engineering']['contractLocators']:
            m = re.fullmatch(r'(A-4-\d+):(\d+)', l)
            locs.append({'locator': l, 'manualKey': KEYS.get(m.group(1), {}).get(int(m.group(2))) if m else None})
        eng['contractLocators'] = locs
        eng['modelMaterials'] = sorted({re.sub(r'_t\d+$', '', MATS[p]) for p in pids if p in MATS})
        if not eng['alignment']['result']:
            prob(d, 'no alignment')
        if private:
            eng['ipcIo520'] = [x for x in (resolve_ipc(d, r) for r in IPC_REFS.get(d['id'], [])) if x]
            eng['priorData'] = prior_data(d, pids)
            if d['id'] in ENG_NOTES:
                eng['note'] = ENG_NOTES[d['id']]
            result = eng['alignment']['result']
            if result not in ('mismatch', 'not_found') or (result == 'not_found' and (eng['ipcIo520'] or eng['gtsioManual'])):
                want = derived_alignment(len(eng['ipcIo520']), len(eng['gtsioManual']))
                if want != result:
                    prob(d, f"alignment is {result} but the catalogue rows and manual keys give {want}")
        else:
            # What the committed file can check on its own: a manual reference goes with confirmed or gtsio_only, and with nothing else.
            result = eng['alignment']['result']
            if result in ('confirmed', 'gtsio_only') and not eng['gtsioManual']:
                prob(d, f"alignment is {result} but there is no GTSIO manual reference")
            if result in ('io520_only', 'not_found') and eng['gtsioManual']:
                prob(d, f"alignment is {result} but it has a GTSIO manual reference")
        stu = rec['student']
        stu['lessons'] = lessons_for(d)
        if d['id'] in CONTEXT:
            stu['context'] = CONTEXT[d['id']]
        cat = d['student']['catalogue']
        if cat:
            stu['catalogue'] = {'description': cat['description'], 'note': CAT_NOTE[cat['basis']], 'basis': cat['basis']}
        rec['match'] = compile_patterns(d)
        if d['id'] in INSTANCE_WORDS:
            rec['instanceWords'] = INSTANCE_WORDS[d['id']]
        rec['partCount'] = len(pids)
        rec['review'] = 'reviewed' if d['id'] in REVIEWED else 'draft'
        out.append(rec)
    return out


BANNED = [r'AMS\s?\d', r'P/N', r'NPT', r'UNJ?F', r'carburi[sz]', r'case-hardened', r'nitrid', r'Rockwell', r'HRC', r'psi', r'lbf', r'ft-?lb',
          r'\d{5,6}[A-Z]?\d*', r'AN\d', r'MS\d', r'X\d{4}', r'TODO', r'TBD', r'lorem', r'placeholder', r'QTY']
STAT_OK = {'specified', 'derived', 'inferred', 'illustrative'}
# The catalogue line may carry sizes and thread names ("1/8-27 NPT"); it is checked for part numbers and placeholders only.
CATALOGUE_BANNED = [r'P/N', r'\d{5,6}[A-Z]?\d*', r'AN\d', r'MS\d', r'X\d{4}', r'TODO', r'TBD', r'lorem', r'placeholder', r'QTY']


def wc(t):
    return len(re.findall(r"\S+", t))


def check(recs):
    errs = []
    ids = {r['id'] for r in recs}
    for r in recs:
        s = r['student']
        def claim(name, c, maxw):
            if c is None:
                errs.append(f"{r['id']}: {name} missing"); return
            if c['status'] not in STAT_OK: errs.append(f"{r['id']}: {name} status {c['status']}")
            if c['status'] in ('specified', 'derived') and not c.get('source'): errs.append(f"{r['id']}: {name} {c['status']} without source")
            if c['status'] in ('inferred', 'illustrative') and not c.get('basis'): errs.append(f"{r['id']}: {name} {c['status']} without basis")
            if 'basis' in c and 'source' in c: errs.append(f"{r['id']}: {name} has both")
            if maxw and wc(c['text']) > maxw: errs.append(f"{r['id']}: {name} {wc(c['text'])} words > {maxw}: {c['text']}")
            for b in BANNED:
                if re.search(b, c['text'], re.I): errs.append(f"{r['id']}: {name} banned {b}: {c['text']}")
        claim('title', s['title'], 4)
        claim('function', s['function'], 22)
        claim('madeOf', s['madeOf'], 8)
        claim('sits', s['sits'], 28)
        claim('lookFor', s['lookFor'], 22)
        for x in s['worksWith']['ids']:
            if x not in ids: errs.append(f"{r['id']}: worksWith {x}")
        if not (1 <= len(s['worksWith']['ids']) <= 6): errs.append(f"{r['id']}: worksWith count {len(s['worksWith']['ids'])}")
        if s['catalogue']:
            for b in CATALOGUE_BANNED:
                if re.search(b, s['catalogue']['description'], re.I): errs.append(f"{r['id']}: catalogue banned {b}: {s['catalogue']['description']}")
        # nothing a reader of the committed file should not see: part numbers or the retired H1B capture
        note = r['engineering']['alignment']['note']
        if re.search(r'\b\d{5,6}[A-Z]?\d*\b|H1B|PartStream|earlier card', note):
            errs.append(f"{r['id']}: alignment note has a part number or the H1B capture: {note}")
        for name in ('title', 'function', 'madeOf', 'sits', 'lookFor'):
            for field in ('source', 'basis'):
                if re.search(r'H1B|PartStream|\b\d{5,6}[A-Z]?\d*\b', s[name].get(field, '')):
                    errs.append(f"{r['id']}: {name} {field} cites the H1B capture or a part number: {s[name].get(field)}")
    return errs


def write_final(recs):
    systems = [
        {'id': 'structure', 'label': 'Engine Structure', 'question': 'What holds the engine together?'},
        {'id': 'power', 'label': 'Power Mechanism', 'question': 'How does combustion turn the shaft?'},
        {'id': 'gas', 'label': 'Gas Exchange & Valve Train', 'question': 'How does mixture get in and exhaust get out?'},
        {'id': 'ignition', 'label': 'Ignition', 'question': 'How is combustion started?'},
        {'id': 'lubrication', 'label': 'Lubrication', 'question': 'How are the moving parts protected?'},
        {'id': 'output', 'label': 'Power Output & Transmission', 'question': 'How does engine power reach the propeller?'},
        {'id': 'accessories', 'label': 'Accessory Drives', 'question': 'What does the engine drive besides the propeller?'},
    ]
    doc = {
        'schema': 'gtsio520-part-definitions/1',
        'model': 'gtsio520-h-r10-mechanism-study',
        'state': 'draft',
        'about': ("Learner-facing details for every part of the R10 (GTSIO-520-H) Explore card, one definition per kind of part. "
                  "The 'student' block is what a learner may see once reviewed; the 'engineering' block is the GTSIO manual cross-check and the alignment result, and never ships to the browser. "
                  "The IO-520 catalogue rows behind each alignment result are kept out of Git (the repository is public). "
                  "Every definition stays 'draft' until the instructor has reviewed it."),
        'rules': {
            'title': "The part noun from the IO-520 parts catalogue description in plain, natural order, four words at most; size, thread and length go in 'catalogue'. Where the IO-520 catalogue has no row, the GTSIO-520 overhaul manual figure key supplies the name by the same rule.",
            'statuses': {
                'specified': 'a source states it directly',
                'derived': 'worked out from a source by a stated step',
                'inferred': 'a reasonable basis, not a source: the claim is not stated in any source read',
                'illustrative': 'a prompt for the learner; it claims nothing about the engine',
            },
            'numbers': 'Numbers appear only where a lesson or a manual gives them. Part numbers are never shown to learners.',
            'catalogueNote': "IO-520 sizes and descriptions are tagged 'the GTSIO-520-H may differ' unless the GTSIO manual confirms them.",
        },
        'systems': systems,
        'references': {
            'io520Catalogue': {
                'title': 'Continental IO-520 Illustrated Parts Catalog, Form X-30040A, 1 May 1969',
                'note': 'Read by OCR from page facsimiles. The rows are kept out of Git; the alignment result and note record what they showed.',
            },
            'gtsioManual': {
                'title': 'Continental GTSIO-520 Series Overhaul Manual, Form X-30045A (Notes/gtsio520_series.pdf)',
                'note': 'Figure keys A-4-8 to A-4-20 in Section IV; callout numbers as printed.',
            },
            'alignment': {
                'confirmed': 'named in both the IO-520 parts catalogue and the GTSIO manual figure key, under the same kind of name',
                'gtsio_only': 'named in the GTSIO manual figure key but not in the IO-520 catalogue',
                'io520_only': 'named in the IO-520 catalogue but not in the GTSIO manual',
                'mismatch': 'the R10 model draws or names the part differently from the books',
                'not_found': 'listed in neither book; the name describes the part',
            },
        },
        'definitions': recs,
    }
    return doc


OUT = REPO / 'data' / 'gtsio520-part-definitions.json'
OUT_PRIVATE = PRIVATE / 'definitions-engineering.json'


def serialise(doc):
    return json.dumps(doc, indent=1, ensure_ascii=False) + '\n'


if __name__ == '__main__':
    recs = build()
    full = build(private=True) if HAVE_PRIVATE else None
    print(len(recs), 'definitions;', len(PROBLEMS), 'problems')
    for p in PROBLEMS:
        print('  -', p)
    errs = check(recs)
    print(len(errs), 'content errors')
    for e in errs:
        print('  *', e)
    if not HAVE_PRIVATE:
        print('private catalogue data not found (data/gtsio_part_authoring/private/): catalogue-row checks skipped; the committed fields only were checked')
    if '--write' in sys.argv or '--check' in sys.argv:
        if PROBLEMS or errs:
            print('not writing: fix the problems above first')
            sys.exit(1)
        text = serialise(write_final(recs))
        if '--check' in sys.argv:
            current = OUT.read_text(encoding='utf-8').replace('\r\n', '\n') if OUT.exists() else None
            if current != text:
                print('data/gtsio520-part-definitions.json is out of date; run: python scripts/gtsio_part_authoring/assemble.py --write')
                sys.exit(1)
            print('data/gtsio520-part-definitions.json is up to date')
        else:
            with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
                f.write(text)
            print(f'wrote {OUT.relative_to(REPO).as_posix()} ({os.path.getsize(OUT)} bytes)')
            if full is not None:
                with open(OUT_PRIVATE, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(serialise(write_final(full)))
                print(f'wrote {OUT_PRIVATE.relative_to(REPO).as_posix()} (private, with the catalogue rows)')
