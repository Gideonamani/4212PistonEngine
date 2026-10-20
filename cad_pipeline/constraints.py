"""Closure checks and global constraints for an engine study: one generic runner, one `constraints.json` per study.

The study's published figures (bore, stroke, displacement, firing order, drive ratios, rated power and speed, weights) must agree with each other, and the model's
own numbers (spec parameters, gear tooth counts, crank pins, motion code) must agree with them. This is what caught the Langley oil cup (2.4 kg against 0.1 kg). The
framework moves those checks out of hand-written scripts: a study lists its checks as data, each with its source locator and tolerance, and this module evaluates them.

A check ends in one of four states (an input that must come from the repository and no longer resolves is a `fail`, unless its binding is `optional`):

    pass      the computed figure is within the stated tolerance of the published one
    fail      it is not (the run fails)
    accepted  it fails, and the check carries an `accepted` record with a reason; reported, does not fail the run. If the check later passes, the stale record fails
              the run so it gets removed (the same ratchet as interference-policy.json)
    unknown   it cannot be evaluated: no source figure was found, the model-side input is not in Git, or a check it `requires` did not pass. A legal state: the reason
              is printed and nothing is invented

Check kinds: compare, displacement, power (PLANK), ratio, formula, sequence, firing-intervals, tdc, numbering, rotation, mass. Schema: cad_pipeline/schemas/constraints.schema.json;
guide: docs/constraints.md. Standard library only, so CI, FreeCAD's Python and Blender's Python can all run it. constraints.json is trusted repository data (a `python` binding
imports repository modules), not user input.

Run: python scripts/check_constraints.py cad-studies/<study>/constraints.json [--volumes geometry.json] [--json out.json]
"""
import ast
import importlib
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 'constraints/1'
STATES = ('pass', 'fail', 'accepted', 'unknown')
KINDS = ('compare', 'displacement', 'power', 'ratio', 'formula', 'sequence', 'firing-intervals', 'tdc', 'numbering', 'rotation', 'mass')
BINDING_KINDS = ('json', 'regex', 'python')
PARSES = ('int', 'float', 'int-list', 'float-list', 'str')

UNITS = {}


def _family(name, **units):
    for unit, factor in units.items():
        UNITS[unit] = (name, factor)


_family('length', mm=1.0, cm=10.0, m=1000.0, **{'in': 25.4, 'ft': 304.8})
_family('area', mm2=1.0, cm2=100.0, m2=1e6, in2=645.16)
_family('volume', mm3=1.0, cm3=1000.0, L=1e6, in3=16387.064, **{'cu in': 16387.064})
_family('mass', g=1.0, kg=1000.0, lb=453.59237, oz=28.349523125)
_family('power', W=1.0, kW=1000.0, hp=745.69987158227022)       # 33,000 ft lbf/min
_family('pressure', Pa=1.0, kPa=1000.0, MPa=1e6, psi=6894.757293168361)
_family('speed', rpm=1.0)
_family('angle', deg=1.0, rad=180.0 / math.pi)
_family('ratio', ratio=1.0)


class Unresolved(Exception):
    """An input could not be found or computed: the check is `unknown`, not wrong."""


class BindingError(Unresolved):
    """A value the check reads from the repository no longer resolves (file moved, module raises, pattern gone). That is drift, not absence: the check FAILS unless the
    binding is declared `optional` (a build output that Git does not hold), in which case it is unknown."""

    def __init__(self, message, optional=False):
        super().__init__(message)
        self.optional = optional


class ConstraintError(Exception):
    """The constraints file itself is malformed."""


# ---------------------------------------------------------------------------------------------------------------------------- safe arithmetic

def _deep_col(x, i):
    if x and isinstance(x[0], (int, float)):
        return x[i]
    return [_deep_col(e, i) for e in x]


def _flat(x):
    return [y for e in x for y in (_flat(e) if isinstance(e, list) else [e])] if isinstance(x, list) else [x]


FUNCTIONS = dict(sqrt=math.sqrt, sin=math.sin, cos=math.cos, tan=math.tan, atan2=math.atan2, degrees=math.degrees, radians=math.radians, abs=abs, min=min, max=max,
                 sum=sum, len=len, round=round, mean=lambda x: sum(x) / len(x), col=_deep_col, flat=_flat,
                 shift=lambda x, c: [v + c for v in x], maxdiff=lambda a, b: max(abs(p - q) for p, q in zip(a, b)),
                 maxsum=lambda a, b: max(abs(p + q) for p, q in zip(a, b)),          # the same comparison across a reflection: equal in magnitude, opposite in sign
                 sign=lambda v: (v > 0) - (v < 0), allclose=lambda a, b, t: all(abs(p - q) <= t for p, q in zip(a, b)))
