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

# Separate GTSIO static-rebuild declaration; the existing teaching asset above
# retains its original layout. Counts/module are packaging estimates, not OEM.
GTSIO_STATIC_TIMING=dict(crank_centre=(0.,0.),cam_centre=(0.,-126.),crank_teeth=30,cam_teeth=60,module_mm=2.8)

# Static GTSIO-H drive reconstruction. The 0.667 propeller ratio is documented;
# tooth counts, modules, face widths, axial stations and absolute indexing are
# explicit packing estimates. Keep the previous teaching GEARS untouched.
GTSIO_STATIC_REDUCTION = dict(pinion_teeth=30, propeller_teeth=45, module_mm=3.36,
                             backlash_mm=.0040*25.4, face_width_mm=36., z_mm=636.)
GTSIO_STATIC_DRIVE_GEARS = {
    'CrankshaftGear': dict(centre=GTSIO_STATIC_TIMING['crank_centre'], z=-36., width=12.,
        teeth=GTSIO_STATIC_TIMING['crank_teeth'], module_mm=GTSIO_STATIC_TIMING['module_mm'], backlash_mm=.00585*25.4),
    'CamshaftGear': dict(centre=GTSIO_STATIC_TIMING['cam_centre'], z=-36., width=12.,
        teeth=GTSIO_STATIC_TIMING['cam_teeth'], module_mm=GTSIO_STATIC_TIMING['module_mm'], backlash_mm=.00585*25.4),
    'CamClusterGear': dict(centre=GTSIO_STATIC_TIMING['cam_centre'], z=-46., width=10.,
        teeth=24, module_mm=2.8, backlash_mm=.0107*25.4),
    'ReductionPinion': dict(centre=GTSIO_STATIC_TIMING['crank_centre'], z=GTSIO_STATIC_REDUCTION['z_mm'],
        width=GTSIO_STATIC_REDUCTION['face_width_mm'], teeth=GTSIO_STATIC_REDUCTION['pinion_teeth'],
        module_mm=GTSIO_STATIC_REDUCTION['module_mm'], backlash_mm=GTSIO_STATIC_REDUCTION['backlash_mm']),
    'PropellerShaft': dict(centre=(0., GTSIO_STATIC_REDUCTION['module_mm'] *
        (GTSIO_STATIC_REDUCTION['pinion_teeth']+GTSIO_STATIC_REDUCTION['propeller_teeth'])/2),
        z=GTSIO_STATIC_REDUCTION['z_mm'], width=GTSIO_STATIC_REDUCTION['face_width_mm'],
        teeth=GTSIO_STATIC_REDUCTION['propeller_teeth'], module_mm=GTSIO_STATIC_REDUCTION['module_mm'],
        backlash_mm=GTSIO_STATIC_REDUCTION['backlash_mm']),
}
GTSIO_STATIC_DRIVE_MESHES = [('CrankshaftGear','CamshaftGear'),('ReductionPinion','PropellerShaft')]


def solve_gtsio_static_drive():
    records = {}
    for id, g in GTSIO_STATIC_DRIVE_GEARS.items():
        m=g['module_mm']
        records[id]=dict(g, r_pitch=m*g['teeth']/2, addendum=m,
                         form=dict(clearance_factor=.25,backlash_factor=g['backlash_mm']/m),
                         phase=0.,rate=1.,driver=None)
    for a,b in GTSIO_STATIC_DRIVE_MESHES:
        ga,gb=records[a],records[b]
        if abs(math.dist(ga['centre'],gb['centre'])-ga['r_pitch']-gb['r_pitch'])>1e-9:
            raise ValueError('GTSIO drive centre distance does not close')
        if ga['module_mm']!=gb['module_mm'] or ga['z']!=gb['z']:
            raise ValueError('GTSIO mating gears need common module and face plane')
        gb.update(phase=mesh_phase(ga['centre'],ga['phase'],ga['teeth'],gb['centre'],gb['teeth']),
                  rate=meshed_rate(ga['rate'],ga['teeth'],gb['teeth']),driver=a)
    records['CamClusterGear'].update(rate=records['CamshaftGear']['rate'],
                                    phase=records['CamshaftGear']['phase'])
    return records


