"""Crankshaft, rods, pistons: the moving mass of the Langley radial. See langley_v1 for the conventions."""
import math
from cad_pipeline.langley_frame import Frame
from cad_pipeline.langley_v1 import cy, tube, cone, bx, rev, about_x, circle_profile


def add(sp, c):
    par = sp.par
    r, L = c.r, c.L
    # ---- crankshaft: hollow shaft, two webs, one hollow pin, rotated to the rest-pose crank angle
    shaft_od = par('shaft_outer_diameter', 50.8, 'inferred', ['P78'], 'Hollow shaft outside diameter about 2.0 in on Plate 78B.', method='Plate 78B bands at rows 455-503 and 690-750, 145.7 px/in; rounded.')
    shaft_id = par('shaft_bore', 36.0, 'inferred', ['P78', 'M1'], 'Shaft bore between 27 and 36 mm on the two sides of Plate 78B; the upper end is used because the crank shaft is 5,225 g in the weight table (M1 p. 250), which a 1.25 in bore overshoots.')
    pin_od = par('crank_pin_diameter', 47.0, 'measured', ['P78'], 'Crank pin outside diameter from its wall bands on Plate 78B.', method='Plate 78B: pin wall bands rows 70-97 and 212-240 around bore 31 mm, 145.7 px/in.')
    c.shaft_ro, c.shaft_ri, c.pin_r = shaft_od / 2, shaft_id / 2, pin_od / 2
    c.shaft_x0 = par('shaft_port_end_x', -262.0, 'measured', ['P78'], 'Port end of the hollow shaft (coupling flange face) on Plate 78B.', method='Plate 78B x = 190 px, X0 at 1714 px, 145.7 px/in.')
    c.shaft_x1 = par('shaft_starboard_end_x', 250.0, 'inferred', ['P78'], 'Starboard end of the shaft; the plate is cut at the page edge, so symmetry with the port flange offset is assumed.')
    wx = c.web_x
    web_t = par('crank_web_thickness', 24.0, 'inferred', ['P78'], 'Crank web thickness; the outer faces stand 2 mm inside the drum head plates at |X| = 96.', method='Webs from |X| = 70 to 94 mm.')

    def web(x0, label):
        return [cy(38.0, web_t, [x0, 0, 0], (1, 0, 0), label=label + ' hub'), cy(28.0, web_t, [x0, 0, r], (1, 0, 0), label=label + ' pin boss'),
                bx(web_t, 56.0, r, [x0, -28.0, 0.0], label=label + ' arm')]
    port_in, stbd_in = -wx - web_t + 4.0, wx + web_t - 4.0           # the shaft stubs run into the web hubs
    crank = [tube(c.shaft_ro, c.shaft_ri, port_in - c.shaft_x0, [c.shaft_x0, 0, 0], (1, 0, 0), label='Hollow port shaft'),
             tube(c.shaft_ro, c.shaft_ri, c.shaft_x1 - stbd_in, [stbd_in, 0, 0], (1, 0, 0), label='Hollow starboard shaft')]
    crank += web(-wx - web_t, 'Port crank web') + web(wx, 'Starboard crank web')
    crank += [cy(c.pin_r, 2 * (wx + 6.0), [-wx - 6.0, 0, r], (1, 0, 0), label='Crank pin')]
    crank += [cy(16.0, 2 * (wx + 3.0), [-wx - 3.0, 0, r], (1, 0, 0), op='cut', label='Crank-pin oil bore'),
              cy(c.shaft_ri, port_in - c.shaft_x0 + web_t, [c.shaft_x0 - 1.0, 0, 0], (1, 0, 0), op='cut', label='Port shaft bore'),
              cy(c.shaft_ri, c.shaft_x1 - stbd_in + web_t, [stbd_in - web_t, 0, 0], (1, 0, 0), op='cut', label='Starboard shaft bore')]
    cf = Frame(c.theta)
    sp.add('Crankshaft', 'Hollow crankshaft with single crank pin', 'crank', crank, 'steel', 'M1 pp. 237-239; Plate 78B (pin axis 69.4 mm from the shaft axis measured against 69.85 documented)', cf)
    sp.add('CrankPlug', 'Plug in the hollow crankshaft', 'crank', [cy(c.shaft_ri - 0.08, 14.0, [-wx - web_t - 16.0, 0, 0], (1, 0, 0), label='Plug')], 'steel', 'M1 p. 239: oil pipe connected to the plug in the shaft', cf)
    sp.add('CrankOilPipe', 'Crank oil pipe', 'crank', [tube(3.0, 2.2, 40.0, [-wx - web_t - 16.1 - 40.0, 0, 8.0], (1, 0, 0), label='Oil pipe')], 'steel', 'M1 p. 239; route estimated', cf)

    # ---- master rod, link rods, sleeve and shoes. Rod frame: origin at the crank-pin centre, +Z along the rod, X along the pin.
    sleeve_ri, sleeve_ro = 26.7, 35.0
    lining_ro = 26.65
    lining_ri = c.pin_r + 0.2
    c.sleeve_ro = par('sleeve_outer_radius', sleeve_ro, 'inferred', ['P78'], 'Steel sleeve outer radius from the stacked bands on Plate 78B (pin 47 mm, lining 3 mm, sleeve about 8.5 mm).')
    sx = c.sleeve_x
    shoe_ri, shoe_ro = sleeve_ro + 0.05, 41.5
    shoe_w = par('shoe_angular_width', 50.0, 'inferred', ['M1'], 'Shoes are "slightly less than sixty degrees" wide (M1 p. 237); at the proportions r/L = 0.24 two adjacent rods can approach to 55.6 degrees, so the model uses 50 degrees (research dossier, closure check).', unit='deg')
    shoe_half = 32.0
    rod_hole_r = c.rod_hole / 2
    rod_r = c.rod_d / 2
    for k in range(5):
        i = k + 1
        ang = c.alphas[k] + c.swings[k]
        rf = Frame(ang, (0.0, c.crank[0], c.crank[1]))
        head_z = L
        head = [tube(17.5, 14.0, 60.0, [-30.0, 0, head_z], (1, 0, 0), label='Little end'), cone(13.5, 17.5, 20.0, [0, 0, head_z - 26.0], label='Neck to little end'), cy(14.0, 62.0, [-31.0, 0, head_z], (1, 0, 0), op='cut', label='Little-end bore')]
        if k == 0:
            feats = [about_x(sleeve_ri, sleeve_ro, -sx, sx, 180.0, 0.0, label='Upper sleeve half, integral with the rod'),
                     cone(15.5, rod_r, 36.0, [0, 0, sleeve_ro - 4.0], label='Flare into the sleeve'),
                     cy(rod_r, head_z - 25.0 - (sleeve_ro + 31.0), [0, 0, sleeve_ro + 31.0], label='Master rod, 7/8 in solid')] + head
            sp.add('MasterRod', 'Master connecting rod', 'rod', feats, 'steel', 'M1 pp. 237-238, 240; Plate 78 (7/8 in solid rod, integral upper sleeve half)', rf)
            sp.add('MasterSleeveCap', 'Master sleeve cap (lower half)', 'rod', [about_x(sleeve_ri, sleeve_ro, -sx, sx, 180.0, 180.0, label='Lower sleeve half')], 'steel', 'M1 p. 238: split steel sleeve', rf)
            sp.add('MasterLiningUpper', 'Master bearing lining, first half', 'rod', [about_x(lining_ri, lining_ro, -sx, sx, 180.0, 90.0, label='Bronze lining half')], 'bronze', 'M1 p. 238: split bronze lining, split at right angles to the sleeve', rf)
            sp.add('MasterLiningLower', 'Master bearing lining, second half', 'rod', [about_x(lining_ri, lining_ro, -sx, sx, 180.0, 270.0, label='Bronze lining half')], 'bronze', 'M1 p. 238', rf)
        else:
            shoe = [rev([(shoe_ri, -shoe_half), (shoe_ro, -shoe_half), (shoe_ro, shoe_half), (shoe_ri, shoe_half)], axis=(1, 0, 0), angle=shoe_w,
                        roll=180.0 - shoe_w / 2.0, label='Bronze slipper shoe')]
            shoe[0]['origin'] = [0, 0, 0]
            shoe.append(cy(14.0, 10.0, [0, 0, shoe_ro - 3.0], label='Shoe boss'))
            sp.add(f'LinkShoe{i}', f'Link rod {i} slipper shoe', 'rod', shoe, 'bronze', 'M1 p. 237: bronze shoes slide on the master sleeve', rf)
            link = [tube(rod_r, rod_hole_r, head_z - 25.0 - (shoe_ro + 7.5), [0, 0, shoe_ro + 7.5], label='Link rod, 7/8 in with a 5/8 in hole')] + head
            sp.add(f'LinkRod{i}', f'Link rod {i}', 'rod', link, 'steel', 'M1 pp. 237-238, 240', rf)
        sp.add(f'WristBush{i}', f'Rod {i} little-end bushing', 'rod', [tube(13.95, c.pin_d / 2 + 0.15, 60.0, [-30.0, 0, head_z], (1, 0, 0), label='Bronze bushing')], 'bronze', 'M1 p. 240', rf)
    # sleeve hardware on the pin axis (turns with the master rod)
    mf = Frame(c.alphas[0] + c.swings[0], (0.0, c.crank[0], c.crank[1]))
    cone_len, jam_len = 26.0, 8.0
    for side, name in ((1, 'Stbd'), (-1, 'Port')):
        x_in = shoe_half + 0.05
        x0 = x_in if side > 0 else -(x_in + cone_len)
        sp.add(f'ConeNut{name}', f'Sleeve cone nut, {name.lower()}', 'rod', [rev([(sleeve_ro + 0.05, 0), (46.0, 0) if side > 0 else (38.0, 0), (38.0 if side > 0 else 46.0, cone_len), (sleeve_ro + 0.05, cone_len)], o=[x0, 0, 0], axis=(1, 0, 0), label='Cone nut')], 'steel', 'M1 p. 238: cone nuts screwed to the sleeve', mf)
        xj = x_in + cone_len + 0.05
        sp.add(f'JamNut{name}', f'Sleeve jam nut, {name.lower()}', 'rod', [tube(40.0, sleeve_ro + 0.05, jam_len, [xj if side > 0 else -(xj + jam_len), 0, 0], (1, 0, 0), label='Jam nut')], 'steel', 'M1 p. 238: locked by jam nuts', mf)

    # ---- pistons, rings, gudgeon pins, retaining screws (piston frame: origin on the pin axis, moved along the cylinder axis)
    par('piston_clearance_diametral', 0.127, 'specified', ['M1'], 'Piston .005 in under the bore at the middle (M1 p. 239).')
    c.Rp = c.R_b - 0.0635
    ring_w, ring_pitch = 3.175, 7.2
    wall, crown = 3.4, 3.8
    for k in range(5):
        i = k + 1
        pf = Frame(0.0, (0.0, 0.0, c.pins[k])).then(Frame(c.alphas[k]))
        crown_top, crown_edge = 60.1, 51.8
        outer = [(0.0, crown_top)] + [(c.Rp * q / 12, crown_top - (crown_top - crown_edge) * (q / 12) ** 2) for q in range(1, 13)]
        inner_top, inner_edge = crown_top - crown, crown_edge - crown
        inner = [((c.Rp - wall) * q / 12, inner_top - (inner_top - inner_edge) * (q / 12) ** 2) for q in range(12, 0, -1)]
        body = [rev(outer + [(c.Rp, -46.7), (c.Rp - wall, -46.7)] + inner + [(0.0, inner_top)], label='Piston body of revolution')]
        tops = [45.5 - j * ring_pitch for j in range(4)]
        deltas = [0.0889, 0.0762, 0.0635, 0.0508]
        for j in range(4):
            body.append(tube(c.Rp + 1, c.Rp - 3.2, ring_w + deltas[j], [0, 0, tops[j] - ring_w - deltas[j]], op='cut', label='Ring groove'))
        for sgn in (-1, 1):
            body.append(cy(16.0, 29.0, [32.0 if sgn > 0 else -61.0, 0, 0], (1, 0, 0), label='Pin boss'))
        for yy in (-26.0, 26.0):
            body.append(bx(74.0, 4.0, 17.0, [-37.0, yy - 2.0, inner_top - 17.0], label='Reinforcing rib'))
        body.append(cy(c.pin_d / 2 + 0.15, 130.0, [-65.0, 0, 0], (1, 0, 0), op='cut', label='Pin bore'))
        for x in (-53.5, 53.5):
            body.append(cy(3.4, 56.0, [x, 0, -28.0], op='cut', label='Retaining screw hole'))
        sp.add(f'Piston{i}', f'Piston {i}', 'piston', body, 'cast iron', 'M1 pp. 239-240; Plate 78A (crown 60.1 mm and skirt -46.7 mm from the pin, measured)', pf)
        for j in range(4):
            sp.add(f'PistonRing{i}_{j + 1}', f'Piston {i} ring {j + 1}', 'piston', [tube(c.R_b - 0.05, c.R_b - 3.0, ring_w, [0, 0, tops[j] - ring_w - deltas[j] / 2.0], label='Piston ring')], 'cast iron', 'M1 p. 240 (narrower than the groove by 0.0508-0.0889 mm)', pf)
        pin = [tube(c.pin_d / 2, 8.75, 118.0, [-59.0, 0, 0], (1, 0, 0), label='Hollow pin')]
        for x in (-53.5, 53.5):
            pin.append(cy(3.4, 30.0, [x, 0, -15.0], op='cut', label='Retaining screw hole'))
        sp.add(f'GudgeonPin{i}', f'Gudgeon pin {i}', 'piston', pin, 'steel', 'M1 p. 240: hollow case-hardened tube 7/8 in; bore estimated', pf)
        for s, x in (('a', -53.5), ('b', 53.5)):
            sp.add(f'PinRetainer{i}_{s}', f'Piston {i} pin retaining screw {s}', 'piston', [cy(3.2, 40.5, [x, 0, -22.3], label='Screw shank'), cy(5.5, 6.05, [x, 0, -28.1], label='Screw head')], 'steel', 'Plate 78A: pin retained by a screw through each piston boss (form read from the plate)', pf)
