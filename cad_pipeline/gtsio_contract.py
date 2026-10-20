"""GTSIO-520-H R10: the configuration of the shared contract builder (`study_contract.py`) and the entry point that builds the R10 contract.

R10 ships as a static GLB; the viewer computes its explode, collapse and core-cycle motion from the contract's `procedural` block. Before the shared builder
the contract came from `gtsio_review_motion.build_review_contract` plus three edits made to the written file by hand (the `display` block of PR #78 and the
audit record of PR #82 in `pending`). Both edits now live here, so rebuilding the contract does not drop them.

Two things to keep in step with the shipped file:

* `DISPLAY` is the per-model orientation the adapter reads (`rotation_x_deg`, `fit_direction`); it is R10-only, and the other five animated studies carry none.
* `AUDIT_RECORDS` holds the exported-file audit lines written into `pending`. A line is bound to the asset it describes: it is written only when the contract
  being built has that asset hash, so a rebuilt or optimised file never carries an audit record that does not apply to it. When a new asset is audited, add its
  line here (scripts/test_interference_audit.mjs requires exactly one line naming the published hash).
"""
import gzip, hashlib, json
from pathlib import Path

from cad_pipeline.gtsio_review_motion import CYCLE, COLLAPSE, EXPLODE, SCOPE, STAGES
from cad_pipeline import gtsio_valvetrain_pose as vp
from cad_pipeline.study_contract import FlatGroups, StudyConfig, build as build_contract

GHOST_IDS = ['CrankcaseLeft', 'CrankcaseRight', *[f'CylinderBarrel{n}' for n in range(1, 7)], *[f'CylinderHead{n}' for n in range(1, 7)]]
DISPLAY = dict(rotation_x_deg=90, fit_direction=[1.3, 0.8, 1.55])
REFERENCE = 'Frozen R10 inventory / X-30045A; inferred geometry and cam law retained'
SHAPE_STATUS = 'Reconstruction; direct-only R10 candidate, not OEM accepted'
STUDY_ID = 'gtsio520-r10-private-review'
PARAMETERS = ('case_cam_y', 'head_seat', 'valve_offset', 'intake_angle', 'exhaust_angle', 'intake_valve_length', 'exhaust_valve_length')
EXCLUSIONS = ['Damper oscillation; the damper system turns with the crank in the Assembled view and is hidden in the cycle core view',
              'Accessory, reduction and propeller drive: the Assembled view turns the gears, shafts and the screws, keys and couplings fitted to them at their declared ratios, '
              'without bearings, torque, backlash or oil; these systems are hidden in the cycle core view',
              'Hydraulic internal action; lifter internals follow their body',
              'Gas, combustion, pressure and oil flow']
REVIEW_VISIBILITY = dict(cycle='Core view ghosts crankcase halves, cylinder barrels and heads so internal crank, rod, piston and valvetrain motion is legible; '
                               'Assembled view shows all 1396 parts.')
