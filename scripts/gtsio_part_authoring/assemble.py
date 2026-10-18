"""Assemble data/gtsio520-part-definitions.json from the authoring modules and the source snapshots.

    python scripts/gtsio_part_authoring/assemble.py            validate and list problems
    python scripts/gtsio_part_authoring/assemble.py --write    validate, then write the definitions file
    python scripts/gtsio_part_authoring/assemble.py --check    fail if the file on disk is not what this would write

The words a learner reads are in defs_*.py; the id patterns are in patterns.py. See docs/gtsio-part-details.md.
"""
import json, re, sys, collections, os
sys.stdout.reconfigure(encoding='utf-8')
from lib import INPUTS, REPO, DEFS
from reviewed import REVIEWED
import patterns
import defs_structure, defs_gas, defs_power, defs_output, defs_lube, defs_ignition, defs_acc
from keys import KEYS, PDF_PAGE

PROBLEMS = []


def prob(d, msg):
    PROBLEMS.append(f"{d['id']}: {msg}")


def norm(pn):
    return re.sub(r'[^A-Z0-9]', '', (pn or '').upper())


# ---- IPC rows
IPC = json.load(open(INPUTS / 'ipc_rows.json', encoding='utf-8'))
# rows the line parser misses (index missing or mangled in the OCR); read from the OCR lines by hand
SUPPLEMENT = [
    {'page': 19, 'figure': 11, 'index': None, 'pn': '633403', 'desc': 'Connecting Rod Assembly, Complete', 'raw': 'j1- 633403 * Connecting Rod Assembly, Complete . . 6 All'},
    {'page': 20, 'figure': 13, 'index': None, 'pn': '635448', 'desc': 'Cylinder Assembly', 'raw': '635448 . . Cylinder Assembly . . 1 All'},
    {'page': 20, 'figure': 13, 'index': '21', 'pn': '539740', 'desc': 'Shaft, Valve Rocker', 'raw': '-21 539740 . Shaft, Valve Rocker. . . 12 All'},
    {'page': 21, 'figure': 13, 'index': None, 'pn': '534639', 'desc': 'Rocker Assembly, Exhaust Valve', 'raw': '534639 . Rocker Assembly, Exhaust Valve . 6 All'},
    {'page': 22, 'figure': 14, 'index': None, 'pn': '629218', 'desc': 'Gear & Bushing Assembly, Oil Pump, Driven', 'raw': '629218 . Gear & Bushing Assembly, Oil Pump, Driven. . . 1 ADEFJKL'},
]
# page 19 holds two figures: 11 (connecting rod) then 12 (piston and rings)
_seen_piston = False
for _r in IPC:
    if _r['page'] == 19:
        if _r['desc'].startswith('Piston,'):
            _seen_piston = True
        _r['figure'] = 12 if _seen_piston else 11
IPC.extend(SUPPLEMENT)
IPC_BY_PN = collections.defaultdict(list)
for r in IPC:
    IPC_BY_PN[norm(r['pn'])].append(r)

# ---- H1B rows
H1B = json.load(open(REPO / 'cad-studies/gtsio520-h-realism/ipc-catalog.json', encoding='utf-8'))
H1B_ROWS = {}
for a in H1B['assemblies']:
    H1B_ROWS[a['assembly']] = a['items']

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

# ---- previous (contract) data
CONTRACT = json.load(open(REPO / 'web/gtsio520-r10-contract.json', encoding='utf-8'))
CPARTS = {p['id']: p for p in CONTRACT['parts']}
# What the contract carried for each part before it was stripped of part references (engineering use only; see docs/gtsio-part-details.md).
PRIOR = json.load(open(INPUTS / 'prior_contract_parts.json', encoding='utf-8'))

SPEC_PAGE = {}


JUNK_TAIL = {'2', '6', '1', '4', 'ee', 'eee', 'ew', 'we', 'wh', 'es', 'ww', 'ws', 'HH', '.', '..', '2.', '6.', '1.', '0c', 'ewe', 'wwe'}
DESC_FIX = {('538404', 6): 'Stud, 7/16 X 1-19/32 In. Lg', ('25008', 51): 'Stud, 1/4 X 1-3/8 In. Lg', ('537019', 20): 'Screw, 5/16-24 X 17/32 In. Lg'}


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
    pn, frag, page = ref['_ipc']
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
    clean = bool(re.fullmatch(r"[A-Za-z0-9 ,.&:\-/()'*]+", desc)) and len(desc) > 3 and not re.search(r'(ee|eee|ew|we)', desc)
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


