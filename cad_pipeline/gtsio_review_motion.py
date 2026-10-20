"""Shared illustrative R10 review motion. No disassembly/clearance acceptance.

Only this module owns transforms. The rig, reference sampler and GLB tests use
it. The source recipe and tessellation are never changed. The contract that
describes this motion to the viewer is built by `gtsio_contract.py`.
"""
from functools import lru_cache
import math
import re

from cad_pipeline.gtsio_layout import StaticEngineLayout, EXPORT_MIRROR_X
from cad_pipeline import gtsio_valvetrain_pose as vp
from cad_pipeline import gtsio_valve_layout as vl
import accessory_gears as gears  # scripts/ is on sys.path (gtsio_valvetrain_pose adds it); the declared gear train

# All the motion maths below is written in the CAD frame of the frozen build (odd cylinders on +X). The export frame is its reflection x -> -x when
# EXPORT_MIRROR_X is set (cad_pipeline/gtsio_layout.py, docs/r10-handedness.md): matrices are conjugated by the reflection (so the crank turns the other way
# about +Z and every body is the exact mirror image of what it was), explosion offsets and the gear bodies are written in the export frame, and `LAYOUT`
# below is the layout as the export sees it. A reflection is an isometry, so clearances, overlaps and the firing order are unchanged by it.
CAD_LAYOUT = StaticEngineLayout(complete_cylinders=True)


def reflect_x_matrix(m):
    """The 4x4 matrix `m` conjugated by the reflection x -> -x (R m R): the same rigid motion seen in the mirror image."""
    k = (-1, 1, 1, 1)
    return [[m[i][j] * k[i] * k[j] + 0.0 for j in range(4)] for i in range(4)]


def reflect_x_point(p):
    return (0.0 - p[0], *p[1:])


class ExportLayout:
    """The CAD-frame layout (`StaticEngineLayout`) as the review export sees it: positions reflected in x, roll angles reversed, bank sign swapped."""

    def __init__(self, cad, mirror):
        self.cad, self.mirror = cad, mirror

    def __getattr__(self, name):
        return getattr(self.cad, name)

    def station(self, n):
        return self.cad.station(n)

    def pose(self, n, theta=0):
        p = self.cad.pose(n, theta)
        if not self.mirror:
            return p
        return dict(p, pin=reflect_x_point(p['pin']), wrist=reflect_x_point(p['wrist']), rod_roll=0.0 - p['rod_roll'], piston_roll=-p['piston_roll'], sign=-p['sign'])


LAYOUT = ExportLayout(CAD_LAYOUT, EXPORT_MIRROR_X)
EXPLODE = 'Explode - illustrative layout'
COLLAPSE = 'Collapse - illustrative layout'
CYCLE = 'Core cycle - illustrative'
STAGES = [
    dict(progress=0, label='Assembled R10'),
    dict(progress=18, label='External fasteners and covers'),
    dict(progress=36, label='Accessories and sump'),
    dict(progress=58, label='Cylinder packages'),
    dict(progress=80, label='Case halves and split bearings'),
    dict(progress=100, label='Core and drive detail'),
]
SCOPE = ('Private illustrative review draft. Explosion is a component layout, not an approved maintenance removal sequence; '
         'transit and swept clearances are unaccepted. R10 whole-engine native/STEP validation is incomplete. '
         'Cycle uses the frozen slider-crank and inferred harmonic cam law; hydraulic behaviour, damper dynamics and '
         'accessory operation are excluded. No manufacturer timing or simulation claim.')


# Parts the Assembled view used to hold `fixed:` although they are fitted to a shaft or gear that turns (docs/r10-cycle-overlap-root-causes.md).
# The Core view keeps hiding them (cycle_visible below), exactly as before. Every assignment was checked by the exact pose audit; the declared
# gear train (scripts/accessory_gears.py) supplies each spinning body's centre and rate, nothing is invented here.
CRANK_FITTED_GROUPS = ('dampers',)
CRANK_FITTED = ('QuillShaft', 'ReductionPinion', 'QuillPlate', 'QuillPlateScrew1', 'QuillPlateScrew2',
                'AlternatorFaceGear', 'AlternatorFaceTabLock1', 'AlternatorFaceTabLock2', *[f'AlternatorFaceScrew{n}' for n in range(1, 5)])
