"""Web contract for the animated Langley / Manly-Balzer study: parts, the system -> component -> part tree, the saved motions and the gear meshes.

The viewer's animated-study adapter reads this beside the GLB (parts with a description, evidence and system, the motions it can play, and a scope note that is
shown with every motion). Descriptions and the component level of the tree come from the research inventory
(cad-studies/langley-manly-balzer-1903/inventory.json), so what a student reads for a part is what the research recorded for the component it belongs to: its
function, interfaces, the modelling decision and the source locator. Standard library only.
"""
import json, math, re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
STUDY = REPO / 'cad-studies/langley-manly-balzer-1903'

# Seven systems, each answering one question a student asks about the engine, then the assemblies that make a system up, then the parts. The first rule that
# matches a part's id decides its system and assembly, so every part sits in exactly one of each. Functional systems and physical assemblies are not the same
# thing (a cylinder holds parts of five systems), so the tree follows function; the cylinder number is in each part's label.
SYSTEMS = [
    ('structure', 'Engine Structure', 'What holds the engine together?'),
    ('power', 'Power Mechanism', 'How does combustion turn the shaft?'),
    ('gas', 'Gas Exchange & Valve Train', 'How does mixture get in and exhaust get out?'),
    ('ignition', 'Ignition', 'How is combustion started?'),
    ('cooling', 'Cooling', 'How is heat removed?'),
    ('lubrication', 'Lubrication (gravity-fed)', 'How are the moving parts protected?'),
    ('output', 'Power Output & Transmission', 'How does engine power reach the propellers?'),
]
# (assembly id, system id, assembly title, pattern over part ids)
ASSEMBLIES = [
    ('drums', 'structure', 'Crank-chamber drums and bed plates', r'^(PortDrum|StbdDrum|PortBedPlate|StbdBedPlate|StbdDrumBolts\d)$'),
    ('bearings', 'structure', 'Main bearings', r'^(PortMainBushing|StbdMainBushing|PortDrumBushingFlange)$'),
    ('barrels', 'structure', 'Cylinder barrels, heads and liners', r'^(CylShell|Chamber|CylLiner)\d$'),
    ('flanges', 'structure', 'Cylinder flanges and bolts', r'^(CylFlange\d|CylBolt\d_\d)$'),
    ('crankshaft', 'power', 'Crankshaft and crank pin', r'^Crankshaft$'),
    ('pistons', 'power', 'Piston assemblies (piston, rings, gudgeon pin, retainers)', r'^(Piston\d|PistonRing\d_\d|GudgeonPin\d|PinRetainer\d_[ab])$'),
    ('master', 'power', 'Master rod and sleeve', r'^(MasterRod|MasterSleeveCap|ConeNut(Port|Stbd)|JamNut(Port|Stbd))$'),
    ('links', 'power', 'Link rods', r'^LinkRod\d$'),
    ('slippers', 'power', 'Bearings and slipper shoes', r'^(MasterLining(Upper|Lower)|LinkShoe\d|WristBush\d)$'),
    ('manifold', 'gas', 'Induction: inlet gas manifold', r'^(InletRing[ABC]|InletFlange[ABC]\d|CarbConnection|AirValvePipe|AirValveSleeve)$'),
    ('inlet', 'gas', 'Induction: automatic inlet valves', r'^(InletValve|InletSeat|InletSeatNut|InletSpring|InletSpringCap)\d$'),
    ('exhaust', 'gas', 'Exhaust: valves and outlets', r'^(ExhaustValve|ExhaustSeat|ExhaustGuide|ExhaustSpring|ExhaustSpringCollar|ExhaustSpringNut|ExhaustOutlet)\d$'),
    ('cam', 'gas', 'Exhaust: ring cam and gear train', r'^(CamRing|CamPinion|CamGearLarge|CamGearSmall|CamIdler|CamStud)$'),
    ('punch', 'gas', 'Exhaust: punch rods', r'^(PunchRod|PunchRoller|PunchGuide)\d$'),
    ('plugs', 'ignition', 'Spark plugs', r'^Plug(Shell|Insulator|Electrode)\d$'),
    ('ignition-drive', 'ignition', 'Ignition drive sleeve and gears', r'^(SparkSleeve|SparkSleeveRing|SparkPinion|SparkGearLarge)$'),
    ('sparker', 'ignition', 'Primary sparker and timing handle', r'^(SparkerCam|SparkerPawl|SparkerSpring|SparkerBracket|SparkerContact|SparkTimingClamp|SparkTimingLever)$'),
    ('distributor', 'ignition', 'Distributor and wires', r'^(DistributorDisc|DistributorBrush|CommutatorBody|CommutatorSegment\d|SparkWire\d)$'),
    ('jackets', 'cooling', 'Water jackets and stubs', r'^(Jacket|JacketRing|WaterInletStub|WaterOutletStub)\d$'),
    ('water-in', 'cooling', 'Water inlet manifold', r'^(WaterInletRing|WaterInletRiser)$'),
    ('water-out', 'cooling', 'Water outlet manifold', r'^(WaterOutletRing|WaterOutletConnection(Front|Rear))$'),
    ('pump', 'cooling', 'Pump drive', r'^(PumpBevelGear|PumpBevelPinion|PumpShaftUpper|PumpShaftBearing)$'),
    ('cups', 'lubrication', 'Oil cups and tubes', r'^(OilCup|OilCupTube)\d$|^(PortOilCup|PortOilCupTube)$'),
    ('feed', 'lubrication', 'Crankshaft oil feed', r'^(CrankPlug|CrankOilPipe)$'),
    ('flywheels', 'output', 'Flywheels', r'^Flywheel(Rim|Hub|Spoke)(Port|Stbd)\d*$'),
    ('balance', 'output', 'Balance arms and braces', r'^Balance(Arm|Brace|BracePlate|BraceCollar)(Port|Stbd)$'),
    ('couplings', 'output', 'Couplings and shaft stubs', r'^(CouplingFlange|TransShaftStub)(Port|Stbd)$'),
    ('starting', 'output', 'Starting mechanism', r'^(WormWheel|StartWorm|StartShaft|StartBracketUpper|StartBracketLower|StartPawlPlug)$'),
]
_ASSEMBLY_RULES = [(aid, sid, re.compile(pattern)) for aid, sid, _, pattern in ASSEMBLIES]


