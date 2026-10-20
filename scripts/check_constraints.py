"""Run the closure checks of one or every engine study.

    python scripts/check_constraints.py cad-studies/gtsio520-h-static/constraints.json
    python scripts/check_constraints.py --all [--quiet]
    python scripts/check_constraints.py cad-studies/langley-manly-balzer-1903/constraints.json --volumes build/dev/out358/geometry.json

Exit status 1 if any check fails or a file is malformed. `unknown` and `accepted` checks are listed and do not fail the run (--strict-unknown makes unknown fail).
--volumes <geometry.json> supplies per-part volumes for a mass check on a machine that has the build output; --json <path> writes the report.
Schema: cad_pipeline/schemas/constraints.schema.json. Guide: docs/constraints.md.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cad_pipeline import constraints as C


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('constraints', nargs='*', type=Path)
    p.add_argument('--all', action='store_true', help='every cad-studies/*/constraints.json')
    p.add_argument('--volumes', type=Path, help='geometry.json with per-part volume_mm3 and material, for mass checks')
    p.add_argument('--json', type=Path, help='write the report here')
    p.add_argument('--quiet', action='store_true', help='list only checks that are not passing')
    p.add_argument('--strict-unknown', action='store_true', help='treat unknown as failure')
    a = p.parse_args(argv)
    files = list(a.constraints) + (sorted((ROOT / 'cad-studies').glob('*/constraints.json')) if a.all else [])
    if not files:
        p.error('name a constraints.json or pass --all')
    reports, bad = [], False
    for f in files:
        try:
            report = C.run(C.load(f), ROOT, a.volumes)
        except C.ConstraintError as e:
            print(f'{f}: malformed: {e}')
            bad = True
            continue
        print(C.render(report, a.quiet))
        reports.append(report)
        bad = bad or not report['ok'] or (a.strict_unknown and report['counts']['unknown'] > 0)
    if a.json:
        a.json.write_text(json.dumps(reports if len(reports) != 1 else reports[0], indent=1) + '\n', encoding='utf-8')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
