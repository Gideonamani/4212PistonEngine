"""Seats: where one part passes through or rests in another, the host is cut to the guest's outline plus a clearance.

A bolt through a cap, a shaft through a casting, a hose in a boss: real parts do not share material, they sit in holes,
grooves and pockets. The Wright revision-2 generator placed many such parts where they simply overlapped. A seat adds
subtractive features to the host that copy the guest's additive outline, grown by `clearance_mm`, so the two touch (with
that clearance) and never overlap. Seats are data (`seats.json`, host and guest), derived from the interference audit and
reviewed, never typed into the generator by hand.

The host is the part that holds the other: a static casting before a moving shaft, a bigger housing before a small part.
A pair of two moving parts has no host (cutting one moving part to clear another hides a mechanism error) and must be fixed
in the generator. Standard library only.

    python -m cad_pipeline.wright_seats derive --audit audit.json --geometry geometry.json --seats seats.json
"""
import argparse, json, math, re
from pathlib import Path
from cad_pipeline.spec import evaluate
from cad_pipeline.wright_bodies import AXES, body

CLEARANCE_MM = 0.15

# Groups ordered by how much they enclose: a static casting holds everything else.
GROUP_RANK = ['crankcase', 'cover', 'valve_boxes', 'cylinders', 'bearings', 'induction', 'cooling', 'lubrication', 'camshafts',
              'crankshaft', 'flywheel', 'pistons', 'rods', 'valves', 'rockers', 'timing', 'ignition', 'generator']

def is_moving(part_id):
    return body(part_id) != 'static'


def _unit(axis):
    n = math.sqrt(sum(v * v for v in axis))
    return [v / n for v in axis]


def _shift(origin, axis, distance):
    return [round(o - a * distance, 6) for o, a in zip(origin, _unit(axis))]


def _offset_polygon(points, c):
    """Mitred outward offset of a simple polygon given as (x, y) tuples."""
    area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1])) / 2
    sign = 1 if area > 0 else -1                      # outward normal is to the right of a counter-clockwise edge
    n = len(points)
    lines = []
    for i in range(n):
        (x1, y1), (x2, y2) = points[i], points[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy) or 1.0
        nx, ny = sign * dy / length, -sign * dx / length
        lines.append(((x1 + nx * c, y1 + ny * c), (dx, dy)))
    result = []
    for i in range(n):
        (p, d), (q, e) = lines[i - 1], lines[i]
        cross = d[0] * e[1] - d[1] * e[0]
        if abs(cross) < 1e-9:
            result.append(q)
            continue
        t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / cross
        result.append((p[0] + d[0] * t, p[1] + d[1] * t))
    return result


def grow(feature, params, c, label):
    """The guest's additive feature as a numeric subtractive tool grown by c, or None when it adds nothing to seat."""
    if feature['operation'] != 'add':
        return None
    kind = feature['primitive']
    origin = [evaluate(v, params) for v in feature.get('origin', [0, 0, 0])]
    axis = feature.get('axis', [0, 0, 1])
    out = dict(operation='cut', label=label, origin=origin, axis=list(axis))
    e = lambda key: evaluate(feature[key], params)
    if kind == 'box':
        if _unit(axis) != [0.0, 0.0, 1.0]:
            raise ValueError('seat for a rotated box is not supported')
        out.update(primitive='box', length=e('length') + 2 * c, width=e('width') + 2 * c, height=e('height') + 2 * c,
                   origin=[o - c for o in origin])
    elif kind in ('cylinder', 'tube'):          # a tube is cleared as its solid outline: the host does not live in its bore
        out.update(primitive='cylinder', radius=e('radius') + c, height=e('height') + 2 * c, origin=_shift(origin, axis, c))
    elif kind == 'cone':
        out.update(primitive='cone', radius1=e('radius1') + c, radius2=e('radius2') + c, height=e('height') + 2 * c, origin=_shift(origin, axis, c))
    elif kind == 'sphere':
        out.update(primitive='sphere', radius=e('radius') + c)
    elif kind == 'prism':
        pts = _offset_polygon([(evaluate(p[0], params), evaluate(p[1], params)) for p in feature['points']], c)
        out.update(primitive='prism', points=[[round(x, 6), round(y, 6)] for x, y in pts], height=e('height') + 2 * c, origin=_shift(origin, axis, c), derived=True)
    elif kind == 'helix':                         # a spring is cleared as its coil envelope
        out.update(primitive='cylinder', radius=e('radius') + e('wire_radius') + c, height=e('height') + 2 * e('wire_radius') + 2 * c,
                   origin=_shift(origin, axis, c + e('wire_radius')))
    else:
        raise ValueError('unknown primitive ' + kind)
    for key in ('radius', 'height', 'length', 'width', 'radius1', 'radius2'):
        if key in out:
            out[key] = round(out[key], 6)
    return out


def swept_envelope(guest_id, geometry):
    """Revolution envelope of a part that turns about a fixed axis: {axis (x, z), radius, y: [lo, hi]}, or None."""
    axis = AXES.get(body(guest_id))
    if axis is None:
        return None
    part = next(p for p in geometry['parts'] if p['id'] == guest_id)
    radius = max(math.hypot(v[0] - axis[0], v[2] - axis[1]) for v in part['vertices_mm'])
    ys = [v[1] for v in part['vertices_mm']]
    return dict(axis=list(axis), radius=round(radius, 4), y=[round(min(ys), 4), round(max(ys), 4)])


