"""Conjugate spur-gear profiles, tooth-phase solving and a mesh-cycle clearance check.

Standard library only, so FreeCAD's Python, Blender's Python, the audits and CI share
one definition. The accessory gears used to be square-ish teeth at exactly r1+r2
centre distance with no phase relationship between mating gears; they interpenetrated
at every pose. Two things are needed for gears that touch but never overlap:

* conjugate flanks (an involute with a positive backlash), so the profiles stay
  separated at every angle of the mesh, and
* a solved tooth phase, so a tooth of one gear meets a gap of the other.

This module is a geometric-validity tool. Module, tooth counts and proportions in this
project remain illustrative teaching choices, not manufacturer gear data.
"""
import math

PRESSURE_ANGLE = math.radians(20)
TAU = 2 * math.pi


def _inv(alpha):
    return math.tan(alpha) - alpha


def module(pitch_radius, teeth):
    return 2 * pitch_radius / teeth


def tooth_form(teeth, pitch_radius, addendum, clearance_factor=.25, backlash_factor=.05,
               pressure_angle=PRESSURE_ANGLE):
    """Radii and tooth thickness derived from the declared proportions.

    Backlash is the linear lash on the pitch circle for a *pair*; each gear gives up
    half of it. Dedendum is addendum plus the standard 0.25 m tip clearance.
    """
    m = module(pitch_radius, teeth)
    r_base = pitch_radius * math.cos(pressure_angle)
    r_tip = pitch_radius + addendum
    r_root = pitch_radius - (addendum + clearance_factor * m)
    thickness = math.pi * m / 2 - backlash_factor * m / 2
    return dict(module=m, r_pitch=pitch_radius, r_base=r_base, r_tip=r_tip, r_root=r_root,
                thickness=thickness, backlash=backlash_factor * m, teeth=teeth,
                pressure_angle=pressure_angle)


def _half_angle(form, rho):
    """Half the angular width of a tooth at radius rho (rho >= base radius)."""
    alpha = math.acos(min(1.0, form['r_base'] / rho))
    return form['thickness'] / (2 * form['r_pitch']) + _inv(form['pressure_angle']) - _inv(alpha)


def profile(teeth, pitch_radius, addendum, phase=0.0, clearance_factor=.25, backlash_factor=.05,
            pressure_angle=PRESSURE_ANGLE, flank_points=8, tip_points=2, root_points=3):
    """Counter-clockwise outline of a spur gear centred on the origin.

    Tooth 0 is centred on angle `phase`. Flanks are involutes sampled as polylines, which
    lie on the inside of the true curve, so the polygon never has more material than the
    ideal tooth. Returns a list of (x, y) with no repeated closing point.
    """
    form = tooth_form(teeth, pitch_radius, addendum, clearance_factor, backlash_factor, pressure_angle)
    r_base, r_tip, r_root = form['r_base'], form['r_tip'], form['r_root']
    if r_root <= 0:
        raise ValueError('root radius must be positive')
    if _half_angle(form, r_tip) <= 0:
        raise ValueError('tooth is pointed at the tip; reduce the addendum or backlash')
    start = max(r_base, r_root)
    pitch = TAU / teeth
    steps = [start + (r_tip - start) * k / (flank_points - 1) for k in range(flank_points)]
    half_start = _half_angle(form, start)
    half_tip = _half_angle(form, r_tip)
    points = []
    for tooth in range(teeth):
        centre = phase + pitch * tooth
        # Rising flank: from the root, up the involute, to the tip corner.
        if r_root < r_base:
            points.append((r_root, centre - half_start))  # radial run below the base circle
        for rho in steps:
            points.append((rho, centre - _half_angle(form, rho)))
        for k in range(1, tip_points + 1):
            points.append((r_tip, centre - half_tip + 2 * half_tip * k / (tip_points + 1)))
        for rho in reversed(steps):
            points.append((rho, centre + _half_angle(form, rho)))
        if r_root < r_base:
            points.append((r_root, centre + half_start))
        # Root arc to the next tooth.
        gap_start, gap_end = centre + half_start, centre + pitch - half_start
        for k in range(1, root_points + 1):
            points.append((r_root, gap_start + (gap_end - gap_start) * k / (root_points + 1)))
    return [(rho * math.cos(a), rho * math.sin(a)) for rho, a in points]


