"""Mass of the built Langley model against Manly's weight table (M1 p. 250): the strongest check of shape that does not depend on a drawing.

    python scripts/langley_mass_check.py build/dev/out358/geometry.json [--json out.json]

Each part is assigned to a weight-table line by its ID; parts that the table does not list (bed plates, starter, pump drive, shaft stubs, flange bolts) are reported
separately. Densities are those of the part's material category. A line within +/-15 percent is "close"; the engine total is compared with 56,323 g.
"""
import argparse, json, re, sys
from pathlib import Path

DENSITY = {'steel': 7.85, 'cast iron': 7.2, 'bronze': 8.8, 'brass': 8.5, 'aluminium': 2.70, 'porcelain': 2.4, 'rubber': 1.2}
LINES = [  # weight-table id, grams, id patterns
    ('W01', 5225, r'^(Crankshaft|CrankPlug|CrankOilPipe)$'),
    ('W02', 5070, r'^(MasterRod|MasterSleeveCap|MasterLining\w+|LinkRod\d|LinkShoe\d|WristBush\d|ConeNut\w+|JamNut\w+)$'),
    ('W03', 8260, r'^(Piston\d|PistonRing\d_\d|GudgeonPin\d|PinRetainer\d_\w)$'),
    ('W04', 23524, r'^(CylShell|CylLiner|CylFlange|JacketRing|Jacket|Chamber|ExhaustOutlet|InletSeatNut|InletSeat|InletValve|InletSpringCap|InletSpring|ExhaustSeat|ExhaustValve|ExhaustGuide|ExhaustSpringCollar|ExhaustSpringNut|ExhaustSpring|OilCupTube|OilCup|WaterInletStub|WaterOutletStub)\d$'),
    ('W05', 5225, r'^(PortDrum|PortMainBushing|PortDrumBushingFlange|CamRing|CamPinion|CamGearLarge|CamGearSmall|CamIdler|CamStud|PunchRod\d|PunchRoller\d|PunchGuide\d|PortOilCup|PortOilCupTube)$'),
    ('W06', 3440, r'^(StbdDrum|StbdMainBushing)$'),
    ('W07', 450, r'^(PlugShell|PlugInsulator|PlugElectrode)\d$'),
    ('W08', 450, r'^(WaterOutletRing|WaterOutletConnection\w+)$'),
    ('W09', 360, r'^(WaterInletRing|WaterInletRiser)$'),
    ('W10', 1700, r'^(InletRing\w|InletFlange\w+|CarbConnection|AirValvePipe|AirValveSleeve)$'),
    ('W11', 512, r'^(SparkSleeve|SparkSleeveRing|SparkPinion|SparkGearLarge|SparkerCam|SparkerPawl|SparkerSpring|SparkerBracket|SparkerContact|DistributorDisc|DistributorBrush|CommutatorBody|CommutatorSegment\d|SparkWire\d|SparkTiming\w+)$'),
    ('W12+W13', 2107, r'^(BalanceArm|BalanceBrace\w*)(Port|Stbd)$'),
    ('W14', 3946, r'^Flywheel(Rim|Hub|Spoke)Stbd\d*$'),
    ('W15', 3234, r'^Flywheel(Rim|Hub|Spoke)Port\d*$')]
ENGINE_LINES = {'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12+W13'}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('geometry', type=Path)
    p.add_argument('--json', type=Path)
    a = p.parse_args()
    parts = json.loads(a.geometry.read_text())['parts']
    grams, assigned, other = {k: 0.0 for k, _, _ in LINES}, {}, {}
    for part in parts:
        mass = part['volume_mm3'] / 1000.0 * DENSITY.get(part['material'], 7.85)      # mm3 -> cm3 -> g
        for key, _, pattern in LINES:
            if re.match(pattern, part['id']):
                grams[key] += mass
                assigned[part['id']] = key
                break
        else:
            other[part['id']] = round(mass, 1)
    report = []
    print(f"{'line':8s} {'model g':>10s} {'table g':>10s} {'ratio':>7s}")
    for key, target, _ in LINES:
        ratio = grams[key] / target
        report.append(dict(line=key, model_g=round(grams[key], 1), table_g=target, ratio=round(ratio, 3)))
        print(f'{key:8s} {grams[key]:10.0f} {target:10d} {ratio:7.2f}' + ('' if 0.85 <= ratio <= 1.15 else '   <-- outside +/-15 %'))
    engine = sum(grams[k] for k in ENGINE_LINES)
    print(f"{'engine':8s} {engine:10.0f} {56323:10d} {engine / 56323:7.2f}   (table total; lines W01-W13)")
    print('not in the table (g):', sum(other.values()).__round__(0), ' largest:', sorted(other.items(), key=lambda kv: -kv[1])[:8])
    if a.json:
        a.json.write_text(json.dumps(dict(lines=report, engine_g=round(engine, 1), unassigned_g=other), indent=1) + '\n')


if __name__ == '__main__':
    main()
