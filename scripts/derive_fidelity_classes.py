"""Derive the fidelity class (engineering, visual-structure, cosmetic) of every part of the R10 and Langley studies, and report what the gates cover.

    python scripts/derive_fidelity_classes.py                  check: the committed classes are what the records derive, no engineering part lacks a gate
    python scripts/derive_fidelity_classes.py --write          rewrite each study's fidelity-classes.json, docs/fidelity-class-report.md and the draft lesson map
    python scripts/derive_fidelity_classes.py --gaps           list the engineering parts that still lack a gate, and which waiver accepts them
    python scripts/derive_fidelity_classes.py --study NAME     one study only (langley-manly-balzer-1903, gtsio520-h-r10)

Standard library only. Exit status 1 when the committed classes are stale, an override or waiver is malformed, a declared class is lower than the derived one, or an
engineering part lacks a gate that no waiver for the present asset accepts. See docs/fidelity-classes.md.
"""
import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from cad_pipeline import fidelity as fc
from cad_pipeline import fidelity_report as report

LESSON_MAP = 'data/gtsio520-lesson-fidelity-map.json'
REPORT = 'docs/fidelity-class-report.md'


def derive_all(names):
    results = {}
    for name in names:
        result = fc.derive(name)
        result['coverage'] = report.coverage(result)
        results[name] = result
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--study', choices=sorted(fc.STUDIES), action='append')
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--gaps', action='store_true')
    args = parser.parse_args()
    names = args.study or sorted(fc.STUDIES)
    results = derive_all(names)
    lessons = report.lesson_map(results['gtsio520-h-r10']) if 'gtsio520-h-r10' in results else None
    problems = []
    for name, result in results.items():
        cfg, cov = fc.STUDIES[name], result['coverage']
        counts = fc.counts(result)
        print(f'{name}: ' + ', '.join(f'{c} {n}' for c, n in counts['parts'].items()) + f' ({counts["parts_with_known_features"]} parts with features known)')
        problems += [f'{name}: {c}' for c in result['conflicts']]
        if args.write:
            fc.write_text(cfg['classes'], fc.sidecar_text(name, result))
        else:
            committed = json.loads((REPO / cfg['classes']).read_text(encoding='utf-8')) if (REPO / cfg['classes']).is_file() else None
            fresh = json.loads(fc.sidecar_text(name, result))
            if committed != fresh:
                problems.append(f'{name}: {cfg["classes"]} is stale; run with --write')
        for part, gate in cov['open']:
            problems.append(f'{name}: engineering part {part} has no current {gate} gate coverage and no waiver for this asset')
        for note in cov['notes']:
            print(f'  audit record not counted: {note}')
        print(f'  gate gaps: {len(cov["open"])} open, {len(cov["waived"])} waived, {len(cov["expired"])} expired waiver(s)')
        if args.gaps:
            for part, gate in cov['open'] + cov['waived']:
                print(f'    {part}: {gate}' + ('  (waived)' if (part, gate) in cov['waived'] else ''))
    if args.write:
        fc.write_text(REPORT, report.report_markdown(results, lessons))
        if lessons:
            fc.write_text(LESSON_MAP, report.lesson_map_text(lessons))
        print(f'wrote the classes, {REPORT} and {LESSON_MAP}')
    for problem in problems:
        print('PROBLEM', problem)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
