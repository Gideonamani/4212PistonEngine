"""Rigid frames for the Langley radial: every part is written in a local frame and placed by a rotation about the shaft axis.

Engine axes: X along the crankshaft toward starboard, Z up, Y completing a right-handed frame. Cylinder k's axis is Z rotated about +X by
alpha_k = 72 (k-1) degrees; crank angle theta is also a rotation about +X, so the crank pin points at cylinder k when theta = alpha_k.

A feature (box, cylinder, tube, cone, sphere, prism, revolve, helix) has a local `origin`, `axis` and `roll`. Placing it in a frame rotates
the origin and axis and adds the roll that keeps boxes and prisms oriented, because the builders turn local Z onto the axis by the shortest arc.
"""
import math

def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]

def mat_vec(a, v):
    return [sum(a[i][k] * v[k] for k in range(3)) for i in range(3)]

def rot_x(angle):
    c, s = math.cos(angle), math.sin(angle)
    return [[1, 0, 0], [0, c, -s], [0, s, c]]

def rot_z(angle):
    c, s = math.cos(angle), math.sin(angle)
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]]

def z_to(axis):
    """Matrix turning Z onto `axis` by the shortest arc (what FreeCAD's Rotation(Vector(0,0,1), axis) does)."""
    n = math.sqrt(sum(x * x for x in axis))
    a = [x / n for x in axis]
    dot = a[2]
    if dot > 1 - 1e-12:
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    if dot < -1 + 1e-12:
        return [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]               # half turn about Y, which is what FreeCAD's Rotation(Z, -Z) does
    k = [-a[1], a[0], 0.0]                                       # Z x a
    s = math.sqrt(k[0] ** 2 + k[1] ** 2)
    k = [k[0] / s, k[1] / s, 0.0]
    c = dot
    sn = s
    kx = [[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]]
    kk = mat_mul(kx, kx)
    return [[(1 if i == j else 0) + sn * kx[i][j] + (1 - c) * kk[i][j] for j in range(3)] for i in range(3)]

def r6(x):
    """Round for readable specs; -0.0 becomes 0.0."""
    return round(x, 6) + 0.0

class Frame:
    """A rotation about X by `angle` (radians) followed by a translation `t` (mm), applied to local features."""
    def __init__(self, angle=0.0, t=(0.0, 0.0, 0.0)):
        self.angle, self.t = angle, tuple(t)
        self.R = rot_x(angle)

    def point(self, p):
        q = mat_vec(self.R, p)
        return [q[i] + self.t[i] for i in range(3)]

    def direction(self, v):
        return mat_vec(self.R, v)

    def then(self, other):
        """Frame equal to applying `self` first and `other` second (both are rotations about X, so angles add)."""
        t = other.point(self.t)
        return Frame(self.angle + other.angle, t)

    def feature(self, f):
        g = dict(f)
        origin = f.get('origin', [0, 0, 0])
        g['origin'] = [r6(x) for x in self.point(origin)]
        axis = f.get('axis', [0, 0, 1])
        new_axis = self.direction(axis)
        g['axis'] = [r6(x) for x in new_axis]
        roll = math.radians(f.get('roll', 0.0))
        q_old = mat_mul(z_to(axis), rot_z(roll))
        q_new = mat_mul(self.R, q_old)
        residual = mat_mul([list(r) for r in zip(*z_to(new_axis))], q_new)      # a rotation about Z
        g['roll'] = r6(math.degrees(math.atan2(residual[1][0], residual[0][0])))
        if g['roll'] == 0.0:
            del g['roll']
        return g

    def features(self, fs):
        return [self.feature(f) for f in fs]

def slider_position(theta, alpha, r, rod):
    """Distance from the shaft axis to the gudgeon pin along cylinder axis alpha when the crank is at theta (radians)."""
    psi = theta - alpha
    return r * math.cos(psi) + math.sqrt(rod * rod - (r * math.sin(psi)) ** 2)

def rod_swing(theta, alpha, r, rod):
    """Angle (radians) of the rod from the cylinder axis, positive in the direction of crank rotation."""
    psi = theta - alpha
    return math.asin(r * math.sin(psi) / rod) * -1.0 + 0.0

def pin_centre(theta, r):
    """Crank-pin centre (Y, Z) with the pin pointing at cylinder 1 when theta is zero."""
    return (-r * math.sin(theta), r * math.cos(theta))
