"""Circular manifolds: inlet gas ring in three flanged segments with five branches, water inlet ring (starboard) and water outlet ring (port).

The rings are tubes bent to circles about the shaft axis. Their radii and diameters come from the circle sections on Plate 78A (inlet 78.4 mm tube at 493.65 mm,
water outlet 23.8 mm at 433.85 mm, water inlet 20 mm at 362.85 mm). Their wall thickness is not drawn; the weight table (inlet manifold 1,700 g, outlet pipe
450 g, inlet pipe 360 g) fixes it at a quarter to a third of a millimetre, so they are modelled as thin sheet tubes.

Angles are degrees from +Z in the direction of crank rotation. A frame `Frame(phi)` has local +Z along the radial direction at phi and local -Y along the
direction of increasing phi.
"""
import math
from cad_pipeline.langley_frame import Frame
from cad_pipeline.langley_v1 import cy, tube, circle_profile


def torus(x, big_r, rad, wall, phi0=0.0, angle=360.0, label='Ring', n=20):
    """Hollow circular tube about the X axis: outer solid and bore cut, from phi0 through `angle` degrees (a full ring when angle is 360)."""
    outer = [[round(a, 6), round(b, 6)] for a, b in circle_profile(big_r, 0.0, rad, n)]
    inner = [[round(a, 6), round(b, 6)] for a, b in circle_profile(big_r, 0.0, rad - wall, n)]
    full = angle >= 360.0
    f_out = dict(primitive='revolve', points=outer, origin=[x, 0, 0], axis=[1, 0, 0], operation='add', label=label + ' tube', derived=True)
    f_in = dict(primitive='revolve', points=inner, origin=[x, 0, 0], axis=[1, 0, 0], operation='cut', label=label + ' bore', derived=True)
    if not full:
        f_out.update(angle=angle, roll=180.0 + phi0)
        f_in.update(angle=angle + 2.0, roll=180.0 + phi0 - 1.0)
    return [f_out, f_in]


