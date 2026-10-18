"""GTSIO-520 overhaul manual figure keys (X-30045A), parsed from pdftotext + patched from page images."""
import json
from lib import INPUTS

_PARSED = json.load(open(INPUTS / 'gtsio_keys.json', encoding='utf-8'))
KEYS = {f: {int(k): v for k, v in d.items()} for f, d in _PARSED.items()}

PATCH = {
    'A-4-20': {32: 'Bearing, Prop Shaft', 33: 'Washer, Prop Shaft Thrust', 35: 'Gear, Idler Accessory Drive', 37: 'Gear, Idler', 17: 'Screw'},
    'A-4-16': {31: 'Bushing', 32: 'Washer, Plain', 38: 'Gasket, Tach Drive Pad', 39: 'Cover, Tach Drive Pad', 41: 'Washer, Lock', 52: 'Washer, Flat', 42: 'Nut', 13: 'Screw, Adjusting'},
    'A-4-15': {32: 'Bearing, Ball', 33: 'Spacer', 37: 'Pin', 2: 'Washer, Plain'},
    'A-4-17': {35: 'Ring, Compression', 39: 'Body, Valve Lifter', 18: 'Packing, Push Rod Housing', 22: 'O-Ring, Cylinder Base'},
    'A-4-11': {23: 'Sleeve'},
}
A418 = ("Rod, Oil Gauge|O-Ring|Screw|Tube, Oil Gauge Rod|O-Ring|Ring, Oil Gauge Lock|Oil Cap and Retainer Assembly|Gasket, Oil Filler Cap|"
        "Neck Assembly, Oil Filler|Gasket, Oil Filler Neck|Nut, Hex|Washer, Lock|Washer, Plain|Cover|Gasket|Clamp, Breather Hose|Hose|Hose|"
        "Tee, Breather|Nut, Hex|Washer, Lock|Washer, Plain|Housing, Needle Bearing|Bearing, Needle|Gasket, Needle Bearing Housing|Nut, Hex|"
        "Washer, Lock|Pin, Idler Gear Support|Gasket, Idler Gear Support|Bolt, Hex Head|Washer, Plain|O-Ring|Bolt, Hex Head|Washer, Plain|"
        "Bolt, Hex Head|Washer, Lock|Washer, Plain|Bolt, Hex Head|Washer, Plain|Bolt, Hex Head|Washer, Lock|Washer, Plain|Nut, Hex|"
        "Washer, Lock|Washer, Plain|Washer|Cover, Governor Pad|Gasket, Governor Pad|Nut, Hex|Washer, Lock|Washer, Plain|Bolt, Hex Head|"
        "Nut, Hex|Washer, Lock|Washer, Plain|Bolt, Hex Head|Washer, Plain|Nut|Washer, Lock|Washer, Plain|Bolt, Hex Head|Bolt, Hex Head|"
        "Washer, Plain|Eye, Lifting, Front|Nut, Hex|Washer, Plain|O-Ring|Bolt, Hex Head|Washer, Plain|O-Ring|Nut, Flanged|Spacer|Nut, Hex|"
        "Washer, Plain|Nut, Hex|Washer, Lock|Washer, Plain|Screw, Hex Head|Eye, Lifting|Spacer|Nut, Hex|Washer, Lock|Washer, Plain|Bolt, Hex|"
        "Washer, Plain|Nut, Hex|Washer, Lock|Washer, Plain|Screw, Hex Head|Valve, Manifold and Bracket|Nut, Hex|Washer, Lock|Washer, Plain|"
        "Bolt, Hex Head|Eye, Lifting, Rear|Spacer|Bolt, Hex Head|Stud|Eye, Lifting, Right Side|Eye, Lifting, Left Side|Nut, Flanged|Washer, Plain|"
        "Nut, Flanged|Washer, Plain|Nut, Hex|Washer, Lock|Washer, Plain|Bracket, Engine Mount|Insert, Thread|Nut, Hex|Washer, Lock|Washer, Plain|"
        "Nut, Flanged|Washer, Plain|Bracket, Engine Mount|Insert, Thread|Plug, Timing Hole|Valve, Timing Hole Plug|Pin, Timing Indicator|"
        "Bolt, Crankcase Thru|Bolt, Crankcase Thru|Bolt, Crankcase Thru|Bolt, Crankcase Thru|Bolt, Crankcase Thru|Bolt, Crankcase Thru|"
        "Crankcase, Left|Crankcase, Right|Nut, Hex|Washer, Lock|Washer, Plain|Bracket, Engine Mount|Insert, Thread|Nut, Hex|Washer, Lock|"
        "Washer, Plain|Bracket, Engine Mount|Insert, Thread|Tube, Breather|Screw, Drive|Plate, Identification|Bearing, Needle|Nozzle, Squirt|O-Ring").split('|')
assert len(A418) == 143, len(A418)
KEYS['A-4-18'] = {i + 1: v for i, v in enumerate(A418)}
for f, d in PATCH.items():
    KEYS.setdefault(f, {}).update(d)

PDF_PAGE = {'A-4-8': 25, 'A-4-10': 27, 'A-4-11': 28, 'A-4-12': 29, 'A-4-13': 30, 'A-4-14': 31, 'A-4-15': 32, 'A-4-16': 33,
            'A-4-17': 34, 'A-4-18': 36, 'A-4-19': 37, 'A-4-20': 38}


def key(fig, n):
    return KEYS[fig][n]