AUDIT_RECORDS = [
    dict(asset_sha256='80991fa8b0d5d4312aa5aabe549dd8a094afb9bad41d18cdc6b7921c4fe1ab9e',
         line=('Exported-file interference audit of the shipped static file 80991fa8b0d5 (sha256 80991fa8b0d5d4312aa5aabe549dd8a094afb9bad41d18cdc6b7921c4fe1ab9e, '
               '51,199,204 bytes, 1,396 parts), 19 Oct 2026, cad-studies/gtsio520-h-static/shipped-r10: the assembled pose is clean (5,168 neighbouring pairs, none '
               'overlapping). The core cycle posed by the viewer\'s own sampler every 5 crank degrees (144 poses) is NOT clean: 159 overlapping pairs, 42 between parts '
               'the default core view shows (pistons against the big-end hardware of the opposite-bank rod, crankshaft against pistons) and 117 only in the Assembled '
               'view (crank and cam turning through parts the contract holds fixed). The exploded layouts are not decided by this audit; the fully exploded layout '
               'holds 14 overlapping pairs. Recorded in a known-defect ledger. This is a record of what the audit found, not an acceptance, and not a clip/transit '
               'clearance check.')),
    dict(asset_sha256='1dcf07ccd0f2951780dd5ae76ad8f1b5e2707616309067f1645f15f892d51abc',
         line=(
               'Exported-file interference audit of the shipped optimised file 1dcf07ccd0f2 (sha256 '
               '1dcf07ccd0f2951780dd5ae76ad8f1b5e2707616309067f1645f15f892d51abc, 21,115,472 bytes, 1,396 parts; audited in its unpacked form), 19 Oct 2026,'
               ' cad-studies/gtsio520-h-static/shipped-r10: the assembled pose is clean (5,168 neighbouring pairs, none overlapping). The core cycle posed '
               "by the viewer's own sampler every 5 crank degrees (144 poses) is NOT clean: 159 overlapping pairs, 42 between parts the default core view "
               'shows (pistons against the big-end hardware of the opposite-bank rod, crankshaft against pistons) and 117 only in the Assembled view (crank '
               'and cam turning through parts the contract holds fixed); the same 159 pairs were found in the unoptimised file 80991fa8b0d5. The exploded '
               'layouts are not decided by this audit; the fully exploded layout holds 14 overlapping pairs. Recorded in a known-defect ledger. This is a '
               'record of what the audit found, not an acceptance, and not a clip/transit clearance check.')),
    dict(asset_sha256='7416aa5a90c02f9eabdcadcebbd0777f33a1b275972c1edd08070592556be676',
         line=(
               'Exported-file interference audit of the shipped optimised file 7416aa5a90c0 (sha256 '
               '7416aa5a90c02f9eabdcadcebbd0777f33a1b275972c1edd08070592556be676, 21,112,200 bytes, 1,396 parts; audited in its unpacked form), 20 Oct 2026,'
               ' cad-studies/gtsio520-h-static/shipped-r10: the assembled pose is clean (5,160 neighbouring pairs, none overlapping). The core cycle posed '
               "by the viewer's own sampler every 5 crank degrees (144 poses) has 2 overlapping pairs, none between parts the default core view shows: "
               'AccessoryIdlerGear against LeftMagnetoGear and RightMagnetoGear (1.5 mm3 each, 0.35 mm thick), visible only in the Assembled view, where the tooth tips of '
               'the declared gears overlap axially by 1 mm. The file of 19 Oct (1dcf07ccd0f2) had 159 (42 in the core view); the piston skirt relief and the fitted-body '
               'motion cleared the rest. The exploded layouts are not decided by this audit; the fully exploded layout holds 14 overlapping pairs. The 2 pairs are in a '
               'known-defect ledger. This is a record of what the audit found, not an acceptance, and not a clip/transit clearance check.')),
]

# Modelling decisions that change the shape of the model without a source for the real part. A note is written only for the asset that contains the decision.
MODELLING_DECISIONS = [
    dict(asset_sha256='7416aa5a90c02f9eabdcadcebbd0777f33a1b275972c1edd08070592556be676',
         line=('Piston skirt relief, an illustrative modelling decision with no source for the real piston (20 Oct 2026): each of the six pistons has a stepped relief cut into the skirt '
               'on the flank that faces the neighbouring crank bay (22 x 27 x 103 mm for the big-end hardware plus a 9.4 x 51 x 116 mm step for the counterweights; 16.1 cm3, 4.5 % of '
               "the piston, removed). The two opposed pistons of a bay reach bottom dead centre together and the reconstruction's bay pitch is 56 mm, so the neighbour rod's big end, "
               'the crank pin and the counterweights would otherwise pass through the skirt. The real piston skirt, crank pin width and bay pitch are not in the project sources; the '
               'sizes are the swept overlaps plus about 1.5 mm, leaving 3.0 mm of web to the lowest ring groove and the pin boss. One parameterised cut in cad_pipeline/gtsio_core.py '
               '(piston_relief_*); docs/r10-cycle-overlap-root-causes.md.')),
]


def _systems(context):
    return [(group, group.replace('_', ' ').title(), None) for group in context['handoff']['groups']]


def _part_extras(part, context):
    motion = context['motion']
    stage, offset_mm = motion.explosion(part['id'])
    return dict(body=motion.body(part['id']), cycle_visible=motion.cycle_visible(part['id']), explosion=dict(stage=stage, offset_mm=list(offset_mm)))


def _motions(parts, context):
    """The three motions, each procedural: the viewer computes the pose, so no keyframes are baked."""
    motion, ghost_set = context['motion'], set(GHOST_IDS)
    core_visible = [p['id'] for p in parts if motion.cycle_visible(p['id']) or p['id'] in ghost_set]
    return [
        dict(id=EXPLODE, label='Exploded layout', loop=False, duration=12.0, procedural=dict(type='explode'), stages=STAGES),
        dict(id=COLLAPSE, label='Collapse layout', loop=False, duration=12.0, procedural=dict(type='collapse'),
             stages=[dict(progress=100 - s['progress'], label=s['label']) for s in reversed(STAGES)]),
        dict(id=CYCLE, label='Core cycle (illustrative)', loop=True, duration=12.0, degrees=720, procedural=dict(type='gtsio-core-cycle', degrees=720),
             display=dict(defaultViewMode='core', allowAssembled=True, visiblePartIds=core_visible, ghostPartIds=GHOST_IDS),
             stages=[dict(progress=i * 25, label=label) for i, label in enumerate(
                 ['Cylinder 1: power', 'Cylinder 1: exhaust', 'Cylinder 1: intake', 'Cylinder 1: compression', '720 degrees / repeat'])]),
    ]