def resolve_h1b(d, ref):
    asm, tag, pn = ref['_h1b']
    rows = H1B_ROWS.get(asm)
    if rows is None:
        prob(d, f"H1B assembly not found: {asm}")
        return None
    c = [r for r in rows if r['tag'] == tag]
    if pn is not None:
        c2 = [r for r in c if norm(r['part_number']) == norm(pn)]
        if not c2:
            # fall back: any tag with that pn
            c2 = [r for r in rows if norm(r['part_number']) == norm(pn)]
            if c2:
                prob(d, f"H1B tag mismatch (pn {pn} found at tag {c2[0]['tag']} not {tag}) in {asm}")
        c = c2
    if not c:
        prob(d, f"H1B ref not found: {asm} tag={tag} pn={pn}")
        return None
    r = c[0]
    out = {'assembly': asm, 'tag': r['tag'], 'partNumber': r['part_number'], 'description': r['description'], 'quantity': r.get('qty')}
    return out


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
        p = PRIOR[pid]
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


def build():
    out = []
    for d in DEFS:
        rec = json.loads(json.dumps({k: v for k, v in d.items() if not k.startswith('_')}))
        pids = match_parts(d)
        eng = rec['engineering']
        eng['ipcIo520'] = [x for x in (resolve_ipc(d, r) for r in d['engineering']['ipcIo520']) if x]
        eng['gtsioManual'] = [x for x in (resolve_man(d, r) for r in d['engineering']['gtsioManual']) if x]
        eng['gtsioOnlineIpcH1b'] = [x for x in (resolve_h1b(d, r) for r in d['engineering']['gtsioOnlineIpcH1b']) if x]
        locs = []
        for l in d['engineering']['contractLocators']:
            m = re.fullmatch(r'(A-4-\d+):(\d+)', l)
            locs.append({'locator': l, 'manualKey': KEYS.get(m.group(1), {}).get(int(m.group(2))) if m else None})
        eng['contractLocators'] = locs
        eng['priorData'] = prior_data(d, pids)
        eng['modelMaterials'] = sorted({re.sub(r'_t\d+$', '', MATS[p]) for p in pids if p in MATS})
        if not eng['alignment']['result']:
            prob(d, 'no alignment')
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


BANNED = [r'AMS\s?\d', r'P/N', r'NPT', r'UNJ?F', r'carburi[sz]', r'case-hardened', r'nitrid', r'Rockwell', r'HRC', r'psi', r'lbf', r'ft-?lb',
          r'\d{5,6}[A-Z]?\d*', r'AN\d', r'MS\d', r'X\d{4}', r'TODO', r'TBD', r'lorem', r'placeholder', r'QTY']
STAT_OK = {'specified', 'derived', 'inferred', 'illustrative'}


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
            for b in BANNED:
                if re.search(b, s['catalogue']['description'], re.I): errs.append(f"{r['id']}: catalogue banned {b}: {s['catalogue']['description']}")
    return errs


if __name__ == '__main__':
    recs = build()
    print(len(recs), 'definitions;', len(PROBLEMS), 'problems')
    for p in PROBLEMS:
        print('  -', p)
    errs = check(recs)
    print(len(errs), 'content errors')
    for e in errs: print('  *', e)


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
                  "The 'student' block is what a learner may see once reviewed; the 'engineering' block is the catalogue cross-check and never ships to the browser. "
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
            'ipcIo520': {
                'title': 'Continental IO-520 Illustrated Parts Catalog, Form X-30040A, 1 May 1969',
                'note': 'Read by OCR from page facsimiles (about 72% confident on the original text layer, much better after re-reading the page images). Rows carry page, figure, index, part number, description and quantity as read; rowText is the raw OCR line. Doubtful rows are marked ocrClean false.',
            },
            'gtsioManual': {
                'title': 'Continental GTSIO-520 Series Overhaul Manual, Form X-30045A (Notes/gtsio520_series.pdf)',
                'note': 'Figure keys A-4-8 to A-4-20 in Section IV; callout numbers as printed.',
            },
            'gtsioOnlineIpcH1b': {
                'title': 'Continental PartStream online IPC capture for GTSIO-520-H1B (cad-studies/gtsio520-h-realism/ipc-catalog.json)',
                'note': 'Provenance not verified by the instructor. Used only as a third cross-check; the GTSIO-520-H catalogue X-30046A is not available.',
            },
            'alignment': {
                'confirmed': 'the part is in the GTSIO manual figure key or both catalogues under the same kind of name',
                'gtsio_only': 'named in the GTSIO manual (and sometimes the H1B catalogue) but not in the IO-520 catalogue',
                'io520_only': 'named in the IO-520 catalogue but not in the GTSIO manual',
                'mismatch': 'the R10 model draws or names the part differently from the books',
                'not_found': 'listed in none of the three references; the name describes the part',
            },
        },
        'definitions': recs,
    }
    return doc


OUT = REPO / 'data' / 'gtsio520-part-definitions.json'


def serialise(doc):
    return json.dumps(doc, indent=1, ensure_ascii=False) + '\n'


if __name__ == '__main__' and ('--write' in sys.argv or '--check' in sys.argv):
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
