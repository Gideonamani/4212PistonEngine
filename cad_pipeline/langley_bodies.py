"""Rigid bodies of the Langley radial: which parts move together in the illustrative operating motion.

Two parts of one body never move relative to each other, so one may be seated in the other. A part that belongs to no moving body is 'static'. Bodies named
here are kinds, resolved to transforms in langley_motion; the per-cylinder bodies carry the cylinder number.
Standard library only.
"""
import re

# (body name template, pattern over part ids); the first match wins. {n} is the number captured by the named group `n`.
BODY_RULES = [
    ('crank', r'^(Crankshaft|CrankPlug|CrankOilPipe|CouplingFlange(Port|Stbd)|BalanceArm(Port|Stbd)|BalanceBrace(Port|Stbd)|BalanceBracePlate(Port|Stbd)|BalanceBraceCollar(Port|Stbd)'
              r'|TransShaftStub(Port|Stbd)|FlywheelRim(Port|Stbd)|FlywheelHub(Port|Stbd)|FlywheelSpoke(Port|Stbd)\d+|CamPinion|WormWheel|PumpBevelGear|SparkSleeve|SparkSleeveRing|SparkPinion)$'),
    ('rod1', r'^(MasterRod|MasterSleeveCap|MasterLining(Upper|Lower)|ConeNut(Port|Stbd)|JamNut(Port|Stbd)|WristBush1)$'),
    ('rod{n}', r'^(LinkRod|LinkShoe|WristBush)(?P<n>[2-5])$'),
    ('piston{n}', r'^(Piston|GudgeonPin)(?P<n>\d)$'),
    ('piston{n}', r'^(PistonRing|PinRetainer)(?P<n>\d)_\w$'),
    ('exhaust{n}', r'^(ExhaustValve|ExhaustSpringCollar|ExhaustSpringNut)(?P<n>\d)$'),
    ('exhaustspring{n}', r'^ExhaustSpring(?P<n>\d)$'),
    ('inlet{n}', r'^(InletValve|InletSpringCap)(?P<n>\d)$'),
    ('inletspring{n}', r'^InletSpring(?P<n>\d)$'),
    ('punch{n}', r'^(PunchRod|PunchRoller)(?P<n>\d)$'),
    ('cam', r'^CamRing$'),
    ('camA', r'^(CamGearLarge|CamGearSmall)$'),
    ('camI', r'^CamIdler$'),
    ('distributor', r'^(SparkGearLarge|DistributorDisc|DistributorBrush)$'),
    ('sparkercam', r'^SparkerCam$'),
    ('pawl', r'^SparkerPawl$'),
    ('pawlspring', r'^SparkerSpring$'),
]
_COMPILED = [(template, re.compile(pattern)) for template, pattern in BODY_RULES]


def body(part_id):
    """Name of the rigid body a part belongs to, or 'static'."""
    for template, pattern in _COMPILED:
        match = pattern.match(part_id)
        if match:
            return template.format(n=match.group('n')) if '{n}' in template else template
    return 'static'