def _extra_fields(parts, asset_sha256, context):
    motion, handoff, params = context['motion'], context['handoff'], context['spec']['parameters']
    moving = sum(1 for p in parts if not p['body'].startswith('fixed:'))
    exploding = sum(1 for p in parts if any(abs(c) > 1e-9 for c in p['explosion']['offset_mm']))
    animated_nodes = context.get('animated_nodes') or {EXPLODE: exploding, COLLAPSE: exploding, CYCLE: moving}
    pending = (list(handoff['pending_before_animation_acceptance']) + [r['line'] for r in MODELLING_DECISIONS if r['asset_sha256'] == asset_sha256]
               + [r['line'] for r in AUDIT_RECORDS if r['asset_sha256'] == asset_sha256])
    return dict(
        schema='4212.animated-study/v1', id=STUDY_ID, asset_file=context['asset_file'],
        complete_engine_acceptance=False, release_allowed=False, display=DISPLAY,
        geometry=handoff['selected_geometry'], spec=handoff['selected_spec'],
        procedural=dict(version=1, stageEnds=[0.0, 0.18, 0.36, 0.58, 0.80, 1.0],
                        parameters={**{name: float(params[name]['value']) for name in PARAMETERS}, 'cam_rate': float(vp.gtsio_cam_rate())}),
        review_visibility=REVIEW_VISIBILITY, exclusions=EXCLUSIONS, animated_nodes=animated_nodes,
        blender_version=context['blender_version'], bytes=context['asset_bytes'], gzip_bytes=context['gzip_bytes'], pending=pending)


CONFIG = StudyConfig(
    scope=SCOPE, reference=REFERENCE, grouping=FlatGroups(), systems=_systems, description='label', shape_status=SHAPE_STATUS,
    part_fields=('id', 'label', 'group', 'groups', 'description', 'evidence', 'shape_status'), part_extras=_part_extras, motions=_motions, extra_fields=_extra_fields,
    remote_displays=False,
    key_order=('schema', 'id', 'scope', 'asset_file', 'asset_sha256', 'complete_engine_acceptance', 'release_allowed', 'display', 'geometry', 'spec', 'reference',
               'procedural', 'parts', 'groups', 'motions', 'review_visibility', 'exclusions', 'animated_nodes', 'blender_version', 'bytes', 'gzip_bytes', 'pending'))


def build_review_contract(*, motion, handoff, spec, parts, asset_file, asset_sha256, asset_bytes, gzip_bytes, blender_version, animated_nodes=None):
    """The 4212.animated-study/v1 contract for the R10 draft: procedural Three.js motion, display metadata and the audit record bound to this asset."""
    context = dict(motion=motion, handoff=handoff, spec=spec, asset_file=asset_file, asset_bytes=asset_bytes, gzip_bytes=gzip_bytes,
                   blender_version=blender_version, animated_nodes=animated_nodes)
    return build_contract(CONFIG, parts, asset_sha256, context=context)


# --- the procedural path: no Blender work, only the contract and the reference poses beside the static GLB ---------------------------------------------------

REPO = Path(__file__).resolve().parents[1]
DEFAULT_BUILD = REPO / 'build/gtsio520-animation-review'
STATIC_GLB = 'gtsio520-r10-static.glb'


