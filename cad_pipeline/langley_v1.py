"""Source-led Langley / Manly-Balzer 1903 radial: the part specification.

Read cad-studies/langley-manly-balzer-1903/research.md and operating-motion.md before changing it. Documented values are from the 1911 Memoir (M1)
and the 1971 Annals of Flight 6 (A1); `measured` values are read from Plates 78-81 with a calibrated scale and carry that method; `inferred` values are
teaching estimates. Nothing here is a manufacturing drawing or an authenticated running model.

Every part is written in a local frame (cylinder frame, rod frame, piston frame) and placed by a rotation about the shaft axis (`langley_frame`).
The rest pose has the crank at theta = 0, cylinder 1 at top dead centre as drawn in Plate 78; every other pose follows from the slider-crank
kinematics, none is typed in. The subsystems are in `langley_crank`, `langley_cylinder`, `langley_drum`, `langley_drive`, `langley_pipes` and
`langley_flywheel`; each adds its parts to a `Spec` using a shared context `C` of parameters and kinematics.
"""
import json, math, sys
from pathlib import Path
from types import SimpleNamespace
from cad_pipeline.langley_frame import Frame, slider_position, rod_swing, pin_centre
R = Path(__file__).resolve().parents[1]
S = R / 'cad-studies/langley-manly-balzer-1903'
IN = 25.4
D2R = math.pi / 180.0


def arc_points(cz, rs, r0, r1, n):
    """Points (r, z) along a sphere of radius rs centred at axial position cz from radius r0 to r1, on the upper side."""
    return [(r0 + (r1 - r0) * i / n, cz + math.sqrt(max(rs * rs - (r0 + (r1 - r0) * i / n) ** 2, 0.0))) for i in range(n + 1)]


def circle_profile(cr, cz, rad, n=16, start=0.0):
    """A closed polygon (r, z) approximating a circle of radius `rad` centred at (cr, cz)."""
    return [(cr + rad * math.cos(start + 2 * math.pi * i / n), cz + rad * math.sin(start + 2 * math.pi * i / n)) for i in range(n)]


class Spec:
    def __init__(self):
        self.params, self.parts, self.derived = {}, [], {}
        self.sources = {
            'M1': {'url': 'https://archive.org/details/langleymemoironm00langrich', 'path': 'build/langley-research/memoir-1911.pdf'},
            'A1': {'url': 'https://doi.org/10.5479/si.AnnalsFlight.6', 'path': 'build/langley-research/annals-of-flight-6-lores.pdf'},
            'P78': {'path': 'build/langley-research/pages/hi_418_rot.png', 'text': 'Memoir Plate 78 page renders, per-half calibration in plates.json'}}

    def par(self, name, value, status, refs, why, unit='mm', method=None):
        p = dict(value=value, unit=unit, status=status, source_ids=list(refs), rationale=why)
        if method:
            p['method'] = method
        self.params[name] = p
        return value

    def add(self, pid, label, group, features, material='steel', evidence='', frame=None):
        if any(p['id'] == pid for p in self.parts):
            raise ValueError('Duplicate part ' + pid)
        feats = frame.features(features) if frame else features
        self.parts.append(dict(id=pid, label=label, group=group, material=material, evidence=evidence or 'Plates 78-81 and M1 Ch. X; see the research dossier', features=feats))

    def spec(self):
        return dict(schema_version=1, model_id='langley-manly-balzer-1903', units='mm', input_mode='mixed',
                    scope='Large 5 x 5.5 in water-cooled stationary radial of Langley Aerodrome A (built 1901): engine proper, flywheels and shaft stubs. Teaching reconstruction from the 1911 Memoir drawings; not a manufacturing drawing, not an authenticated running model.',
                    sources=self.sources, parameters=self.params, parts=self.parts,
                    tessellation=dict(default_mm=0.4, groups={'piston': 0.02, 'liner': 0.02, 'crank': 0.03, 'bearing': 0.03, 'cylinder': 0.2, 'shell': 0.04, 'jacket': 0.04, 'rod': 0.1, 'valve': 0.05, 'pipe': 0.3, 'ignition': 0.1}))


# ---- feature constructors (local frame, numbers in mm)
def cy(r, h, o=(0, 0, 0), axis=(0, 0, 1), op='add', label=''):
    return dict(primitive='cylinder', radius=r, height=h, origin=list(o), axis=list(axis), operation=op, label=label or 'Cylinder')

def tube(ro, ri, h, o=(0, 0, 0), axis=(0, 0, 1), op='add', label=''):
    return dict(primitive='tube', radius=ro, inner_radius=ri, height=h, origin=list(o), axis=list(axis), operation=op, label=label or 'Tube')

