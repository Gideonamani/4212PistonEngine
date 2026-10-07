"""Valve and ignition drives: cam ring and its reversing gear train, punch rods, ignition gears and sparker, bed plates, starter and pump drive.

Ratios are documented (cam -1/4, sparker cam 2.5x, distributor 0.5x, pump 3x); tooth counts and layout are derived to give those ratios exactly and are
illustrative. Gear outlines come from scripts/gear_geometry.py, with each mesh's tooth phase solved so a tooth meets a gap.

X layout (port negative): crank webs |X| 70-94; head plates 96-99; bed plate webs 99-102 against the head faces; port gears and cam outboard to X = -170;
starboard ignition gears X = 112-122.
"""
import math, sys
from cad_pipeline.langley_frame import Frame
from cad_pipeline.langley_v1 import cy, tube, cone, bx, rev, prism, helix, circle_profile, R as REPO
sys.path.insert(0, str(REPO / 'scripts'))
import gear_geometry as G
from cad_pipeline.langley_cam import BASE, ROLLER_R, ROLLER_GAP, EXHAUST_GAP, FIRING_ORDER, spark_theta


def gear_points(teeth, pitch_r, module, phase, centre_yz):
    """Involute outline in (Y, Z) about a centre, for a gear on an X axis."""
    return [(centre_yz[0] + u, centre_yz[1] + v) for u, v in G.profile(teeth, pitch_r, module, phase, flank_points=5, tip_points=1, root_points=1)]


def x_prism(points_yz, x0, thickness, label):
    """A prism along +X from x0 from an outline in (Y, Z); the builder sends local Z to X and local X to -Z."""
    return prism([(-z, y) for (y, z) in points_yz], thickness, [x0, 0, 0], (1, 0, 0), label=label)


def x_cyl(r, x0, x1, yz, op='add', label='Cylinder'):
    return dict(primitive='cylinder', radius=r, height=x1 - x0, origin=[x0, yz[0], yz[1]], axis=[1, 0, 0], operation=op, label=label)


def x_tube(ro, ri, x0, x1, yz, label='Tube'):
    return dict(primitive='tube', radius=ro, inner_radius=ri, height=x1 - x0, origin=[x0, yz[0], yz[1]], axis=[1, 0, 0], operation='add', label=label)


def lighten(x0, thickness, r_pocket, yz, web=2.5):
    """Two pockets on either side of a gear or disc, leaving a web `web` thick midway and a rim outside r_pocket: lightening that the weight table calls for."""
    mid = x0 + thickness / 2.0
    return [x_cyl(r_pocket, x0 - 1.0, mid - web / 2.0, yz, 'cut', 'Lightening pocket'), x_cyl(r_pocket, mid + web / 2.0, x0 + thickness + 1.0, yz, 'cut', 'Lightening pocket')]


def polar(r, phi_deg):
    """(Y, Z) of a point at radius r and angle phi from +Z in the direction of crank rotation."""
    p = math.radians(phi_deg)
    return (-r * math.sin(p), r * math.cos(p))


def add(sp, c):
    port(sp, c)
    starboard(sp, c)
    start_and_pump(sp, c)


