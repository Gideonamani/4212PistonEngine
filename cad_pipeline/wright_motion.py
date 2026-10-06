"""Illustrative operating motion of the Wright revision-2 engine as rigid transforms, one per part, for a crank angle.

What the research supports and what is a teaching choice (cad-studies/wright-1903/revision-2/research.md):

* Supported: a four-throw crank (stroke 101.6 mm) driving long pistons through 245 mm rods (slider-crank geometry); a 6-tooth
  crank sprocket driving a 12-tooth cam sprocket through the chain, so the exhaust camshaft turns at half crank speed; an exhaust
  cam, a two-cheek rocker with a roller at each end, and an exhaust valve with nominal lift 7.9375 mm; automatic inlet valves
  that open from suction against their springs; a 1:1 spur pair that turns the ignition shaft opposite the cam shaft at the same
  speed; a generator friction wheel tangent to the flywheel rim (no slip).
* Teaching choices, labelled illustrative: the firing order (1-3-4-2) and so every valve and ignition phase, the cam lobe shape
  (derived here so its peak lift is the nominal valve lift), the inlet-valve lift curve, the ignition snap timing and angle. The
  sources say the cam law and phases are unresolved, so this is not a certified running animation.

Crank angle `theta` is in degrees (two crank revolutions, 0 to 720, make one four-stroke cycle). Rotations about the engine's y-axes
are positive clockwise seen with x to the right and z up: the crank pin at +x moves toward -z. Transforms are 4x4 row-major
matrices in millimetres in the CAD frame, mapping the assembled (theta = 0) pose to the posed one. Standard library only.
"""
import math
from cad_pipeline.wright_bodies import AXES, body
from cad_pipeline.wright_chain import layout as chain_layout

# ---- declared geometry (each also appears in wright_v2.py, which imports it from here)
PITCH = 129.69
STROKE, ROD_LENGTH = 101.6, 245.0
THROWS = {1: 1, 2: -1, 3: -1, 4: 1}                      # crank throw direction of each cylinder, +x at the assembled pose
CRANK_AXIS, CAM_AXIS, IGNITION_AXIS = AXES['crank'], AXES['cam'], AXES['ignition']     # (x, z) of the shaft axes
FIRING_ORDER = (1, 3, 4, 2)                              # illustrative; the two source drawing sets disagree
POWER_TDC = {cyl: 180.0 * k for k, cyl in enumerate(FIRING_ORDER)}   # crank degrees of each cylinder's power-stroke TDC
VALVE_LIFT = 7.9375
ROCKER = dict(pivot=(382.0, -126.0), cam_roller=(350.0, -131.0), valve_roller=(415.0, -125.0), roller_radius=10.0)
NOSE_RADIUS = 7.0                                        # chosen so each exhaust window (about 159 degrees) lies inside the exhaust stroke
FLYWHEEL_RADIUS, WHEEL_RADIUS = 190.0, 40.0
GENERATOR_AXIS = AXES['generator']
IGNITION_HUB_RADIUS = 7.0
TRIP_PIVOT = (461.0, -40.0)
NOSE_GAP = 0.6                                           # the lever underside rides this far off the cam; covers linear interpolation between 1-degree keys
CHAIN_PROFILE = dict(c1=CRANK_AXIS, c2=CAM_AXIS, teeth1=6, teeth2=12, links=38)
SPRING_FREE_LENGTH = 23.5
SPRING_FIXED_Z = 86.5
IGNITER_OPEN_DEG = 8.0

I4 = [[1.0, 0, 0, 0], [0, 1.0, 0, 0], [0, 0, 1.0, 0], [0, 0, 0, 1.0]]
rad = math.radians


# ---------------------------------------------------------------- transforms
def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def translate(x=0.0, y=0.0, z=0.0):
    m = [row[:] for row in I4]
    m[0][3], m[1][3], m[2][3] = x, y, z
    return m


