"""Cycle timing and the double-pointed ring cam of the Langley radial: one source for the rest-pose geometry and the operating motion.

Crank angle `theta` is in degrees; two crank turns (0 to 720) make one four-stroke cycle. Angles about the shaft are measured from +Z in the direction of
crank rotation (a rotation about +X); a point at radius r and angle phi is at (Y, Z) = (-r sin phi, r cos phi).

What the sources give and what is a teaching choice (operating-motion.md): the firing order 1-3-5-2-4, the cam at one quarter crank speed in reverse with two
lobes, and the 1/64 in gap between punch rod and exhaust stem are documented. The cam phase follows from one choice, the exhaust timing: the exhaust valve of a
cylinder is at peak lift in the middle of its exhaust stroke, 270 degrees after its power top dead centre. Lobe width, rise, valve lift and the inlet-valve
window are illustrative.
"""
import math

FIRING_ORDER = (1, 3, 5, 2, 4)
FIRING_INTERVAL = 720.0 / len(FIRING_ORDER)                       # 144 degrees
POWER_TDC_1 = 360.0               # cylinder 1 is at the top of its exhaust stroke at the rest pose (theta = 0), so its power top dead centre is half a cycle on
POWER_TDC = {cyl: (POWER_TDC_1 + FIRING_INTERVAL * j) % 720.0 for j, cyl in enumerate(FIRING_ORDER)}
CAM_SPEED = -0.25                 # ring cam speed as a fraction of crank speed (reverse, documented)
EXHAUST_PEAK_AFTER_TDC = 270.0    # illustrative: peak lift in the middle of the exhaust stroke
SPARK_ADVANCE = 20.0              # illustrative: contact breaks 20 degrees before power top dead centre
INLET_PEAK_AFTER_TDC, INLET_HALF_WINDOW, INLET_LIFT = 450.0, 50.0, 6.0   # illustrative automatic inlet valve: opens mid intake stroke by suction
EXHAUST_GAP = 0.397               # punch rod to exhaust stem at rest (1/64 in, documented)

BASE, ROLLER_R, ROLLER_GAP = 60.0, 8.0, 0.1                       # cam base circle, punch-rod roller radius, clearance kept between roller and cam


def wrap(theta):
    return theta % 720.0


def xy(r, phi_deg):
    p = math.radians(phi_deg)
    return (-r * math.sin(p), r * math.cos(p))


def lobe_phase():
    """Direction (degrees) of a cam lobe centre at the rest pose: the lobe is under cylinder 1 when its exhaust valve peaks, and the cam turns -1/4 as fast as the crank."""
    peak_1 = wrap(POWER_TDC[1] + EXHAUST_PEAK_AFTER_TDC)
    return (peak_1 * -CAM_SPEED) % 180.0                         # lobe at 0 - theta/4 * ... : phi(theta) = phase - theta/4 = 0 at theta = peak_1


def exhaust_peak(cyl):
    return wrap(POWER_TDC[cyl] + EXHAUST_PEAK_AFTER_TDC)


def inlet_lift(cyl, theta):
    """Automatic inlet valve: a raised cosine window through the middle of the intake stroke (illustrative)."""
    d = ((theta - wrap(POWER_TDC[cyl] + INLET_PEAK_AFTER_TDC) + 360.0) % 720.0) - 360.0
    if abs(d) >= INLET_HALF_WINDOW:
        return 0.0
    return INLET_LIFT * (0.5 + 0.5 * math.cos(math.pi * d / INLET_HALF_WINDOW))


def spark_theta(cyl):
    return wrap(POWER_TDC[cyl] - SPARK_ADVANCE)


class Cam:
    """Two-lobe ring cam: a base circle and raised-cosine lobes, written as a polygon with vertices every `step` degrees starting at a lobe centre."""

    def __init__(self, rise, half_width, phase, base=BASE, step=2.0):
        self.rise, self.half, self.phase, self.base, self.step = rise, half_width, phase, base, step
        self.n = int(round(360.0 / step))
        self._points = [xy(base + self.bump(phase + step * i), phase + step * i) for i in range(self.n)]
        self._phis = [phase + step * i for i in range(self.n)]

    def bump(self, phi):
        """Lobe height above the base circle at direction phi (degrees) for lobe centres at `phase` and `phase` + 180."""
        d = abs(((phi - self.phase + 90.0) % 180.0) - 90.0)
        return self.rise * (0.5 + 0.5 * math.cos(math.pi * d / self.half)) if d < self.half else 0.0

    def polygon(self):
        """Outline points (Y, Z) of the cam in its rest orientation."""
        return list(self._points)

    def roller_rise(self, cyl_phi, cam_turn=0.0, gap=ROLLER_GAP):
        """How far a punch-rod roller on cylinder direction `cyl_phi` rides above its base-circle position when the cam has turned `cam_turn` degrees.

        The roller centre moves along the cylinder direction until the roller (radius ROLLER_R) clears the cam outline by `gap` mm: exact contact against the
        polygon, not the nominal lobe height, because a roller on a flank sits higher than the profile under its centre."""
        rel = cyl_phi - cam_turn                                  # the cylinder direction seen in the cam's rest frame
        unit = (-math.sin(math.radians(rel)), math.cos(math.radians(rel)))
        index = int(round((rel - self.phase) / self.step))
        span = int(math.ceil((ROLLER_R + 6.0) / (self.base * math.radians(self.step)))) + 6
        edges = [(self._points[(index + k) % self.n], self._points[(index + k + 1) % self.n]) for k in range(-span, span)]

        def clearance(rho):
            p = (rho * unit[0], rho * unit[1])
            best = 1e9
            for a, b in edges:
                ex, ey = b[0] - a[0], b[1] - a[1]
                t = max(0.0, min(1.0, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey)))
                best = min(best, math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey))
            return best - (ROLLER_R + gap)

        ref = self.base + ROLLER_R + gap
        if clearance(ref) >= 0.0:
            return 0.0
        lo, hi = ref, ref + self.rise + 6.0
        for _ in range(48):
            mid = 0.5 * (lo + hi)
            if clearance(mid) < 0.0:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi) - ref


def exhaust_lift(rise):
    """Exhaust-valve lift for a punch-rod rise: nothing until the rod has taken up the 1/64 in gap."""
    return max(0.0, rise - EXHAUST_GAP)