# ================================================================================================ port: cam ring, reversing train, punch rods
def port(sp, c):
    par = sp.par
    hx, ht = c.head_x, 3.0
    m = 3.0
    z1, z2, zb, zi, z4 = 24, 48, 18, 20, 36              # pinion, large gear, its coaxial small gear, idler, cam-ring teeth (the idler stud stands outside the cam lobes' sweep)
    rp = lambda z: m * z / 2.0
    par('cam_train_module', m, 'inferred', ['M1'], 'Module of the cam gear train; layout and tooth counts are illustrative and chosen to give net -1/4 exactly with three external meshes and no two gears of one plane overlapping.')
    par('cam_gear_ratio', -(z1 / z2) * (zb / z4), 'specified', ['M1'], 'Cam turns at one quarter crank speed in the reverse direction (M1 p. 237).', unit='ratio')
    d_a = rp(z1) + rp(z2)
    a_c = polar(d_a, 17.0)
    d_i = rp(zi) + rp(z4)
    d_ab = rp(zb) + rp(zi)
    i_c = polar(d_i, 17.0 + math.degrees(math.acos((d_a ** 2 + d_i ** 2 - d_ab ** 2) / (2 * d_a * d_i))))
    ph_p = 0.0
    ph_a = G.mesh_phase((0.0, 0.0), ph_p, z1, a_c, z2)
    ph_b = 0.0
    ph_i = G.mesh_phase(a_c, ph_b, zb, i_c, zi)
    ph_c = G.mesh_phase(i_c, ph_i, zi, (0.0, 0.0), z4)
    c.cam_train = dict(centres=dict(A=a_c, I=i_c), phases=dict(P=ph_p, A=ph_a, B=ph_b, I=ph_i, C=ph_c), teeth=dict(P=z1, A=z2, B=zb, I=zi, C=z4), module=m)
    x_head = -(hx + ht)                                        # outer face of the port head
    x_web = x_head - 3.0                                       # port bed plate web
    x_p0 = x_head - 66.0                                       # pinion and large-gear plane, outboard of the hub end
    x_c0 = x_head - 48.0                                       # second plane: small gear, idler, cam-ring teeth
    gear_t = 7.0
    sp.add('CamPinion', 'Cam drive pinion on the crankshaft', 'timing',
           [x_prism(gear_points(z1, rp(z1), m, ph_p, (0.0, 0.0)), x_p0, gear_t, 'Involute pinion'), x_cyl(c.shaft_ro + 3.0, x_p0 - 1.0, x_p0 + gear_t + 1.0, (0, 0), label='Boss'),
            x_cyl(c.shaft_ro + 0.05, x_p0 - 3.0, x_p0 + gear_t + 3.0, (0, 0), op='cut', label='Shaft bore')], 'steel', 'M1 p. 237: a small gear on the crankshaft close to the crank arm', Frame(c.theta))
    sp.add('CamGearLarge', 'Cam train large gear on its axle', 'timing',
           [x_prism(gear_points(z2, rp(z2), m, ph_a, a_c), x_p0, gear_t, 'Involute gear')] + lighten(x_p0, gear_t, 62.0, a_c) + [x_cyl(14.0, x_p0, x_p0 + gear_t, a_c, label='Hub'), x_cyl(6.0, x_p0 - 1.0, x_web + 3.0, a_c, label='Axle')], 'steel', 'M1 p. 237: gears mounted on the port head; web and rim lightened to the weight table', None)
    sp.add('CamGearSmall', 'Cam train small gear on the large gear axle', 'timing',
           [x_prism(gear_points(zb, rp(zb), m, ph_b, a_c), x_c0, gear_t, 'Involute pinion')] + lighten(x_c0, gear_t, 16.0, a_c) + [x_cyl(10.0, x_c0, x_c0 + gear_t, a_c, label='Hub'), x_cyl(6.05, x_c0 - 1.0, x_c0 + gear_t + 1.0, a_c, op='cut', label='Axle bore')], 'steel', 'M1 p. 237', None)
    sp.add('CamStud', 'Cam train idler stud', 'timing', [x_cyl(6.0, x_c0 - 4.0, x_web + 3.0, i_c, label='Stud')], 'steel', 'M1 p. 237: gears on studs mounted on the drum', None)
    sp.add('CamIdler', 'Cam train idler gear', 'timing',
           [x_prism(gear_points(zi, rp(zi), m, ph_i, i_c), x_c0, gear_t, 'Involute idler'), x_cyl(6.05, x_c0 - 1.0, x_c0 + gear_t + 1.0, i_c, op='cut', label='Stud bore')], 'steel', 'M1 p. 237', None)
    # cam ring: thin sleeve journalled on the hub, tooth ring at the outboard end, double-pointed cam track at the inboard end; web and rims lightened to the weight table
    cam_x_out, cam_x_in = x_c0, x_head - 6.0
    vx = c.valve_x
    cam_x0, cam_x1 = vx - 5.2, vx + 5.2                    # the cam track is only as wide as the rollers: the roller cheeks stand outside it
    sleeve_r = c.hub_ro_port + 6.0
    ring = [x_prism(gear_points(z4, rp(z4), m, ph_c, (0.0, 0.0)), cam_x_out, gear_t, 'Involute teeth on the cam ring'),
            x_prism(c.cam.polygon(), cam_x0, cam_x1 - cam_x0, 'Double-pointed cam track'),
            x_cyl(44.0, cam_x_out + 2.5, cam_x_out + gear_t + 1.0, (0, 0), 'cut', 'Lightening pocket in the tooth ring'),
            x_cyl(55.0, cam_x0 + 3.0, cam_x1 + 1.0, (0, 0), 'cut', 'Lightening pocket in the cam track'),
            x_tube(sleeve_r, c.hub_ro_port + 0.1, cam_x_out, cam_x_in, (0, 0), 'Cam ring sleeve'),
            x_cyl(c.hub_ro_port + 0.1, cam_x_out - 1.0, cam_x_in + 1.0, (0, 0), op='cut', label='Hub bore')]
    sp.add('CamRing', 'Double-pointed ring cam with tooth ring', 'timing', ring, 'steel', 'M1 p. 237: double-pointed cam on the exterior of the hub; profile illustrative', None)
    # punch rods, rollers and guides: one under each exhaust stem, radial, at the valve axis X
    roller_r, roller_w = ROLLER_R, 10.0
    par('punch_rod_gap', EXHAUST_GAP, 'specified', ['M1'], 'Punch rods stand within 1/64 in of the exhaust stems (M1 p. 237).')
    top = c.ex_stem_end - EXHAUST_GAP
    roller_c = BASE + ROLLER_R + ROLLER_GAP
    for k in range(5):
        i = k + 1
        fr = Frame(0.0, (0.0, 0.0, c.cam_h[k])).then(Frame(c.alphas[k]))           # the rod rides the lobe height under its roller
        gf = Frame(c.alphas[k])
        rod = [cy(5.0, top - (roller_c + 22.0), [vx, 0, roller_c + 22.0], label='Rod'),
               bx(2.4, 18.0, 28.0, [vx + 5.55, -9.0, roller_c - 6.0], label='Clevis cheek'), bx(2.4, 18.0, 28.0, [vx - 7.95, -9.0, roller_c - 6.0], label='Clevis cheek'),
               bx(13.5, 17.0, 8.0, [vx - 6.75, -8.5, roller_c + 20.5], label='Clevis bridge'),
               cy(2.4, 16.5, [vx - 8.25, 0, roller_c], (1, 0, 0), label='Roller axle')]
        sp.add(f'PunchRod{i}', f'Exhaust punch rod {i}', 'timing', rod, 'steel', 'M1 p. 237: five punch rods on the exterior of the port head', fr)
        sp.add(f'PunchRoller{i}', f'Punch rod {i} roller', 'timing', [tube(roller_r, 2.5, roller_w, [vx - roller_w / 2.0, 0, roller_c], (1, 0, 0), label='Hardened roller')], 'steel', 'M1 p. 237: hardened-steel rollers on the cam', fr)
        sp.add(f'PunchGuide{i}', f'Punch rod {i} guide', 'timing',
               [tube(10.0, 5.15, 22.0, [vx, 0, c.c_flange + 12.0], label='Guide sleeve'), bx(x_web - 0.1 - (vx - 8.0), 16.0, 26.0, [vx - 8.0, -8.0, c.c_flange - 12.0], label='Knee bracket'),
                cy(5.3, 40.0, [vx, 0, c.c_flange - 14.0], op='cut', label='Rod passage')],
               'steel', 'A1 p. 180: valve lifter guides; bracket form estimated', gf)


