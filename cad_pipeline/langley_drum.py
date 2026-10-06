"""Port and starboard crank-chamber drums (head plate, hub, flange pads), main bushings and the port oil cup.

The drum "consists essentially of two heads" (M1 p. 237). Each head is a thin pentagonal plate (3 mm: the starboard drum weighs 3,440 g in the weight
table, which a thick plate would exceed) with a hub carrying the bronze bushing, and one flange pad per cylinder and per head that the cylinder's ear
flange bolts to. The cylinders hold the two heads apart. Pad positions and sizes are estimates; the head plane and hub follow Plate 78B. The port hub is
larger because it carries the cam ring; the starboard hub is thin because the ignition sleeve slides over it.
"""
import math
from cad_pipeline.langley_frame import Frame
from cad_pipeline.langley_v1 import cy, tube, cone, bx, rev, prism


def pentagon(apothem):
    """Pentagon with a flat facing each cylinder: vertices midway between cylinder directions, as (Y, Z)."""
    r = apothem / math.cos(math.radians(36.0))
    return [(-r * math.sin(math.radians(72.0 * k + 36.0)), r * math.cos(math.radians(72.0 * k + 36.0))) for k in range(5)]


def add(sp, c):
    par = sp.par
    head_t = par('drum_head_thickness', 3.0, 'inferred', ['M1'], 'Head plate thickness; the starboard drum is 3,440 g in the weight table (M1 p. 250), which fixes a thin sheet.')
    wx = c.web_x
    hx = wx + 26.0                                               # inner face of a head plate, |X| = 96
    c.head_x = hx
    ap = c.c_flange
    c.hub_ro_port, c.hub_ro_stbd = 34.0, 31.0
    sides = {'Port': dict(sgn=-1, ro=c.hub_ro_port, ri=29.55, bush_ro=29.5, hub_len=54.0),
             'Stbd': dict(sgn=1, ro=c.hub_ro_stbd, ri=28.45, bush_ro=28.4, hub_len=47.0)}
    bolts = [(-82.0, -28.0), (-82.0, 28.0), (82.0, -28.0), (82.0, 28.0)]
    pad_x0, pad_x1 = 69.0, hx + head_t
    for side, d in sides.items():
        sgn, hub_ro, hub_ri, bush_ro, hub_len = d['sgn'], d['ro'], d['ri'], d['bush_ro'], d['hub_len']
        x_lo, x_hi = (-(hx + head_t), -hx) if sgn < 0 else (hx, hx + head_t)          # the head plate spans x_lo..x_hi
        hub_x0 = x_hi - (hub_len + head_t) if sgn < 0 else x_lo
        outline = [(-z, y) for (y, z) in pentagon(ap + 1.0)]
        feats = [prism(outline, head_t, [x_lo, 0, 0], (1, 0, 0), label='Head plate (pentagon, flats under the cylinders)'),
                 tube(hub_ro, hub_ri, hub_len + head_t, [hub_x0, 0, 0], (1, 0, 0), label='Hub'),
                 cy(hub_ri, hub_len + head_t + 5.0, [hub_x0 - 1.0 if sgn > 0 else hub_x0 - 1.0, 0, 0], (1, 0, 0), op='cut', label='Bearing bore')]
        for k in range(5):
            fr = Frame(c.alphas[k])
            pad = [bx(pad_x1 - pad_x0, 80.0, 15.0, [(pad_x0 if sgn > 0 else -pad_x1), -40.0, ap - 15.0], label='Flange pad')]
            for bx_, by_ in bolts:
                if (bx_ > 0) == (sgn > 0):
                    pad.append(cy(4.8, 17.0, [bx_, by_, ap - 16.0], op='cut', label='Bolt hole'))
            feats += fr.features(pad)
        sp.add(f'{side}Drum', f'{side.replace("Stbd", "Starboard")} crank-chamber drum (head, hub and flange pads)', 'drum', feats, 'steel', 'M1 p. 237; Plate 78B (head plane and hub measured); pads and plate thickness estimated', None)
        bush_x0 = x_hi - hub_len if sgn < 0 else x_lo
        sp.add(f'{side}MainBushing', f'{side.replace("Stbd", "Starboard")} main bearing bushing', 'bearing', [tube(bush_ro, c.shaft_ro + 0.15, hub_len, [bush_x0, 0, 0], (1, 0, 0), label='Bronze bushing')], 'bronze', 'M1 p. 239: bronze bushing in the hub of the drum', None)
    # flanged retaining bushing at the outboard end of the port hub (stands in for the tongue-and-groove bushing of M1 p. 237)
    x_end = -(hx + head_t) - 54.0
    sp.add('PortDrumBushingFlange', 'Port hub retaining flange bushing', 'drum', [tube(45.0, c.hub_ro_port + 0.05, 6.0, [x_end, 0, 0], (1, 0, 0), label='Flanged bushing')], 'steel', 'M1 p. 237: flanged bushing joining hub and port bed plate; modelled as a retaining ring on the hub end, against the cam ring', None)
    # port oil cup and its tube to the hub groove (M1 p. 239): below the hub end, clear of the gear train above
    px = -(hx + head_t) - 51.0
    sp.add('PortOilCup', 'Port main bearing oil cup', 'lubrication', [rev([(0, 0), (9.0, 0), (9.0, 22.0), (0, 22.0)], o=[px, 0, -102.0], label='Oil cup')], 'steel', 'M1 p. 239: small oil cup fastened to the port bed plate; form and position estimated', None)
    sp.add('PortOilCupTube', 'Port oil cup tube', 'lubrication', [tube(3.0, 2.0, 34.05, [px, 0, -80.05], label='Oil tube')], 'steel', 'M1 p. 239: oil through a hole in the hub to a circular groove', None)