def gtsio_static_mesh_records():
    gears=solve_gtsio_static_drive()
    return [dict(driver=a,driven=b,centre_distance_mm=math.dist(gears[a]['centre'],gears[b]['centre']),
                 module_mm=gears[a]['module_mm'],teeth=[gears[a]['teeth'],gears[b]['teeth']],
                 ratio=gears[a]['teeth']/gears[b]['teeth'],backlash_mm=gears[a]['backlash_mm'],
                 driven_phase_rad=gears[b]['phase']) for a,b in GTSIO_STATIC_DRIVE_MESHES]

def gtsio_cam_rate():
    return -GTSIO_STATIC_TIMING['crank_teeth']/GTSIO_STATIC_TIMING['cam_teeth']


def solve_gtsio_accessory_drive():
    """New static reconstruction, independent of the published teaching asset.

    OEM relationships: crank->idler->magnetos, crank->starter shaftgear,
    cam cluster->fuel, cam spline->oil shaft->scavenge. Counts and packing are
    selected estimates. The unconnected secondary idler is retained as an
    explicit interface awaiting H vacuum-route evidence, never a ratio claim.
    """
    records=solve_gtsio_static_drive()
    m=GTSIO_STATIC_TIMING['module_mm']; yi=m*(30+42)/2
    dmag=m*(42+20)/2
    definitions={
        'IdlerGear':dict(centre=(0.,yi),z=-36.,width=12.,teeth=42,module_mm=m,backlash_mm=.15),
        'AccessoryIdlerGear':dict(centre=(0.,yi),z=-48.,width=12.,teeth=32,module_mm=m,backlash_mm=.15),
        'LeftMagnetoGear':dict(centre=(-.6*dmag,yi+.8*dmag),z=-37.,width=12.,teeth=20,module_mm=m,backlash_mm=2*.01135*25.4-.15),
        'RightMagnetoGear':dict(centre=(.6*dmag,yi+.8*dmag),z=-37.,width=12.,teeth=20,module_mm=m,backlash_mm=2*.01135*25.4-.15),
        'StarterShaftGear':dict(centre=(m*(30+24)/2,0.),z=-36.,width=12.,teeth=24,module_mm=m,backlash_mm=.15),
        'FuelPumpDriveGear':dict(centre=(-m*(24+24)/2,-126.),z=-46.,width=10.,teeth=24,module_mm=m,backlash_mm=.0107*25.4),
        'OilPumpDriver':dict(centre=(0.,-126.),z=-166.,width=2.62425*25.4-.0035*25.4,teeth=18,module_mm=1.8,backlash_mm=.0179*25.4),
        'OilPumpDriven':dict(centre=(32.4,-126.),z=-166.,width=2.62425*25.4-.0035*25.4,teeth=18,module_mm=1.8,backlash_mm=.0179*25.4),
        'ScavengePumpDriver':dict(centre=(0.,-126.),z=-192.,width=14.,teeth=18,module_mm=1.8,backlash_mm=.0179*25.4),
        'ScavengePumpDriven':dict(centre=(32.4,-126.),z=-192.,width=14.,teeth=18,module_mm=1.8,backlash_mm=.0179*25.4),
    }
    for id,g in definitions.items():
        records[id]=dict(g,r_pitch=g['teeth']*g['module_mm']/2,addendum=g['module_mm'],
            form=dict(clearance_factor=.25,backlash_factor=g['backlash_mm']/g['module_mm']),
            phase=0.,rate=None,driver=None)
    links=[('mesh','CrankshaftGear','IdlerGear'),('rigid','IdlerGear','AccessoryIdlerGear'),
           ('mesh','IdlerGear','LeftMagnetoGear'),('mesh','IdlerGear','RightMagnetoGear'),
           ('mesh','CrankshaftGear','StarterShaftGear'),('mesh','CamClusterGear','FuelPumpDriveGear'),
           ('rigid','CamshaftGear','OilPumpDriver'),('mesh','OilPumpDriver','OilPumpDriven'),
           ('rigid','OilPumpDriver','ScavengePumpDriver'),('mesh','ScavengePumpDriver','ScavengePumpDriven')]
    for kind,driver,driven in links:
        ga,gb=records[driver],records[driven]
        if kind=='rigid':
            gb.update(rate=ga['rate'],phase=0.,driver=driver)
        else:
            if abs(math.dist(ga['centre'],gb['centre'])-ga['r_pitch']-gb['r_pitch'])>1e-8:
                raise ValueError('Accessory centre distance does not close: '+driven)
            engagement=min(ga['z']+ga['width'],gb['z']+gb['width'])-max(ga['z'],gb['z'])
            if ga['module_mm']!=gb['module_mm'] or engagement < .9*min(ga['width'],gb['width']):
                raise ValueError('Accessory mesh plane/module mismatch: '+driven)
            gb.update(rate=meshed_rate(ga['rate'],ga['teeth'],gb['teeth']),
                phase=mesh_phase(ga['centre'],ga['phase'],ga['teeth'],gb['centre'],gb['teeth']),driver=driver)
    return records