def mesh_phase(driver_centre, driver_phase, driver_teeth, driven_centre, driven_teeth):
    """Tooth phase of the driven gear so a tooth of one meets a gap of the other.

    For an external mesh (driver turns +t, driven turns -t * N1/N2) the quantity
    N1*mu1 + N2*mu2 is invariant, where mu_i is the angle from gear i's tooth-0 centre
    to the line of centres. A tooth on the line of centres of one gear needs a gap on
    that line for the other, which fixes the invariant at pi (mod 2 pi).
    """
    alpha = math.atan2(driven_centre[1] - driver_centre[1], driven_centre[0] - driver_centre[0])
    phase = (driver_teeth * (alpha - driver_phase) + driven_teeth * (alpha + math.pi) - math.pi) / driven_teeth
    return phase % (TAU / driven_teeth)


def meshed_rate(driver_rate, driver_teeth, driven_teeth):
    return -driver_rate * driver_teeth / driven_teeth


# ---------------------------------------------------------------- clearance check
def _rotate(points, angle, cx=0.0, cy=0.0):
    c, s = math.cos(angle), math.sin(angle)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in points]


def _orient(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _cross(p1, p2, p3, p4):
    d1, d2 = _orient(p3, p4, p1), _orient(p3, p4, p2)
    d3, d4 = _orient(p1, p2, p3), _orient(p1, p2, p4)
    return d1 * d2 < 0 and d3 * d4 < 0


def _point_segment(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = dx * dx + dy * dy
    t = 0.0 if length == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def _inside(point, polygon):
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _edges_near(points, centre, radius):
    """Polygon edges with an endpoint inside `radius` of `centre` (the possible overlap lens)."""
    n = len(points)
    return [(points[i], points[(i + 1) % n]) for i in range(n)
            if math.hypot(points[i][0] - centre[0], points[i][1] - centre[1]) <= radius
            or math.hypot(points[(i + 1) % n][0] - centre[0], points[(i + 1) % n][1] - centre[1]) <= radius]


def signed_gap(polygon_a, polygon_b, centre_a, centre_b, tip_a, tip_b):
    """Signed clearance between two polygons: distance when apart, -depth when overlapping."""
    edges_a = _edges_near(polygon_a, centre_b, tip_b + 5.0)
    edges_b = _edges_near(polygon_b, centre_a, tip_a + 5.0)
    distance = math.inf
    for a1, a2 in edges_a:
        for b1, b2 in edges_b:
            if _cross(a1, a2, b1, b2):
                distance = 0.0
                break
            distance = min(distance, _point_segment(a1, b1, b2), _point_segment(a2, b1, b2),
                           _point_segment(b1, a1, a2), _point_segment(b2, a1, a2))
        if distance == 0.0:
            break
    if distance > 0.0:
        return distance
    # Overlapping boundaries: report the deepest vertex of either gear inside the other.
    depth = 0.0
    for points, other, edges in ((polygon_a, polygon_b, edges_b), (polygon_b, polygon_a, edges_a)):
        for p in points:
            if _inside(p, other):
                depth = max(depth, min(_point_segment(p, e1, e2) for e1, e2 in edges))
    return -depth if depth else 0.0


def mesh_clearance(driver, driven, steps=48):
    """Minimum signed gap over one full tooth-pitch of mesh motion.

    `driver`/`driven` are dicts with centre, teeth, r_pitch, r_tip, phase and the profile
    keyword arguments. The driver turns +t; the driven gear turns -t * N1/N2.
    """
    poly_a = profile(driver['teeth'], driver['r_pitch'], driver['addendum'], 0.0, **driver.get('form', {}))
    poly_b = profile(driven['teeth'], driven['r_pitch'], driven['addendum'], 0.0, **driven.get('form', {}))
    ca, cb = driver['centre'], driven['centre']
    tip_a, tip_b = driver['r_pitch'] + driver['addendum'], driven['r_pitch'] + driven['addendum']
    worst = math.inf
    for k in range(steps):
        t = TAU / driver['teeth'] * k / steps
        a = _rotate(poly_a, driver['phase'] + t, *ca)
        b = _rotate(poly_b, driven['phase'] - t * driver['teeth'] / driven['teeth'], *cb)
        worst = min(worst, signed_gap(a, b, ca, cb, tip_a, tip_b))
    return worst