def rotate_y(angle, pivot_xz):
    """Rotation by `angle` radians about the line through (pivot x, *, pivot z) parallel to y; positive is clockwise (x toward -z)."""
    c, s = math.cos(angle), math.sin(angle)
    px, pz = pivot_xz
    return [[c, 0, s, px - c * px - s * pz], [0, 1, 0, 0], [-s, 0, c, pz + s * px - c * pz], [0, 0, 0, 1]]


def rotate_x(angle, pivot_yz):
    """Rotation by `angle` radians about the line through (*, pivot y, pivot z) parallel to x (positive turns y toward z)."""
    c, s = math.cos(angle), math.sin(angle)
    py, pz = pivot_yz
    return [[1, 0, 0, 0], [0, c, -s, py - c * py + s * pz], [0, s, c, pz - s * py - c * pz], [0, 0, 0, 1]]


def scale_z(factor, z0):
    m = [row[:] for row in I4]
    m[2][2], m[2][3] = factor, z0 * (1 - factor)
    return m


def apply(m, point):
    x, y, z = point
    return tuple(m[i][0] * x + m[i][1] * y + m[i][2] * z + m[i][3] for i in range(3))


# ---------------------------------------------------------------- cycle timing
def wrap(theta):
    return theta % 720.0


def bump(x, lo, hi):
    """0 outside [lo, hi] (mod 720), smooth raised cosine 0..1..0 inside."""
    t = wrap(x - lo)
    span = hi - lo
    return 0.0 if t > span else 0.5 * (1 - math.cos(2 * math.pi * t / span))


def exhaust_lift_centre(cyl):
    """Crank angle of peak exhaust-valve lift: the middle of the exhaust stroke, 270 degrees after power TDC."""
    return wrap(POWER_TDC[cyl] + 270.0)


def intake_lift(cyl, theta):
    """Automatic inlet valve: opens by suction through the middle of the intake stroke (360-540 after power TDC)."""
    return VALVE_LIFT * bump(theta, POWER_TDC[cyl] + 370.0, POWER_TDC[cyl] + 530.0)


def spark_angle(cyl):
    """Crank angle at which the ignition contact breaks: 20 degrees before compression TDC (illustrative)."""
    return wrap(POWER_TDC[cyl] - 20.0)


# ---------------------------------------------------------------- slider crank
def crank_pin(cyl, theta):
    cx = THROWS[cyl] * STROKE / 2
    a = rad(theta)
    return cx * math.cos(a), -cx * math.sin(a)             # (x, z)


def piston_x(cyl, theta):
    """x of the wrist pin: crank pin x plus the rod's x-extent."""
    x, z = crank_pin(cyl, theta)
    return x + math.sqrt(ROD_LENGTH ** 2 - z ** 2)


def rod_angle(cyl, theta):
    return math.asin(crank_pin(cyl, theta)[1] / ROD_LENGTH)


# ---------------------------------------------------------------- cam, rocker, exhaust valve
def _rocker_points(delta):
    """Cam roller and valve roller centres (x, z) after the rocker turns delta radians counter-clockwise about its pivot."""
    px, pz = ROCKER['pivot']
    c, s = math.cos(delta), math.sin(delta)
    out = []
    for key in ('cam_roller', 'valve_roller'):
        dx, dz = ROCKER[key][0] - px, ROCKER[key][1] - pz
        out.append((px + dx * c - dz * s, pz + dx * s + dz * c))
    return out