GTSIO_ACCESSORY_MESHES=[('CrankshaftGear','IdlerGear'),('IdlerGear','LeftMagnetoGear'),
    ('IdlerGear','RightMagnetoGear'),('CrankshaftGear','StarterShaftGear'),
    ('CamClusterGear','FuelPumpDriveGear'),('OilPumpDriver','OilPumpDriven'),
    ('ScavengePumpDriver','ScavengePumpDriven')]


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


# Cross-axis starter worm. A true worm mesh needs a throated wheel and an enveloping thread, which this model does not
# have, so the worm sits WORM_CLEARANCE off the wheel's tooth tips instead of cutting into them.
WORM_CORE_R = 6.0             # shaft radius; the motor input bore seats it
WORM_WIRE_R = 1.0             # thread wire radius: the thread crest is core + wire
WORM_CLEARANCE = .3


def worm_axis_y():
    """Y of the worm axis: out from the wheel by its tooth-tip radius, the worm's crest radius and the clearance."""
    wheel = GEARS['WormWheel']
    return wheel['centre'][1] - (wheel['r'] + ADDENDUM + WORM_CORE_R + WORM_WIRE_R + WORM_CLEARANCE)


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

def gtsio_governor_development():
    """Provisional front installation; counts/position are estimates, not OEM dimensions.

    A common apex preserves the already-tested 55/34 method. The cam nose is
    589.8..608 mm; a 600 mm back face leaves room for the keyed rear hub.
    """
    return dict(apex=[0., -126., 617.], module=1., face_width=7.,
        driver=dict(teeth=55, axis=[0,0,-1], quaternion=[0,1,0,0], phase=0., rate=.5),
        driven=dict(teeth=34, axis=[-1,0,0], quaternion=[0,-math.sqrt(.5),0,math.sqrt(.5)],
                    phase=math.pi+math.pi/34, rate=-.5*55/34),
        status='Estimated development placement; installed case clearance pending')


def gtsio_tach_development():
    """Pinned equal bevels in the pump cover; packaging/counts remain estimates.

    This is the proven -Z/-X 24/24 pair rotated180 degrees about global Z.
    Oil shaft -0.5 about +Z is +0.5 about the driver's -Z axis. The driven
    shaft is -0.5 about outward +X: clockwise looking at the output pad.
    The cone orientation therefore follows the documented output direction;
    the side choice and apex station are provisional packaging decisions.
    """
    return dict(apex=[0.,-126.,-216.],module=1.,face_width=4.,
        driver=dict(teeth=24,axis=[0,0,-1],quaternion=[-1,0,0,0],phase=0.,rate=.5),
        driven=dict(teeth=24,axis=[1,0,0],quaternion=[math.sqrt(.5),0,math.sqrt(.5),0],
                    phase=math.pi+math.pi/24,rate=-.5),
        status='Source construction and ratio; provisional side and axial packaging')