# ================================================================================================ starboard: ignition drive, sparker, distributor
def starboard(sp, c):
    par = sp.par
    hx, ht = c.head_x, 3.0
    m = 2.5
    z1, z2, z3 = 30, 60, 12
    rp = lambda z: m * z / 2.0
    par('ignition_gear_ratios', 2.5, 'specified', ['M1'], 'Primary sparker cam at 2.5x and distributor at 0.5x crank speed (M1 p. 241); gears 30/60/12 teeth give exactly 0.5 and 2.5.', unit='ratio')
    x_head = hx + ht
    x_web = x_head + 3.0
    sleeve_ro = c.hub_ro_stbd + 1.6
    d1 = rp(z1) + rp(z2)
    d2 = rp(z2) + rp(z3)
    L_c = (d1, 0.0)                                       # large gear centre (Y, Z): +Y of the shaft
    S_c = (d1 + d2, 0.0)
    ph1 = 0.0
    ph2 = G.mesh_phase((0.0, 0.0), ph1, z1, L_c, z2)
    ph3 = G.mesh_phase(L_c, ph2, z2, S_c, z3)
    c.ign_train = dict(centres=dict(L=L_c, S=S_c), phases=dict(P=ph1, L=ph2, S=ph3), teeth=dict(P=z1, L=z2, S=z3), module=m)
    gx0, gx1 = x_web + 10.0, x_web + 17.0                 # gear plane (7 mm gears)
    sx0, sx1 = x_head + 8.0, x_head + 50.0                # sleeve over the hub
    sp.add('SparkSleeve', 'Ignition drive sleeve over the starboard hub', 'ignition', [x_tube(sleeve_ro, c.hub_ro_stbd + 0.15, sx0, sx1, (0, 0), 'Sleeve')], 'steel', 'M1 p. 237: sleeve telescoping over the hub of the starboard drum', Frame(c.theta))
    sp.add('SparkSleeveRing', 'Ignition sleeve ring fixed to the crankshaft', 'ignition', [x_tube(sleeve_ro, c.shaft_ro + 0.05, sx1 + 0.05, sx1 + 6.05, (0, 0), 'Ring clamped to the shaft')], 'steel', 'M1 p. 237: sleeve ends in a ring fastened to the crank shaft', Frame(c.theta))
    sp.add('SparkPinion', 'Ignition gear on the sleeve (crank gear)', 'ignition',
           [x_prism(gear_points(z1, rp(z1), m, ph1, (0.0, 0.0)), gx0, 7.0, 'Involute gear'), x_cyl(sleeve_ro + 0.05, gx0 - 1.0, gx1 + 1.0, (0, 0), op='cut', label='Sleeve bore')], 'steel', 'M1 p. 237: gear formed on the sleeve; read from Plate 81, tooth counts derived', Frame(c.theta))
    sp.add('SparkGearLarge', 'Ignition large gear with distributor axle', 'ignition',
           [x_prism(gear_points(z2, rp(z2), m, ph2, L_c), gx0, 7.0, 'Involute gear')] + lighten(gx0, 7.0, 68.0, L_c, web=2.0) + [x_cyl(14.0, gx0, gx1, L_c, label='Hub'), x_cyl(8.0, x_web - 2.0, gx1 + 16.0, L_c, label='Axle')], 'steel', 'Plate 81: large spur gear; 0.5x crank speed; web and rim lightened to the weight table', None)
    crest_0 = (270.0 - 2.5 * spark_theta(1)) % 360.0         # the sparker cam turns +2.5 x crank: its lobe crest is straight under the axle (270 degrees) at every spark
    cam_pts = []
    for n in range(72):
        a = 5.0 * n
        d = abs(((a - crest_0 + 180.0) % 360.0) - 180.0)
        r_ = 9.0 + (7.0 * (0.5 + 0.5 * math.cos(math.pi * d / 50.0)) if d < 50.0 else 0.0)
        cam_pts.append((S_c[0] + r_ * math.cos(math.radians(a)), S_c[1] + r_ * math.sin(math.radians(a))))
    c.sparker = dict(centre=S_c, crest_0=crest_0, base_r=9.0, lobe_r=7.0, lobe_half=50.0)
    sp.add('SparkerCam', 'Primary sparker cam and gear', 'ignition',
           [x_prism(gear_points(z3, rp(z3), m, ph3, S_c), gx0, 7.0, 'Involute pinion'), x_cyl(6.0, x_web - 2.0, gx1 + 12.0, S_c, label='Axle'), x_prism(cam_pts, gx1 + 2.0, 6.0, 'One-lobe cam')], 'steel', 'M1 p. 241: one-lobe cam at 2.5x acting on a pawl', None)
    # distributor: disc on the large-gear axle, brush, five-section commutator on a fixed rail
    dx0, dx1 = gx1 + 6.0, gx1 + 10.0
    sp.add('DistributorDisc', 'Secondary distributor disc', 'ignition', [x_tube(22.0, 8.0, dx0, dx1, L_c, 'Hard-rubber disc')], 'rubber', 'M1 p. 241: disc carrying a contact brush at half engine speed', None)
    sp.add('DistributorBrush', 'Distributor contact brush', 'ignition', [dict(primitive='box', length=3.0, width=6.0, height=4.0, origin=[dx1, L_c[0] + 14.0 - 3.0, L_c[1] - 2.0], axis=[0, 0, 1], operation='add', label='Brush block')], 'steel', 'M1 p. 241', None)
    cx0, cx1 = dx1 + 3.05, dx1 + 6.05
    body = [x_tube(28.0, 8.2, cx1, cx1 + 4.0, L_c, 'Commutator ring')]
    sp.add('CommutatorBody', 'Five-section commutator body (hard rubber)', 'ignition', body, 'rubber', 'M1 pp. 241-242: hard rubber after red fibre failed; its support to the bed plate is not drawn and is omitted', None)
    for j, cyl in enumerate(FIRING_ORDER):                # the brush turns -1/2 x crank: it reaches cylinder `cyl`'s segment at its spark, so segments run clockwise in firing order
        sigma = math.radians((-spark_theta(cyl) / 2.0) % 360.0)
        pos = (L_c[0] + 14.0 * math.cos(sigma), L_c[1] + 14.0 * math.sin(sigma))
        sp.add(f'CommutatorSegment{cyl}', f'Commutator segment for cylinder {cyl}', 'ignition', [x_cyl(3.5, cx0, cx1, pos, label='Segment')], 'brass', 'M1 p. 241: five-section commutator, one section per plug; order of the firing sequence', None)
        sp.add(f'SparkWire{cyl}', f'High-tension lead stub for cylinder {cyl}', 'ignition', [x_cyl(1.6, cx1 + 4.0, cx1 + 28.0, (L_c[0] + 22.0 * math.cos(sigma), L_c[1] + 22.0 * math.sin(sigma)), label='Lead stub')], 'rubber', 'M1 p. 242: rubber-tube insulated leads; routing to the plug is not drawn, only the stub is modelled', None)
    # pawl, spring, bracket, contact on the sparker cam
    bx_y = S_c[0] + 30.0
    px0, px1 = gx1 + 2.0, gx1 + 8.0
    sp.add('SparkerBracket', 'Sparker bracket', 'ignition', [bx(px1 + 6.0 - x_web, 10.0, 12.0, [x_web, bx_y - 5.0, S_c[1] - 36.0], label='Bracket arm')], 'steel', 'Plate 81: bracket on the bed plate carrying the pawl and contact', None)
    sp.add('SparkerPawl', 'Sparker pawl', 'ignition', [dict(primitive='box', length=px1 - px0, width=40.0, height=4.0, origin=[px0, S_c[0] - 8.0, S_c[1] - 14.0], axis=[0, 0, 1], operation='add', label='Pawl arm')], 'steel', 'M1 p. 241: pawl on the end of a spring; form estimated', None)
    sp.add('SparkerSpring', 'Sparker pawl spring', 'ignition', [helix(3.0, 0.5, 2.0, 14.0, [px0 + 3.0, S_c[0] + 24.0, S_c[1] - 9.4], (0, 0, 1), label='Spring wire')], 'steel', 'M1 p. 241', None)
    sp.add('SparkerContact', 'Primary contact', 'ignition', [x_cyl(2.0, px0, px1, (S_c[0] - 6.0, S_c[1] - 25.0), label='Contact')], 'steel', 'M1 p. 241; contact form estimated', None)
    # timing handle (Plate 81, role interpreted)
    sp.add('SparkTimingClamp', 'Spark timing handle clamp', 'ignition', [bx(14.0, 14.0, 14.0, [px1 + 8.0, bx_y - 7.0, S_c[1] - 36.0], label='Clamp block'), dict(primitive='cylinder', radius=4.2, height=40.0, origin=[px1 + 15.05, bx_y, S_c[1] - 29.0], axis=[0, math.cos(math.radians(22.0)), math.sin(math.radians(22.0))], operation='cut', label='Lever bore')], 'steel', 'Plate 81 (role interpreted): clamp on the bracket for the timing handle', None)
    sp.add('SparkTimingLever', 'Spark timing handle', 'ignition', [dict(primitive='tube', radius=4.0, inner_radius=2.6, height=320.0, origin=[px1 + 15.05, bx_y, S_c[1] - 29.0], axis=[0, math.cos(math.radians(22.0)), math.sin(math.radians(22.0))], operation='add', label='Handle rod')], 'steel', 'Plate 81: long handle with a wing nut; shortened to the engine boundary', None)
    # bed plate web (starboard): diamond sheet against the head face
    bolts = [polar(86.0, 45.0 + 90.0 * q) for q in range(4)]
    cuts = [x_cyl(4.0, x_web - 4.0, x_web + 1.0, yz, 'cut', 'Bolt hole') for yz in bolts]
    wx_, w_big, w_r = c.water_in
    tip = w_big - w_r - 5.0                                # clear of the water inlet ring
    sp.add('StbdBedPlate', 'Starboard bed plate (diamond web)', 'bedplate', bed_plate(c, +1, x_web, [(L_c, 8.05), (S_c, 6.05)], sleeve_ro, cuts, tip), 'steel', 'M1 p. 237; A1 p. 179; Plate 81: elongated diamond of steel tubing with a sheet-steel web; modelled as the web only, with its tips cut short of the water inlet ring', None)
    for q, yz in enumerate(bolts, 1):
        sp.add(f'StbdDrumBolts{q}', f'Starboard bed plate bolt {q}', 'bedplate', [x_cyl(3.8, x_head + 0.2, x_web + 3.0, yz, label='Bolt shank'), x_cyl(7.0, x_web + 3.0, x_web + 7.0, yz, label='Bolt head')], 'steel', 'M1 p. 237: bolts draw the web of the bed plate against the face of the drum', None)