CAM_FITTED = ('GovernorCamKey', 'GovernorDriveBevel', 'OilPumpDriver', 'ScavengePumpDriver', 'ScavengeDriveKey', 'TachDriverBevel', 'TachDriverPin')
# Gears that turn about a Z-parallel axis, with what is fitted to them (screws, couplings): declared gear -> fitted part ids.
SPINNING_GEARS = {
    'IdlerGear': ('IdlerGear', 'IdlerClusterScrew1', 'IdlerClusterScrew2', 'IdlerClusterScrew3', 'IdlerClusterScrew4'),
    'AccessoryIdlerGear': ('AccessoryIdlerGear',),
    'LeftMagnetoGear': ('LeftMagnetoGear', 'LeftMagnetoCoupling'),
    'RightMagnetoGear': ('RightMagnetoGear', 'RightMagnetoCoupling'),
    'LeftAccessoryGear': ('LeftAccessoryGear',),
    'RightAccessoryGear': ('RightAccessoryGear',),
    'StarterShaftGear': ('StarterShaftGear',),
    'FuelPumpDriveGear': ('FuelPumpDriveGear', 'FuelDriveCoupling'),
    'OilPumpDriven': ('OilPumpDriven',),
    'ScavengePumpDriven': ('ScavengePumpDriven',),
    'PropellerShaft': ('PropellerShaft',),
}


def spin_body(point, axis, rate):
    """`spin:px,py,pz,ax,ay,az,rate` in export-frame millimetres: the part turns about the axis through p by rate x the crank angle. Mirrors the viewer's evaluator.

    The arguments are the declaration of scripts/accessory_gears.py, in the CAD frame. In the export frame the centre and the axis are reflected in x and the
    rate changes sign: a reflection turns a rotation about an axis into a rotation about the reflected axis the other way round (R Rot(a, f) R = Rot(R a, -f))."""
    if EXPORT_MIRROR_X:
        point, axis, rate = reflect_x_point(point), reflect_x_point(axis), 0.0 - rate
    return 'spin:' + ','.join(f'{v:.6f}' for v in (*point, *axis)) + f',{rate:.9f}'


@lru_cache(maxsize=None)
def spinning_bodies():
    """{part id: spin body} from the declared gear train (accessory_gears.py): Z-axis gears, the governor and tach bevels' driven side, the alternator pinion."""
    declared = {**gears.solve_gtsio_accessory_drive(), **gears.gtsio_h_accessory_development()}
    out = {}
    for gear, fitted in SPINNING_GEARS.items():
        centre, rate = declared[gear]['centre'], declared[gear]['rate']
        for pid in fitted:
            out[pid] = spin_body((centre[0], centre[1], 0.), (0., 0., 1.), rate)
    governor = gears.gtsio_governor_development()
    for pid in ('GovernorDrivenShaftGear',):
        out[pid] = spin_body(governor['apex'], governor['driven']['axis'], governor['driven']['rate'])
    tach = gears.gtsio_tach_development()
    for pid in ('TachDrivenBevel', 'TachDrivenPin', 'TachOutputShaft'):
        out[pid] = spin_body(tach['apex'], tach['driven']['axis'], tach['driven']['rate'])
    alternator = gears.gtsio_alternator_installation_development()
    for pid in ('AlternatorDrivenGear', 'AlternatorGearBushing', 'AlternatorKeyedHub', 'AlternatorCouplingSpring', 'AlternatorRotorShaft',
                'AlternatorWoodruffKey', 'AlternatorThrustWasher', 'AlternatorSlottedNut', 'AlternatorCotter'):
        out[pid] = spin_body(alternator['pinion_start'], alternator['pinion_axis'], alternator['pinion_rate'])
    return out


