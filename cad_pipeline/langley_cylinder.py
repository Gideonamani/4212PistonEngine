"""The five cylinders with their jackets, combustion chambers, valves, springs, plugs and oil cups. Cylinder frame: origin on the shaft axis,
Z up the cylinder axis, X along the shaft (port negative). Heights are written as u(dz): dz millimetres above the gudgeon pin at TDC."""
import math
from cad_pipeline.langley_frame import Frame
from cad_pipeline.langley_v1 import cy, tube, cone, bx, rev, helix, about_x, arc_points, circle_profile


def add(sp, c):
    par = sp.par
    u = c.u
    vx = c.valve_x
    R_s, R_l, R_b = c.R_s, c.R_l, c.R_b
    flange_t = par('flange_thickness', 5.0, 'inferred', ['M1'], 'Mounting flange thickness; the cylinder mass in the weight table (4.6-4.8 kg with valves) rules out a thick flange.')
    boss_r = 21.6
    rs = (R_s ** 2 + c.dome_h ** 2) / (2 * c.dome_h)           # dome sphere radius
    c_top = u(67.9)                                             # barrel top where the dome starts
    cz = c_top + c.dome_h - rs
    ri = R_s - c.shell_wall
    rsi = rs - c.shell_wall
    jr, jt = c.jacket_r, c.jacket_sheet
    jtop = u(88.3)                                              # top of the cylindrical part of the jacket
    rj = (jr ** 2 + (u(112.9) - jtop) ** 2) / (2.0 * (u(112.9) - jtop))      # dome sphere through the wall top and the apex height 112.9 mm above the pin
    jc = u(112.9) - rj
    # chamber geometry (measured on Plate 78A against the cylinder axis, 149.6 px/in)
    ch_ro, ch_ri = 31.8, 28.3
    pas_z = u(76.0)                                             # centre of the passage into the cylinder
    pas_ro, pas_ri = 15.5, 11.5
    duct_z = u(28.9)
    c.chamber = dict(vx=vx, top=u(101.6), floor=u(13.0), seat_in=(u(80.0), u(90.0)), seat_ex=(u(36.0), u(41.0)), duct_z=duct_z, pas_z=pas_z)
    stem_r_in, stem_r_ex = 5.0, 4.1
    out_y = 45.0                                                # the water outlet stub leaves the jacket beside the chamber, 45 mm off the cylinder plane
    out_z = math.sqrt(u(76.0) ** 2 - out_y ** 2)                # on the outlet ring of radius u(76), so it meets the ring tube
    c.ex_spring = dict(top=u(0.5), free=u(0.5) - u(-39.3))      # exhaust spring: its top end is fixed against the guide boss, its free length (valve closed)
    c.in_spring = dict(bottom=u(98.4), free=u(122.8) - u(98.4))   # inlet spring: its bottom end is fixed, the cap moves down with the valve
    ex_end = c.c_flange + 86.0                                  # lower end of the exhaust stem (a punch rod gap above the cam train)
    c.ex_stem_end = ex_end

    for k in range(5):
        i = k + 1
        fr = Frame(c.alphas[k])
        # ---- shell, liner, flange, jacket
        outer = arc_points(cz, rs, R_s, boss_r, 14)
        inner = arc_points(cz, rsi, 14.5, ri, 14)
        shell = [rev([(R_s, c.c_flange)] + outer + [(boss_r, u(113.0)), (14.5, u(113.0))] + inner + [(ri, c.c_flange)], label='Seamless steel shell with integral dome and plug boss')]
        shell.append(cy(pas_ro + 0.05, 24.0, [-72.0, 0, pas_z], (1, 0, 0), op='cut', label='Window for the chamber passage'))
        shell.append(cy(3.1, 16.0, [60.0, 0, u(-30.0)], (1, 0, 0), op='cut', label='Oil tube hole'))
        sp.add(f'CylShell{i}', f'Cylinder {i} shell with integral dome', 'shell', shell, 'steel', 'M1 p. 235; Plate 78A (dome and wall positions measured)', fr)
        sp.add(f'CylLiner{i}', f'Cylinder {i} cast-iron liner', 'liner', [tube(R_l - 0.1, R_b, u(66.5) - 130.0, [0, 0, 130.0], label='Liner (0.1 mm inside the shell: a shrink fit cannot be modelled without overlap)'), cy(3.1, 12.0, [58.0, 0, u(-30.0)], (1, 0, 0), op='cut', label='Oil tube hole'), cy(pas_ro + 0.05, 24.0, [-72.0, 0, pas_z], (1, 0, 0), op='cut', label='Window for the chamber passage')], 'cast iron', 'M1 p. 235: 1/16 in wall, shrunk in; lower end estimated', fr)
        bolts = [(-82.0, -28.0), (-82.0, 28.0), (82.0, -28.0), (82.0, 28.0)]
        flange = [bx(192.0, 140.0, flange_t, [-96.0, -70.0, c.c_flange], label='Ear flange'), cy(R_s + 0.25, flange_t + 2.0, [0, 0, c.c_flange - 1.0], op='cut', label='Shell seat')]
        for bx_, by_ in bolts:
            flange.append(cy(4.8, flange_t + 2.0, [bx_, by_, c.c_flange - 1.0], op='cut', label='Bolt hole'))
        sp.add(f'CylFlange{i}', f'Cylinder {i} mounting flange', 'cylinder', flange, 'steel', 'M1 p. 235 (screwed and brazed); an ear flange along the shaft because the neighbours leave no room sideways; outline estimated', fr)
        for n, (bx_, by_) in enumerate(bolts, 1):
            sp.add(f'CylBolt{i}_{n}', f'Cylinder {i} flange bolt {n}', 'cylinder', [cy(4.7, flange_t + 12.0, [bx_, by_, c.c_flange - 6.0], label='Bolt shank'), cy(8.0, 5.0, [bx_, by_, c.c_flange + flange_t], label='Bolt head')], 'steel', 'Plates 78, 79: flange bolts; count and circle estimated', fr)
        # jacket: wall, dome, hole round the plug boss, holes for the chamber passage and the oil tube
        r_boss = boss_r + jt
        jouter = [(jr, u(-8.5))] + [(jr + (r_boss - jr) * q / 14, jc + math.sqrt(rj ** 2 - (jr + (r_boss - jr) * q / 14) ** 2)) for q in range(0, 15)]
        jinner = [((jr - jt) + (r_boss - (jr - jt)) * q / 14, jc + math.sqrt((rj - jt) ** 2 - ((jr - jt) + (r_boss - (jr - jt)) * q / 14) ** 2)) for q in range(14, -1, -1)]
        profile = [(jr - jt, u(-8.5))] + jouter + jinner
        jacket = [rev(profile, label='Sheet-steel jacket'),
                  cy(pas_ro + 0.05, 24.0, [-85.0, 0, pas_z], (1, 0, 0), op='cut', label='Passage hole'),
                  cy(7.05, 14.0, [66.0, 0, u(5.0)], (1, 0, 0), op='cut', label='Inlet stub hole'),
                  cy(7.05, 26.0, [-82.0, out_y, out_z], (1, 0, 0), op='cut', label='Outlet stub hole')]
        sp.add(f'Jacket{i}', f'Cylinder {i} water jacket', 'jacket', jacket, 'steel', 'M1 pp. 235-236; Plate 78A (outer radius and dome measured)', fr)
        sp.add(f'JacketRing{i}', f'Cylinder {i} jacket ring', 'jacket', [tube(jr, R_s, 4.0, [0, 0, u(-12.5)], label='Ring')], 'steel', 'M1 p. 236: ring near mid-length forms the bottom of the jacket; position measured', fr)

        # ---- combustion chamber: forged column carrying both valves, passage to the cylinder, floor with guide boss
        col = [rev([(8.7, u(1.5)), (14.0, u(1.5)), (14.0, u(12.5)), (ch_ro, u(12.5)), (ch_ro, u(97.5)), (38.3, u(97.5)), (38.3, u(101.6)), (ch_ri, u(101.6)), (ch_ri, u(18.0)), (8.7, u(18.0))],
                   o=[vx, 0, 0], label='Chamber column, floor, guide boss and inlet cap flange'),
               tube(pas_ro, pas_ri, -(R_b - 0.05) - (vx + ch_ro - 4.0), [vx + ch_ro - 4.0, 0, pas_z], (1, 0, 0), label='Passage to the cylinder'),
               cy(pas_ri, 12.0, [vx + ch_ro - 6.0, 0, pas_z], (1, 0, 0), op='cut', label='Passage bore'),
               cy(10.0, 12.0, [vx - ch_ro - 1.0, 0, duct_z], (1, 0, 0), op='cut', label='Exhaust outlet bore')]
        sp.add(f'Chamber{i}', f'Cylinder {i} forged combustion chamber', 'cylinder', col, 'steel', 'M1 p. 235; Plate 78A (column, flange and floor measured)', fr)
        sp.add(f'ExhaustOutlet{i}', f'Cylinder {i} exhaust side outlet', 'cylinder', [tube(13.5, 10.0, 39.0, [vx - ch_ro - 39.0, 0, duct_z], (1, 0, 0), label='Side outlet')], 'steel', 'M1 p. 240: chamber below the exhaust seat with a side outlet; size measured from Plate 78A', fr)

        # ---- inlet valve, seat, nut, spring, cap
        sp.add(f'InletSeat{i}', f'Cylinder {i} inlet valve seat', 'valve', [tube(ch_ri - 0.4, 24.5, u(90.0) - u(80.0), [vx, 0, u(80.0)], label='Removable cast-iron seat')], 'cast iron', 'M1 p. 240: removable cast-iron seat fastened by a nut', fr)
        sp.add(f'InletSeatNut{i}', f'Cylinder {i} inlet seat nut', 'valve', [tube(ch_ri - 0.4, 24.5, 7.0, [vx, 0, u(90.3)], label='Seat nut')], 'steel', 'M1 p. 240', fr)
        sp.add(f'InletValve{i}', f'Cylinder {i} automatic inlet valve', 'valve', [rev([(0, u(76.45)), (27.0, u(76.45)), (27.0, u(79.95)), (stem_r_in, u(79.95)), (stem_r_in, u(130.0)), (0, u(130.0))], o=[vx, 0, 0], label='Valve head and stem')], 'steel', 'M1 p. 240; Plate 78A (head diameter 54 mm, stem 10 mm)', fr)
        sp.add(f'InletSpring{i}', f'Cylinder {i} inlet valve spring', 'spring', [helix(11.0, 1.2, 4.6, u(122.8) - u(98.4), [vx, 0, u(98.4)], label='Spring wire')], 'steel', 'Plate 78A: coil above the seat; pitch and wire estimated', fr)
        sp.add(f'InletSpringCap{i}', f'Cylinder {i} inlet spring cap', 'valve', [tube(14.0, stem_r_in + 0.05, 6.0, [vx, 0, u(124.0)], label='Spring cap')], 'steel', 'Plate 78A', fr)
        # ---- exhaust valve, seat, guide, spring, collar, nut
        sp.add(f'ExhaustSeat{i}', f'Cylinder {i} exhaust valve seat', 'valve', [tube(ch_ri - 0.4, 23.5, 5.0, [vx, 0, u(36.0)], label='Exhaust seat ring')], 'cast iron', 'Plate 78A', fr)
        lift = c.ex_lift[k]
        vf = Frame(0.0, (0.0, 0.0, lift)).then(fr) if lift else fr         # an open valve (the rest pose has cylinder 1's exhaust valve at the cam peak) moves with its stem
        sp.add(f'ExhaustValve{i}', f'Cylinder {i} exhaust valve', 'valve', [rev([(0, ex_end), (stem_r_ex, ex_end), (stem_r_ex, u(41.05)), (27.0, u(41.05)), (27.0, u(45.0)), (0, u(45.0))], o=[vx, 0, 0], label='Valve head and stem')], 'steel', 'M1 pp. 237, 240; Plate 78A (head diameter 54 mm, stem 8.2 mm)', vf)
        sp.add(f'ExhaustGuide{i}', f'Cylinder {i} exhaust valve guide', 'valve', [tube(8.65, stem_r_ex + 0.25, u(13.0) - u(2.0), [vx, 0, u(2.0)], label='Bronze guide')], 'bronze', 'Plate 78A', fr)
        sp.add(f'ExhaustSpring{i}', f'Cylinder {i} exhaust valve spring', 'spring', [helix(7.95, 1.2, 4.0 * (u(0.5) - u(-39.3) - lift) / (u(0.5) - u(-39.3)), u(0.5) - u(-39.3) - lift, [vx, 0, u(-39.3) + lift], label='Spring wire')], 'steel', 'Plate 78A: 15 coils, outside diameter 18 mm, from the guide boss to the collar', fr)
        sp.add(f'ExhaustSpringCollar{i}', f'Cylinder {i} exhaust spring collar', 'valve', [tube(11.5, stem_r_ex + 0.05, 3.8, [vx, 0, u(-44.5)], label='Spring collar')], 'steel', 'Plate 78A', vf)
        sp.add(f'ExhaustSpringNut{i}', f'Cylinder {i} exhaust spring nut', 'valve', [tube(7.0, stem_r_ex + 0.05, 6.5, [vx, 0, u(-51.05)], label='Spring nut')], 'steel', 'Plate 78A', vf)

        # ---- spark plug: metal body and sheath, porcelain, centre electrode
        plug = [rev([(6.9, u(68.0)), (7.7, u(68.0)), (7.7, u(100.0)), (14.4, u(100.0)), (14.4, u(113.05)), (15.7, u(113.05)), (15.7, u(123.0)), (14.7, u(123.0)), (14.7, u(114.05)), (7.9, u(114.05)), (7.9, u(123.0)), (6.9, u(123.0))], label='Plug body and sheath')]
        sp.add(f'PlugShell{i}', f'Cylinder {i} spark plug body', 'ignition', plug, 'steel', 'M1 pp. 221-222; Plate 78A (collar 31 mm, sheath 15 mm)', fr)
        sp.add(f'PlugInsulator{i}', f'Cylinder {i} spark plug porcelain', 'ignition', [rev([(2.05, u(87.0)), (6.8, u(87.0)), (6.8, u(147.0)), (2.05, u(147.0))], label='Porcelain')], 'porcelain', 'M1 p. 222: metal part about 3/4 in beyond the porcelain', fr)
        sp.add(f'PlugElectrode{i}', f'Cylinder {i} spark plug electrode', 'ignition', [rev([(0, u(65.0)), (2.0, u(65.0)), (2.0, u(150.0)), (5.5, u(150.0)), (5.5, u(158.0)), (2.0, u(158.0)), (2.0, u(165.0)), (0, u(165.0))], label='Centre electrode and terminal')], 'steel', 'M1 p. 222: terminal extended beyond the porcelain; Plate 78A', fr)

        # ---- piston oil cup and tube: crescent cup around the barrel below the jacket, tube through jacket, shell and liner
        sp.add(f'OilCup{i}', f'Cylinder {i} piston oil cup', 'lubrication', [about_x_cup(R_s, u)], 'steel', 'M1 p. 239: crescent-shaped cup of 0.003 in sheet steel; position and form estimated', fr)
        sp.add(f'OilCupTube{i}', f'Cylinder {i} oil cup tube', 'lubrication', [tube(3.0, 2.0, (R_s + 2.5) - (R_b - 0.05), [R_b - 0.05, 0, u(-30.0)], (1, 0, 0), label='Oil tube')], 'steel', 'M1 p. 239: small tubes through holes in the cylinder wall', fr)

        # ---- water stubs: inlet on the starboard side at the bottom of the jacket, outlet on the port side near the top
        sp.add(f'WaterInletStub{i}', f'Cylinder {i} water inlet stub', 'cooling', [tube(7.0, 6.2, 88.0 - (jr - jt), [jr - jt, 0, u(5.0)], (1, 0, 0), label='Inlet stub')], 'steel', 'M1 p. 240: coolant enters on the starboard side; stub position measured on Plate 78A', fr)
        sp.add(f'WaterOutletStub{i}', f'Cylinder {i} water outlet stub', 'cooling', [tube(7.0, 6.2, 186.0 - 11.9 - math.sqrt(jr ** 2 - out_y ** 2) + jt, [-(186.0 - 11.9), out_y, out_z], (1, 0, 0), label='Outlet stub')], 'steel', 'M1 p. 240: heated water leaves on the port side; stub position measured on Plate 78A', fr)


def about_x_cup(R_s, u):
    """Crescent oil cup: a 150 degree sector of a rectangular ring about the cylinder axis, centred on the starboard (+X) side."""
    wall = 1.0                                                  # the cup is 0.003 in sheet; 1 mm is the thinnest wall the Boolean and the mesh audit hold reliably
    profile = [(R_s + 3.0, u(-45.0)), (R_s + 15.0, u(-45.0)), (R_s + 15.0, u(-18.0)), (R_s + 15.0 - wall, u(-18.0)), (R_s + 15.0 - wall, u(-45.0) + wall),
               (R_s + 3.0 + wall, u(-45.0) + wall), (R_s + 3.0 + wall, u(-18.0)), (R_s + 3.0, u(-18.0))]
    return rev(profile, angle=150.0, roll=-75.0, label='Crescent oil cup (open channel)')