BINARY = {ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b, ast.Div: lambda a, b: a / b, ast.Pow: lambda a, b: a ** b,
          ast.Mod: lambda a, b: a % b, ast.FloorDiv: lambda a, b: a // b}
COMPARE = {ast.Lt: lambda a, b: a < b, ast.LtE: lambda a, b: a <= b, ast.Gt: lambda a, b: a > b, ast.GtE: lambda a, b: a >= b, ast.Eq: lambda a, b: a == b,
           ast.NotEq: lambda a, b: a != b}


def safe_eval(expr, env):
    """Evaluate arithmetic, comparisons and the whitelisted FUNCTIONS over `env`; nothing else (no attributes, no imports, no comprehensions)."""
    def go(n):
        if isinstance(n, ast.Expression):
            return go(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float, bool, str)):
            return n.value
        if isinstance(n, ast.Name):
            if n.id == 'pi':
                return math.pi
            if n.id in env:
                return env[n.id]
            raise ConstraintError(f'unknown name {n.id!r} in {expr!r}')
        if isinstance(n, ast.BinOp) and type(n.op) in BINARY:
            return BINARY[type(n.op)](go(n.left), go(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd, ast.Not)):
            v = go(n.operand)
            return -v if isinstance(n.op, ast.USub) else v if isinstance(n.op, ast.UAdd) else not v
        if isinstance(n, ast.BoolOp):
            vals = [go(v) for v in n.values]
            return all(vals) if isinstance(n.op, ast.And) else any(vals)
        if isinstance(n, ast.Compare) and all(type(o) in COMPARE for o in n.ops):
            left = go(n.left)
            for op, right in zip(n.ops, n.comparators):
                right_v = go(right)
                if not COMPARE[type(op)](left, right_v):
                    return False
                left = right_v
            return True
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in FUNCTIONS and not n.keywords:
            return FUNCTIONS[n.func.id](*[go(a) for a in n.args])
        if isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Constant) and isinstance(n.slice.value, int):
            return go(n.value)[n.slice.value]
        if isinstance(n, (ast.List, ast.Tuple)):
            return [go(e) for e in n.elts]
        raise ConstraintError(f'expression element not allowed: {ast.dump(n)[:60]} in {expr!r}')
    try:
        return go(ast.parse(expr, mode='eval'))
    except SyntaxError as e:
        raise ConstraintError(f'bad expression {expr!r}: {e}')


# ---------------------------------------------------------------------------------------------------------------------------- selecting values

SEGMENT = re.compile(r'^([^\[\]]*)\[(\w+)(==|=|\^=)(.*)\]$')


def _plain(x):
    if isinstance(x, (tuple, list)):
        return [_plain(e) for e in x]
    if isinstance(x, dict):
        return {str(k): _plain(v) for k, v in x.items()}
    return x


def select(obj, path):
    """Walk `a/b[field=value]/c`. `[f=v]` picks the first list item whose field equals v, `[f==v]` every such item, `[f^=v]` every item whose field starts with v.
    A name applied to a list maps over it (items that lack the key are skipped); a number indexes a list."""
    def walk(o, segs):
        if not segs:
            return o
        seg, rest = segs[0], segs[1:]
        m = SEGMENT.match(seg)
        if m:
            key, field, op, val = m.groups()
            seq = walk_key(o, key) if key else o
            hits = [x for x in seq if isinstance(x, dict) and (str(x.get(field)) == val if op in ('=', '==') else str(x.get(field, '')).startswith(val))]
            if op == '=':
                if not hits:
                    raise Unresolved(f'no item with {field}={val!r} in {key or "list"}')
                return walk(hits[0], rest)
            return [r for r in (try_walk(h, rest) for h in hits) if r is not _MISSING]
        return walk(walk_key(o, seg), rest)

    def walk_key(o, seg):
        if isinstance(o, list):
            if seg.isdigit():
                try:
                    return o[int(seg)]
                except IndexError:
                    raise Unresolved(f'index {seg} out of range')
            return [r for r in (try_walk(e, [seg]) for e in o) if r is not _MISSING]
        if isinstance(o, dict):
            if seg in o:
                return o[seg]
            raise Unresolved(f'no key {seg!r}')
        raise Unresolved(f'cannot take {seg!r} of {type(o).__name__}')

    def try_walk(o, segs):
        try:
            return walk(o, segs)
        except Unresolved:
            return _MISSING

    return walk(obj, [s for s in str(path).split('/') if s != ''])


_MISSING = object()


