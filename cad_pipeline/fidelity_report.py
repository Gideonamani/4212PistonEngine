"""Coverage, the draft lesson map and the written report for the fidelity classes (cad_pipeline/fidelity.py derives the classes).

Standard library only. Run through scripts/derive_fidelity_classes.py.
"""
import json
from collections import Counter, defaultdict

from cad_pipeline.fidelity import CLASSES, _json, counts, coverage_gaps, gate_coverage


def coverage(result):
    """Gate coverage of a derived study: per-class tables plus the engineering gaps (open, waived by a waiver for the present asset, and expired waivers)."""
    inputs = result['inputs']
    cover, notes = gate_coverage(inputs['parts'], inputs['moving'], inputs['meshed'], inputs['audits'], inputs['asset_sha256'])
    open_, waived, expired = coverage_gaps(result['parts'], cover, inputs['moving'], inputs['meshed'], inputs['waivers'], inputs['asset_sha256'])
    table = {}
    for c in CLASSES:
        rows = [r for r in result['parts'] if r['class'] == c]
        moving = [r for r in rows if r['id'] in inputs['moving']]
        meshed = [r for r in rows if r['id'] in inputs['meshed']]
        table[c] = dict(parts=len(rows),
                        rest=sum(1 for r in rows if cover[r['id']]['rest']),
                        moving=len(moving), clip=sum(1 for r in moving if cover[r['id']]['clip']),
                        meshed=len(meshed), gear=sum(1 for r in meshed if cover[r['id']]['gear']),
                        mass_line=sum(1 for r in rows if r['id'] in inputs['mass']),
                        on_path=sum(1 for r in rows if r['id'] in inputs['paths']))
    return dict(cover=cover, notes=notes, table=table, open=open_, waived=waived, expired=expired)


# ------------------------------------------------------------------------------------------------------------------------- lesson map

def numbered_lessons():
    """{number: (id, title)} of the 18 syllabus lessons, from the lesson packs."""
    manifest = _json('web/lessons-manifest.json')
    found = {}
    for pack_path in manifest['packs']:
        for lesson in _json('web/' + pack_path.removeprefix('./'))['lessons']:
            number = lesson.get('sequenceNumber')
            if isinstance(number, int):
                found[number] = (lesson['id'], lesson['title'])
    return dict(sorted(found.items()))


def lesson_map(result):
    """A first, draft map of which R10 parts each of the 18 lessons needs and at which fidelity class.

    Parts come from the definitions' lesson mentions (counted in the lesson text by scripts/gtsio_part_authoring, up to four lessons per definition). What a lesson needs of a
    part depends on its focus (a draft judgement in fidelity-overrides.json): `operate` needs engineering fidelity (fits, motion, clearance) of the parts that are engineering;
    `identify` needs visual-structure fidelity (the shape students recognise); `concept` only names the part and needs none of the model's detail.
    """
    inputs = result['inputs']
    classes = {r['id']: r['class'] for r in result['parts']}
    placement = _json('web/gtsio520-r10-parts.json')['parts']
    members = defaultdict(list)
    for pid, (definition, _) in placement.items():
        members[definition].append(pid)
    definitions = {d['id']: d for d in _json('data/gtsio520-part-definitions.json')['definitions']}
    lessons = []
    needed = defaultdict(set)
    mentioned = set()
    for number, (lesson_id, title) in numbered_lessons().items():
        focus = inputs['lesson_focus'].get(str(number), {})
        entries = []
        for definition in definitions.values():
            for mention in definition['student'].get('lessons', []):
                if mention['lesson'] != number:
                    continue
                parts = sorted(members[definition['id']])
                tally = Counter(classes[p] for p in parts)
                if focus.get('focus') == 'operate':
                    need = 'engineering' if tally['engineering'] else 'visual-structure'
                elif focus.get('focus') == 'identify':
                    need = 'visual-structure'
                else:
                    need = 'none'
                entries.append(dict(definition=definition['id'], title=definition['student']['title']['text'], system=definition['student'].get('system'),
                                    mentions=mention['mentions'], parts=len(parts), classes={c: tally[c] for c in CLASSES if tally[c]}, needs=need))
                mentioned.update(parts)
                if need != 'none':
                    needed[need].update(parts)
        entries.sort(key=lambda e: (-e['mentions'], e['definition']))
        by_need = Counter()
        for e in entries:
            by_need[e['needs']] += e['parts']
        lessons.append(dict(lesson=number, id=lesson_id, title=title, focus=focus.get('focus', 'unset'), focus_note=focus.get('note', ''),
                            definitions=len(entries), parts=sum(e['parts'] for e in entries),
                            parts_by_need={k: by_need[k] for k in ('engineering', 'visual-structure', 'none') if by_need[k]}, needs=entries))
    return dict(schema='gtsio520-lesson-fidelity-map/1', status='draft', study='gtsio520-h-r10',
                note='Generated by python scripts/derive_fidelity_classes.py --write from web/gtsio520-r10-parts.json, data/gtsio520-part-definitions.json and the classes. The focus of '
                     'each lesson is a draft judgement in cad-studies/gtsio520-h-static/fidelity-overrides.json that the instructor has not reviewed.',
                needs_key={'engineering': 'fits, motion and clearance must be right (operate lessons)', 'visual-structure': 'the shape must be recognisable (identify lessons)',
                           'none': 'the lesson only names the part'},
                summary=dict(parts=len(placement), needed_at_engineering=len(needed['engineering']),
                             needed_at_visual_structure=len(needed['visual-structure'] - needed['engineering']),
                             mentioned_by_no_lesson=len(set(placement) - mentioned),
                             mentioned_only_by_concept_lessons=len(mentioned - needed['engineering'] - needed['visual-structure'])),
                lessons=lessons)


