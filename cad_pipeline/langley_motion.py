"""Illustrative operating motion of the Langley / Manly-Balzer radial as rigid transforms, one per part, for a crank angle.

What the sources support and what is a teaching choice (cad-studies/langley-manly-balzer-1903/operating-motion.md):

* Supported: the crank turns about the shaft axis; the five pistons slide in their radial cylinders on a slider-crank (stroke 139.7 mm); every rod axis passes
  through the one crank pin, the master rod carrying the sleeve on which the four link-rod shoes slide; the double-lobed ring cam turns at one quarter of crank
  speed in reverse through a train of three external meshes and lifts the five exhaust valves through punch rods that stand 1/64 in below the stems; the firing
  order is 1-3-5-2-4; the inlet valves are automatic; the ignition gear train turns the primary sparker cam at 2.5x and the distributor brush at 0.5x (reverse).
* Teaching choices, labelled illustrative: the exhaust timing (peak lift 270 degrees after power top dead centre) and with it the cam phase, the lobe width and
  rise, the inlet-valve window and lift, the spark advance, the pawl and spring motion at the sparker. The sources do not give cam law or valve timing, so this is
  not a certified running animation.

Crank angle `theta` is in degrees; two turns (0 to 720) make one four-stroke cycle. Rotations about the engine axis are positive in the direction of crank
rotation (about +X: Y toward Z). Transforms are 4x4 row-major matrices in millimetres in the CAD frame (X along the shaft toward starboard, Z up), mapping the
assembled (theta = 0) pose to the posed one. The kinematics and the gear-train layouts come from the same context that builds the geometry (langley_v1).
Standard library only.
"""
import math
from cad_pipeline import langley_cam as C
from cad_pipeline.langley_bodies import body

I4 = [[1.0, 0, 0, 0], [0, 1.0, 0, 0], [0, 0, 1.0, 0], [0, 0, 0, 1.0]]
rad = math.radians
PAWL_GAP = 0.1                      # the pawl rides this far under the sparker cam
_CTX = None


def ctx():
    """The geometry context (kinematics, gear-train layouts, spring anchors), built once."""
    global _CTX
    if _CTX is None:
        from cad_pipeline.langley_v1 import build
        _CTX = build().c
    return _CTX


# ---------------------------------------------------------------- transforms
def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def translate(x=0.0, y=0.0, z=0.0):
    m = [row[:] for row in I4]
    m[0][3], m[1][3], m[2][3] = x, y, z
    return m


def rotate_x(angle, pivot_yz=(0.0, 0.0)):
    """Rotation by `angle` radians about the line through (*, pivot y, pivot z) parallel to X; positive turns Y toward Z."""
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


def along(alpha, d):
    """Translation by `d` mm along the direction of angle `alpha` (radians from +Z, toward crank rotation)."""
    return translate(0.0, -d * math.sin(alpha), d * math.cos(alpha))


# ---------------------------------------------------------------- slider crank
def alpha(k):
    return ctx().alphas[k]


def pin(theta):
    c = ctx()
    t = rad(theta)
    return (-c.r * math.sin(t), c.r * math.cos(t))


def slider(k, theta):
    """Gudgeon-pin distance from the shaft axis along cylinder k's axis."""
    from cad_pipeline.langley_frame import slider_position
    c = ctx()
    return slider_position(rad(theta), c.alphas[k], c.r, c.L)


def rod_angle(k, theta):
    """Direction of rod k (radians from +Z toward crank rotation): the cylinder angle plus the swing from the cylinder axis."""
    from cad_pipeline.langley_frame import rod_swing
    c = ctx()
    return c.alphas[k] + rod_swing(rad(theta), c.alphas[k], c.r, c.L)


def rod_matrix(k, theta):
    p0, p1 = pin(0.0), pin(theta)
    return mul(translate(0.0, p1[0] - p0[0], p1[1] - p0[1]), rotate_x(rod_angle(k, theta) - rod_angle(k, 0.0), p0))


def piston_matrix(k, theta):
    return along(alpha(k), slider(k, theta) - slider(k, 0.0))


# ---------------------------------------------------------------- valves
def cam_turn(theta):
    """Rotation of the ring cam from its rest orientation, degrees."""
    return C.CAM_SPEED * theta


def exhaust_rise(k, theta):
    """Punch-rod rise of cylinder k (mm): the roller rides the cam polygon."""
    return ctx().cam.roller_rise(math.degrees(alpha(k)), cam_turn(theta))


def exhaust_lift(k, theta):
    return C.exhaust_lift(exhaust_rise(k, theta))


def inlet_lift(k, theta):
    return C.inlet_lift(k + 1, theta)


def exhaust_spring_matrix(k, theta):
    c = ctx()
    s = (c.ex_spring['free'] - exhaust_lift(k, theta)) / (c.ex_spring['free'] - exhaust_lift(k, 0.0))
    a = alpha(k)
    return mul(rotate_x(a), mul(scale_z(s, c.ex_spring['top']), rotate_x(-a)))


def inlet_spring_matrix(k, theta):
    c = ctx()
    s = (c.in_spring['free'] - inlet_lift(k, theta)) / (c.in_spring['free'] - inlet_lift(k, 0.0))
    a = alpha(k)
    return mul(rotate_x(a), mul(scale_z(s, c.in_spring['bottom']), rotate_x(-a)))


# ---------------------------------------------------------------- gear trains
def cam_train_angles(theta):
    """Rotation (degrees) of the cam-train bodies for crank angle theta: external meshes reverse the sense at every step."""
    z = ctx().cam_train['teeth']
    a = -(z['P'] / z['A']) * theta                        # large gear and its coaxial small gear
    i = -(z['B'] / z['I']) * a                            # idler
    cam = -(z['I'] / z['C']) * i                          # tooth ring of the cam
    return dict(A=a, I=i, C=cam)


