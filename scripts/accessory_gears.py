"""Single declaration of the accessory gear train, shared by the CAD builder and the checks.

Standard library only. Positions, tooth counts and pitch radii are declared once here;
rates, tooth phases and mesh records are derived, so a gear can no longer be moved,
re-toothed or re-phased in one place and silently interpenetrate its neighbour in
another. Module, tooth counts and proportions remain illustrative teaching choices.
"""
import math
from gear_geometry import mesh_phase, meshed_rate, module, TAU

# The housing pockets were authored around the previous tip radius (r + 1.8), so the
# addendum keeps that envelope. Dedendum = addendum + 0.25 m, the usual tip clearance.
ADDENDUM = 1.8
CLEARANCE_FACTOR = .25
BACKLASH_FACTOR = .05
FACE_WIDTH = 8.0

# id: x, y, z of the gear's lower face, pitch radius, tooth count (all mm).
GEARS = {
    'CrankGear': dict(centre=(0, 0), z=0, r=30, teeth=24),
    'CamGear': dict(centre=(0, -90), z=0, r=60, teeth=48),
    'CamCluster': dict(centre=(0, -90), z=12, r=16, teeth=16),
    'IdlerGear': dict(centre=(0, 60), z=0, r=30, teeth=24),
    'LeftMagGear': dict(centre=(-40, 90), z=0, r=20, teeth=16),
    'RightMagGear': dict(centre=(40, 90), z=0, r=20, teeth=16),
    'FuelGear': dict(centre=(42, -90), z=12, r=26, teeth=26),
    'OilDriver': dict(centre=(0, -90), z=44, r=13, teeth=13),
    'OilDriven': dict(centre=(-26, -90), z=44, r=13, teeth=13),
    'StarterShaftGear': dict(centre=(60, 0), z=0, r=30, teeth=24),
    'WormWheel': dict(centre=(60, 0), z=73, r=23, teeth=32),
    'AlternatorDrivenGear': dict(centre=(137, 82), z=24, r=15, teeth=20),
}
# Signed rate (turns per crank-sample turn x 1) of gears that no spur mesh drives here.
ROOT_RATES = {'CrankGear': 1.0, 'WormWheel': 0.0, 'AlternatorDrivenGear': -3.0}
# External spur meshes: (driver, driven). Driven gears turn the opposite way, N1/N2 as fast.
MESHES = [('CrankGear', 'CamGear'), ('CrankGear', 'IdlerGear'), ('CrankGear', 'StarterShaftGear'),
          ('IdlerGear', 'LeftMagGear'), ('IdlerGear', 'RightMagGear'),
          ('CamCluster', 'FuelGear'), ('OilDriver', 'OilDriven')]
# Rigidly joined on one shaft: same signed rate. Their relative tooth phase is free.
COAXIAL = [('CamGear', 'CamCluster'), ('CamGear', 'OilDriver')]


