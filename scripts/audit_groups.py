"""Group an interference audit's overlaps by part type (digits folded): python scripts/audit_groups.py audit.json [--top N]"""
import json, re, sys, collections
a = json.load(open(sys.argv[1]))
items = a['new_violations'] + a['known_defects']
norm = lambda s: re.sub(r'\d+', '#', s)
g = collections.defaultdict(list)
for i in items:
    g[tuple(sorted((norm(i['a']), norm(i['b']))))].append((i['a'], i['b'], i['max_overlap_mm3'], i['max_thickness_mm']))
print(len(items), 'overlapping pairs;', a['rest_neighbouring_pairs'], 'neighbouring pairs checked;', a['rest_touching_only'], 'touching only')
for k, v in sorted(g.items(), key=lambda kv: -max(x[2] for x in kv[1]))[:int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 60]:
    print(f'{k[0]:24s} {k[1]:24s} n={len(v):2d} vol={max(x[2] for x in v):9.2f} thick={max(x[3] for x in v):5.2f}  e.g. {v[0][0]} / {v[0][1]}')