def _bisect(f, lo, hi, iterations=60):
    flo = f(lo)
    for _ in range(iterations):
        mid = (lo + hi) / 2
        if (f(mid) > 0) == (flo > 0):
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def cam_profile():
    """Cam geometry derived so the lobe's peak lift is the nominal valve lift: base radius, nose circle, lobe axis direction."""
    z_valve = lambda d: _rocker_points(d)[1][1] - ROCKER['valve_roller'][1]
    delta_max = _bisect(lambda d: z_valve(d) - VALVE_LIFT, 0.0, 0.6)
    roller_max = _rocker_points(delta_max)[0]
    rest_distance = math.dist(ROCKER['cam_roller'], CAM_AXIS)
    base = rest_distance - ROCKER['roller_radius']
    max_distance = math.dist(roller_max, CAM_AXIS)
    nose_distance = max_distance - (NOSE_RADIUS + ROCKER['roller_radius'])
    lobe_direction = math.atan2(roller_max[1] - CAM_AXIS[1], roller_max[0] - CAM_AXIS[0])
    return dict(base_radius=base, nose_radius=NOSE_RADIUS, nose_distance=nose_distance, lobe_direction=lobe_direction,
                delta_max=delta_max, roller_radius=ROCKER['roller_radius'])


CAM = cam_profile()


def lobe_angle(cyl, theta):
    """Direction (radians, counter-clockwise from +x) of cylinder `cyl`'s exhaust cam lobe at crank angle theta."""
    peak = exhaust_lift_centre(cyl)
    at_zero = CAM['lobe_direction'] + rad(peak) / 2         # the cam turns clockwise at half crank speed
    return at_zero - rad(theta) / 2


def rocker_delta(cyl, theta):
    """Counter-clockwise rocker angle (radians) that keeps the cam roller on the cam, from the circle-union profile."""
    a = lobe_angle(cyl, theta)
    nose = (CAM_AXIS[0] + CAM['nose_distance'] * math.cos(a), CAM_AXIS[1] + CAM['nose_distance'] * math.sin(a))
    r = ROCKER['roller_radius']

    def clearance(d):
        roller = _rocker_points(d)[0]
        return min(math.dist(roller, CAM_AXIS) - (CAM['base_radius'] + r), math.dist(roller, nose) - (CAM['nose_radius'] + r))

    if clearance(0.0) >= 0:
        return 0.0
    return _bisect(clearance, 0.0, CAM['delta_max'] * 1.5)


def exhaust_lift(cyl, theta):
    d = rocker_delta(cyl, theta)
    return _rocker_points(d)[1][1] - ROCKER['valve_roller'][1]


# ---------------------------------------------------------------- ignition
STRIP = [(382, -69), (383, -59), (393, -53), (400, -59), (401, -69), (399, -69), (398, -60), (393, -56), (385, -61), (384, -69)]


def ignition_crest_angle(cyl, theta):
    """Direction (radians, ccw from +x) of ignition cam `cyl`'s crest. The shaft turns opposite the cam shaft at the same speed."""
    at_zero = math.pi / 2 - rad(spark_angle(cyl)) / 2      # the crest is under the lever nose (straight up) at the spark angle
    return at_zero + rad(theta) / 2


def rotate_point(point, pivot, angle):
    c, s = math.cos(angle), math.sin(angle)
    dx, dz = point[0] - pivot[0], point[1] - pivot[1]
    return pivot[0] + dx * c - dz * s, pivot[1] + dx * s + dz * c


def ignition_cam_outline(cyl):
    """The strip outline of ignition cam `cyl` at the assembled pose: the reference strip (crest straight up) turned to its crest angle."""
    turn = ignition_crest_angle(cyl, 0.0) - math.pi / 2
    return [tuple(round(v, 5) for v in rotate_point(p, IGNITION_AXIS, turn)) for p in STRIP]


def _strip_top(points, x):
    """Highest z of the closed polygon at abscissa x, or None."""
    best = None
    n = len(points)
    for i in range(n):
        (x1, z1), (x2, z2) = points[i], points[(i + 1) % n]
        if x1 == x2 or not (min(x1, x2) <= x <= max(x1, x2)):
            continue
        z = z1 + (z2 - z1) * (x - x1) / (x2 - x1)
        best = z if best is None else max(best, z)
    return best


