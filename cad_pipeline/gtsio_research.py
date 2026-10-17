"""Account for the two core exploded figures before generating the scoped CAD."""
import argparse
import hashlib
import json
from pathlib import Path
from cad_pipeline.research_gate import review

STUDY = Path('cad-studies/gtsio520-h-realism')
CRANK = ['Cotter pin', 'Slotted rod nut', 'Rod bolt', 'Rod cap', 'Connecting rod', 'Rod bearing', 'Piston pin bushing', 'Damper retaining ring', 'Damper retaining plate', 'Damper pin', 'Damper bushing', 'Counterweight', 'Crank gear screw', 'Deleted', 'Crankshaft gear', 'Quill retaining ring', 'Quill plate screw', 'Quill plate', 'Propeller drive gear', 'Quill shaft', 'Alternator gear screw', 'Tab lock plate', 'Alternator drive gear', 'Shaft oil seal', 'Seal reinforcing ring', 'Seal spring', 'Propeller shaft', 'Oil transfer sleeve', 'Oil transfer tube', 'Sleeve assembly', 'O-ring', 'Prop shaft bearing', 'Prop shaft thrust washer', 'Idler screw', 'Accessory idler gear', 'Idler bushing', 'Idler gear', 'Prop drive bearing', 'Main bearing', 'Crank gear dowel', 'Crankshaft forging', 'Bushing']
CYLINDER = ['Cover screw', 'Lock washer', 'Plain washer', 'Rocker cover', 'Cover gasket', 'Screw', 'Tab washer', 'Rocker shaft', 'Drive screw', 'Rocker bushing', 'Valve rocker', 'Rocker shaft retainer', 'Pushrod', 'Pushrod housing', 'Housing spring', 'Housing washer', 'O-ring', 'Housing packing', 'Flanged nut', 'Flanged nut', 'Cylinder assembly', 'Cylinder base O-ring', 'Valve keeper', 'Exhaust rotocoil', 'Intake spring retainer', 'Outer valve spring', 'Inner valve spring', 'Inner spring retainer', 'Exhaust valve', 'Intake valve', 'Piston pin', 'Piston', 'Compression ring 1', 'Compression ring 2', 'Legacy third compression ring', 'Oil ring', 'Scraper ring', 'Retaining ring', 'Valve lifter body', 'Baffle spring', 'Head baffle', 'Plug thread insert', 'Plug', 'Rocker shaft insert', 'Stud', 'Exhaust gasket', 'Exhaust nut', 'Valve guide', 'Exhaust seat', 'Intake seat', 'Washer']