class Context:
    """Resolves bindings (values read from the repository) and value references; remembers check results for `requires`."""

    def __init__(self, doc, root=ROOT, volumes=None):
        self.doc, self.root, self.volumes = doc, Path(root), volumes
        self._files, self._bound, self.results = {}, {}, {}
        for p in doc.get('python_path', []):
            full = str(self.root / p)
            if full not in sys.path:
                sys.path.insert(0, full)

    # files ---------------------------------------------------------------------------------------------------------------------------
    def text(self, rel):
        full = self.root / rel
        if not full.exists():
            raise Unresolved(f'{rel} not found')
        if rel not in self._files:
            self._files[rel] = full.read_text(encoding='utf-8')
        return self._files[rel]

    def json(self, rel):
        key = ('json', rel)
        if key not in self._files:
            try:
                self._files[key] = json.loads(self.text(rel))
            except ValueError as e:
                raise Unresolved(f'{rel} is not JSON: {e}')
        return self._files[key]

    # bindings ------------------------------------------------------------------------------------------------------------------------
    def bound(self, name):
        if name not in self._bound:
            b = self.doc.get('bindings', {}).get(name)
            if b is None:
                raise ConstraintError(f'no binding named {name!r}')
            try:
                self._bound[name] = ('ok', self._resolve_binding(b))
            except Unresolved as e:
                self._bound[name] = ('err', str(e))
        status, value = self._bound[name]
        if status == 'err':
            raise BindingError(f'binding {name}: {value}', bool(self.doc['bindings'][name].get('optional')))
        return value

    def _resolve_binding(self, b):
        kind = b['kind']
        if kind == 'json':
            v = self.json(b['path'])
            return _plain(select(v, b['select'])) if b.get('select') else _plain(v)
        if kind == 'regex':
            m = re.search(b['pattern'], self.text(b['path']), re.M)
            if not m:
                raise Unresolved(f'pattern {b["pattern"]!r} no longer matches in {b["path"]}')
            raw = m.group(1) if m.groups() else m.group(0)
            return parse_value(raw, b.get('parse', 'str'))
        if kind == 'python':
            try:
                obj = importlib.import_module(b['module'])
            except Exception as e:                          # the module may need a tool this environment lacks
                raise Unresolved(f'cannot import {b["module"]}: {type(e).__name__}: {e}')
            try:
                for part in b['attr'].split('.'):
                    obj = getattr(obj, part)
                if 'args' in b or 'foreach' in b or b.get('call'):
                    def call(item):
                        r = obj(*[item if a == '$' else a for a in b.get('args', [])])
                        return select(_plain(r), b['path']) if b.get('path') else _plain(r)
                    return [call(i) for i in b['foreach']] if 'foreach' in b else call(None)
            except (AttributeError, TypeError, KeyError, ValueError) as e:
                raise Unresolved(f'{b["module"]}.{b["attr"]}: {type(e).__name__}: {e}')
            v = _plain(obj)
            return select(v, b['path']) if b.get('path') else v
        raise ConstraintError(f'unknown binding kind {kind!r}')

    # value references ----------------------------------------------------------------------------------------------------------------
    def ref(self, r):
        """-> (value, unit or None, locator text or None) for a literal, {"value","unit"} or {"bind"}."""
        if isinstance(r, dict) and 'bind' in r:
            b = self.doc['bindings'][r['bind']]
            return self.bound(r['bind']), r.get('unit', b.get('unit')), r.get('locator', b.get('locator'))
        if isinstance(r, dict) and 'value' in r:
            return r['value'], r.get('unit'), r.get('locator')
        return r, None, None

    def value(self, r):
        return self.ref(r)[0]

    def qty(self, r, family):
        """A quantity in the base unit of `family` (mm, mm3, g, W, Pa, rpm, deg, 1)."""
        value, unit, _ = self.ref(r)
        if unit is None:
            if family in ('ratio', 'speed', 'angle') and isinstance(value, (int, float)):
                unit = {'ratio': 'ratio', 'speed': 'rpm', 'angle': 'deg'}[family]
            else:
                raise ConstraintError(f'{r!r} needs a unit ({family})')
        fam, factor = UNITS.get(unit, (None, None))
        if fam != family:
            raise ConstraintError(f'unit {unit!r} is not a {family} unit')
        if isinstance(value, list):
            return [v * factor for v in value]
        return value * factor


def parse_value(raw, how):
    try:
        if how == 'int':
            return int(raw)
        if how == 'float':
            return float(raw)
        if how == 'int-list':
            return [int(x) for x in re.split(r'[,\s]+', raw.strip()) if x]
        if how == 'float-list':
            return [float(x) for x in re.split(r'[,\s]+', raw.strip()) if x]
    except ValueError:
        raise Unresolved(f'cannot read {raw!r} as {how}')
    return raw


def to_unit(value, family, unit):
    return value / UNITS[unit][1]


def allowed_error(tol, expected, unit=None, family=None):
    """Largest permitted |computed - published| in base units. `abs` is in the published figure's unit (or `unit`), `rel` a fraction; the larger of the two applies."""
    out = 0.0
    if 'rel' in tol:
        out = max(out, tol['rel'] * abs(expected))
    if 'abs' in tol:
        u = tol.get('unit', unit)
        out = max(out, tol['abs'] * (UNITS[u][1] if u else 1.0))
    return out


def fmt(x, digits=4):
    if isinstance(x, float):
        return f'{x:.{digits}g}'
    return str(x)


# ---------------------------------------------------------------------------------------------------------------------------- check kinds
# Each returns (state, detail, values); `state` is pass or fail here. Unresolved inputs are caught by the caller and become `unknown`.