def export_pad_sides():
    """x of the pads and drives that sit on a named side of the engine, in the export frame (the gear declarations of scripts/accessory_gears.py are in the CAD frame).

    The first four are the manual's (A-3-1, A-3-2); the starter, the fuel-pump drive and the tachometer pad follow the reflection only (the manual is silent): inferred."""
    drive = gears.solve_gtsio_accessory_drive()
    s = -1.0 if EXPORT_MIRROR_X else 1.0
    return dict(alternator_pad_x=s * gears.gtsio_alternator_installation_development()['pad_x'],
                governor_pad_x=s * gears.gtsio_governor_development()['driven']['axis'][0],
                left_magneto_x=s * drive['LeftMagnetoGear']['centre'][0], right_magneto_x=s * drive['RightMagnetoGear']['centre'][0],
                starter_pad_x=s * drive['StarterShaftGear']['centre'][0], fuel_pump_drive_x=s * drive['FuelPumpDriveGear']['centre'][0],
                tach_pad_x=s * gears.gtsio_tach_development()['driven']['axis'][0])


def eye():
    return [[float(i == j) for j in range(4)] for i in range(4)]


def mul(a,b):
    return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def trans(v):
    m=eye()
    for i in range(3): m[i][3]=v[i]
    return m


def rotation(axis,angle):
    x,y,z=vp.unit(axis);c=math.cos(angle);s=math.sin(angle);d=1-c
    return [[c+x*x*d,x*y*d-z*s,x*z*d+y*s,0],
            [y*x*d+z*s,c+y*y*d,y*z*d-x*s,0],
            [z*x*d-y*s,z*y*d+x*s,c+z*z*d,0],[0,0,0,1]]


def around(axis,angle,pivot):
    return mul(mul(trans(pivot),rotation(axis,angle)),trans(vp.scale(pivot,-1)))