def cone(r1, r2, h, o=(0, 0, 0), axis=(0, 0, 1), op='add', label=''):
    return dict(primitive='cone', radius1=r1, radius2=r2, height=h, origin=list(o), axis=list(axis), operation=op, label=label or 'Cone')

def bx(l, w, h, o=(0, 0, 0), axis=(0, 0, 1), roll=0.0, op='add', label=''):
    f = dict(primitive='box', length=l, width=w, height=h, origin=list(o), axis=list(axis), operation=op, label=label or 'Block')
    if roll:
        f['roll'] = roll
    return f

def prism(points, h, o=(0, 0, 0), axis=(0, 0, 1), roll=0.0, op='add', label=''):
    f = dict(primitive='prism', points=[[round(p[0], 6), round(p[1], 6)] for p in points], height=h, origin=list(o), axis=list(axis), operation=op, label=label or 'Prism', derived=True)
    if roll:
        f['roll'] = roll
    return f

def rev(points, o=(0, 0, 0), axis=(0, 0, 1), angle=360.0, roll=0.0, op='add', label=''):
    f = dict(primitive='revolve', points=[[round(p[0], 6), round(p[1], 6)] for p in points], origin=list(o), axis=list(axis), operation=op, label=label or 'Revolved section', derived=True)
    if angle != 360.0:
        f['angle'] = angle
    if roll:
        f['roll'] = roll
    return f

def helix(r, wire, pitch, h, o=(0, 0, 0), axis=(0, 0, 1), label=''):
    return dict(primitive='helix', radius=r, wire_radius=wire, pitch=pitch, height=h, origin=list(o), axis=list(axis), operation='add', label=label or 'Spring wire')

def about_x(r_in, r_out, x0, x1, angle, centre_deg, o=(0, 0, 0), op='add', label=''):
    """A sector of a tube (axis parallel to X) from x0 to x1 and radius r_in..r_out, `angle` degrees wide, centred on the direction
    `centre_deg` degrees about +X from local +Z. `o` is the (y, z) of the axis."""
    profile = [(r_in, 0.0), (r_out, 0.0), (r_out, x1 - x0), (r_in, x1 - x0)]
    return rev(profile, o=[x0, o[1], o[2]], axis=(1, 0, 0), angle=angle, roll=180.0 + centre_deg - angle / 2.0, op=op, label=label)