def _cam_top(cyl, theta, x, strip=None):
    """Height of the highest igniter-cam surface (strip or hub) at world abscissa x, or None when nothing is under x."""
    if strip is None:
        turn = ignition_crest_angle(cyl, theta) - math.pi / 2
        strip = [rotate_point(p, IGNITION_AXIS, turn) for p in STRIP]
    top = _strip_top(strip, x)
    hub = IGNITION_AXIS[1] + math.sqrt(IGNITION_HUB_RADIUS ** 2 - (x - IGNITION_AXIS[0]) ** 2) if abs(x - IGNITION_AXIS[0]) <= IGNITION_HUB_RADIUS else None
    heights = [z for z in (top, hub) if z is not None]
    return max(heights) if heights else None


def _underside(nose_z):
    """Points (x, z) along the underside of the trip lever at the assembled pose: the flat nose, then the start of the sloping edge."""
    slope = (-44.0 - nose_z) / (464.0 - 398.0)
    return [(390.0 + k, nose_z) for k in range(9)] + [(398.0 + k, nose_z + slope * k) for k in range(1, 5)]


def trip_rest(cyl):
    """Nose height of the trip lever at the assembled pose: the lowest it can sit with NOSE_GAP clear of the cam it rests on."""
    strip = None
    nose = -60.0
    for _ in range(4):                                           # the sloping edge depends on the nose height; it converges at once
        need = [_cam_top(cyl, 0.0, x, strip) for x, _ in _underside(nose)]
        nose = max(top + NOSE_GAP - (z - nose) for top, (_, z) in zip(need, _underside(nose)) if top is not None)
    return round(nose, 4)


def trip_angle(cyl, theta):
    """Counter-clockwise rotation (radians) of trip lever `cyl` about its pivot so its whole underside stays NOSE_GAP above the cam."""
    turn = ignition_crest_angle(cyl, theta) - math.pi / 2
    strip = [rotate_point(p, IGNITION_AXIS, turn) for p in STRIP]
    under = _underside(trip_rest(cyl))

    def clearance(e):
        worst = 1e9
        for point in under:
            x, z = rotate_point(point, TRIP_PIVOT, e)
            top = _cam_top(cyl, theta, x, strip)
            if top is not None:
                worst = min(worst, z - top - NOSE_GAP)
        return worst

    # A counter-clockwise turn lowers the nose (the pivot is to its right), so clearance falls as e rises. The cam surface spans only
    # about 20 mm, so the bracket is kept to the turns that keep the underside over it (the nose moves at most 12 mm, about 0.18 rad).
    limit = 0.25
    if clearance(limit) >= 0:
        return limit
    if clearance(-limit) <= 0:
        return -limit
    e = _bisect(clearance, -limit, limit)
    return 0.0 if abs(e) < 1e-5 else e                 # the assembled pose is exact; 1e-5 rad is under a thousandth of a millimetre at the nose


def igniter_angle(cyl, theta):
    """Rotation (radians, about +x, negative opens) of the igniter lever and moving contact: snaps open at the spark angle."""
    t = wrap(theta - spark_angle(cyl))
    if t > 19.0:
        return 0.0                                      # contact made: the assembled pose and most of the cycle
    smooth = lambda x: min(1.0, max(0.0, x)) ** 2 * (3 - 2 * min(1.0, max(0.0, x)))
    opening = smooth(t / 3.0)                           # snap open at the spark angle over 3 degrees, stay open 8, close over 8
    closing = 1.0 - smooth((t - 11.0) / 8.0)
    return -rad(IGNITER_OPEN_DEG) * opening * closing


# ---------------------------------------------------------------- chain
_CHAIN = None


def chain():
    global _CHAIN
    if _CHAIN is None:
        _CHAIN = chain_layout(**CHAIN_PROFILE)
    return _CHAIN