def assembly_of(part_id):
    """(system id, assembly id) of a part, or raises: every part must be placed."""
    for aid, sid, pattern in _ASSEMBLY_RULES:
        if pattern.match(part_id):
            return sid, aid
    raise ValueError('Part is in no assembly: ' + part_id)


SCOPE = ('Source-led teaching reconstruction of the large 5 x 5.5 in water-cooled radial engine of Langley\'s Aerodrome A (built 1901), drawn from Manly\'s 1911 Memoir '
         '(Plates 78-81) and the 1971 Annals of Flight 6; it is not the museum object, not a manufacturing drawing and not a running model. It covers the engine proper, the '
         'two flywheels and short stubs of the transmission shafts. Dimensions the plates do not give are estimates (the rod length, the cylinder flange height, wall thicknesses '
         'found from Manly\'s weight table). The operating motion is illustrative: the crank, the five pistons on one crank pin with a master rod and four slipper-shoe link rods, '
         'the 1:4 reversed ring cam, the 1-3-5-2-4 firing order and the 2.5x and 0.5x ignition gears follow the sources, while the exhaust and inlet timing, the cam lobe '
         'shape and valve lifts and the spark advance are teaching choices. The starting worm, the pump drive and the pipes do not move.')
REFERENCE = ('Manly, Langley Memoir on Mechanical Flight Part II (1911), Plates 78-81 (M1); Meyer (ed.), Langley\'s Aero Engine of 1903, Smithsonian Annals of Flight 6 (A1); '
             'see cad-studies/langley-manly-balzer-1903/research.md.')
VIEWPOINT = ('Axes: the crankshaft runs along x with the starboard (ignition) side at +x and the port (cam) side at -x, z is up and cylinder 1 points up at the assembled pose. '
             'The crank turns from +y toward +z (clockwise seen from the port side).')


def operating_stages():
    return [
        dict(label='Piston 1 at the top of its exhaust stroke', progress=0, note='Piston 1 is at top dead centre at the end of its exhaust stroke and its exhaust valve is just closing; cylinder 3 is part way through its exhaust stroke with its valve open. At any instant the five cylinders are in different strokes: that is what the firing order 1-3-5-2-4 means. Valve and ignition timing are teaching choices.'),
        dict(label='Half a crank turn', progress=25, note='The crank has turned 180 degrees and the ring cam 45 degrees the other way: one quarter of crank speed, reversed by three gear meshes. Each link-rod shoe has slid a little on the master rod\'s sleeve.'),
        dict(label='One crank turn', progress=50, note='The ring cam has turned a quarter turn backwards. The primary sparker cam, driven at 2.5 times crank speed, has turned two and a half times and the distributor brush half a turn the other way.'),
        dict(label='Three half-turns', progress=75, note='A cylinder fires every 144 degrees of crank rotation in the order 1-3-5-2-4. The inlet valves open by suction in the middle of each intake stroke; the exhaust valves are pushed open by the punch rods.'),
        dict(label='Two crank turns: one four-stroke cycle', progress=100, note='Every cylinder has fired once. The ring cam has turned half a turn backwards and its two lobes have shared the five exhaust-valve lifts between them. Valve and ignition timing here are teaching choices, not source data.'),
    ]