def context(theta=0.0):
    """Parameters with provenance, and the kinematics of the rest pose."""
    sp = Spec()
    par = sp.par
    c = SimpleNamespace()
    c.bore = par('bore', 127.0, 'specified', ['A1'], 'Bore 5 in (A1 p. 156, p. 182).')
    c.stroke = par('stroke', 139.7, 'specified', ['A1'], 'Stroke 5.5 in (A1 p. 156).')
    c.r = par('crank_radius', c.stroke / 2, 'inferred', ['A1'], 'Half the documented stroke.')
    c.shell_wall = par('shell_wall', 1.5875, 'specified', ['M1'], 'Steel shell 1/16 in (M1 p. 235).')
    c.liner_wall = par('liner_wall', 1.5875, 'specified', ['M1'], 'Cast-iron liner 1/16 in (M1 p. 235).')
    c.jacket_sheet = par('jacket_sheet', 0.508, 'specified', ['M1'], 'Sheet-steel water jacket 0.020 in (M1 p. 235).')
    c.rod_d = par('rod_diameter', 22.225, 'specified', ['M1'], 'Rods 7/8 in (M1 p. 240, page image).')
    c.rod_hole = par('link_rod_hole', 15.875, 'specified', ['M1'], 'Link rods have a 5/8 in hole (M1 p. 240, page image).')
    c.pin_d = par('gudgeon_pin_diameter', 22.225, 'specified', ['M1'], 'Hollow case-hardened gudgeon pins 7/8 in (M1 p. 240, page image).')
    c.L = par('rod_length', 288.0, 'inferred', ['M1', 'A1'], 'Gudgeon-pin to crank-pin axis. Not documented. Bounds: shoe clearance (about 278 mm for 55 degree shoes) and the 37 in overall diameter taken over the cylinder jackets: 2 x (r + L + 112.9 mm above the pin) = 37 in. The fold-out of Plate 78 hides the strip that would measure it.', method='Overall diameter 37 in (A1 p. 156) minus the jacket top above the pin (Plate 78A) minus the crank radius.')
    c.jacket_r = par('jacket_outer_radius', 75.7, 'measured', ['P78'], 'Jacket outer radius.', method='Plate 78A, right wall x = 2185 px, cylinder axis x = 1739 px, 149.6 px/in.')
    c.z_pin = c.r + c.L                               # gudgeon-pin height above the shaft axis at TDC
    c.R_b = c.bore / 2
    c.R_l = c.R_b + c.liner_wall
    c.R_s = c.R_l + c.shell_wall
    par('shell_outer_radius', c.R_s, 'inferred', ['M1'], 'Bore radius plus the two documented walls.')
    c.c_flange = par('cylinder_flange_height', 132.0, 'inferred', ['P78'], 'Open end of the cylinder barrel above the shaft axis. Plate 78B shows the section walls ending at 104 mm, but two neighbouring 133 mm shells (axes 72 degrees apart) only clear each other from 1.176 x height >= 133.4, i.e. 113.4 mm, and a flange wider than the shell needs about 140 mm of centre distance at its height; the plate section does not show the neighbours. 132 mm gives a flange 140 mm wide across the cylinder plane with 15 mm to spare.', method='Measured 104 mm on Plate 78B (row 50 px, axis row 648 px, 145.7 px/in); raised so that neighbouring shells and flanges do not overlap.')
    c.dome_h = par('dome_height', 32.0, 'measured', ['P78'], 'Dome apex above the barrel top.', method='Plate 78A rows 1250 and 1062.')
    c.valve_x = par('valve_axis_x', -112.7, 'measured', ['P78'], 'Offset of the inlet and exhaust valve axis from the cylinder axis, toward the port drum.', method='Plate 78A, stem at x = 1075 px, cylinder axis 1739 px, 149.6 px/in.')
    c.theta = theta
    c.cam_rise = par('cam_rise', 12.4, 'inferred', ['M1'], 'Rise of a cam lobe: valve lift 12.0 mm plus the documented 1/64 in (0.397 mm) gap. Lift and lobe form are not documented and are illustrative.')
    c.lobe_half = par('cam_lobe_half_width', 15.0, 'inferred', ['M1'], 'Half width of a cam lobe in cam degrees (illustrative).', unit='deg')

    def lobe_h(phi):
        d = abs(((phi + 90.0) % 180.0) - 90.0)                  # distance from the nearest lobe centre; lobes sit at 0 and 180 degrees at the rest pose
        return c.cam_rise * (0.5 + 0.5 * math.cos(math.pi * d / c.lobe_half)) if d < c.lobe_half else 0.0
    c.lobe_h = lobe_h
    c.cam_h = [lobe_h(72.0 * k) for k in range(5)]              # lobe height under each punch-rod roller at the rest pose
    c.ex_lift = [max(0.0, h - 0.397) for h in c.cam_h]          # exhaust valve lift at the rest pose
    c.alphas = [72.0 * k * D2R for k in range(5)]
    c.crank = pin_centre(theta, c.r)                  # (Y, Z) of the crank-pin centre
    c.pins = [slider_position(theta, a, c.r, c.L) for a in c.alphas]
    c.swings = [rod_swing(theta, a, c.r, c.L) for a in c.alphas]
    c.u = lambda dz: c.z_pin + dz                     # height along the cylinder axis for a height `dz` above the pin at TDC
    # X layout (starboard positive), estimated from Plates 78B, 79 and 80; refined by the overlay and the audit
    c.sleeve_x = par('sleeve_half_length', 66.0, 'inferred', ['P78'], 'Master sleeve with its nuts spans X = +/-66 mm between the crank webs.')
    c.web_x = par('web_inner_x', 70.0, 'inferred', ['P78'], 'Inner faces of the two crank webs at X = +/-70 mm.')
    c.water_in = (98.0, c.u(5.0), 10.0)               # starboard water inlet ring: X, radius of the ring circle, tube radius (circle on Plate 78A)
    c.water_out = (-186.0, c.u(76.0), 11.9)           # port water outlet ring
    sp.derived = dict(L=c.L, r=c.r, z_pin=c.z_pin, pins=c.pins, swings=c.swings)
    return sp, c


def build(theta=0.0, subsystems=None):
    from cad_pipeline import langley_crank, langley_cylinder, langley_drum, langley_drive, langley_pipes, langley_flywheel
    sp, c = context(theta)
    for module in (langley_crank, langley_cylinder, langley_drum, langley_drive, langley_pipes, langley_flywheel):
        if subsystems is None or module.__name__.rsplit('.', 1)[-1] in subsystems:
            module.add(sp, c)
    return sp


def main():
    sp = build()
    spec = sp.spec()
    from cad_pipeline.spec import validate_spec
    validate_spec(spec)
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else S / 'part-spec.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(spec, indent=1) + '\n')
    print('parts', len(spec['parts']), 'features', sum(len(p['features']) for p in spec['parts']), '->', out)
    print('derived', {k: (round(v, 3) if isinstance(v, float) else [round(x, 3) for x in v]) for k, v in sp.derived.items()})


if __name__ == '__main__':
    main()
