"""Systems exploded view of the Langley / Manly-Balzer radial: where each system goes, and in which of three stages.

The view separates the engine system by system, not part by part, so a student sees the pipework, the valve gear, the ignition, the cylinders, the running gear
and the flywheels as units. It is pedagogical: the order and directions are not an assembly or disassembly procedure, and the crankshaft stays put as the
reference. Offsets are millimetres in the CAD frame (X along the crankshaft toward starboard, Z up). A vector marked 'c' is written in the part's own
cylinder frame (Z along the cylinder axis, outward from the shaft) and turned to that cylinder's direction; one marked 'g' is in the CAD frame.
Standard library only.
"""
import math
import re

STAGES = [
    dict(label='Assembled', progress=0, note='The engine as modelled: every part in its assembled position.'),
    dict(label='Pipework, plugs and oil cups', progress=34, note='The three-piece inlet gas ring and the two water rings lift away along the shaft; the spark plugs, the piston oil cups and the water stubs leave the cylinders.'),
    dict(label='Valve gear, ignition and drives', progress=67, note='The inlet and exhaust valves with their springs, the five punch rods, the ring cam and its gear train, the ignition gears, sparker and distributor, the starting worm and the pump drive separate.'),
    dict(label='Cylinders, running gear and flywheels', progress=100, note='The five cylinders move out along their own axes and the pistons part from the rods; the two drums and bed plates, the balance arms with the shaft stubs and the two flywheels move out along the shaft. The crankshaft with the master rod and its sleeve stays as the reference.'),
]

# (pattern, stage, frame, vector): first match wins. Parts matching no rule stay put (the crankshaft, the rods and their bushings).
RULES = [
    # --- stage 1: pipework, plugs, oil cups, water stubs
    (r'^(InletRing[ABC]|InletFlange[ABC]\d|CarbConnection|AirValvePipe|AirValveSleeve)$', 1, 'g', (-420, 0, 0)),
    (r'^(WaterOutletRing|WaterOutletConnection(Front|Rear))$', 1, 'g', (-300, 0, 0)),
    (r'^(WaterInletRing|WaterInletRiser)$', 1, 'g', (300, 0, 0)),
    (r'^Plug(Shell|Insulator|Electrode)\d$', 1, 'c', (0, 0, 260)),
    (r'^OilCup(Tube)?\d$', 1, 'c', (0, 0, 420)),
    (r'^WaterInletStub\d$', 1, 'g', (170, 0, 0)),
    (r'^WaterOutletStub\d$', 1, 'g', (-170, 0, 0)),
    (r'^(PortOilCup|PortOilCupTube)$', 1, 'g', (0, 0, -260)),
    # --- stage 2: valve gear, ignition, drives
    (r'^(ExhaustValve|ExhaustSpringCollar|ExhaustSpringNut)\d$', 2, 'c', (0, 0, -150)),
    (r'^ExhaustSpring\d$', 2, 'c', (0, 0, -80)),
    (r'^(InletValve|InletSpringCap)\d$', 2, 'c', (0, 0, 190)),
    (r'^InletSpring\d$', 2, 'c', (0, 0, 110)),
    (r'^InletSeatNut\d$', 2, 'c', (0, 0, 60)),
    (r'^(PunchRod|PunchRoller)\d$', 2, 'c', (0, 0, -250)),
    (r'^CamRing$', 2, 'g', (-120, 0, 0)),
    (r'^(CamGearLarge|CamGearSmall|CamIdler|CamStud)$', 2, 'g', (-250, 0, 0)),
    (r'^CamPinion$', 2, 'g', (-140, 0, 0)),
    (r'^(WormWheel|PumpBevelGear)$', 2, 'g', (-330, 0, 0)),
    (r'^(StartWorm|StartShaft|StartBracketUpper|StartBracketLower|StartPawlPlug)$', 2, 'g', (-330, 0, -120)),
    (r'^(PumpBevelPinion|PumpShaftUpper|PumpShaftBearing)$', 2, 'g', (-330, 0, -260)),
    (r'^(SparkSleeve|SparkSleeveRing|SparkPinion)$', 2, 'g', (170, 0, 0)),
    (r'^(SparkGearLarge|DistributorDisc|DistributorBrush)$', 2, 'g', (260, 0, 0)),
    (r'^(SparkerCam|SparkerPawl|SparkerSpring|SparkerContact|SparkerBracket|SparkTimingClamp|SparkTimingLever)$', 2, 'g', (330, 0, 0)),
    (r'^(CommutatorBody|CommutatorSegment\d|SparkWire\d)$', 2, 'g', (380, 0, 0)),
    # --- stage 3: cylinders, pistons, drums, bed plates, couplings, flywheels
    (r'^(CylShell|CylLiner|CylFlange|CylBolt|Jacket|JacketRing|Chamber|ExhaustOutlet|InletSeat|ExhaustSeat|ExhaustGuide)\d', 3, 'c', (0, 0, 330)),
    (r'^(Piston|PistonRing)\d', 3, 'c', (0, 0, 150)),
    (r'^(GudgeonPin|PinRetainer)\d', 3, 'c', (0, 0, 75)),
    (r'^(PortDrum|PortDrumBushingFlange|PortMainBushing|PunchGuide\d)$', 3, 'g', (-200, 0, 0)),
    (r'^(StbdDrum|StbdMainBushing)$', 3, 'g', (200, 0, 0)),
    (r'^PortBedPlate$', 3, 'g', (-270, 0, 0)),
    (r'^(StbdBedPlate|StbdDrumBolts\d)$', 3, 'g', (270, 0, 0)),
    (r'^(CouplingFlangePort|TransShaftStubPort|BalanceArmPort|BalanceBrace(Plate|Collar)?Port)$', 3, 'g', (-360, 0, 0)),
    (r'^(CouplingFlangeStbd|TransShaftStubStbd|BalanceArmStbd|BalanceBrace(Plate|Collar)?Stbd)$', 3, 'g', (360, 0, 0)),
    (r'^Flywheel(Rim|Hub|Spoke)Port', 3, 'g', (-520, 0, 0)),
    (r'^Flywheel(Rim|Hub|Spoke)Stbd', 3, 'g', (520, 0, 0)),
]
_RULES = [(re.compile(p), stage, frame, vector) for p, stage, frame, vector in RULES]
_NUMBER = re.compile(r'(\d)')
ALPHA = 72.0 * math.pi / 180.0                         # angle between neighbouring cylinders


def placement(part_id):
    """(stage, frame, (dx, dy, dz)) of a part in the exploded view, or None when it stays put."""
    for pattern, stage, frame, vector in _RULES:
        if pattern.match(part_id):
            return stage, frame, vector
    return None


def amount(stage, v):
    """0..1 progress of a stage at overall progress v in [0, 1]: each stage moves during its own third."""
    return max(0.0, min(1.0, v * 3 - (stage - 1)))


def offset(part_id, group, v):
    """CAD-frame offset (mm) of a part at overall progress v in [0, 1]. `group` is accepted for the shared rig interface and not used."""
    rule = placement(part_id)
    if rule is None:
        return (0.0, 0.0, 0.0)
    stage, frame, (dx, dy, dz) = rule
    a = amount(stage, v)
    if frame == 'c':
        k = int(_NUMBER.findall(part_id)[0]) - 1
        s, c = math.sin(ALPHA * k), math.cos(ALPHA * k)
        dy, dz = dy * c - dz * s, dy * s + dz * c
    return (dx * a, dy * a, dz * a)
