"""Coupling flanges, balance arms with braces, transmission-shaft stubs and the two tangent-spoke flywheels.

All of these turn with the crankshaft, so they are written in the crank frame (rotated by the rest-pose crank angle). Balance arms point away from the crank pin.
Flywheels (M1 pp. 242-243): 33 in diameter, U-section aluminium rims, special steel hubs, 24 tangent wire spokes of No. 10 coppered steel wire; rim weight
inversely proportional to the distance from the crank-pin centre. Tooth-free; rim thickness is solved against the weight table (3,946 g starboard, 3,234 g port).
"""
import math
from cad_pipeline.langley_frame import Frame
from cad_pipeline.langley_v1 import cy, tube, cone, bx, rev, prism

BOLT_R, BOLT_HOLE = 45.0, 4.3


def bolt_holes(x0, height):
    return [cy(BOLT_HOLE, height + 2.0, [x0 - 1.0, BOLT_R * math.cos(math.radians(45.0 + 90.0 * q)), BOLT_R * math.sin(math.radians(45.0 + 90.0 * q))], (1, 0, 0), op='cut', label='Bolt hole') for q in range(4)]


def add(sp, c):
    par = sp.par
    cf = Frame(c.theta)
    af = Frame(c.theta + math.pi)                              # arm frame: local +Z points away from the crank pin
    stub_r = par('transmission_shaft_diameter', 38.1, 'specified', ['M1'], 'Transmission shafts 1.5 in outside diameter (M1 p. 242).') / 2.0
    stub_ri = stub_r - 2.4
    arm_t = par('balance_arm_thickness', 8.5, 'inferred', ['M1'], 'Balance arm plate thickness; the arms with their braces weigh 1,040 g and 1,067 g in the weight table (M1 p. 250).')
    for side, sgn, x_end in (('Port', -1, c.shaft_x0), ('Stbd', 1, c.shaft_x1)):
        # stack outward from the shaft end: coupling flange 14, balance arm 4, transmission flange 14
        def x_span(start, thick):
            return (start, start + thick) if sgn > 0 else (start - thick, start)
        f0, f1 = x_span(x_end, 14.0)
        a0, a1 = x_span(f1 if sgn > 0 else f0, arm_t)
        t0, t1 = x_span(a1 if sgn > 0 else a0, 14.0)
        sp.add(f'CouplingFlange{side}', f'Coupling flange, {side.replace("Stbd", "starboard").lower()}', 'coupling',
               [tube(70.0, c.shaft_ri, f1 - f0, [f0, 0, 0], (1, 0, 0), label='Flange disc')] + [dict(g) for g in bolt_holes(f0, f1 - f0)], 'steel', 'M1 p. 247: flange couplings join the transmission shafts to the engine shafts; sizes estimated, bolts omitted', cf)
        arm = [cy(52.0, a1 - a0, [a0, 0, 0], (1, 0, 0), label='Clamped disc'), bx(a1 - a0, 30.0, 170.0, [a0, -15.0, 20.0], label='Balance arm'),
               prism([(-z, y) for (y, z) in ((0.0, 168.0), (24.0, 188.0), (0.0, 208.0), (-24.0, 188.0))], a1 - a0, [a0, 0, 0], (1, 0, 0), label='Lozenge lug'),
               cy(c.shaft_ri, a1 - a0 + 2.0, [a0 - 1.0, 0, 0], (1, 0, 0), op='cut', label='Shaft clearance')] + bolt_holes(a0, a1 - a0)
        sp.add(f'BalanceArm{side}', f'Balance arm, {side.replace("Stbd", "starboard").lower()}', 'balance', arm, 'steel', 'M1 p. 247: flat arm bolted between the coupling flanges ending in a lozenge-shaped lug; sizes estimated', af)
        stub = [tube(60.0, stub_ri, t1 - t0, [t0, 0, 0], (1, 0, 0), label='Transmission flange'),
                tube(stub_r, stub_ri, 94.0, [(t1 - 4.0) if sgn > 0 else (t0 - 90.0), 0, 0], (1, 0, 0), label='Transmission shaft stub')] + bolt_holes(t0, t1 - t0)
        sp.add(f'TransShaftStub{side}', f'Transmission shaft stub, {side.replace("Stbd", "starboard").lower()}', 'coupling', stub, 'steel', 'M1 p. 242: tubular transmission shaft 1.5 in outside diameter; the shaft beyond the stub, its gears and the propeller are outside the assembly', cf)
        # brace: inclined tube from a plate on the lug to a collar on the stub
        plate_x0, plate_x1 = x_span(a1 if sgn > 0 else a0, 4.0)
        sp.add(f'BalanceBracePlate{side}', f'Balance brace plate, {side.replace("Stbd", "starboard").lower()}', 'balance', [bx(plate_x1 - plate_x0, 30.0, 30.0, [plate_x0, -15.0, 172.0], label='Plate')], 'steel', 'M1 p. 247: plate fastened to the lug by small bolts', af)
        # the plate and the transmission flange both sit outboard of the arm: shift the plate outboard of the flange stack's arm layer
        # (the transmission flange occupies the layer next to the arm, so the plate and brace are placed at the arm's outer layer only where there is no flange: radius 172+)
        p1 = (plate_x1 if sgn > 0 else plate_x0)
        collar_x0 = (p1 + sgn * 81.0)
        collar0, collar1 = (collar_x0 - 7.0, collar_x0 + 7.0)
        dx, dz = sgn * 81.0, -(172.0 + 15.0 - 28.0)
        length = math.hypot(dx, dz)
        ux, uz = dx / length, dz / length
        start, trim = 14.0, 4.0                                      # the tube starts clear of the plate and ends clear of the collar: a tilted end cap would otherwise bite into both
        sp.add(f'BalanceBrace{side}', f'Balance brace tube, {side.replace("Stbd", "starboard").lower()}', 'balance', [dict(primitive='tube', radius=7.0, inner_radius=5.8, height=length - start - trim, origin=[p1 + ux * start, 0.0, 187.0 + uz * start], axis=[ux, 0.0, uz], operation='add', label='Brace tube')], 'steel', 'M1 p. 247: tube inclined about 30 degrees to the arm', af)
        sp.add(f'BalanceBraceCollar{side}', f'Balance brace collar, {side.replace("Stbd", "starboard").lower()}', 'balance', [tube(28.0, stub_r + 0.05, collar1 - collar0, [collar0, 0, 0], (1, 0, 0), label='Collar on the transmission shaft')], 'steel', 'M1 p. 247: collar fastened around the transmission shaft', cf)

    # ---------------------------------------------------------------- flywheels
    r_out = par('flywheel_outer_radius', 419.1, 'inferred', ['M1'], 'Rims 33 in in diameter (M1 p. 243, steel automobile-wheel rims); the aluminium rims are assumed to match.')
    for side, xc, t_rim in (('Port', -232.0, 3.15), ('Stbd', 195.0, 4.65)):
        w, depth = 20.0, 22.0
        t = par(f'flywheel_rim_thickness_{side.lower()}', t_rim, 'inferred', ['M1'], f'U-section rim thickness, set so that the {side.lower()} flywheel weighs {"3,234" if side == "Port" else "3,946"} g (M1 p. 250).', unit='mm')
        U = [(r_out, -w), (r_out, w), (r_out - depth, w), (r_out - depth, w - t), (r_out - t, w - t), (r_out - t, -w + t), (r_out - depth, -w + t), (r_out - depth, -w)]
        sp.add(f'FlywheelRim{side}', f'Flywheel rim, {side.replace("Stbd", "starboard").lower()}', 'flywheel', [rev(U, o=[xc, 0, 0], axis=(1, 0, 0), label='U-section rim')], 'aluminium', 'M1 p. 243: aluminium casting rim of U section, many times stiffer than the steel rim of the same weight', cf)
        r_h, r_d = 44.0, 52.0
        hub = [tube(33.0, c.shaft_ro + 0.05, 40.0, [xc - 20.0, 0, 0], (1, 0, 0), label='Hub tube'), cy(r_d, 6.0, [xc - 10.5, 0, 0], (1, 0, 0), label='Leading-spoke flange'), cy(r_d, 6.0, [xc + 4.5, 0, 0], (1, 0, 0), label='Trailing-spoke flange'),
               cy(c.shaft_ro + 0.05, 42.0, [xc - 21.0, 0, 0], (1, 0, 0), op='cut', label='Shaft bore')]
        r_in = r_out - t - 0.4
        spokes = []
        for i in range(24):
            a = math.radians(15.0 * i)
            sgn_ = 1.0 if i % 2 == 0 else -1.0
            px, py = r_h * math.cos(a), r_h * math.sin(a)                     # tangent point (Y, Z)
            d = (-math.sin(a) * sgn_, math.cos(a) * sgn_)
            x_s = xc - 7.5 if i % 2 == 0 else xc + 7.5
            hub.append(dict(primitive='cylinder', radius=2.2, height=38.0, origin=[x_s, px - 5.0 * d[0], py - 5.0 * d[1]], axis=[0.0, d[0], d[1]], operation='cut', label='Spoke hole'))   # from 5 mm behind the tangent point out through the flange rim, short enough that neighbouring holes of one flange never meet
            s_end = math.sqrt(r_in ** 2 - r_h ** 2)
            spokes.append((i, [x_s, px - 3.0 * d[0], py - 3.0 * d[1]], [0.0, d[0], d[1]], s_end + 3.0))   # starts inside its hole, 3 mm behind the tangent point, so spokes of one flange never cross
        sp.add(f'FlywheelHub{side}', f'Flywheel hub, {side.replace("Stbd", "starboard").lower()}', 'flywheel', hub, 'steel', 'M1 p. 243: special steel hubs fitted to the crankshaft; two spoke flanges are an estimate', cf)
        for i, o, ax, h in spokes:
            sp.add(f'FlywheelSpoke{side}{i + 1}', f'Flywheel spoke {i + 1}, {side.replace("Stbd", "starboard").lower()}', 'flywheel', [dict(primitive='cylinder', radius=1.7, height=h, origin=o, axis=ax, operation='add', label='Tangent wire spoke')], 'steel', 'M1 pp. 242-243: 24 tangent wire spokes of No. 10 coppered steel wire (24 documented for the starboard wheel)', cf)
