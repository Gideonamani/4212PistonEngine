"""Timing-chain layout derived once, so every roller sits in a sprocket pocket at every angle of rotation.

The static chain in revision 2 spaced its rollers equally along the chain path, but the sprocket pockets were laid out
separately (pitch radii from a chord pitch), so rollers and pockets did not coincide and the two sprockets did not turn
exactly 2:1 against the chain. Here the arc pitch `s` between rollers is the single declared quantity: both sprockets get
the pitch radius whose tooth arc equals `s` (radius = teeth * s / 2 pi, so the 12-tooth wheel is exactly twice the 6-tooth
one), the chain closes with a whole number of links, and every roller on a wrap sits in a pocket. Turning the crank sprocket
by an angle moves the chain `r1 * angle` along its path and the cam sprocket by half that angle, with the rollers staying in
their pockets. Chordal action is ignored: plates are straight between rollers. This is an illustrative teaching layout, not
a chain-pitch validation. Standard library only.
"""
import math


def _length(rho, centre_distance, ratio, links):
    """Closed path length for pitch radii rho and ratio*rho, and the wrap half-offset phi."""
    r1, r2 = rho, ratio * rho
    phi = math.asin((r2 - r1) / centre_distance)
    return 2 * centre_distance * math.cos(phi) + r1 * (math.pi - 2 * phi) + r2 * (math.pi + 2 * phi), phi


def layout(c1, c2, teeth1, teeth2, links, tolerance=1e-12):
    """Chain path, roller positions and sprocket pocket phases. Points are (x, z) in millimetres."""
    if teeth2 % teeth1:
        raise ValueError('the large sprocket must have a whole multiple of the small sprocket tooth count')
    ratio = teeth2 / teeth1
    dx, dz = c2[0] - c1[0], c2[1] - c1[1]
    centre_distance = math.hypot(dx, dz)
    rho = 24.0
    for _ in range(200):                       # arc pitch s = L / links must equal 2 pi rho / teeth1
        length, phi = _length(rho, centre_distance, ratio, links)
        new = teeth1 * (length / links) / (2 * math.pi)
        if abs(new - rho) < tolerance:
            break
        rho = new
    r1, r2 = rho, ratio * rho
    length, phi = _length(r1, centre_distance, ratio, links)
    s = length / links
    a = math.atan2(dz, dx)
    top, bottom = a + math.pi / 2 + phi, a - math.pi / 2 - phi
    span = centre_distance * math.cos(phi)
    wrap2, wrap1 = math.pi + 2 * phi, math.pi - 2 * phi
    point = lambda c, r, t: (c[0] + r * math.cos(t), c[1] + r * math.sin(t))

    def at(u):
        """(x, z, tangent angle) at path distance u from the crank sprocket's top tangent point."""
        u %= length
        if u < span:                           # top span, crank to cam
            p, q = point(c1, r1, top), point(c2, r2, top)
            t = u / span
            return p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, math.atan2(q[1] - p[1], q[0] - p[0])
        u -= span
        if u < r2 * wrap2:                     # wrap round the cam sprocket, clockwise
            angle = top - u / r2
            x, z = point(c2, r2, angle)
            return x, z, angle - math.pi / 2
        u -= r2 * wrap2
        if u < span:                           # bottom span, cam back to crank
            p, q = point(c2, r2, bottom), point(c1, r1, bottom)
            t = u / span
            return p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, math.atan2(q[1] - p[1], q[0] - p[0])
        u -= span
        angle = bottom - u / r1                # wrap round the crank sprocket
        x, z = point(c1, r1, angle)
        return x, z, angle - math.pi / 2

    # Roller 0 sits on the cam wrap at the pocket angle `top`, so every wrap roller lands in a pocket of its sprocket.
    u0 = span
    rollers = [at(u0 + k * s) for k in range(links)]
    # Pocket angles: a roller on each wrap fixes the phase of that sprocket's pockets (they repeat every 2 pi / teeth).
    angle2 = top - (u0 - span) / r2
    first1 = next(k for k in range(links) if (u0 + k * s - span - r2 * wrap2 - span) % length < r1 * wrap1 and
                  (u0 + k * s - span - r2 * wrap2 - span) % length >= 0)
    angle1 = bottom - (((u0 + first1 * s) - span - r2 * wrap2 - span) % length) / r1
    return dict(
        r1=r1, r2=r2, arc_pitch=s, length=length, links=links, centre_distance=centre_distance, at=at,
        rollers=[(x, z) for x, z, _ in rollers], roller_tangents=[t for _, _, t in rollers],
        phase1=angle1 % (2 * math.pi / teeth1), phase2=angle2 % (2 * math.pi / teeth2), teeth=(teeth1, teeth2), centres=(c1, c2),
        bottom_span=(point(c2, r2, bottom), point(c1, r1, bottom)), top_span=(point(c1, r1, top), point(c2, r2, top)))


def pocket_angles(info, which):
    """Angles of the roller pockets of sprocket 1 or 2 at the assembled pose."""
    teeth = info['teeth'][which - 1]
    phase = info['phase%d' % which]
    return [phase + 2 * math.pi * k / teeth for k in range(teeth)]


def relief_centres(rho, angle, centre, reach=7.1, spacing=1.8):
    """Centres of the roller-pocket circles that make one pocket and its entry/exit relief.

    Relative to the turning sprocket, a roller on the straight span beside a wrap follows an involute of the pitch circle (the
    chain line unwinds from it), on either side of the pocket depending on whether it is entering or leaving. Cutting the
    roller's clearance circle at points along both branches, out to the sprocket rim (`reach` is how far past the pitch
    circle the disc extends plus the roller radius), leaves true teeth between the pockets and lets every roller move in and
    out without touching them. Points are (x, z) around `centre`; `angle` is the pocket's angle at the assembled pose.
    """
    top = math.sqrt((1 + reach / rho) ** 2 - 1)
    count = max(2, math.ceil(rho * top * top / 2 / spacing))
    ts = [0.0] + [sign * top * (k / count) for k in range(1, count + 1) for sign in (1, -1)]
    c, s = math.cos(angle), math.sin(angle)
    result = []
    for t in ts:
        x, y = rho * (math.cos(t) + t * math.sin(t)), rho * (math.sin(t) - t * math.cos(t))
        result.append((round(centre[0] + x * c - y * s, 5), round(centre[1] + x * s + y * c, 5)))
    return result
