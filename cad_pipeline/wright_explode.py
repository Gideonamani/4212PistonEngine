"""Systems exploded view of the Wright revision-2 engine: where each system goes, and in which of three stages.

The view separates the engine system by system, not part by part, so a student sees the crank assembly, the valve gear, the timing
drive and the ignition as units. It is pedagogical: the order and directions are not an assembly or disassembly procedure, and
the casting stays put as the reference. Offsets are millimetres in the CAD frame (x along the cylinders toward the valves, y along
the crankshaft with the flywheel at +y, z up). Standard library only.
"""
import re

STAGES = [
    dict(label='Covers, induction and pipework', progress=34, note='The steel cover, hot plate, intake manifold, fuel line and water fittings lift off the casting; the oil pump and feed drop away.'),
    dict(label='Valve gear and ignition', progress=67, note='The valve boxes with their valves, the rockers and the make-and-break ignition levers separate from the cylinders.'),
    dict(label='Crank, timing and accessories', progress=100, note='Liners, the piston-and-rod assembly, the crank assembly, camshafts, timing drive, flywheel and generator move apart. Direction and order are pedagogical.'),
]

# group -> (stage, offset); a part rule below overrides its group.
GROUPS = {
    'cover': (1, (0, 0, 300)),
    'induction': (1, (0, 0, 200)),
    'cooling': (1, (0, 0, 150)),
    'lubrication': (1, (0, -170, -110)),
    'crankcase': (1, (0, 0, -150)),            # mounting bolts; the casting itself is the reference and does not move
    'valve_boxes': (2, (150, 0, 0)),
    'valves': (2, (150, 0, 0)),
    'rockers': (2, (90, 0, -230)),
    'ignition': (2, (170, 0, 180)),
    'cylinders': (3, (470, 0, 0)),
    'pistons': (3, (0, 0, -400)),
    'rods': (3, (0, 0, -400)),
    'crankshaft': (3, (0, 0, 270)),
    'bearings': (3, (0, 0, 270)),
    'camshafts': (3, (0, 0, -210)),
    'timing': (3, (0, -300, 0)),
    'flywheel': (3, (-130, 310, 0)),
    'generator': (3, (150, 330, -60)),
}
# (pattern, stage, offset), first match wins
PART_RULES = [
    (r'^Crankcase$', 3, (0, 0, 0)),
    (r'^(WaterInlet|WaterHoseIn)$', 1, (0, 0, -150)),
    (r'^(OilReturnGallery|OilDistributor|OilJet\d)$', 1, (0, 0, 200)),
    (r'^Intake(Head|Stem|Cage|Retainer|Spring|SpringWasher)\d$', 2, (150, 0, 130)),
    (r'^Exhaust(Head|Stem|Cage|Retainer|Spring|SpringWasher)\d$', 2, (150, 0, -130)),
    (r'^(ExhaustGear|IgnitionGear|IgnitionDrivePin|IgnitionGearSpring|AdvanceCam|AdvanceLever|AdvanceBracket)$', 3, (0, -200, 0)),
    (r'^EndPlate$', 3, (0, -110, 0)),
    (r'^(CamBearing|IgnitionBearing)\d$', 3, (0, 0, -210)),
]
_RULES = [(re.compile(p), stage, vector) for p, stage, vector in PART_RULES]


def placement(part_id, group):
    """(stage, (dx, dy, dz)) of a part in the exploded view."""
    for pattern, stage, vector in _RULES:
        if pattern.match(part_id):
            return stage, vector
    return GROUPS.get(group, (3, (0, 0, 0)))


def amount(stage, v):
    """0..1 progress of a stage at overall progress v in [0, 1]: each stage moves during its own third."""
    return max(0.0, min(1.0, v * 3 - (stage - 1)))


def offset(part_id, group, v):
    stage, vector = placement(part_id, group)
    a = amount(stage, v)
    return tuple(c * a for c in vector)
