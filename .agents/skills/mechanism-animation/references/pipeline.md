# Mechanism animation pipeline (Wright revision 2 as the worked example)

## Files and what each is for

| File | Role |
|---|---|
| `cad_pipeline/wright_bodies.py` | rigid bodies (`body(part_id)`) and fixed axes (`AXES`) |
| `cad_pipeline/wright_motion.py` | the motion: `matrix(part_id, theta)`, `pivot(part_id)`, cam profile, rocker, trip lever, igniter, chain links |
| `cad_pipeline/wright_explode.py` | systems exploded view: stages, group and part offsets |
| `cad_pipeline/wright_contract.py` | viewer contract: parts with inventory descriptions, system to component tree, scope text, gear meshes |
| `cad_pipeline/rig_wright.py` | Blender rig: bakes both clips, writes .blend, GLB, GLB.gz, contract |
| `cad_pipeline/geometry_to_glb.py --motion` | development baker (trimesh) so the audit can run without Blender |
| `cad_pipeline/audit_motion.py` | audit at chosen crank angles from CAD tessellation (exact poses; for the loop) |
| `scripts/audit_assembly_interference.py` | release audit of the exported GLB, clip sampled between keys |
| `scripts/scan_assembly_pairs.py` | one pair through a clip, every pair at chosen poses, transit scan |
| `scripts/test_wright_reconstruction.mjs` | loads the released GLB and checks the physics |
| `cad_pipeline/package_animated.py` | private archive of the native sources, refuses mismatched files |

## Run order

1. Fast loop: spec, then `fast_build.py`, then `geometry_to_glb.py --motion`, then `audit_assembly_interference.py` (`--rest-only` first, then the clip), then `scan_assembly_pairs.py` for any named pair.
2. Release: `generate.py --batch-runs 6`, then `verify.py` (the reviewed STEP exception only with fresh evidence), `audit_wright_v2.py`, `rig_wright.py`, the audit of the exported GLB (commit `interference-audit.json`), `test_wright_reconstruction.mjs`, the preview image, the Drive release, `package_animated.py`.

## Interpolation: the rule that cost six overlaps

glTF interpolates translation, rotation and scale linearly between keys. For a rotation about a point `c` the node translation is `c - R c`, which a straight line between keys cannot follow: the error is about `|c| * step^2 / 8` (step in radians). An axis 230 mm from the node origin at 4.75 degrees per key: 0.2 mm. Fix by moving the node origin onto the axis so the translation is constant (the rig sets `object.location` to the pivot and keys `pose @ translation(pivot)`; the dev baker does the same). A node that is animated must carry translation, rotation and scale, never a `matrix` (the audit reads TRS). For followers whose angle jumps between keys (a cam-and-lever snap), keep a clearance gap larger than the worst between-key error: measure it by comparing linear interpolation with the exact pose at quarter-frame steps.

## Blender 5 notes

- Actions are slotted: `action.slots.new(id_type='OBJECT', name=obj.name)`, `layer.strips.new(type='KEYFRAME')`, `strip.channelbag(slot, ensure=True)`.
- Fast curve creation: `channelbag.fcurves.new(path, index=k)`, `curve.keyframe_points.add(n)`, `foreach_set('co', ...)`; per-key Python loops are too slow for hundreds of parts times 721 frames. Cache the track per rigid body.
- The glTF exporter writes only actions referenced by NLA tracks: put each clip on a muted NLA track named for the clip, with `nla.action_slot = slot`.
- Keep the quaternion on one hemisphere between keys. Decompose after multiplying by the pivot translation. Convert mm to metres once (only the translation scales).
- `scripts/normalize_glb_motion_time.py` makes the exported time axis start at 0 and run in seconds.

## Contract and viewer

The animated-study adapter reads parts (id, label, group, groups, description, evidence), `groups` (system, then component, with depth), `motions` (id, label, loop, stages), `scope` (shown with every motion), `viewpoint` and `gearMeshes`. Stage `progress` is where the stage label becomes active: start with 0 ("Assembled") and end with 100. The tree and descriptions come from the research inventory, so what a student reads is what the research recorded. `headerLabel` in `src/data/models.json` replaces the default header subtitle for a model that is not the teaching engine.

## Physics-compliance checklist for a new mechanism

| Check | Example here |
|---|---|
| Conversion exact (slider-crank, cam-follower) | piston travel against `r(1-cos a)+L-sqrt(L^2-r^2 sin^2 a)` to 1e-5 |
| Ratios from sources or tooth counts, directions | chain 6:12, spur 18:18 reversed, wheel 190:40 reversed |
| Follower stays on its driver with margin | trip lever underside at least 0.6 mm over the cam through the whole cycle (stdlib test) |
| Event windows lie in the right stroke | exhaust lift peaks inside the exhaust stroke; inlet inside the intake stroke |
| Closed loops close | 38 whole links, closure within tolerance |
| Fixed axes do not drift between keys | origins on axes; test the node position is constant |
| No part crosses another | rest, clip between keys, held stages; transit exceptions named |
| Not modelled, said so | inertia, gas load, spring dynamics, friction, wear |