def lesson_map_text(data):
    """JSON with one part kind per line, so a change to the map reads as a change to a line."""
    head = {k: v for k, v in data.items() if k != 'lessons'}
    body = json.dumps(head, indent=1)[:-2]
    rows = []
    for lesson in data['lessons']:
        entries = ',\n'.join('    ' + json.dumps(e, separators=(',', ':')) for e in lesson['needs'])
        top = {k: v for k, v in lesson.items() if k != 'needs'}
        rows.append('  ' + json.dumps(top, separators=(',', ':'))[:-1] + ',"needs":[' + ('\n' + entries + '\n  ' if entries else '') + ']}')
    return body + ',\n "lessons": [\n' + ',\n'.join(rows) + '\n ]\n}\n'


# --------------------------------------------------------------------------------------------------------------------------------- report

def percent(n, total):
    return f'{100 * n / total:.0f}%' if total else '-'


def report_markdown(results, lesson_data):
    out = ['# Fidelity class report', '',
           'Generated by `python scripts/derive_fidelity_classes.py --write`; a record of the run, not maintained by hand. The rules, the signals and how to add an exception are in '
           '[fidelity-classes.md](fidelity-classes.md).', '']
    for result in results.values():
        inputs, cov = result['inputs'], result['coverage']
        cfg = inputs['cfg']
        c = counts(result)
        total = len(result['parts'])
        sources = [cfg['contract'], cfg['policy']] + inputs['audit_paths'] + cfg['inventories'] + ([cfg['mass_check']] if cfg.get('mass_check') else []) + [cfg['spec'], cfg['overrides']]
        out += [f'## {cfg["title"]}', '', 'Derived from ' + ', '.join(f'`{p}`' for p in sources) + '.', '',
                f'| Class | Parts | Share | Features (spec known for {c["parts_with_known_features"]} parts) |', '|---|---|---|---|']
        for cl in CLASSES:
            out.append(f'| {cl} | {c["parts"][cl]} | {percent(c["parts"][cl], total)} | {c["features"][cl]} |')
        out += ['', 'Why the engineering parts are engineering (the set of signals each has):', '', '| Signals | Parts |', '|---|---|']
        combos = Counter(' + '.join(sorted({w.split(':')[0] for w in r['why']})) for r in result['parts'] if r['class'] == 'engineering')
        for combo, n in combos.most_common():
            out.append(f'| {combo} | {n} |')
        out += ['', f'Signals present in the records: {len(inputs["moving"])} moving parts, {len(inputs["gear"])} gear parts, {len(inputs["ledger"])} parts in the interference ledger, '
                   f'{len(inputs["mass"])} parts in a mass-check line, {len(inputs["paths"])} parts on a mechanism path of the inventory. Overrides applied: {len(result["overrides_applied"])}.', '']
        spec = _json(cfg['spec'])
        dressups = sum(len(p.get('dressups', [])) for p in spec['parts'])
        if c['parts']['cosmetic'] == 0:
            out += [f'No cosmetic part or feature is modelled yet: no feature label names a chamfer, edge break, blend, texture or lettering, and the spec holds {dressups} fillet '
                    f'dressup{"s" if dressups != 1 else ""} (a dressup takes the class of its part). The class exists for the casting spike (B8) and any display skin; it is derived '
                    'only from a label that names one, or from an override.', '']
        out += ['### Audit coverage by class', '',
                "A gate covers a part only when its audit record was run on the study's present asset (same SHA-256) and audited every part. Moving parts also need a swept audit of "
                'a baked clip; meshed parts need their declared gear-mesh clearance measured.', '',
                '| Class | Parts | Rest-pose audit | Moving | Swept clip | Meshed | Gear clearance | In a mass-check line | On a mechanism path |', '|---|---|---|---|---|---|---|---|---|']
        for cl in CLASSES:
            t = cov['table'][cl]
            out.append(f'| {cl} | {t["parts"]} | {t["rest"]} | {t["moving"]} | {t["clip"]} | {t["meshed"]} | {t["gear"]} | {t["mass_line"]} | {t["on_path"]} |')
        out.append('')
        for note in cov['notes']:
            out.append(f'- Audit record not counted: {note}.')
        if inputs['mass_check']:
            lines = inputs['mass_check']['lines']
            outside = [f'{l["line"]} ({l["ratio"]})' for l in lines if not 0.85 <= l['ratio'] <= 1.15]
            out.append(f'- Mass check: {len(lines)} lines, engine {inputs["mass_check"]["engine_g"]:.0f} g; outside the 15 percent limit: {", ".join(outside) or "none"}.')
        if cov['open'] or cov['waived'] or cov['expired']:
            by_gate = Counter(g for _, g in cov['waived'])
            out.append(f'- Engineering parts missing a required gate: {len(cov["open"])} open, {len(cov["waived"])} accepted by a waiver for this asset '
                       f'({", ".join(f"{g}: {n}" for g, n in sorted(by_gate.items())) or "none"}), {len(cov["expired"])} expired waiver(s).')
        else:
            out.append('- Every engineering part is covered by every gate it needs.')
        out += ['', '### Tessellation tiers the classes would imply (B1, not applied)', '']
        setting = spec.get('tessellation', {})
        default, groups = setting.get('default_mm'), setting.get('groups', {})
        if groups:
            group_of = {p['id']: p['group'] for p in spec['parts']}
            tiers = Counter((r['class'], groups.get(group_of.get(r['id']), default)) for r in result['parts'])
            out += ['| Class | Parts at each linear deflection today |', '|---|---|']
            for cl in CLASSES:
                row = ', '.join(f'{d} mm: {n}' for (k, d), n in sorted(tiers.items(), key=lambda kv: kv[0][1]) if k == cl)
                out.append(f'| {cl} | {row or "-"} |')
            coarsest = max([default] + list(groups.values()))
            at_coarsest = tiers[('engineering', coarsest)]
            out += ['', f'The tiers follow the part group today, not the class: the default is {default} mm and the coarsest tier is {coarsest} mm. {at_coarsest} engineering parts '
                        f'({percent(at_coarsest, c["parts"]["engineering"])} of them) sit at the coarsest tier, so tiers by class would make them finer and cost size, while the other '
                        'classes could take the coarsest tier. Where an engineering part is engineering only by membership of a mass-check line, B1 should weigh that signal first. '
                        'Nothing is changed here; B1 measures the size saved and the audit effect.', '']
        else:
            out += [f'Every part is tessellated at one linear deflection ({default} mm). Engineering parts keep it; visual-structure and cosmetic parts could move to a coarser tier, and '
                    'B1 measures the size saved and the audit effect before anything is changed. The Langley study already uses 0.02 to 0.4 mm by group.', '']
    if lesson_data:
        s = lesson_data['summary']
        out += ['## Lesson map for the R10 model (draft)', '',
                f'`data/gtsio520-lesson-fidelity-map.json`, status **{lesson_data["status"]}**. Of {s["parts"]} R10 parts, {s["needed_at_engineering"]} are needed at engineering fidelity by an '
                f'operate lesson, {s["needed_at_visual_structure"]} more at visual-structure fidelity by an identify lesson, and {s["mentioned_by_no_lesson"]} are named in no lesson text '
                f'({s["mentioned_only_by_concept_lessons"]} more only in concept lessons). Mentions come from the lesson text and keep the top four lessons per part kind, so a part kind '
                'used in a fifth lesson is understated.', '',
                '| Lesson | Focus | Part kinds | Parts | Needed at engineering | Needed at visual-structure | Named only |', '|---|---|---|---|---|---|---|']
        for lesson in lesson_data['lessons']:
            b = lesson['parts_by_need']
            out.append(f'| {lesson["lesson"]}. {lesson["title"]} | {lesson["focus"]} | {lesson["definitions"]} | {lesson["parts"]} | {b.get("engineering", 0)} | '
                       f'{b.get("visual-structure", 0)} | {b.get("none", 0)} |')
        out += ['', 'Where the effort pays: identify lessons (parts and construction, practicals, maintenance, cooling) need the exterior shapes that are visual-structure, such as the '
                    'crankcase and covers; operate lessons (cycles, valve operating, power generation, accessories) need the fits and motion that are engineering.', '']
    out += ['## What this report does not show', '',
            '- The R10 part-spec with all 1,396 parts is a build output outside Git, so feature classes cover only the foundation parts whose spec is kept. Pass the full spec to extend it.',
            '- No structured interface ledger exists: the inventories keep interfaces as free text, so the nearest structured record, the mechanism paths of the inventory, is used. Pairs closer '
            'than the clearance limit are not in any record (the audit counts neighbouring pairs but does not list them); listing them is the next step for the audit.',
            '- The mass-check signal is membership of a line, not sensitivity: a line is checked to 15 percent, so a small part in a line can change without moving the check. Per-part volumes '
            'would let the signal weigh by share; they are not kept in Git.', '']
    return '\n'.join(out)