def ignition_angles(theta):
    z = ctx().ign_train['teeth']
    large = -(z['P'] / z['L']) * theta                    # large gear with the distributor disc and brush
    sparker = -(z['L'] / z['S']) * large                  # sparker pinion and cam
    return dict(L=large, S=sparker)


def sparker_pawl_drop(theta):
    """How far (mm) the sparker cam presses the pawl down from its rest height: the pawl's top stays PAWL_GAP under the lowest cam surface over its width."""
    s = ctx().sparker
    cy, cz = s['centre']
    y_lo, y_hi, z_top = cy - 8.0, cy + 32.0, cz - 10.0
    psi = rad(ignition_angles(theta)['S'])
    c_, s_ = math.cos(psi), math.sin(psi)
    pts = []
    for n in range(72):
        a = 5.0 * n
        d = abs(((a - s['crest_0'] + 180.0) % 360.0) - 180.0)
        r = s['base_r'] + (s['lobe_r'] * (0.5 + 0.5 * math.cos(math.pi * d / s['lobe_half'])) if d < s['lobe_half'] else 0.0)
        x, y = r * math.cos(rad(a)), r * math.sin(rad(a))
        pts.append((cy + c_ * x - s_ * y, cz + s_ * x + c_ * y))
    lowest = 1e9
    for i in range(len(pts)):
        (y1, z1), (y2, z2) = pts[i], pts[(i + 1) % len(pts)]
        for y in (y1, y2):
            if y_lo <= y <= y_hi:
                lowest = min(lowest, z1 if y == y1 else z2)
        for y in (y_lo, y_hi):                            # the edge's height where it crosses either end of the pawl
            if (y1 - y) * (y2 - y) < 0:
                lowest = min(lowest, z1 + (z2 - z1) * (y - y1) / (y2 - y1))
    return max(0.0, z_top - (lowest - PAWL_GAP))


# ---------------------------------------------------------------- per-part matrices
def matrix(part_id, theta):
    """Transform of `part_id` at crank angle `theta` degrees (identity for parts that do not move)."""
    b = body(part_id)
    if b == 'static':
        return I4
    c = ctx()
    t = rad(theta)
    if b == 'crank':
        return rotate_x(t)
    if b == 'cam':
        return rotate_x(rad(cam_turn(theta)))
    if b == 'camA':
        return rotate_x(rad(cam_train_angles(theta)['A']), c.cam_train['centres']['A'])
    if b == 'camI':
        return rotate_x(rad(cam_train_angles(theta)['I']), c.cam_train['centres']['I'])
    if b == 'distributor':
        return rotate_x(rad(ignition_angles(theta)['L']), c.ign_train['centres']['L'])
    if b == 'sparkercam':
        return rotate_x(rad(ignition_angles(theta)['S']), c.ign_train['centres']['S'])
    if b == 'pawl':
        return translate(0.0, 0.0, -sparker_pawl_drop(theta))
    if b == 'pawlspring':
        top = c.sparker['centre'][1] - 9.4 + 14.0
        return scale_z((14.0 + sparker_pawl_drop(theta)) / 14.0, top)
    if b.startswith('rod'):
        return rod_matrix(int(b[3:]) - 1, theta)
    if b.startswith('piston'):
        return piston_matrix(int(b[6:]) - 1, theta)
    if b.startswith('exhaustspring'):
        return exhaust_spring_matrix(int(b[13:]) - 1, theta)
    if b.startswith('exhaust'):
        k = int(b[7:]) - 1
        return along(alpha(k), exhaust_lift(k, theta) - exhaust_lift(k, 0.0))
    if b.startswith('inletspring'):
        return inlet_spring_matrix(int(b[11:]) - 1, theta)
    if b.startswith('inlet'):
        k = int(b[5:]) - 1
        return along(alpha(k), -(inlet_lift(k, theta) - inlet_lift(k, 0.0)))
    if b.startswith('punch'):
        k = int(b[5:]) - 1
        return along(alpha(k), exhaust_rise(k, theta) - exhaust_rise(k, 0.0))
    raise ValueError('no motion for body ' + b)


def pivot(part_id):
    """A point (CAD mm) on the fixed axis of a part that only turns about one fixed axis, else None.

    The exported file puts the part's origin there, so the key frames hold a pure rotation about a fixed node origin and linear interpolation between two keys
    keeps the axis where it is."""
    b = body(part_id)
    c = ctx()
    if b in ('crank', 'cam'):
        return (0.0, 0.0, 0.0)
    if b == 'camA':
        return (0.0,) + tuple(c.cam_train['centres']['A'])
    if b == 'camI':
        return (0.0,) + tuple(c.cam_train['centres']['I'])
    if b == 'distributor':
        return (0.0,) + tuple(c.ign_train['centres']['L'])
    if b == 'sparkercam':
        return (0.0,) + tuple(c.ign_train['centres']['S'])
    return None


def rest_rotation(part_id):
    """Rotation (radians about +X) that carries a part's own frame to the CAD frame, for the parts whose motion is a scale along an axis that is not a CAD axis.

    The exported mesh of such a part is stored in its own frame and its node carries this rotation, so the key frames hold a plain scale along the node's Z."""
    b = body(part_id)
    if b.startswith('exhaustspring') or b.startswith('inletspring'):
        return alpha(int(b[-1]) - 1)
    return 0.0