def chain_link_matrix(k, theta):
    """Rigid transform of link k (its two plates and roller) when the crank sprocket has turned theta degrees."""
    c = chain()
    n, s, length = c['links'], c['arc_pitch'], c['length']
    span = c['centre_distance'] * math.cos(math.asin((c['r2'] - c['r1']) / c['centre_distance']))
    shift = c['r1'] * rad(theta)
    p0, q0 = c['rollers'][k], c['rollers'][(k + 1) % n]
    p1 = c['at'](span + k * s + shift)[:2]
    q1 = c['at'](span + (k + 1) * s + shift)[:2]
    a0 = math.atan2(q0[1] - p0[1], q0[0] - p0[0])
    a1 = math.atan2(q1[1] - p1[1], q1[0] - p1[0])
    return mul(translate(p1[0] - p0[0], 0.0, p1[1] - p0[1]), rotate_y(-(a1 - a0), p0))


# ---------------------------------------------------------------- per-part matrices
_NUMBER = __import__('re').compile(r'(\d+)')


def _cyl(part_id):
    return int(_NUMBER.findall(part_id)[0])


def matrix(part_id, theta):
    """Transform of `part_id` at crank angle `theta` degrees (identity for parts that do not move)."""
    b = body(part_id)
    a = rad(theta)
    if b == 'crank':
        return rotate_y(a, CRANK_AXIS)
    if b == 'cam':
        return rotate_y(a / 2, CAM_AXIS)
    if b == 'ignition':
        return rotate_y(-a / 2, IGNITION_AXIS)
    if b == 'generator':
        return rotate_y(-a * FLYWHEEL_RADIUS / WHEEL_RADIUS, GENERATOR_AXIS)
    if b.startswith('piston'):
        cyl = int(b[6:])
        return translate(piston_x(cyl, theta) - piston_x(cyl, 0.0))
    if b.startswith('rod'):
        cyl = int(b[3:])
        x0, z0 = crank_pin(cyl, 0.0)
        x1, z1 = crank_pin(cyl, theta)
        return mul(translate(x1 - x0, 0.0, z1 - z0), rotate_y(rod_angle(cyl, theta), (x0, z0)))
    if b.startswith('intake'):
        return translate(0.0, 0.0, -intake_lift(int(b[6:]), theta))
    if b.startswith('exhaust'):
        return translate(0.0, 0.0, exhaust_lift(int(b[7:]), theta))
    if b.startswith('rocker'):
        return rotate_y(-rocker_delta(int(b[6:]), theta), ROCKER['pivot'])
    if b.startswith('trip'):
        return rotate_y(-trip_angle(int(b[4:]), theta), TRIP_PIVOT)
    if b.startswith('igniter'):
        cyl = int(b[7:])
        return rotate_x(igniter_angle(cyl, theta), (PITCH * (cyl - 1), 0.0))
    if b.startswith('chain'):
        return chain_link_matrix(int(b[5:]), theta)
    if b.startswith('spring'):                                   # valve springs: compress along z between the retainer and the washer
        kind, cyl = b[6], int(b[7:])
        lift = intake_lift(cyl, theta) if kind == 'I' else exhaust_lift(cyl, theta)
        z0 = SPRING_FIXED_Z if kind == 'I' else -SPRING_FIXED_Z
        return scale_z((SPRING_FREE_LENGTH - lift) / SPRING_FREE_LENGTH, z0)
    return I4


def pivot(part_id):
    """A point (CAD mm) on the fixed axis of a part that only turns about one fixed axis (crank, cam, ignition shaft, generator), else None.

    The exported file puts the part's origin there, so the key frames hold a pure rotation about a fixed node origin: linear
    interpolation between two keys then keeps the axis where it is. With the origin at the model origin, a part turning 4.75 degrees per
    key about an axis 230 mm away would drift 0.2 mm between keys, enough to move a friction wheel into the flywheel rim."""
    axis = AXES.get(body(part_id))
    return None if axis is None else (axis[0], 0.0, axis[1])


def lobe_nose_centre(cyl):
    """Nose circle centre of exhaust cam `cyl` at the assembled pose, for the generator."""
    a = lobe_angle(cyl, 0.0)
    return CAM_AXIS[0] + CAM['nose_distance'] * math.cos(a), CAM_AXIS[1] + CAM['nose_distance'] * math.sin(a)