def align(a,b):
    a,b=vp.unit(a),vp.unit(b)
    cross=(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    length=math.sqrt(vp.dot(cross,cross))
    return rotation(vp.scale(cross,1/length),math.atan2(length,vp.dot(a,b))) if length>1e-12 else eye()


def world_vector(v,n):
    sign=1 if n%2 else -1
    return sign*v[0],v[1],-sign*v[2]


class ReviewMotion:
    def __init__(self,spec,parts,seeds):
        self.parameters=spec['parameters']
        self.parts={p['id']:p for p in parts}
        self.seeds={p:s['id'] for s in seeds for p in s['part_ids'] if s['id']!='propeller'}

    @lru_cache(maxsize=None)
    def valve_pose(self,name,n,theta):
        return vp.pose(name,n,self.parameters,CAD_LAYOUT,theta)

    def valve_tag(self,pid):
        match=re.search(r'(Intake|Exhaust).*?([1-6])$',pid)
        return (match[1],int(match[2])) if match else None

    def body(self,pid):
        if pid in self.seeds: return self.seeds[pid]
        tag=self.valve_tag(pid)
        if tag:
            name,n=tag;suffix=pid[len(name):-1]
            if pid.startswith('Lifter'): return 'lifter:'+name+str(n)
            if suffix in ['Valve','Retainer','KeeperA','KeeperB','RotocoilRim']:return 'valve:'+name+str(n)
            if suffix in ['Rocker','RockerBush']:return 'rocker:'+name+str(n)
            if suffix=='Pushrod': return 'pushrod:'+name+str(n)
            if suffix in ['InnerSpring','OuterSpring']:return 'spring:'+name+str(n)
        fitted=self.fitted_body(pid)
        return fitted or 'fixed:'+pid

    def fitted_body(self,pid):
        """The moving body of a part the contract used to hold fixed (see CRANK_FITTED / CAM_FITTED / SPINNING_GEARS), or None."""
        if pid in CRANK_FITTED or self.parts.get(pid,{}).get('group') in CRANK_FITTED_GROUPS:return 'crank'
        if pid in CAM_FITTED:return 'cam'
        return spinning_bodies().get(pid)

    def origin_basis(self,pid):
        """Origin and basis of the part's body in the export frame (the rig sets a node's origin and orientation from it)."""
        point,basis=self.cad_origin_basis(pid)
        return (reflect_x_point(point),reflect_x_matrix(basis)) if EXPORT_MIRROR_X else (point,basis)

    def cad_origin_basis(self,pid):
        body=self.body(pid)
        if body=='crank':return (0,0,0),eye()
        if body=='cam':return (0,self.parameters['case_cam_y']['value'],0),eye()
        if body.startswith('rod'):return CAD_LAYOUT.pose(int(body[-1]))['pin'],eye()
        if body.startswith('piston'):return CAD_LAYOUT.pose(int(body[-1]))['wrist'],eye()
        tag=self.valve_tag(pid)
        if tag:
            name,n=tag
            if body.startswith('rocker:'):
                return vl.world_point(name,n,vl.PIVOT_T,vl.PIVOT_U,0,self.parameters,CAD_LAYOUT),eye()
            if body.startswith('spring:'):
                foot=vl.world_point(name,n,vl.SPRING_TOP-vl.SPRING_INSTALLED,0,0,self.parameters,CAD_LAYOUT)
                direction=world_vector(vl.raw_frame(name,self.parameters)[1],n)
                return foot,align((1,0,0),direction)
        return (0,0,0),eye()

    def matrix(self,pid,theta):
        """The body's 4x4 matrix at crank angle `theta` (degrees), CAD millimetres, in the export frame."""
        body=self.body(pid)
        if body.startswith('spin:'):             # written in the export frame already (spin_body)
            x=[float(v) for v in body[5:].split(',')]
            return around(x[3:6],math.radians(theta)*x[6],x[0:3])
        m=self.cad_matrix(pid,theta)
        return reflect_x_matrix(m) if EXPORT_MIRROR_X else m

    def cad_matrix(self,pid,theta):
        """The same matrix in the CAD frame of the frozen build (every body but the spinning ones, whose strings are in the export frame)."""
        body=self.body(pid)
        if body=='crank':return around((0,0,1),math.radians(theta),(0,0,0))
        if body=='cam':return around((0,0,1),math.radians(theta)*vp.gtsio_cam_rate(),self.cad_origin_basis(pid)[0])
        if body.startswith('rod'):
            n=int(body[-1]);a,b=CAD_LAYOUT.pose(n),CAD_LAYOUT.pose(n,theta)
            return mul(mul(trans(b['pin']),rotation((0,0,1),math.radians(b['rod_roll']-a['rod_roll']))),trans(vp.scale(a['pin'],-1)))
        if body.startswith('piston'):
            n=int(body[-1]);return trans(vp.sub(CAD_LAYOUT.pose(n,theta)['wrist'],CAD_LAYOUT.pose(n)['wrist']))
        tag=self.valve_tag(pid)
        if not tag:return eye()
        name,n=tag;a,b=self.valve_pose(name,n,0),self.valve_pose(name,n,theta)
        if body.startswith('lifter:'):return trans(vp.sub(b['socket'],a['socket']))
        if body.startswith('valve:'):
            direction=world_vector(vl.raw_frame(name,self.parameters)[1],n)
            return trans(vp.scale(direction,-(b['valve_lift']-a['valve_lift'])))
        if body.startswith('rocker:'):
            axis=vp.scale(world_vector(vl.raw_frame(name,self.parameters)[2],n),-1)
            return around(axis,b['beta']-a['beta'],self.cad_origin_basis(pid)[0])
        if body.startswith('pushrod:'):
            return mul(mul(trans(b['socket']),align(vp.sub(a['cup'],a['socket']),vp.sub(b['cup'],b['socket']))),trans(vp.scale(a['socket'],-1)))
        if body.startswith('spring:'):
            scale=(vl.SPRING_INSTALLED-b['valve_lift'])/(vl.SPRING_INSTALLED-a['valve_lift'])
            axis=world_vector(vl.raw_frame(name,self.parameters)[1],n);m=eye()
            for i in range(3):
                for j in range(3):m[i][j]+=(scale-1)*axis[i]*axis[j]
            foot=self.cad_origin_basis(pid)[0]
            return mul(mul(trans(foot),m),trans(vp.scale(foot,-1)))
        return eye()

    def cycle_visible(self,pid):
        # Hide unresolved connected mechanisms, including counterweights whose
        # articulation/dynamics have not been solved. No motion is invented.
        # Parts that only turn in the Assembled view (fitted_body) stay hidden in the Core view, as before.
        return (not self.body(pid).startswith('fixed:') and not self.fitted_body(pid)) or self.parts[pid]['group'] in ['main_bearings'] or bool(re.match(r'(Intake|Exhaust)(Seat|Guide|SpringFoot|LowerInnerRetainer|RockerShaft)[1-6]$',pid))

    def explosion(self,pid):
        """(stage, offset_mm) in the export frame: the CAD-frame layout below with its x reflected (the part bounds are the CAD frame's)."""
        stage,offset=self.cad_explosion(pid)
        return (stage,(-offset[0] if offset[0] else offset[0],*offset[1:])) if EXPORT_MIRROR_X else (stage,offset)

    def cad_explosion(self,pid):
        part=self.parts[pid];group=part['group'];bounds=part['bounds_mm']
        centre=[sum(v)/2 for v in zip(*bounds)];sign=1 if centre[0]>=0 else -1
        tag=self.valve_tag(pid)
        n=tag[1] if tag else (int(pid[-1]) if pid[-1] in '123456' else None)
        if group in ['rocker_covers','spark_plugs']:
            return 1,(sign*350,180,0)
        if group=='deck_fasteners':return 1,(sign*500,130,0)
        if group=='case_fasteners':return 1,(sign*460,-130,0)
        if group=='sump':return 2,(0,-430,0)
        if group in ['cylinders','cylinder_heads','valves','valve_springs','rockers','rocker_retention','pushrods','pushrod_housings']:
            return 3,(sign*430,0,((n-1)//2-1)*120 if n else 0)
        if group=='crankcase':return 4,(sign*230,260,0)
        if group=='main_bearings':return 4,(sign*230,260,0)
        if group in ['crankshaft','rods','pistons','rings','dampers']:return 5,(0,0,0)
        if group in ['camshaft','hydraulic_lifters','cam_drive']:return 5,(0,-130,-120)
        if group in ['front_drive','propeller_shaft','reduction_retention','drive_bearings','propeller_thrust','propeller_oil_transfer','propeller_seal','front_case_hardware']:
            return 5,(0,40,430)
        # Each rear accessory keeps its system together. These are deliberately
        # labelled visual system groups, never accepted rigid body assignments.
        lane={'magneto_drives':-2,'fuel_drive':-1,'oil_pump':0,'scavenge_pump':1,'starter_drive':2,'starter_shell':2,
              'governor_drive':-2,'tach_drive':1,'tach_hardware':1,'alternator_drive':2,'alternator_machine':2,'alternator_hardware':2}.get(group,0)
        return 2,(lane*95,-180,-350)

    def exploded_matrix(self,pid,fraction):
        stage,offset=self.explosion(pid)
        ends=[0,.18,.36,.58,.80,1]
        progress=max(0,min(1,(fraction-ends[stage-1])/(ends[stage]-ends[stage-1])))
        return trans(vp.scale(offset,progress))


def cad_metre_matrix(m):
    """Convert a 4x4 CAD millimetre matrix into a 4x4 CAD metre matrix."""
    return [
        [float(m[0][0]), float(m[0][1]), float(m[0][2]), float(m[0][3]) / 1000.0],
        [float(m[1][0]), float(m[1][1]), float(m[1][2]), float(m[1][3]) / 1000.0],
        [float(m[2][0]), float(m[2][1]), float(m[2][2]), float(m[2][3]) / 1000.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def build_reference_poses(motion, parts, sample_angles=(0, 137, 360, 720)):
    """Compute reference 4x4 CAD-metre matrices at sample crank angles for all moving parts."""
    reference = {}
    body_cache = {}
    for part in parts:
        pid = part['id']
        body = motion.body(pid)
        if body.startswith('fixed:'):
            continue
        if body not in body_cache:
            body_cache[body] = {
                str(angle): cad_metre_matrix(motion.matrix(pid, float(angle)))
                for angle in sample_angles
            }
        reference[pid] = body_cache[body]
    return reference
