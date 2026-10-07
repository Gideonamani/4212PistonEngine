"""How much do the Wright and Langley builder families duplicate each other? A read-only measurement for Phase B.

Reads cad_pipeline/ (wright_*, langley_*, rig_*, audit_wright_v2) and the committed part-spec.json of both studies. Standard library
only; it changes nothing. Run it before and after an extraction and compare: the numbers in docs/builder-overlap-audit.md are its output.

    python scripts/audit_builder_overlap.py            # the report
    python scripts/audit_builder_overlap.py --json out.json
"""
import ast
import difflib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CP = ROOT / 'cad_pipeline'
WRIGHT = sorted(p.stem for p in CP.glob('wright_*.py')) + ['rig_wright', 'audit_wright_v2']
LANGLEY = sorted(p.stem for p in CP.glob('langley_*.py')) + ['rig_langley']
STUDIES = {'wright': 'cad-studies/wright-1903/revision-2/part-spec.json', 'langley': 'cad-studies/langley-manly-balzer-1903/part-spec.json'}

# Part families of docs/ai-mechanical-engineer.md section 4a, by part id. Sprockets are listed apart: only Wright has them.
FAMILY = {
    'piston': r'^(Piston\d|WristPin\d|PinLock\d|Ring\d_\d|RingPeg\d_\d|PistonRing\d_\d|GudgeonPin\d|PinRetainer\d_\w)$',
    'connecting rod': r'^(RodTube|BigEnd|BigCap|BigShim|BigLock|LittleEnd|LittleClamp|BigBolt[AB]|RodPin[AB]|MasterRod|MasterSleeveCap|MasterLining(Upper|Lower)|LinkRod|LinkShoe|WristBush|ConeNut(Port|Stbd)|JamNut(Port|Stbd))\d*$',
    'valve': r'^((Intake|Exhaust)(Head|Stem|Cage|Retainer|Spring|SpringWasher)\d|InletValve\d|ExhaustValve\d|InletSpring\w*\d|ExhaustSpring\w*\d|InletSeat\d|InletNut\d)$',
    'cam': r'^(Camshaft|CamWasher[AB]|ExhaustCam\d|CamRing|IgnitionCam\d|SparkerCam|CamBearing\d|CamRoller\d|ValveRoller\d|PunchRod\d|PunchRoller\d)$',
    'spur/bevel gear': r'^(ExhaustGear|IgnitionGear|CamPinion|CamGearLarge|CamGearSmall|CamIdler|SparkPinion|SparkGearLarge|WormWheel|PumpBevelGear|PumpBevelPinion|OilPumpGear\d)$',
    'sprocket': r'^(CrankSprocket|CamSprocket)$',
}
STRUCTURAL_THRESHOLD = 0.75
MAX_NODES = 2500


def _strip_doc(node):
    if node.body and isinstance(node.body[0], ast.Expr) and isinstance(getattr(node.body[0], 'value', None), ast.Constant) and isinstance(node.body[0].value.value, str):
        node = ast.parse(ast.unparse(node)).body[0]
        node.body = node.body[1:] or [ast.Pass()]
    return node


def functions(stem):
    tree = ast.parse((CP / f'{stem}.py').read_text(encoding='utf-8'))
    out = []
    for n in ast.walk(tree):
        if isinstance(n, ast.FunctionDef) and n.end_lineno - n.lineno + 1 >= 2:
            f = _strip_doc(n)
            out.append(dict(file=stem, name=n.name, line=n.lineno, lines=n.end_lineno - n.lineno + 1,
                            shape=[type(x).__name__ for x in ast.walk(f)], named=[ast.dump(x, annotate_fields=False)[:40] for x in ast.walk(f)], text=ast.unparse(f)))
    return out


def ratio(a, b):
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return sm.ratio() if sm.real_quick_ratio() >= 0.7 and sm.quick_ratio() >= 0.7 else 0.0


def cross_family_pairs():
    fw = [f for s in WRIGHT for f in functions(s)]
    fl = [f for s in LANGLEY for f in functions(s)]
    pairs = []
    for a in fw:
        for b in fl:
            if max(len(a['shape']), len(b['shape'])) > MAX_NODES:
                continue
            rs = ratio(a['shape'], b['shape'])
            if rs >= STRUCTURAL_THRESHOLD:
                pairs.append(dict(structural=round(rs, 2), named=round(ratio(a['named'], b['named']), 2), wright=f"{a['file']}.{a['name']}", wright_lines=a['lines'],
                                  langley=f"{b['file']}.{b['name']}", langley_lines=b['lines'], identical=a['text'] == b['text']))
    pairs.sort(key=lambda p: (-p['structural'], p['wright']))
    return fw, fl, pairs