def bed_plate(c, side, x_web, axles, hole_r, cuts=(), tip=450.0):
    """Diamond web (3 mm sheet), 956 x 256 mm when whole, with its tips cut off at |Y| = `tip` so that the circular manifolds pass them (the inlet gas ring
    at 454 mm on the port side, the water inlet ring at 352 mm on the starboard side): vertices on the horizontal axis at +/-tip, top and bottom at +/-128 mm;
    holes for the hub and axles, and any further cuts."""
    half = 128.0 * (1.0 - tip / 478.0)
    pts = [(tip, half), (0.0, 128.0), (-tip, half), (-tip, -half), (0.0, -128.0), (tip, -half)]
    x0 = x_web - 3.0 if side > 0 else x_web
    web = [x_prism(pts, x0, 3.0, 'Diamond web')]
    web.append(x_cyl(hole_r + 0.2, x0 - 1.0, x0 + 4.0, (0, 0), op='cut', label='Hub opening'))
    for yz, r_ in axles:
        web.append(x_cyl(r_, x0 - 1.0, x0 + 4.0, yz, op='cut', label='Axle hole'))
    return web + list(cuts)


# ================================================================================================ port bed plate, starting mechanism and pump drive
def start_and_pump(sp, c):
    par = sp.par
    hx, ht = c.head_x, 3.0
    x_head = -(hx + ht)
    x_web = x_head - 3.0
    gear = c.cam_train
    holes = [(gear['centres']['A'], 6.05), (gear['centres']['I'], 6.05)]
    sp.add('PortBedPlate', 'Port bed plate (diamond web)', 'bedplate', bed_plate(c, -1, x_web, holes, c.hub_ro_port), 'steel', 'M1 p. 237; A1 p. 179: elongated diamond of steel tubing with a sheet-steel web; modelled as the web only', None)
    # worm wheel on the crankshaft outboard of the bed plate; the worm sits below it on a horizontal tubular starting shaft along -Y, tangent to the wheel's tip circle
    ww0, ww1 = -208.0, -184.0
    zw, mw = 30, 3.0
    rw = mw * zw / 2.0                                    # 45 mm pitch radius
    ph = 0.0
    wheel = [x_prism(gear_points(zw, rw, mw, ph, (0.0, 0.0)), ww0, ww1 - ww0, 'Worm wheel teeth (straight, simplified)'), x_cyl(c.shaft_ro + 3.0, ww0 - 2.0, ww1 + 2.0, (0, 0), label='Boss'), x_cyl(c.shaft_ro + 0.05, ww0 - 4.0, ww1 + 4.0, (0, 0), op='cut', label='Shaft bore')]
    sp.add('WormWheel', 'Worm wheel on the crankshaft', 'start', wheel, 'steel', 'M1 p. 244: worm wheel on the port end of the crankshaft just outside the bed plate; tooth count estimated', Frame(c.theta))
    cx_ = -196.5                                          # worm and shaft axis X (inside the wheel's width)
    worm_r, shaft_r = 10.0, 7.0
    z_ax = -(rw + mw + worm_r + 0.5)                      # 0.5 mm under the wheel's tip circle: the thread is omitted, so the worm cannot interleave with the teeth
    along_y = lambda y0: [cx_, y0, z_ax]
    sp.add('StartWorm', 'Sliding starting worm', 'start', [dict(primitive='cylinder', radius=worm_r, height=60.0, origin=along_y(-30.0), axis=[0, 1, 0], operation='add', label='Worm body'),
                                                              dict(primitive='cylinder', radius=13.0, height=13.0, origin=along_y(29.0), axis=[0, 1, 0], operation='add', label='Worm collar'),
                                                              dict(primitive='cylinder', radius=shaft_r + 0.1, height=84.0, origin=along_y(-31.0), axis=[0, 1, 0], operation='cut', label='Bore on the shaft')], 'steel', 'M1 p. 244: worm screw slidably mounted on the tongued and grooved shaft; thread omitted', None)
    sp.add('StartShaft', 'Starting shaft (tubular)', 'start', [dict(primitive='tube', radius=shaft_r, inner_radius=5.0, height=336.0, origin=along_y(-300.0), axis=[0, 1, 0], operation='add', label='Tubular starting shaft')], 'steel', 'M1 p. 244: tubular starting shaft; ends at the Aerodrome cross-frame, where the ratchet crank begins (outside the assembly)', None)
    for name, y_c in (('Upper', -85.0), ('Lower', -175.0)):
        arm = [bx((x_web - 0.1) - (cx_ - 12.0), 30.0, 28.0, [cx_ - 12.0, y_c - 15.0, z_ax - 14.0], label='Bracket arm'),
               dict(primitive='cylinder', radius=shaft_r + 0.1, height=40.0, origin=[cx_, y_c - 20.0, z_ax], axis=[0, 1, 0], operation='cut', label='Shaft bore')]
        sp.add(f'StartBracket{name}', f'Starting shaft {name.lower()} bracket', 'start', arm, 'steel', 'M1 p. 244: two brackets on the web of the bed plate', None)
    sp.add('StartPawlPlug', 'Spring-pressed pawl plug', 'start', [dict(primitive='cylinder', radius=2.5, height=40.0, origin=along_y(-150.0), axis=[0, 1, 0], operation='add', label='Pawl plug')], 'steel', 'M1 p. 244: spring-pressed pawl plug inside the tubular shaft (not shown in the drawing; form estimated)', None)
    # pump drive: bevel gear on the worm-wheel hub, pinion, upper part of the vertical shaft with its bearing
    bx0, bx1 = -176.5, -167.5
    sp.add('PumpBevelGear', 'Pump drive bevel gear on the worm-wheel hub', 'pump', [rev([(c.shaft_ro + 0.05, 0.0), (44.0, 0.0), (30.0, bx1 - bx0), (c.shaft_ro + 0.05, bx1 - bx0)], o=[bx0, 0, 0], axis=(1, 0, 0), label='Bevel gear (cone, teeth omitted)')], 'steel', 'M1 p. 244: bevel gear on the hub of the worm wheel; tooth form simplified', Frame(c.theta))
    sp.add('PumpBevelPinion', 'Pump drive bevel pinion', 'pump', [dict(primitive='cone', radius1=14.0, radius2=8.0, height=10.0, origin=[bx0 + 4.5, 0.0, -50.0], axis=[0, 0, -1], operation='add', label='Bevel pinion (teeth omitted)')], 'steel', 'M1 p. 241: bevel pinion driving the vertical pump shaft at 3x', None)
    sp.add('PumpShaftUpper', 'Pump shaft (upper section)', 'pump', [dict(primitive='tube', radius=5.0, inner_radius=3.0, height=160.0, origin=[bx0 + 4.5, 0.0, -60.0 - 160.0], axis=[0, 0, 1], operation='add', label='Upper shaft with splines')], 'steel', 'M1 p. 241: vertical shaft with a telescoping splined section; lower shaft and pump are outside the assembly', None)
    sp.add('PumpShaftBearing', 'Pump shaft bearing bracket', 'pump', [bx(26.0, 26.0, 20.0, [bx0 + 4.5 - 13.0, -13.0, -60.0 - 120.0], label='Bearing block'), dict(primitive='cylinder', radius=5.15, height=22.0, origin=[bx0 + 4.5, 0.0, -60.0 - 121.0], axis=[0, 0, 1], operation='cut', label='Shaft bore')], 'steel', 'M1 p. 241: bearings on the port bed plate carry the bevel drive', None)