def gear_meshes():
    """The five spur meshes (involute form and backlash from scripts/gear_geometry.py): three in the cam train, two in the ignition train."""
    from cad_pipeline.langley_motion import ctx
    c = ctx()
    cam, ign = c.cam_train, c.ign_train
    d = lambda p, q: math.dist(p, q)
    origin = (0.0, 0.0)
    rows = [('CamPinion', 'CamGearLarge', (cam['teeth']['P'], cam['teeth']['A']), d(origin, cam['centres']['A']), cam['module']),
            ('CamGearSmall', 'CamIdler', (cam['teeth']['B'], cam['teeth']['I']), d(cam['centres']['A'], cam['centres']['I']), cam['module']),
            ('CamIdler', 'CamRing', (cam['teeth']['I'], cam['teeth']['C']), d(cam['centres']['I'], origin), cam['module']),
            ('SparkPinion', 'SparkGearLarge', (ign['teeth']['P'], ign['teeth']['L']), d(origin, ign['centres']['L']), ign['module']),
            ('SparkGearLarge', 'SparkerCam', (ign['teeth']['L'], ign['teeth']['S']), d(ign['centres']['L'], ign['centres']['S']), ign['module'])]
    return [dict(driver=a, driven=b, teeth=list(t), ratio=round(t[0] / t[1], 6), centre_distance_mm=round(cd, 4), module_mm=m, backlash_mm=round(0.05 * m, 4)) for a, b, t, cd, m in rows]


def build(geometry, asset_sha256, inventory=None, motions=None):
    """The contract dict for a geometry.json (parts in the CAD frame) and the exported asset's decoded hash."""
    inventory = inventory or json.loads((STUDY / 'inventory.json').read_text(encoding='utf-8'))
    by_part = {}
    for component in inventory['components']:
        for part_id in component.get('part_ids', []):
            by_part.setdefault(part_id, []).append(component)
    parts, used = [], set()
    for p in geometry['parts']:
        system, assembly = assembly_of(p['id'])
        used.add(assembly)
        components = by_part.get(p['id'], [])
        if components:
            c = components[0]
            description = f"{c['name']}. {c['function']}. Interfaces: {c['interfaces']}. {c['decision'].rstrip('.')}. Source: {c['locator']}."
            disposition = c.get('disposition', 'simplified')
        else:
            description, disposition = p['label'] + '.', 'simplified'
        parts.append(dict(id=p['id'], label=p['label'], group=system, groups=[f'assembly:{assembly}'], component=components[0]['id'] if components else None,
                          description=description, evidence=p['evidence'], material=p['material'], disposition=disposition,
                          shape_status='Reconstructed from the 1911 Memoir drawings; dimensions the plates omit are estimated; instructor review pending'))
    tree = []
    for system, title, question in SYSTEMS:
        tree.append(dict(id=system, label=title, depth=0, question=question))
        for aid, sid, atitle, _ in ASSEMBLIES:
            if sid == system and aid in used:
                tree.append(dict(id=f'assembly:{aid}', label=atitle, depth=1))
    return dict(asset_sha256=asset_sha256, parts=parts, groups=tree, reference=REFERENCE, scope=SCOPE, motions=motions or [], viewpoint=VIEWPOINT,
                remoteDisplays=[], gearMeshes=gear_meshes())


def main():
    """Rebuild the tree and part list of a released contract from part-spec.json, keeping its asset hash and motions: python -m cad_pipeline.langley_contract web/langley-manly-balzer-1903-contract.json"""
    import sys
    path = Path(sys.argv[1])
    old = json.loads(path.read_text(encoding='utf-8'))
    geometry = json.loads((STUDY / 'part-spec.json').read_text(encoding='utf-8'))
    new = build(geometry, old['asset_sha256'], motions=old['motions'])
    path.write_text(json.dumps(new, indent=2) + '\n', encoding='utf-8')
    print(f"{len(new['parts'])} parts, {sum(1 for g in new['groups'] if g['depth'] == 0)} systems, {sum(1 for g in new['groups'] if g['depth'] == 1)} assemblies -> {path}")


if __name__ == '__main__':
    main()
