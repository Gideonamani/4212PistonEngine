"""Web contract for the animated Wright revision-2 study: parts, the system -> component -> part tree, the saved motions.

The viewer's animated-study adapter reads this beside the GLB (parts with a description, evidence and group, the motions it
can play, and a scope note that is shown with every motion). Descriptions and the component level of the tree come from the
research inventory (cad-studies/wright-1903/revision-2/inventory.json), so what a student reads for a part is what the research
recorded for the component it belongs to: its function, interfaces, the modelling decision and the source locator.
Standard library only.

This file is the Wright *configuration* of the shared builder in `study_contract.py`: the system titles, the scope text and the stage names.
"""
import math
from pathlib import Path

from cad_pipeline.study_contract import ComponentTree, StudyConfig, build as build_contract, rebuild_released
from cad_pipeline.wright_bodies import AXES

REPO = Path(__file__).resolve().parents[1]
STUDY = REPO / 'cad-studies/wright-1903/revision-2'

SYSTEM_TITLES = {
    'crankcase': 'Crankcase & water jacket', 'cover': 'Sheet-steel crankcase cover', 'bearings': 'Split bearings & shaft supports',
    'crankshaft': 'Four-throw crankshaft', 'cylinders': 'Short cylinder liners & head joints', 'pistons': 'Cast-iron pistons, rings & pins',
    'rods': 'Built-up connecting rods', 'valve_boxes': 'Combustion chambers / valve boxes', 'valves': 'Intake & exhaust valves',
    'camshafts': 'Exhaust & ignition camshafts', 'rockers': 'Two-cheek exhaust rockers & rollers', 'ignition': 'Make-and-break ignition & spark control',
    'timing': 'Timing sprockets, chain & tensioner', 'flywheel': 'Flywheel & propeller drive sprockets', 'induction': 'Intake & fuel mixing',
    'cooling': 'Water connections', 'lubrication': 'Oil system (rebuilt accessory)', 'generator': 'Generator & flywheel friction drive',
}
SCOPE = ('Source-led teaching reconstruction of the surviving rebuilt Wright horizontal engine, modelled from the Hobbs account and the Science Museum '
         'construction lineage; it is not the 1903 original and manufacturing dimensions are estimates. The operating motion is illustrative: the crank, '
         'rods and pistons, the 2:1 chain drive to the exhaust cam, the 1:1 gear pair to the ignition shaft and the generator friction drive follow '
         'the sources, while the firing order, valve and ignition timing, cam lobe shape and inlet-valve lift are teaching choices. The oil-pump '
         'drive is deferred and does not move.')
REFERENCE = 'Hobbs, The Wright Brothers\' Engines and Their Design (H1); Science Museum construction lineage; see cad-studies/wright-1903/revision-2/research.md.'
VIEWPOINT = 'Axes: cylinders lie along x toward the valves, the crankshaft along y with the flywheel at the rear, z up. Crank rotation is clockwise seen from +y with x to the right.'


def operating_stages():
    return [
        dict(label='Top dead centre, cylinders 1 and 4', progress=0, note='Pistons 1 and 4 at the head end, 2 and 3 at the crank end. Valves seated; the chain, gears and cams are at their assembled phase.'),
        dict(label='Half a crank turn', progress=25, note='The crank has turned 180 degrees and the exhaust cam 90. Cylinder 1 begins its exhaust stroke: its rocker lifts the exhaust valve from the cam.'),
        dict(label='One crank turn', progress=50, note='The exhaust camshaft has turned half a turn: the 6-tooth crank sprocket drives the 12-tooth cam sprocket through the chain at 2:1.'),
        dict(label='Three half-turns', progress=75, note='The inlet valves open by suction on their intake strokes and the ignition contacts snap open in firing order 1-3-4-2 (illustrative).'),
        dict(label='Two crank turns: one four-stroke cycle', progress=100, note='Every cylinder has fired once. Valve and ignition timing here are teaching choices, not source data.'),
    ]


def gear_mesh():
    """The exhaust-to-ignition spur pair: equal 18-tooth gears tangent at their pitch circles (scripts/gear_geometry.py form, backlash 0.05 module)."""
    centre = math.dist(AXES['cam'], AXES['ignition'])
    module = centre / 18
    return dict(driver='ExhaustGear', driven='IgnitionGear', teeth=[18, 18], ratio=1.0, centre_distance_mm=round(centre, 4),
                module_mm=round(module, 4), backlash_mm=round(0.05 * module, 4))


CONFIG = StudyConfig(
    scope=SCOPE, reference=REFERENCE, viewpoint=VIEWPOINT, grouping=ComponentTree(), systems=[(system, title, None) for system, title in SYSTEM_TITLES.items()], study=STUDY,
    gear_meshes=lambda: [gear_mesh()], part_fields=('id', 'label', 'group', 'groups', 'description', 'evidence', 'material', 'disposition', 'shape_status'),
    shape_status='Reconstructed from the reviewed source account; dimensions estimated; instructor review pending',
    key_order=('asset_sha256', 'parts', 'groups', 'reference', 'scope', 'motions', 'viewpoint', 'remoteDisplays', 'gearMeshes'))


def build(geometry, asset_sha256, inventory=None, motions=None):
    """The contract dict for a geometry.json (parts in the CAD frame) and the exported asset's decoded hash."""
    return build_contract(CONFIG, geometry['parts'], asset_sha256, inventory=inventory, motions=motions)