def write_procedural_review(build_dir=DEFAULT_BUILD, blender_version=None, output_dir=None, spec=None, asset=None, asset_name=STATIC_GLB, gzip_path=None):
    """Write review-contract.json and reference-poses.json for the static R10 GLB in `build_dir` (the presentation stage's folder).

    Reads review-manifest.json and the static GLB there and the frozen handoff in the repository. `spec` is the frozen part-spec (read from the handoff's path when
    not given). `asset` is the unpacked GLB when it is not `build_dir/gtsio520-r10-static.glb` (the optimised file, say), `asset_name` the name the contract gives it
    and `gzip_path` its packed form. Returns (part count, GLB bytes, gzip bytes)."""
    from cad_pipeline.animated_studies import Gtsio
    build_dir = Path(build_dir)
    output_dir = Path(output_dir) if output_dir else build_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((build_dir / 'review-manifest.json').read_text())
    study = Gtsio(manifest['parts'], spec=spec)
    raw = Path(asset or build_dir / asset_name).read_bytes()
    gz = Path(gzip_path) if gzip_path else build_dir / (asset_name + '.gz')
    packed = gz.read_bytes() if gz.exists() else gzip.compress(raw, mtime=0)
    contract = study.contract(hashlib.sha256(raw).hexdigest(), asset_file=asset_name, asset_bytes=len(raw), gzip_bytes=len(packed),
                              blender_version=manifest.get('blender_version', blender_version))
    (output_dir / 'review-contract.json').write_text(json.dumps(contract, indent=2) + '\n')
    study.write_extras(output_dir)
    return len(manifest['parts']), len(raw), len(packed)


def spec_from_contract(path):
    """A stand-in for the frozen part-spec that holds only the seven parameters the motion reads, taken from a built contract's `procedural` block.

    The part-spec is a build output (build/gtsio520-case-contours-r10/part-spec.json, 8.4 MB) that is not committed. Rebuilding a contract from a stand-in
    reproduces everything except the proof that those seven numbers are the spec's: check them against reference-poses.json (see `check_reference`)."""
    shipped = json.loads(Path(path).read_text(encoding='utf-8'))
    return {'parameters': {name: {'value': shipped['procedural']['parameters'][name]} for name in PARAMETERS}}


def check_reference(build_dir, spec):
    """Largest absolute difference between the reference poses on disk and the ones the motion gives for `spec`: the independent check of a stand-in spec."""
    from cad_pipeline.animated_studies import Gtsio
    from cad_pipeline.gtsio_review_motion import build_reference_poses
    build_dir = Path(build_dir)
    manifest = json.loads((build_dir / 'review-manifest.json').read_text())
    expected = json.loads((build_dir / 'reference-poses.json').read_text())
    got = json.loads(json.dumps(build_reference_poses(Gtsio(manifest['parts'], spec=spec).review, manifest['parts'])))
    if expected.keys() != got.keys():
        return None
    return max(abs(x - y) for pid, angles in expected.items() for angle, m in angles.items() for r1, r2 in zip(m, got[pid][angle]) for x, y in zip(r1, r2))


def main():
    """Build the R10 contract with the shared builder into a folder of your choice and compare it with a contract on file:

        python -m cad_pipeline.gtsio_contract --build-dir <presentation folder> --output-dir <scratch> --compare web/gtsio520-r10-contract.json --parameters-from web/gtsio520-r10-contract.json
    """
    import argparse
    from cad_pipeline.study_contract import diff
    parser = argparse.ArgumentParser(description=main.__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--build-dir', type=Path, default=DEFAULT_BUILD, help='folder with review-manifest.json and the static GLB')
    parser.add_argument('--output-dir', type=Path, required=True, help='where to write review-contract.json and reference-poses.json (never the shipped web/ folder)')
    parser.add_argument('--asset', type=Path, help='the unpacked GLB, when it is not the static file in --build-dir (the optimised file)')
    parser.add_argument('--asset-name', default=STATIC_GLB, help='the file name the contract gives the GLB (default: the static file)')
    parser.add_argument('--gzip', type=Path, help='the packed GLB (default: --asset-name plus .gz beside the manifest, else packed here)')
    parser.add_argument('--parameters-from', type=Path, help='a built contract to take the seven procedural parameters from, when the frozen part-spec is not on this machine')
    parser.add_argument('--compare', type=Path, help='a contract to compare the result with, field by field')
    args = parser.parse_args()
    spec = spec_from_contract(args.parameters_from) if args.parameters_from else None
    if spec:
        error = check_reference(args.build_dir, spec)
        print('stand-in spec: seven parameters from', args.parameters_from, '| largest reference-pose difference:', 'poses differ in kind' if error is None else f'{error:.3g}')
    counts = write_procedural_review(args.build_dir, output_dir=args.output_dir, spec=spec, asset=args.asset, asset_name=args.asset_name, gzip_path=args.gzip)
    print('parts, GLB bytes, gzip bytes:', *counts, '->', args.output_dir / 'review-contract.json')
    if args.compare:
        rows = diff(json.loads(args.compare.read_text(encoding='utf-8')), json.loads((args.output_dir / 'review-contract.json').read_text()))
        print(f'{len(rows)} field difference(s) from {args.compare}')
        for path, kind, a, b in rows:
            print(' ', path, kind, a, '|', b)


if __name__ == '__main__':
    main()