def gtsio_h_accessory_development():
    """Independent nested accessory gears (MSB94-4G printed14).

    Counts remain estimates. 8/7 rounds to the documented1.14; the second
    module follows the shared axes, rather than being copied from the first.
    Rates use the existing mathematical crank frame. Pad-view direction
    calibration remains required before any operating animation.
    """
    gears=solve_gtsio_accessory_drive()
    idler=gears['IdlerGear'];secondary=gears['AccessoryIdlerGear']
    distance=math.dist(idler['centre'],gears['LeftMagnetoGear']['centre'])
    teeth=20
    secondary_module=2*distance/(secondary['teeth']+teeth)
    secondary.update(module_mm=secondary_module,r_pitch=secondary_module*secondary['teeth']/2,
                     addendum=secondary_module,backlash_mm=.15,
                     form=dict(clearance_factor=.25,backlash_factor=.15/secondary_module))
    for side in ('Left','Right'):
        gear=gears[side+'MagnetoGear'];identity=side+'AccessoryGear'
        gears[identity]=dict(centre=gear['centre'],z=-48.,width=10.8,teeth=teeth,
            module_mm=secondary_module,r_pitch=secondary_module*teeth/2,
            addendum=secondary_module,backlash_mm=.15,
            form=dict(clearance_factor=.25,backlash_factor=.15/secondary_module),
            phase=mesh_phase(secondary['centre'],secondary['phase'],secondary['teeth'],gear['centre'],teeth),
            rate=meshed_rate(secondary['rate'],secondary['teeth'],teeth),driver='AccessoryIdlerGear',
            source_pad_rotation='CCW',pad_axis=[0,0,-1],direction_status='Source pad label; installed sign calibration pending')
    return gears


def gtsio_alternator_face_development():
    """Isolated face/pinion method trial; installation remains separate.

    The fixture uses +Z face/+X pinion axes with mathematical rates1 and3.
    Installed normal, mounting plane and physical direction are separate;
    the complete engine direction convention remains unresolved.
    """
    return dict(face_teeth=60,pinion_teeth=20,module=1.6,ratio=3.,
        face_axis=[0,0,1],pinion_axis=[1,0,0],face_rate=1.,pinion_rate=3.,
        pinion_start_normalized=[27.,0.,10.],pinion_width_normalized=6.,
        pinion_quaternion=[0.,math.sqrt(.5),0.,math.sqrt(.5)],
        host='ReductionPinion',
        status='Estimated count/module and trial envelope; no engine tooth geometry accepted yet')


def gtsio_alternator_installation_development():
    """Calculated front installation; physical rotation sign is still open."""
    layout=gtsio_alternator_face_development()
    layout.update(module=1.5,face_origin=[0,0,604.],face_axis=[0,0,1],
                  pinion_start=[40.5,0,619.],pinion_width=9.,
                  pad_x=75.,mount_offsets=[[-26,-26],[26,-26],[26,26],[-26,26]],
                  status='Estimated installation after A-4-13/A-4-20/A-4-33 review; complete native/neighbor checks and physical direction calibration pending')
    return layout


GEAR_FORM_NOTE = ('Involute spur teeth (20 degree pressure angle) with positive backlash, solved tooth phase and '
                  'tip clearance so meshing gears touch but never overlap. Module, tooth counts and proportions are '
                  'illustrative teaching choices, not manufacturer gear data.')

if __name__ == '__main__':
    for gear_id, info in solve().items():
        print(f"{gear_id:22s} rate={info['rate']:+.4f} phase={math.degrees(info['phase']):8.3f} deg  m={info['module']:.4f}")