def k_compare(ctx, c):
    fam = c.get('family') or UNITS[ctx.ref(c['expected'])[1]][0]
    actual, expected = ctx.qty(c['actual'], fam), ctx.qty(c['expected'], fam)
    unit = ctx.ref(c['expected'])[1] or {'ratio': 'ratio', 'speed': 'rpm', 'angle': 'deg'}.get(fam)
    err = abs(actual - expected)
    ok = err <= allowed_error(c['tolerance'], expected, unit, fam)
    a, e = to_unit(actual, fam, unit), to_unit(expected, fam, unit)
    return ok, f'model {fmt(a, 6)} {unit}, published {fmt(e, 6)} {unit}, difference {fmt(a - e, 3)} {unit}', dict(model=a, published=e, unit=unit)


def k_displacement(ctx, c):
    n = ctx.value(c['cylinders'])
    bore, stroke, stated = ctx.qty(c['bore'], 'length'), ctx.qty(c['stroke'], 'length'), ctx.qty(c['stated'], 'volume')
    swept = n * math.pi / 4 * bore ** 2 * stroke
    unit = ctx.ref(c['stated'])[1]
    err = abs(swept - stated)
    ok = err <= allowed_error(c['tolerance'], stated, unit, 'volume')
    got, want = to_unit(swept, 'volume', unit), to_unit(stated, 'volume', unit)
    return ok, f'{n} x pi/4 x bore^2 x stroke = {fmt(got, 6)} {unit}; published {fmt(want, 6)} {unit}; {fmt((got - want) / want * 100, 3)} percent', dict(computed=got, published=want, unit=unit)


def plank(pressure_pa, stroke_mm, bore_mm, cylinders, rpm, strokes_per_cycle):
    """Brake power in watts from P L A N K: mean effective pressure x stroke x piston area x power strokes per minute x cylinders."""
    area_m2 = math.pi / 4 * (bore_mm / 1000.0) ** 2
    strokes_per_min = rpm / (strokes_per_cycle / 2.0)
    return pressure_pa * (stroke_mm / 1000.0) * area_m2 * strokes_per_min * cylinders / 60.0


def k_power(ctx, c):
    n, cycle = ctx.value(c['cylinders']), ctx.value(c.get('strokes_per_cycle', 4))
    bore, stroke, rpm = ctx.qty(c['bore'], 'length'), ctx.qty(c['stroke'], 'length'), ctx.qty(c['speed'], 'speed')
    stated, unit = ctx.qty(c['stated_power'], 'power'), ctx.ref(c['stated_power'])[1]
    if c.get('solve') == 'pressure':
        unit_p = c.get('pressure_unit', 'psi')
        implied = to_unit(stated / plank(1.0, stroke, bore, n, rpm, cycle), 'pressure', unit_p)
        values = dict(implied_pressure=implied, unit=unit_p)
        rng = c.get('expect_pressure')
        if rng is None:
            raise Unresolved(f'implied mean effective pressure {fmt(implied, 4)} {unit_p} from {fmt(to_unit(stated, "power", unit), 5)} {unit} at {fmt(rpm, 5)} rpm; '
                             'no source states the pressure, so it is reported and not judged')
        lo, hi = ctx.qty(dict(rng, value=rng['min']), 'pressure'), ctx.qty(dict(rng, value=rng['max']), 'pressure')
        p = implied * UNITS[unit_p][1]
        return lo <= p <= hi, f'implied mean effective pressure {fmt(implied, 4)} {unit_p}; expected {rng["min"]} to {rng["max"]} {rng.get("unit", unit_p)}', values
    p = ctx.qty(c['pressure'], 'pressure')
    watts = plank(p, stroke, bore, n, rpm, cycle)
    ok = abs(watts - stated) <= allowed_error(c['tolerance'], stated, unit, 'power')
    return ok, f'P L A N K = {fmt(to_unit(watts, "power", unit), 6)} {unit}; published {fmt(to_unit(stated, "power", unit), 6)} {unit}', dict(computed=to_unit(watts, 'power', unit), published=to_unit(stated, 'power', unit), unit=unit)


def k_ratio(ctx, c):
    actual, expected = ctx.value(c['actual']), ctx.value(c['expected'])
    if not isinstance(actual, (int, float)):
        raise Unresolved('model ratio is not a number')
    ok = abs(abs(actual) - abs(expected)) <= allowed_error(c['tolerance'], abs(expected))
    note = f'model {fmt(actual, 6)}, published {fmt(expected, 6)}'
    if 'direction' in c:                         # the sign of a signed rate says whether the driven shaft turns with or against the crank
        want = c['direction']
        turns = 'with' if actual > 0 else 'against'
        ok = ok and turns == want
        note += f'; model turns {turns} the crank, expected {want}'
    return ok, note, dict(model=actual, published=expected)


