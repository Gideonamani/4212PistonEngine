"""Rigid bodies of the Wright revision-2 assembly: which parts move together in the illustrative operating motion.

Two parts of the same body never move relative to each other, so one may be seated in the other. A part that belongs to no
moving body is 'static'. The animation, the seats and the interference policy all read this one classification.
Standard library only.
"""
import re

# (body name template, pattern over part ids); the first match wins. {n} is the cylinder number captured by the pattern.
BODY_RULES = [
    ('crank', r'^(Crankshaft|Flywheel|FlywheelKey|PropellerDrive[AB]|CrankSprocket)$'),
    ('rod{n}', r'^(RodTube|BigEnd|BigCap|BigShim|BigLock|LittleEnd|LittleClamp)(\d)$'),
    ('rod{n}', r'^(BigBolt[AB]|RodPin[AB])(\d)$'),
    ('piston{n}', r'^(Piston|WristPin|PinLock)(\d)$'),
    ('piston{n}', r'^(Ring|RingPeg)(\d)_\d$'),
    ('intake{n}', r'^Intake(Head|Stem|SpringWasher)(\d)$'),
    ('exhaust{n}', r'^Exhaust(Head|Stem|SpringWasher)(\d)$'),
    ('rocker{n}', r'^(Rocker(?:Left|Right)|CamRoller|ValveRoller|CamRollerAxle|ValveRollerAxle)(\d)$'),
    ('cam', r'^(Camshaft|CamWasher[AB]|ExhaustCam\d|CamSprocket|ExhaustGear)$'),
    ('ignition', r'^(IgnitionShaft|IgnitionCam\d|IgnitionGear|IgnitionDrivePin)$'),
    ('trip{n}', r'^(TripLever)(\d)$'),
    ('igniter{n}', r'^(IgniterLever|MovingContact)(\d)$'),
    ('chain{n}', r'^Chain(?:Plate|Roller)(\d+)(?:_[AB])?$'),
    ('generator', r'^Magneto(Armature|Shaft|DriveWheel)$'),
]
_COMPILED = [(template, re.compile(pattern)) for template, pattern in BODY_RULES]


def body(part_id):
    """Name of the rigid body a part belongs to, or 'static'."""
    for template, pattern in _COMPILED:
        match = pattern.match(part_id)
        if match:
            return template.format(n=match.groups()[-1]) if '{n}' in template else template
    return 'static'