def instances(*names):
    return [f'{name}{n}' for n in range(1, 7) for name in names]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--hashes', type=Path, default=Path('build/gtsio520-research/source-hashes.json'))
    args = parser.parse_args()
    sources = json.loads(args.hashes.read_text())
    sources['manual'] = dict(sources['original'], title='Continental GTSIO-520 Series Overhaul Manual',
                             publication='X-30045A', revision='March 1981; relevant H pages June 1980',
                             organization='Teledyne Continental Motors', accessed='2026-10-07', variant='GTSIO-520-H')
    selected_crank = {2: instances('RodNutA', 'RodNutB'), 3: instances('RodBoltA', 'RodBoltB'),
                      4: instances('RodCap'), 5: instances('ConnectingRod'),
                      6: instances('RodBearingUpper', 'RodBearingLower'),
                      7: instances('SmallEndBush'), 41: ['Crankshaft']}
    selected_cyl = {31: instances('PistonPin', 'PinPlugA', 'PinPlugB'), 32: instances('Piston'),
                    33: instances('CompressionRingA'), 34: instances('CompressionRingB'),
                    36: instances('OilRing'), 37: instances('ScraperRing')}
    components = []
    for figure, page, names, selected in [('A-4-20', 38, CRANK, selected_crank), ('A-4-17', 34, CYLINDER, selected_cyl)]:
        for index, name in enumerate(names, 1):
            parts = selected.get(index, [])
            outside = (figure == 'A-4-20' and index == 14) or (figure == 'A-4-17' and index == 35)
            components.append(dict(id=f'{figure}:{index}', name=name, locator=f'X-30045A Figure {figure}, printed A-4-{18 if page==38 else 14}, PDF{page}, callout {index}',
                source_ids=['manual'], function=f'{name}: retained source identity in the engine assembly.',
                interfaces=['See research.md construction and assembly paths; Figure '+figure],
                disposition='simplified' if parts else 'outside_scope' if outside else 'deferred', part_ids=parts,
                decision='Built with source-backed critical dimensions and declared contour estimates; inspect part evidence.' if parts else
                         'Deleted or superseded by the consistently selected four-ring layout.' if outside else
                         'Deferred to its engine module; not represented or counted in the static core.'))
    mechanisms = [
        dict(id='load', path='piston > floating pin and plugs > bronze bushing > I-section rod > split lined bearings > crankpin > crankshaft',
             components=['A-4-17:31', 'A-4-17:32', 'A-4-20:4', 'A-4-20:5', 'A-4-20:6', 'A-4-20:7', 'A-4-20:41'], source_ids=['manual'],
             checks=['saved pin fits', 'rod center distance', 'bearing seat closure', 'all pair intersections']),
        dict(id='seal', path='alternating ring gaps > separate grooves > cylinder bore interface (barrel deferred)',
             components=['A-4-17:32', 'A-4-17:33', 'A-4-17:34', 'A-4-17:36', 'A-4-17:37'], source_ids=['manual'],
             checks=['A-11-3 alternating gaps', 'groove side/root clearance', 'fitted bore target']),
        dict(id='phase', path='H firing order > separate opposed pins in three bays > six slider-crank positions',
             components=['A-4-20:41', 'A-4-20:5', 'A-4-17:32'], source_ids=['manual'],
             checks=['120 degree events', 'opposite throws in each bay', '101.6 mm travel', 'constant 168.275 mm rod centers'])]
    inventory = dict(target='GTSIO-520-H static rotating core, realism revision 1', sources={'manual': sources['manual']},
        decision='Ready only for the static forging/piston/rod candidate described in research.md; whole engine and operating animation remain incomplete.',
        reviewed_locators=['A-3-1/2 PDF16-17', 'A-4-17 PDF34', 'A-4-20 PDF38', 'A-11-2/3/4 PDF74-76', 'A-12-1/2/3/4 PDF77-80', 'B-2 PDF97', 'Table 6 B-12 PDF103', 'H C-3-2/3 PDF152-153'],
        conflicts=[dict(topic='Four versus five rings', decision='Use four and account for legacy callout 35 outside selected scope.'),
                   dict(topic='Old ring gap angles', decision='Use alternating opposite gaps per A-11-3.'),
                   dict(topic='Axial datum and forging contours', decision='Declare estimated packaging; do not inherit V5 positions as measurements.')],
        components=components, expected_callouts=[c['id'] for c in components], mechanisms=mechanisms,
        gaps=[dict(topic='Unmeasured axial stations and contours', blocks_selected_scope=False,
                   modelling_consequence='Illustrative static layout only; no manufacturing fidelity or case fit claim.', next_evidence='Applicable crankshaft drawing and scaled workshop measurements.'),
              dict(topic='Dampers, cotters, main bearings and engine systems', blocks_selected_scope=False,
                   modelling_consequence='Deferred identities stay in coverage; operating/full-engine readiness remains false.', next_evidence='Counterweight plate/part dimensions, locking hardware and subsystem figure review.')])
    STUDY.mkdir(parents=True, exist_ok=True)
    (STUDY/'source-manifest.json').write_text(json.dumps(sources, indent=2)+'\n')
    (STUDY/'inventory.json').write_text(json.dumps(inventory, indent=2)+'\n')
    result = review(inventory)
    result.update(whole_engine_ready=False, operating_motion_ready=False, reviewed='2026-10-07',
                  inventory_sha256=hashlib.sha256((STUDY/'inventory.json').read_bytes()).hexdigest())
    (STUDY/'research-readiness.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