def solve():
    """Return id -> derived gear record with rate, tooth phase and driver; raise on any inconsistency."""
    solved = {}
    for gear_id, rate in ROOT_RATES.items():
        solved[gear_id] = dict(rate=rate, phase=0.0, driver=None)
    pending = list(MESHES) + [('coaxial',) + pair for pair in COAXIAL]
    while pending:
        progress = False
        for item in list(pending):
            if item[0] == 'coaxial':
                a, b = item[1], item[2]
                if a not in solved and b not in solved:
                    continue
                if a in solved and b not in solved:
                    solved[b] = dict(rate=solved[a]['rate'], phase=0.0, driver=None)
                elif b in solved and a not in solved:
                    solved[a] = dict(rate=solved[b]['rate'], phase=0.0, driver=None)
                elif solved[a]['rate'] != solved[b]['rate']:
                    raise ValueError(f'coaxial gears {a}/{b} disagree on rate')
            else:
                a, b = item
                if a not in solved:
                    continue
                if b in solved:
                    raise ValueError(f'{b} is reached by more than one mesh; the train must be a tree')
                ga, gb = GEARS[a], GEARS[b]
                if abs(math.dist(ga['centre'], gb['centre']) - (ga['r'] + gb['r'])) > 1e-9:
                    raise ValueError(f'{a}/{b}: centre distance is not the sum of pitch radii')
                if abs(module(ga['r'], ga['teeth']) - module(gb['r'], gb['teeth'])) > 1e-9:
                    raise ValueError(f'{a}/{b}: mating gears must share a module')
                if ga['z'] != gb['z']:
                    raise ValueError(f'{a}/{b}: mating gears must lie in the same plane')
                solved[b] = dict(rate=meshed_rate(solved[a]['rate'], ga['teeth'], gb['teeth']),
                                 phase=mesh_phase(ga['centre'], solved[a]['phase'], ga['teeth'],
                                                  gb['centre'], gb['teeth']),
                                 driver=a)
            pending.remove(item)
            progress = True
        if not progress:
            raise ValueError(f'unreachable gear mesh declarations: {pending}')
    missing = set(GEARS) - set(solved)
    if missing:
        raise ValueError(f'gears without a rate: {sorted(missing)}')
    for gear_id, info in solved.items():
        g = GEARS[gear_id]
        info.update(centre=g['centre'], z=g['z'], r_pitch=g['r'], teeth=g['teeth'], addendum=ADDENDUM,
                    module=module(g['r'], g['teeth']),
                    form=dict(clearance_factor=CLEARANCE_FACTOR, backlash_factor=BACKLASH_FACTOR))
    return solved


def mesh_records():
    """Contract entries for the declared meshes, for the web contract and the audits."""
    solved = solve()
    records = []
    for a, b in MESHES:
        ga, gb = solved[a], solved[b]
        records.append(dict(driver=a, driven=b, centre_distance_mm=math.dist(ga['centre'], gb['centre']),
                            module_mm=ga['module'], teeth=[ga['teeth'], gb['teeth']],
                            ratio=ga['teeth'] / gb['teeth'], backlash_mm=BACKLASH_FACTOR * ga['module'],
                            driven_phase_rad=gb['phase']))
    return records


# Wrap spring: the released coil sits off the drum/hub and the grip animation contracts it to touch, never into them.
SPRING_COIL_R = 11.2          # released coil-centre radius (mm); built into the model
SPRING_WIRE_R = .8
SPRING_SURFACE_R = 10.0       # drum and hub radius the spring wraps
SPRING_GRIP_CLEARANCE = .1    # contracted spring stops this far off the surfaces


def spring_grip_scale():
    """XY scale at full grip: the coil's inner surface lands SPRING_GRIP_CLEARANCE off the drum."""
    return (SPRING_SURFACE_R + SPRING_WIRE_R + SPRING_GRIP_CLEARANCE) / SPRING_COIL_R


# Parts splined to a gear turn with it even when a focus animation leaves them out of the displayed path.
SPLINED_TO = {'OilTachShaft': 'CamGear'}


def turning_with(part_ids):
    """The part ids that must turn whenever `part_ids` do: `part_ids` plus everything linked to them.

    A focus clip animates one highlighted power path, but a gear driven through a held-still neighbour passes its
    teeth through it, and so does a shaft spun inside a still spline. So meshing gears (MESHES), gears on one shaft
    (COAXIAL) and a part splined to its host gear (SPLINED_TO) all turn together, whichever side the path named.
    The path's own parts, as published in the contract, are left alone; only the motion uses this set.
    """
    turning = set(part_ids)
    links = [*MESHES, *COAXIAL, *SPLINED_TO.items()]
    grew = True
    while grew:
        grew = False
        for a, b in links:
            if (a in turning) != (b in turning):
                turning.update((a, b))
                grew = True
    return turning

GEAR_FORM_NOTE = ('Involute spur teeth (20 degree pressure angle) with positive backlash, solved tooth phase and '
                  'tip clearance so meshing gears touch but never overlap. Module, tooth counts and proportions are '
                  'illustrative teaching choices, not manufacturer gear data.')

if __name__ == '__main__':
    for gear_id, info in solve().items():
        print(f"{gear_id:22s} rate={info['rate']:+.4f} phase={math.degrees(info['phase']):8.3f} deg  m={info['module']:.4f}")