def add(sp, c):
    par = sp.par
    vx = c.valve_x
    u = c.u
    # ---------------------------------------------------------------- inlet gas manifold
    inlet_r, inlet_big = 39.2, u(135.8)
    wall_i = par('inlet_manifold_wall', 0.24, 'inferred', ['M1'], 'Wall of the inlet manifold tube. Not drawn; the weight table (1,700 g) with the measured ring (78.4 mm tube, radius 493.65 mm) gives about 0.24 mm once the flanges are counted.', method='1,700 g over steel density, ring length 3,101 mm and tube circumference 246 mm, branches and flanges included.')
    joints = {'A': (36.0, 144.0, (1, 2)), 'B': (180.0, 144.0, (3, 4)), 'C': (324.0, 72.0, (0,))}
    for name, (phi0, ang, cylinders) in joints.items():
        feats = torus(vx, inlet_big, inlet_r, wall_i, phi0, ang, 'Inlet ring', n=28)
        h0 = u(101.65)
        for k in cylinders:
            fr = Frame(c.alphas[k])
            branch_r = inlet_r - 0.2                                  # a branch exactly as wide as the ring would meet it tangentially, which the Boolean cannot resolve
            feats += fr.features([tube(branch_r, branch_r - wall_i, inlet_big - h0, [vx, 0, h0], label='Branch tube'),
                                  cy(branch_r - wall_i + 0.04, 44.0, [vx, 0, inlet_big - 42.0], op='cut', label='Branch opening into the ring')])   # 0.04 mm wider than the branch bore so the two surfaces are not coincident])
        if name == 'B':
            feats += Frame(math.radians(252.0)).features([cy(24.0 - wall_i, 6.0 + wall_i, [vx, 0, inlet_big + inlet_r - 6.0], op='cut', label='Carburetor opening')])
        sp.add(f'InletRing{name}', f'Inlet gas manifold segment {name}', 'pipe', feats, 'steel', 'M1 p. 240: tube bent to a circle with five branches, cut in three places; diameter and radius measured on Plate 78A; wall from the weight table', None)
    t_ = 3.0
    for phi, (end_label, start_label) in zip((36.0, 180.0, 324.0), (('C2', 'A1'), ('A2', 'B1'), ('B2', 'C1'))):
        f = Frame(math.radians(phi))
        for label, y0 in ((end_label, 0.0), (start_label, -t_)):
            sp.add(f'InletFlange{label}', f'Inlet manifold flange {label}', 'pipe',
                   [f.feature(dict(primitive='tube', radius=inlet_r + 8.0, inner_radius=inlet_r + 0.3, height=t_, origin=[vx, y0, inlet_big], axis=[0, 1, 0], operation='add', label='Flange ring'))],
                   'steel', 'M1 p. 240: pipe cut in three places and joined by flanges; sizes estimated', None)
    cf = Frame(math.radians(252.0))
    top = inlet_big + inlet_r
    sp.add('CarbConnection', 'Carburetor connection stub', 'pipe', cf.features([tube(24.0, 24.0 - wall_i, 110.0, [vx, 0, top], label='Connection to the carburetor pipe')]), 'steel', 'M1 p. 240: carburetor connected to the circular pipe in line with the shaft centre; ends at the assembly boundary', None)
    sp.add('AirValvePipe', 'Air valve pipe', 'pipe', cf.features([tube(22.0, 22.0 - wall_i, 70.0, [vx, 0, top + 110.0], label='Vertical pipe'),
                                                                   cy(6.0, 60.0, [vx, -30.0, top + 150.0], (0, 1, 0), op='cut', label='Air hole'), cy(6.0, 60.0, [vx - 30.0, 0, top + 160.0], (1, 0, 0), op='cut', label='Air hole')]),
           'steel', 'M1 p. 240: rotating-sleeve auxiliary air valve on the vertical pipe', None)
    sp.add('AirValveSleeve', 'Air valve sleeve', 'pipe', cf.features([tube(23.5, 22.05, 40.0, [vx, 0, top + 135.0], label='Rotating sleeve'), cy(6.0, 60.0, [vx, -30.0, top + 150.0], (0, 1, 0), op='cut', label='Sleeve hole')]), 'steel', 'M1 p. 240: sleeve with holes brought to coincide with holes in the pipe', None)

    # ---------------------------------------------------------------- water rings
    wall_w = par('water_pipe_wall', 0.3, 'inferred', ['M1'], 'Wall of the water ring pipes; the weight table (outlet 450 g, inlet 360 g) gives 0.28-0.32 mm.', method='450 g and 360 g against the measured ring radii and tube diameters.')
    out_x, out_big, out_r = c.water_out
    in_x, in_big, in_r = c.water_in
    stub_hole = 6.2
    out_feats = torus(out_x, out_big, out_r, wall_w, label='Outlet ring')
    in_feats = torus(in_x, in_big, in_r, wall_w, label='Inlet ring')
    out_y = 45.0
    out_z = math.sqrt(out_big ** 2 - out_y ** 2)
    for k in range(5):
        fr = Frame(c.alphas[k])
        out_feats += fr.features([cy(stub_hole, 8.0, [out_x + out_r - 4.0, out_y, out_z], (1, 0, 0), op='cut', label='Stub opening')])
        in_feats += fr.features([cy(stub_hole, 8.0, [in_x - in_r - 4.0, 0, in_big], (1, 0, 0), op='cut', label='Stub opening')])
    for phi in (90.0, 270.0):
        out_feats += Frame(math.radians(phi)).features([cy(out_r + 2.0 - wall_w, 6.0, [out_x, 0, out_big + out_r - 5.0], op='cut', label='Connection opening')])
    in_feats += [cy(in_r - wall_w, 6.0, [in_x, 0, -(in_big + in_r) - 1.0], op='cut', label='Riser opening')]
    sp.add('WaterOutletRing', 'Water outlet ring (port manifold)', 'pipe', out_feats, 'steel', 'M1 p. 240: heated water leaves through a circular manifold on the port side; circle measured on Plate 78A, wall from the weight table', None)
    sp.add('WaterInletRing', 'Water inlet ring (starboard manifold)', 'pipe', in_feats, 'steel', 'M1 p. 240: cooling water enters through a circular manifold on the starboard side; circle measured on Plate 78A, wall from the weight table', None)
    sp.add('WaterInletRiser', 'Water inlet riser to the pump', 'pipe', [tube(in_r, in_r - wall_w, 170.0, [in_x, 0, -(in_big + in_r) - 170.0], label='Vertical riser')], 'steel', 'M1 p. 240: vertical pipe to the centrifugal pump; ends at the assembly boundary', None)
    for name, phi in (('Front', 90.0), ('Rear', 270.0)):
        sp.add(f'WaterOutletConnection{name}', f'Water outlet connection to the radiator, {name.lower()}', 'pipe', Frame(math.radians(phi)).features([tube(out_r + 2.0, out_r + 2.0 - wall_w, 130.0, [out_x, 0, out_big + out_r], label='Connection tube')]),
               'steel', 'M1 p. 240: two connections to the radiating tubes at the front and rear; ends at the assembly boundary', None)
