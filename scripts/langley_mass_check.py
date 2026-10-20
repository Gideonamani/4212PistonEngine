"""Mass of the built Langley model against Manly's weight table (M1 p. 250): the strongest check of shape that does not depend on a drawing.

    python scripts/langley_mass_check.py build/dev/out358/geometry.json [--json out.json]

Each part is assigned to a weight-table line by its ID; parts that the table does not list (bed plates, starter, pump drive, shaft stubs, flange bolts) are reported
separately. Densities are those of the part's material category. A line within +/-15 percent is "close"; the engine total is compared with 56,323 g.

The weight table, the densities and the tolerances now live in cad-studies/langley-manly-balzer-1903/constraints.json (check `mass-by-weight-line`) and the arithmetic in
cad_pipeline/constraints.py (`mass_report`), the generic runner every study uses (`python scripts/check_constraints.py`). This script keeps the original command line, console
output and mass-check.json format, and still exports LINES, DENSITY and ENGINE_LINES for cad_pipeline/fidelity.py.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cad_pipeline import constraints as C

DOC = C.load(ROOT / 'cad-studies/langley-manly-balzer-1903/constraints.json')
CHECK = next(c for c in DOC['checks'] if c['id'] == 'mass-by-weight-line')
DENSITY = CHECK['densities_g_cm3']
LINES = [(g['id'], g['published']['value'], g['patterns'][0]) for g in CHECK['groups']]      # weight-table id, grams, id pattern
TOTAL = CHECK['totals'][0]
ENGINE_LINES = set(TOTAL['groups'])
TABLE_TOTAL = TOTAL['published']['value']


def main():
    p = argparse.ArgumentParser()
    p.add_argument('geometry', type=Path)
    p.add_argument('--json', type=Path)
    a = p.parse_args()
    parts = json.loads(a.geometry.read_text())['parts']
    rep = C.mass_report(CHECK, parts)
    grams, other = rep['grams'], rep['unassigned_g']
    report = []
    print(f"{'line':8s} {'model g':>10s} {'table g':>10s} {'ratio':>7s}")
    for key, target, _ in LINES:
        ratio = grams[key] / target
        report.append(dict(line=key, model_g=round(grams[key], 1), table_g=target, ratio=round(ratio, 3)))
        print(f'{key:8s} {grams[key]:10.0f} {target:10d} {ratio:7.2f}' + ('' if 0.85 <= ratio <= 1.15 else '   <-- outside +/-15 %'))
    engine = sum(grams[k] for k in TOTAL['groups'])
    print(f"{'engine':8s} {engine:10.0f} {TABLE_TOTAL:10d} {engine / TABLE_TOTAL:7.2f}   (table total; lines W01-W13)")
    print('not in the table (g):', sum(other.values()).__round__(0), ' largest:', sorted(other.items(), key=lambda kv: -kv[1])[:8])
    if a.json:
        a.json.write_text(json.dumps(dict(lines=report, engine_g=round(engine, 1), unassigned_g=other), indent=1) + '\n')


if __name__ == '__main__':
    main()