def k_formula(ctx, c):
    env = {k: ctx.value(v) for k, v in c.get('vars', {}).items()}
    got = safe_eval(c['expr'], env)
    exp = c['expect']
    if exp.get('true'):
        ok = bool(got)
        return ok, f'{c["expr"]} -> {got}', dict(value=got)
    if 'equals' in exp:
        ok = abs(got - exp['equals']) <= allowed_error(c['tolerance'], exp['equals'])
        return ok, f'{c["expr"]} = {fmt(got, 6)}; expected {exp["equals"]}', dict(value=got)
    ok = exp.get('min', -math.inf) <= got <= exp.get('max', math.inf)
    return ok, f'{c["expr"]} = {fmt(got, 6)}; expected {exp.get("min", "-inf")} to {exp.get("max", "inf")}', dict(value=got)


def k_sequence(ctx, c):
    expect = ctx.value(c['expected'])
    lines, ok = [], True
    for name, r in c['actuals'].items():
        got = ctx.value(r)
        same = list(got) == list(expect)
        ok = ok and same
        lines.append(f'{name}: {got} {"=" if same else "!="} {expect}')
    return ok, '; '.join(lines), dict(expected=expect)


def _firing_phases(ctx, c):
    order, n, cycle = ctx.value(c['order']), ctx.value(c['cylinders']), ctx.value(c.get('strokes_per_cycle', 4))
    step = 360.0 * cycle / 2 / n
    if 'phases' in c:                                                  # {cylinder: crank angle of its firing event} read from the model
        raw = ctx.value(c['phases'])
        phases = {int(k): float(v) for k, v in raw.items()}
    else:
        model_order = ctx.value(c['phase_order']) if 'phase_order' in c else order        # the order the model's own code uses, when it differs from the published one
        phases = {cyl: k * ctx.value(c['step_deg']) for k, cyl in enumerate(model_order)}
    return order, n, step, phases, cycle


def k_firing_intervals(ctx, c):
    order, n, step, phases, cycle = _firing_phases(ctx, c)
    period = 360.0 * cycle / 2
    tol = c['tolerance'].get('abs', 1e-6)
    seq = sorted(phases, key=lambda k: phases[k] % period)
    gaps = [((phases[seq[(i + 1) % n]] - phases[seq[i]]) % period) for i in range(n)]
    even = all(abs(g - step) <= tol for g in gaps)
    start = seq.index(order[0]) if order and order[0] in seq else 0
    in_order = seq[start:] + seq[:start] == list(order)                   # a cycle: the sequence may begin anywhere in the 720 degrees
    ok = even and in_order and len(phases) == n
    return ok, (f'events at {[round(phases[k] % period, 3) for k in seq]} deg for cylinders {seq}; gaps {[round(g, 3) for g in gaps]}; even interval is {fmt(step, 6)} '
                f'({period:g}/{n}); order {"matches" if in_order else "does not match"} {order}'), dict(interval=step, gaps=gaps)


def _angle(xy):
    return math.degrees(math.atan2(xy[1], xy[0])) % 360.0


def _crank_direction(ctx, g):
    """+1 if the crank turns anticlockwise about +Z (the sense in which the pin angle grows), -1 otherwise, from cylinder 1's pin at two crank angles."""
    p0, p1 = ctx.value(g['pin_at_zero']), ctx.value(g['pin_at_probe'])
    cross = p0[0] * p1[1] - p0[1] * p1[0]
    if abs(cross) < 1e-9:
        raise Unresolved('the probe pin position equals the rest position')
    return 1 if cross > 0 else -1


def k_tdc(ctx, c):
    """The crank pins and the cylinder axes decide when each piston reaches top dead centre (modulo one revolution); the firing events must fall there."""
    order, n, step, phases, cycle = _firing_phases(ctx, c)
    pins = ctx.value(c['pins_at_zero'])
    bores = ctx.value(c['bore_points'])
    d = _crank_direction(ctx, c)
    tol = c['tolerance'].get('abs', 1e-3)
    bad, rows = [], []
    for k in range(n):
        cyl = k + 1
        tdc = (d * (_angle(bores[k]) - _angle(pins[k]))) % 360.0
        event = phases[cyl] % 360.0
        diff = min((tdc - event) % 360.0, (event - tdc) % 360.0)
        rows.append(f'{cyl}: pin {_angle(pins[k]):.1f}, bore {_angle(bores[k]):.1f}, top centre at {tdc:.1f}, firing event {event:.1f}')
        if diff > tol:
            bad.append(cyl)
    return not bad, ('crank turns ' + ('anticlockwise' if d > 0 else 'clockwise') + ' about +Z; ' + '; '.join(rows)
                     + ('' if not bad else f'; cylinders {bad} do not reach top centre when they fire')), dict(direction=d)


def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def _dot(a, b):
    return sum(p * q for p, q in zip(a, b))