def apply_seats(parts, params, seats, clearance=CLEARANCE_MM):
    by_id = {p['id']: p for p in parts}
    for seat in seats:
        host, guest = by_id[seat['host']], by_id[seat['guest']]
        if seat.get('swept'):                       # a part turning about a fixed axis clears the host through its whole revolution
            s = seat['swept']
            host['features'].append(dict(primitive='cylinder', operation='cut', radius=round(s['radius'] + clearance, 6), height=round(s['y'][1] - s['y'][0] + 2 * clearance, 6),
                                         origin=[s['axis'][0], round(s['y'][0] - clearance, 6), s['axis'][1]], axis=[0, 1, 0],
                                         label=f"Swept clearance for {guest['id']} ({guest['label']}), {clearance} mm"))
            continue
        for n, feature in enumerate(guest['features'], 1):
            tool = grow(feature, params, clearance, f"Seat for {guest['id']} ({guest['label']}), {clearance} mm clearance")
            if tool:
                host['features'].append(tool)
    return parts


def load(path):
    path = Path(path)
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else dict(schema_version=1, clearance_mm=CLEARANCE_MM, seats=[])


# Thin connectors are always the guest: cutting a spring, hose, lead or bolt to clear its neighbour severs it, whereas the
# neighbour takes a hole or pocket for it.
NEVER_HOST = re.compile(r'(Bolt|Clamp|PinLock|Spring|Hose|Line$|Lead$|Busbar|BusLink|RingPeg|RodPin|Key$|Gallery|Distributor|OilJet|FixedElectrode|MovingContact)')


def host_of(a, b, group, volume):
    """Which of two overlapping parts holds the other, or None when they move relative to each other (a mechanism fault).

    Parts of one rigid body, or two static parts, never move relative to each other: a thin connector is the guest, and
    otherwise the larger enclosing group holds the other. Against a moving body the static part holds it, unless that part
    is a thin connector (a hose through a piston is a routing fault). Two different moving bodies have no host.
    """
    ba, bb = body(a), body(b)
    na, nb = bool(NEVER_HOST.search(a)), bool(NEVER_HOST.search(b))
    if ba != bb:
        if ba == 'static' and not na:
            return a
        if bb == 'static' and not nb:
            return b
        return None
    if na != nb:
        return b if na else a
    ra, rb = GROUP_RANK.index(group[a]), GROUP_RANK.index(group[b])
    if ra != rb:
        return a if ra < rb else b
    return a if volume[a] >= volume[b] else b


def derive(audit, geometry, existing, skip=()):
    """Seats for every overlapping pair in an audit that has a host, plus the pairs that need a generator fix.

    `audit` is an audit report ({'new_violations', 'known_defects'}) or a list of (a, b, volume, thickness) pairs. A guest that turns
    about a fixed axis, seated in a host outside its own body, is cleared through its whole revolution (`swept`).
    """
    group = {p['id']: p['group'] for p in geometry['parts']}
    volume = {p['id']: p['volume_mm3'] for p in geometry['parts']}
    known = {(s['host'], s['guest']) for s in existing}
    seats, manual = list(existing), []
    items = audit if isinstance(audit, list) else [(i['a'], i['b'], i['max_overlap_mm3'], i['max_thickness_mm']) for i in audit['new_violations'] + audit['known_defects']]
    for a, b, vol, thick in items:
        host = None if (a in skip or b in skip) else host_of(a, b, group, volume)
        if host is None:
            manual.append((a, b, vol, thick))
            continue
        guest = b if host == a else a
        if (host, guest) not in known:
            seat = dict(host=host, guest=guest)
            if body(host) != body(guest):
                swept = swept_envelope(guest, geometry)
                if swept:
                    seat['swept'] = swept
            seats.append(seat)
            known.add((host, guest))
    return seats, manual


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['derive'])
    parser.add_argument('--audit', type=Path, nargs='+', required=True, help='audit report(s) of the rest pose and/or the motion (audit_motion.py output)')
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--seats', type=Path, required=True)
    parser.add_argument('--skip', nargs='*', default=[], help='part ids that must be fixed in the generator, not seated')
    args = parser.parse_args()
    data = load(args.seats)
    items = []
    for path in args.audit:
        report = json.loads(path.read_text())
        if 'new_violations' in report:
            items += [(i['a'], i['b'], i['max_overlap_mm3'], i['max_thickness_mm']) for i in report['new_violations'] + report['known_defects']]
        else:                                       # audit_motion.py: {'a / b': {...}}
            items += [(*key.split(' / '), e['max_mm3'], e['max_mm']) for key, e in report.items()]
    seats, manual = derive(items, json.loads(args.geometry.read_text()), data['seats'], set(args.skip))
    data['seats'] = sorted(seats, key=lambda s: (s['host'], s['guest']))
    args.seats.write_text(json.dumps(data, indent=1) + '\n', encoding='utf-8')
    print(f'{len(data["seats"])} seats; {len(manual)} pairs need a generator fix:')
    for a, b, volume, thick in sorted(manual, key=lambda m: -m[2]):
        print(f'  {a} / {b}: {volume:.1f} mm3, {thick:.2f} mm thick')


if __name__ == '__main__':
    main()