def imports(stems):
    found = set()
    for stem in stems:
        for n in ast.walk(ast.parse((CP / f'{stem}.py').read_text(encoding='utf-8'))):
            if isinstance(n, ast.ImportFrom) and n.module and n.module.startswith('cad_pipeline'):
                for a in n.names:
                    found.add(f'{n.module}.{a.name}' if n.module == 'cad_pipeline' else n.module)
            elif isinstance(n, ast.Import):
                found.update(a.name for a in n.names if a.name == 'gear_geometry')
            elif isinstance(n, ast.ImportFrom) and n.module == 'gear_geometry':
                found.add('gear_geometry')
    # gear_geometry is imported as `import gear_geometry as G` after a sys.path edit
    if any('gear_geometry' in (CP / f'{s}.py').read_text(encoding='utf-8') for s in stems):
        found.add('gear_geometry')
    return found


def own_family(name):
    return bool(re.match(r'cad_pipeline(\.|$)', name)) and bool(re.search(r'(wright|langley)_', name))


def hand_written_dicts():
    out = {}
    for stem in WRIGHT + LANGLEY:
        n = len(re.findall(r"dict\(\s*primitive\s*=|\{\s*'primitive'", (CP / f'{stem}.py').read_text(encoding='utf-8')))
        if n:
            out[stem] = n
    return out


def constructors():
    out = []
    for stem in WRIGHT + LANGLEY:
        for n in ast.walk(ast.parse((CP / f'{stem}.py').read_text(encoding='utf-8'))):
            if isinstance(n, ast.FunctionDef) and n.name != 'add':
                src = ast.unparse(n)
                m = re.search(r"primitive\s*=\s*'(\w+)'|'primitive':\s*'(\w+)'", src)
                if m and len(src) < 700:
                    out.append(f'{stem}.{n.name} -> {m.group(1) or m.group(2)}')
    return out


def _has_expr(v):
    if isinstance(v, str):
        return bool(re.search(r'[A-Za-z_]', v))
    return isinstance(v, (list, tuple)) and any(_has_expr(x) for x in v)


def study_sizes():
    out = {}
    for key, rel in STUDIES.items():
        spec = json.loads((ROOT / rel).read_text(encoding='utf-8'))
        feats = [f for p in spec['parts'] for f in p['features']]
        info = dict(parts=len(spec['parts']), features=len(feats), vocabulary=dict(Counter(f['primitive'] for f in feats)),
                    derived_profile_features=sum(1 for f in feats if f.get('derived')),
                    expression_features=sum(1 for f in feats if any(_has_expr(v) for k, v in f.items() if k not in ('label', 'operation', 'primitive'))),
                    parameters=len(spec['parameters']), families={})
        for fam, pat in FAMILY.items():
            ps = [p for p in spec['parts'] if re.match(pat, p['id'])]
            info['families'][fam] = dict(parts=len(ps), features=sum(len(p['features']) for p in ps))
        out[key] = info
    return out


def main():
    fw, fl, pairs = cross_family_pairs()
    iw, il = imports(WRIGHT), imports(LANGLEY)
    shared = sorted(x for x in iw & il if not own_family(x))
    result = dict(function_counts=dict(wright=len(fw), langley=len(fl)), cross_family_pairs=pairs, identical_pairs=sum(1 for p in pairs if p['identical']),
                  near_identical_pairs=sum(1 for p in pairs if p['structural'] >= 0.95), shared_imports=shared,
                  cross_family_imports=[x for x in iw if 'langley' in x] + [x for x in il if 'wright' in x],
                  hand_written_feature_dicts=hand_written_dicts(), feature_constructors=constructors(), studies=study_sizes())
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(result, indent=1) + '\n')
    print(f"functions of 2+ lines: wright family {len(fw)}, langley family {len(fl)}")
    print(f"cross-family pairs with structural similarity >= {STRUCTURAL_THRESHOLD}: {len(pairs)}; identical source: {result['identical_pairs']}; >= 0.95: {result['near_identical_pairs']}")
    for p in pairs:
        if p['structural'] >= 0.9:
            print(f"  {p['structural']:.2f} {'IDENTICAL' if p['identical'] else '         '} {p['wright']} ({p['wright_lines']} lines) <-> {p['langley']} ({p['langley_lines']} lines)")
    print('shared by both families (outside them):', shared)
    print('imports of one family by the other:', result['cross_family_imports'] or 'none')
    print('hand-written feature dicts per file:', result['hand_written_feature_dicts'])
    print('feature-constructor helpers:', len(result['feature_constructors']))
    for line in result['feature_constructors']:
        print('  ', line)
    for key, info in result['studies'].items():
        print(f"{key}: {info['parts']} parts, {info['features']} features, {info['expression_features']} with expression strings, {info['derived_profile_features']} derived profiles, {info['parameters']} parameters")
        for fam, v in info['families'].items():
            print(f"    {fam:16s} {v['parts']:4d} parts {v['features']:4d} features ({v['features'] / info['features']:5.1%})")


if __name__ == '__main__':
    main()