def k_numbering(ctx, c):
    """Which side of the engine do the odd cylinders sit, and from which end are they numbered, in a right-handed frame with known forward and up?"""
    forward, up = ctx.value(c['forward']), ctx.value(c['up'])
    right = _cross(forward, up)                         # facing forward with up overhead, right = forward x up in a right-handed frame
    bores, stations = ctx.value(c['bore_points']), ctx.value(c['stations'])
    exp = c['expect']
    sides = []
    for k, p in enumerate(bores):
        v = [p[0], p[1], 0.0]
        sides.append('right' if _dot(v, right) > 0 else 'left')
    odd = {sides[k] for k in range(0, len(sides), 2)}
    even = {sides[k] for k in range(1, len(sides), 2)}
    odd_side = odd.pop() if len(odd) == 1 else 'mixed'
    even_side = even.pop() if len(even) == 1 else 'mixed'
    along = [_dot([0, 0, s], forward) for s in stations]
    first_rear = all(along[k] < along[k + 2] for k in range(len(along) - 2))
    from_end = 'rear' if first_rear else 'front'
    ok = odd_side == exp['odd_side'] and even_side != odd_side and from_end == exp['numbered_from']
    return ok, (f'looking forward with up {up}: right is {[round(x, 3) for x in right]}; odd cylinders on the {odd_side}, even on the {even_side}; numbered from the {from_end}; '
                f'published: odd on the {exp["odd_side"]}, numbered from the {exp["numbered_from"]}'), dict(odd_side=odd_side, numbered_from=from_end)


def k_rotation(ctx, c):
    """Crank direction in the model against the direction the manual implies: the propeller shaft's stated rotation, reversed once per external mesh back to the crank."""
    d = _crank_direction(ctx, c['model'])
    axis, forward = ctx.value(c['model']['axis']), ctx.value(c['model']['forward'])
    looking = 'clockwise' if d * _dot(axis, forward) > 0 else 'counterclockwise'     # rotation about +a is anticlockwise seen from the tip of a, clockwise seen looking along a
    anchor = c['anchor']['direction']
    flips = sum(1 for link in c['chain'] if link['link'] == 'external-mesh')
    other = {'clockwise': 'counterclockwise', 'counterclockwise': 'clockwise'}
    implied = anchor if flips % 2 == 0 else other[anchor]
    ok = looking == implied
    return ok, (f'model crank turns {looking} looking forward; the {c["anchor"]["part"]} turns {anchor} looking forward through {flips} external mesh(es), so the crank '
                f'must turn {implied}'), dict(model=looking, implied=implied)


def _check_mass_parts(ctx, c):
    """-> (parts [{id, volume_mm3, material}], 'computed', path) from --volumes or the declared geometry file; (None, None, None) if neither exists on this machine."""
    for rel in (ctx.volumes, c.get('volumes', {}).get('geometry')):
        if not rel:
            continue
        for full in (Path(rel), ctx.root / rel):
            if full.is_file():
                return json.loads(full.read_text(encoding='utf-8'))['parts'], 'computed', str(rel)
    return None, None, None


def mass_report(c, parts):
    """Per-group masses from part volumes: `mass = volume_mm3 / 1000 x density` summed in part order, so results are bit-identical to langley_mass_check.py."""
    dens, default = c['densities_g_cm3'], c.get('default_density_g_cm3')
    groups = c['groups']
    patterns = [[re.compile(p) for p in g['patterns']] for g in groups]
    grams, assigned, other, unpriced = {g['id']: 0.0 for g in groups}, {}, {}, {}
    for part in parts:
        material = part.get('material')
        rho = dens.get(material, default)
        if rho is None:
            unpriced.setdefault(material, []).append(part['id'])
            continue
        mass = part['volume_mm3'] / 1000.0 * rho
        for g, pats in zip(groups, patterns):
            if any(p.match(part['id']) for p in pats):
                grams[g['id']] += mass
                assigned[part['id']] = g['id']
                break
        else:
            other[part['id']] = round(mass, 1)
    return dict(grams=grams, assigned=assigned, unassigned_g=other, unpriced=unpriced)


