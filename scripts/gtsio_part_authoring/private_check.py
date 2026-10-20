"""Cross-check the part store against the IO-520 catalogue rows that are kept out of Git (the repository is public).

    python scripts/gtsio_part_authoring/private_check.py            check, and write data/gtsio_part_authoring/private/definitions-engineering.json
    python scripts/gtsio_part_authoring/private_check.py --check    check only

Needs data/gtsio_part_authoring/private/ (ipc_rows.json, ipc_refs.json; see docs/part-store.md). For each definition it resolves the catalogue
rows listed in ipc_refs.json, checks the stored alignment result against what the rows and the manual keys give (a catalogue row and a
manual key give confirmed; a manual key alone gives gtsio_only; a row alone gives io520_only; neither gives not_found; mismatch is a
judgement and is not re-derived), and writes the full engineering block (with the resolved rows and the old register's values) beside the
rows, outside Git. Without the private files it says so and exits cleanly: the committed fields are the validator's to check.
"""
import collections
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
from cad_pipeline.intent import part_store as ps  # noqa: E402

PRIVATE = REPO / 'data' / 'gtsio_part_authoring' / 'private'
OUT = PRIVATE / 'definitions-engineering.json'
PROBLEMS = []


def private_json(name, default=None):
    path = PRIVATE / name
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def norm(pn):
    return re.sub(r'[^A-Z0-9]', '', (pn or '').upper())


JUNK_TAIL = {'2', '6', '1', '4', 'ee', 'eee', 'ew', 'we', 'wh', 'es', 'ww', 'ws', 'HH', '.', '..', '2.', '6.', '1.', '0c', 'ewe', 'wwe'}


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


def derived_alignment(n_ipc, n_man):
    if n_ipc and n_man:
        return 'confirmed'
    if n_man:
        return 'gtsio_only'
    if n_ipc:
        return 'io520_only'
    return 'not_found'


def main(argv):
    if not all((PRIVATE / name).exists() for name in ('ipc_rows.json', 'ipc_refs.json')):
        print('private catalogue data not found (data/gtsio_part_authoring/private/): catalogue-row checks skipped; the committed fields are the validator\'s')
        return 0
    rows = private_json('ipc_rows.json')
    refs = private_json('ipc_refs.json')
    prior = private_json('prior_contract_parts.json', {})
    notes = private_json('engineering_notes.json', {})
    corrections = private_json('ipc_corrections.json', {'supplement': [], 'descFix': []})
    desc_fix = {(c['pn'], c['page']): c['description'] for c in corrections['descFix']}
    # page 19 holds two figures: 11 (connecting rod) then 12 (piston and rings)
    seen_piston = False
    for r in rows:
        if r['page'] == 19:
            if r['desc'].startswith('Piston,'):
                seen_piston = True
            r['figure'] = 12 if seen_piston else 11
    rows.extend(corrections['supplement'])
    by_pn = collections.defaultdict(list)
    for r in rows:
        by_pn[norm(r['pn'])].append(r)

    def resolve(did, ref):
        pn, frag, page = ref
        cands = list(by_pn.get(norm(pn), [])) if pn is not None else [r for r in rows if frag.lower().replace(' ', '') in r['desc'].lower().replace(' ', '')]
        if pn is not None and frag:
            narrowed = [r for r in cands if frag.lower().replace(' ', '') in r['desc'].lower().replace(' ', '')]
            cands = narrowed or cands
        if page is not None:
            same_page = [r for r in cands if r['page'] == page]
            cands = same_page or sorted(cands, key=lambda r: abs(r['page'] - page))[:1]
        if not cands:
            PROBLEMS.append(f'{did}: catalogue row not found: pn={pn} frag={frag!r} page={page}')
            return None
        r = cands[0]
        desc = desc_fix.get((norm(r['pn']), r['page'])) or tidy(r['desc'])
        clean = bool(re.fullmatch(r"[A-Za-z0-9 ,.&:\-/()'*]+", desc)) and len(desc) > 3 and not re.search(r'(ee|eee|ew|we)', desc)
        figure = r['figure']
        m = re.match(r'^\W*(\d{1,2})-\s+\d{1,2}\s{2,}', r['raw'])
        if m:
            figure = int(m.group(1))
        return {'page': r['page'], 'figure': figure, 'index': int(r['index']) if r['index'] and str(r['index']).isdigit() else None,
                'partNumber': None if r['pn'] == 'No Number' else r['pn'], 'description': desc, 'quantity': qty_of(r['raw']),
                'rowText': r['raw'][:160], 'ocrClean': clean}

    loaded = ps.load_store()
    r10 = next(doc for doc in loaded['instances'] if doc['model'] == 'gtsio520-h-r10-mechanism-study')
    hits, _, _ = ps.resolve_instances(r10, ps.model_part_ids(r10))
    pids_by_def = collections.defaultdict(list)
    for pid, did in hits.items():
        pids_by_def[did].append(pid)

    full = json.loads(json.dumps(loaded['definitions']))
    for d in full:
        e = d['engineering']
        e['ipcIo520'] = [x for x in (resolve(d['id'], ref) for ref in refs.get(d['id'], [])) if x]
        labels, numbers, specs = collections.Counter(), collections.Counter(), collections.Counter()
        for pid in pids_by_def.get(d['id'], []):
            p = prior.get(pid, {})
            if p.get('label'):
                labels[p['label']] += 1
            if p.get('partNumber'):
                numbers[p['partNumber']] += 1
            if p.get('materialSpec'):
                specs[p['materialSpec']] += 1
        listed = []
        for pn, count in numbers.most_common(6):
            found = by_pn.get(norm(pn), [])
            listed.append({'partNumber': pn, 'parts': count, 'inIo520Catalogue': bool(found), 'io520Description': found[0]['desc'] if found else None})
        e['priorData'] = {'labels': [label for label, _ in labels.most_common(4)], 'partNumbers': listed, 'materialSpecs': [s for s, _ in specs.most_common(2)]}
        if d['id'] in notes:
            e['note'] = notes[d['id']]
        result = e['alignment']['result']
        if result not in ('mismatch', 'not_found') or (result == 'not_found' and (e['ipcIo520'] or e['gtsioManual'])):
            want = derived_alignment(len(e['ipcIo520']), len(e.get('gtsioManual') or []))
            if want != result:
                PROBLEMS.append(f"{d['id']}: alignment is {result} but the catalogue rows and manual keys give {want}")

    print(f'{len(full)} definitions cross-checked against {len(rows)} catalogue rows; {len(PROBLEMS)} problem(s)')
    for p in PROBLEMS:
        print('  -', p)
    if PROBLEMS:
        return 1
    if '--check' not in argv:
        OUT.write_text(json.dumps({'about': 'Private: the store definitions with the catalogue rows resolved. Never commit.', 'definitions': full}, indent=1, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
        print(f'wrote {OUT.relative_to(REPO).as_posix()} (private, with the catalogue rows)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