def k_mass(ctx, c):
    groups, tol = c['groups'], c.get('tolerance', {})
    parts, basis, path = _check_mass_parts(ctx, c)
    if parts is not None:
        rep = mass_report(c, parts)
        if rep['unpriced'] and any('at_most' in g for g in groups):
            raise Unresolved('materials without a density: ' + ', '.join(f'{m} ({len(ids)} parts)' for m, ids in rep['unpriced'].items()) + '; a mass bound needs every part priced')
        model = rep['grams']
    else:
        rec = c.get('volumes', {}).get('record')
        if not rec:
            raise Unresolved('per-part volumes are not in Git (they live in the build output of the CAD run); run with --volumes <geometry.json> on a machine that has them')
        data = ctx.json(rec)
        model = {line['line']: line['model_g'] for line in data['lines']}
        rep = dict(unassigned_g=data.get('unassigned_g', {}), unpriced={})
        basis, path = 'recorded', rec
        if set(model) != {g['id'] for g in groups}:
            raise Unresolved(f'{rec} lines {sorted(model)} differ from the declared groups')
    rows, states, values = [], [], {}
    for g in groups:
        pub = ctx.qty(g['published'], 'mass') if 'published' in g else None
        at_most = ctx.qty(g['at_most'], 'mass') if 'at_most' in g else None
        m = model[g['id']]
        t = g.get('tolerance', tol)
        if pub is not None:
            ratio = m / pub
            within = abs(ratio - 1) <= t['rel']
            acc = g.get('accepted')
            if within:
                state = 'fail' if acc else 'pass'
                note = ' (stale `accepted` record: now within tolerance, remove it)' if acc else ''
            elif acc and 1 + t['rel'] < ratio <= acc['max_ratio']:
                state, note = 'accepted', f' (accepted up to {acc["max_ratio"]}: {acc["reason"]})'
            else:
                state, note = 'fail', ''
            rows.append(f'{g["id"]} {m:.0f} g / {pub:.0f} g = {ratio:.3f} {state}{note}')
            values[g['id']] = dict(model_g=round(m, 1), published_g=pub, ratio=round(ratio, 3), state=state)
        else:
            state = 'pass' if m <= at_most * (1 + t.get('rel', 0)) else 'fail'
            rows.append(f'{g["id"]} {m:.0f} g, at most {at_most:.0f} g: {state}')
            values[g['id']] = dict(model_g=round(m, 1), at_most_g=at_most, state=state)
        states.append(state)
    for tot in c.get('totals', []):
        pub = ctx.qty(tot['published'], 'mass')
        m = sum(model[i] for i in tot['groups'])
        ratio = m / pub
        within = abs(ratio - 1) <= tot['tolerance']['rel']
        state = 'pass' if within else 'fail'
        rows.append(f'total {tot["id"]} {m:.0f} g / {pub:.0f} g = {ratio:.3f} {state}')
        values['total:' + tot['id']] = dict(model_g=round(m, 1), published_g=pub, ratio=round(ratio, 3), state=state)
        states.append(state)
    other = sum(rep['unassigned_g'].values())
    rows.append(f'not in a group: {other:.0f} g in {len(rep["unassigned_g"])} parts')
    state = 'fail' if 'fail' in states else 'accepted' if 'accepted' in states else 'pass'
    return state, f'basis {basis} ({path}); ' + '; '.join(rows), dict(values, basis=basis, unassigned_g=rep['unassigned_g'])


KIND_FUNCS = dict(compare=k_compare, displacement=k_displacement, power=k_power, ratio=k_ratio, formula=k_formula, sequence=k_sequence,
                  **{'firing-intervals': k_firing_intervals}, tdc=k_tdc, numbering=k_numbering, rotation=k_rotation, mass=k_mass)


# ---------------------------------------------------------------------------------------------------------------------------- validation

def validate(doc):
    """Problems with the file's structure, not with what the engine does. Every check needs a source locator and a tolerance unless it is declared `unknown`."""
    errs = []
    if doc.get('schema') != SCHEMA:
        errs.append(f'schema must be {SCHEMA!r}')
    for key in ('study', 'sources', 'checks'):
        if key not in doc:
            errs.append(f'missing {key!r}')
    if errs:
        return errs
    sources = set(doc['sources']) | {'repo'}
    for name, s in doc['sources'].items():
        if 'title' not in s:
            errs.append(f'source {name}: title missing')
    for name, b in doc.get('bindings', {}).items():
        k = b.get('kind')
        if k not in BINDING_KINDS:
            errs.append(f'binding {name}: kind must be one of {BINDING_KINDS}')
        elif k == 'json' and not b.get('path'):
            errs.append(f'binding {name}: json needs path')
        elif k == 'regex' and not (b.get('path') and b.get('pattern')):
            errs.append(f'binding {name}: regex needs path and pattern')
        elif k == 'regex' and b.get('parse', 'str') not in PARSES:
            errs.append(f'binding {name}: parse must be one of {PARSES}')
        elif k == 'python' and not (b.get('module') and b.get('attr')):
            errs.append(f'binding {name}: python needs module and attr')
        if not b.get('locator'):
            errs.append(f'binding {name}: locator missing (file and line, or the field it reads)')
        if 'optional' in b and not isinstance(b['optional'], bool):
            errs.append(f'binding {name}: optional must be true or false')
    ids = []
    for c in doc['checks']:
        cid = c.get('id', '?')
        ids.append(cid)
        if c.get('kind') not in KINDS:
            errs.append(f'{cid}: kind must be one of {KINDS}')
        if not c.get('title'):
            errs.append(f'{cid}: title missing')
        srcs = c.get('source')
        srcs = srcs if isinstance(srcs, list) else [srcs] if srcs else []
        if not srcs:
            errs.append(f'{cid}: source locator missing')
        for s in srcs:
            if s.get('source') not in sources:
                errs.append(f'{cid}: source {s.get("source")!r} is not declared in `sources`')
            if not s.get('where'):
                errs.append(f'{cid}: source locator needs `where` (page, figure or file line)')
        if 'accepted' in c and not c['accepted'].get('reason'):
            errs.append(f'{cid}: `accepted` needs a reason')
        for dep in c.get('requires', []):
            if dep not in [x.get('id') for x in doc['checks']]:
                errs.append(f'{cid}: requires unknown check {dep!r}')
        for a in c.get('anchors', []):
            if not (a.get('path') and a.get('pattern')):
                errs.append(f'{cid}: an anchor needs path and pattern')
        if 'unknown' in c:
            if not isinstance(c['unknown'], str) or not c['unknown'].strip():
                errs.append(f'{cid}: `unknown` must give the reason')
            continue
        if c.get('kind') in ('compare', 'displacement', 'power', 'ratio', 'formula', 'firing-intervals', 'tdc') and not isinstance(c.get('tolerance'), dict) \
                and not (c.get('kind') == 'power' and c.get('solve') == 'pressure') \
                and not (c.get('kind') == 'formula' and (c.get('expect', {}).get('true') or 'min' in c.get('expect', {}) or 'max' in c.get('expect', {}))):
            errs.append(f'{cid}: tolerance missing')
        if c.get('kind') == 'mass' and not (c.get('tolerance') or all(g.get('tolerance') for g in c.get('groups', []))):
            errs.append(f'{cid}: tolerance missing')
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        errs.append(f'duplicate check ids: {sorted(dup)}')
    return errs


# ---------------------------------------------------------------------------------------------------------------------------- running

def _evaluate(ctx, c):
    """-> (state, detail, values). Unknown when a required check did not pass or a source figure is missing; fail when a binding or anchor that must resolve does not."""
    for dep in c.get('requires', []):
        got = ctx.results.get(dep, {}).get('state', 'not run')
        if got != 'pass':
            return 'unknown', f'depends on {dep}, which is {got}', {}
    try:
        for a in c.get('anchors', []):                 # the source lines a literal in this check was read from must still say so
            try:
                found = re.search(a['pattern'], ctx.text(a['path']), re.M)
            except Unresolved as e:
                raise BindingError(f'anchor file: {e}')
            if not found:
                raise BindingError(f'anchor {a["pattern"]!r} no longer matches in {a["path"]}: the line this check relied on has changed, re-read it')
        ok, detail, values = KIND_FUNCS[c['kind']](ctx, c)
    except BindingError as e:
        return ('unknown' if e.optional else 'fail'), f'input no longer resolves: {e}', {}
    except Unresolved as e:
        return 'unknown', str(e), {}
    state = ok if isinstance(ok, str) else 'pass' if ok else 'fail'
    acc = c.get('accepted')
    if acc and c['kind'] != 'mass':
        if state == 'fail':
            state = 'accepted'
            detail += f' [accepted: {acc["reason"]}]'
        elif state == 'pass':
            state = 'fail'
            detail += ' [stale `accepted` record: this check now passes, remove it]'
    return state, detail, values


def run_check(ctx, c):
    """One check -> {id, kind, title, source, tolerance, state, detail, values}. A check with `unknown` is not judged; with `evaluate` it is still computed and the figure shown."""
    base = dict(id=c['id'], kind=c['kind'], title=c['title'], source=c['source'], tolerance=c.get('tolerance'))
    if 'unknown' in c:
        if not c.get('evaluate'):
            return dict(base, state='unknown', detail=c['unknown'], values={})
        state, detail, values = _evaluate(ctx, c)
        return dict(base, state='unknown', detail=f'{c["unknown"]} | computed anyway: {detail} [{state}]', values=values)
    state, detail, values = _evaluate(ctx, c)
    return dict(base, state=state, detail=detail, values=values)


def run(doc, root=ROOT, volumes=None):
    """Evaluate every check of a constraints document. -> {study, checks: [...], counts, ok}."""
    errs = validate(doc)
    if errs:
        raise ConstraintError('; '.join(errs))
    ctx = Context(doc, root, volumes)
    rows = []
    for c in doc['checks']:
        r = run_check(ctx, c)
        ctx.results[c['id']] = r
        rows.append(r)
    counts = {s: sum(1 for r in rows if r['state'] == s) for s in STATES}
    return dict(study=doc['study'], checks=rows, counts=counts, ok=counts['fail'] == 0)


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def render(report, quiet=False):
    mark = dict(zip(STATES, ('PASS    ', 'FAIL    ', 'ACCEPTED', 'UNKNOWN ')))
    out = [f'{report["study"]}: ' + ', '.join(f'{report["counts"][s]} {s}' for s in STATES)]
    for r in report['checks']:
        if quiet and r['state'] == 'pass':
            continue
        out.append(f'  {mark[r["state"]]} {r["id"]}: {r["title"]}')
        out.append(f'           {r["detail"]}')
    return '\n'.join(out)
