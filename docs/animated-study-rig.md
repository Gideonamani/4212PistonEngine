# Animated studies: one rig, one contract builder

Wright, Langley and GTSIO-520-H R10 are animated studies: a GLB the viewer plays, and a contract beside it (the parts with their descriptions and evidence, the system tree, the motions, the scope
note shown with every motion, the gear meshes). Before this change each engine had its own Blender rig and its own contract builder that repeated one skeleton, so a fix to the look, the clip
export or the contract had to be made three times and the copies drifted. Now there is one rig, one builder, one look, and a small description per engine.

## The parts

| Module | What it does | Needs |
|---|---|---|
| `cad_pipeline/look.py` | The standard look: one set of materials, one smoothing rule. No engine keeps a colour table. | Blender for `blender_material` and `apply_smooth_by_angle`; the rest is plain Python. |
| `cad_pipeline/animated_studies.py` | What differs between engines: where a part's object origin sits, the clips (title, frame count, pose of a part at a frame, which parts share one set of tracks), output names, frame rate, the few export differences. One `Study` subclass per engine (`Langley`, `Wright`, `Gtsio`). | Standard library. |
| `cad_pipeline/rig_animated_study.py` | The one Blender script: creates the objects from the CAD package, bakes the clips, exports the GLB with its clips, packs `.glb.gz`, writes the contract and the verification record. | Blender. |
| `cad_pipeline/study_contract.py` | The one contract builder: `build(config, parts, asset_sha256, ...)` with a `StudyConfig` per engine, and `diff()` for a field-by-field comparison. | Standard library. |
| `cad_pipeline/langley_contract.py`, `wright_contract.py`, `gtsio_contract.py` | The per-engine `StudyConfig`: systems, grouping, the clip stage names, scope text, gear meshes. R10's also holds its procedural block, its orientation and its audit records. | Standard library. |
| `cad_pipeline/rig_langley.py`, `rig_wright.py`, `rig_gtsio_review.py` | Thin entry points that call the shared rig with their study, so existing commands and notes still work. | Blender. |

Run a study:

```
blender --background --python-exit-code 1 --python cad_pipeline/rig_animated_study.py -- --study langley --package <cad package> --output <folder>
```

`--study` is `langley`, `wright` or `gtsio`. `--development` accepts the fast evaluator's output, `--limit` bakes the first parts only, `--smooth-angle` overrides the look's angle, and `--bake-gltf`
(R10 only) bakes 721-frame glTF clips instead of leaving the motion to the viewer's procedural block.

## Adding an engine

1. Subclass `Study` in `animated_studies.py`: the frame of each part, the clips, the output names. Register it in `STUDIES`.
2. Write the contract config next to the engine's other modules: the systems (id, title, optional question), a grouping (`AssemblyRules`, `ComponentTree` or `FlatGroups`), the clip stage names
   in the motion descriptors, the scope text, the gear meshes if any.
3. Add a rebuild test to `scripts/test_study_contract.py`: build the contract from the committed spec and compare it with the file in `web/`.

The rig is not edited. If a change to the rig is needed for one engine only, it is a hook on the `Study` (`annotate`, `finish`, `write_extras`), not an `if` in the rig.

## Tessellation tiers

A spec's `tessellation` block says how finely each part is meshed. It used to be one number for the whole study (R10: 0.1 mm). It can now name tiers by part class, so a piston ring land is
not meshed like a cover plate:

| Key | Meaning |
|---|---|
| `tiers` | Named linear deflections in millimetres. |
| `groups` | Part group to tier name. |
| `default_mm` | Used when neither the part nor its group names a tier. |
| `classes` | Optional ceiling in millimetres per fidelity class; a part is meshed at the finer of its tier and its class ceiling. |
| `tessellation_tier` (on a part) | Overrides the group's tier for that part. |

`cad_pipeline/spec.py` resolves a part with `deflection_for`: its own tier, then its group's, then `default_mm`, then the class ceiling. `validate_spec` refuses an unknown tier name and a tier
that is not a positive number.

The Langley spec uses eight tiers (`fit` 0.02 mm for pistons and liners, `journal` 0.03, `thin_wall` 0.04, `valve` 0.05, `standard` 0.1, `body` 0.2, `pipe` 0.3, `coarse` 0.4) and a group map.
They are written so that every one of the 358 parts resolves to the deflection it was built with; the regenerated `part-spec.json` changed only in that block (so its SHA-256 changed, and the
Drive package manifest, which lists the file inside the released archive, still names the old one). R10 keeps its single 0.1 mm and its shipped asset hash is untouched.

No class ceiling is applied to Langley yet. `docs/fidelity-class-report.md` shows what one would do: 158 engineering parts are meshed coarser than 0.1 mm today and would become finer. That is a
change to a released model and is left to the person who decides it.

## The R10 contract

R10 is a static GLB; the viewer computes the motion from the contract's `procedural` block. The contract used to come from `gtsio_review_motion.build_review_contract` plus edits made to the
written file by hand (the `display` orientation, the audit record in `pending`). `cad_pipeline/gtsio_contract.py` holds both, so rebuilding the contract no longer drops them:

```
python -m cad_pipeline.gtsio_contract --output-dir <folder outside web/> --asset <unpacked GLB> --asset-name <name> --compare web/gtsio520-r10-contract.json
```

* `--compare` prints the difference with a shipped contract, field by field, key order ignored. Always build into a scratch folder and look at the difference before replacing a shipped contract.
* The frozen part-spec of the R10 build is a build output outside Git. Where it is missing, `--parameters-from` takes the seven procedural parameters from a built contract. They are checked
  against the reference poses file, so a stand-in cannot pass silently.
* `AUDIT_RECORDS` holds the audit lines written into `pending`. A line is bound to the asset hash it describes and is written only for that hash, so an optimised or rebuilt file never carries an
  audit that was not run on it. When a new asset is audited, add its line there (`scripts/test_interference_audit.mjs` requires exactly one line naming the published hash).

## What the checks prove

`python3 scripts/test_study_contract.py` (CI, standard library): the Langley and Wright contracts rebuild from the committed `part-spec.json`, the inventory and the motion modules **exactly**, as
text, including key order. It proves the builder, the configs and the motion descriptors reproduce what is shipped. It does not prove that the GLB beside the contract is what a rebuild would
export, or that the committed spec is the geometry the GLB was built from.

`python3 scripts/test_tessellation_tiers.py` (CI): all 358 Langley parts resolve, through the tiers, to the deflection the spec held before it had tiers (the old numbers are pinned in the test); the Wright and R10 specs resolve as before; the resolution order and the validation, on small fixtures.

`python3 scripts/test_glb_compare.py` (CI): the GLB comparator finds what it should on built fixtures.

`python scripts/check_rig_equivalence.py` (by hand; needs Blender, a CAD package and a checkout of the commit before the shared rig): runs the old per-engine rig and the shared rig on the same package
and compares, with `scripts/compare_glb_structure.py`, the GLB structurally (nodes by name, transforms, extras, mesh vertex, normal and index data and bounds, resolved materials, every animation
channel's times and values) and the contract, the verification record and the `.glb.gz` byte for byte. The tolerance is 0 by default. It proves that the shared rig, run on that package with that
Blender, makes the same file the old rig made. It does not prove the result is right (the motions are checked by the audits), it does not cover R10's baked-clip path, and Blender versions that
change the exporter would need the comparison run again.

When the package also holds the released export, the check reports the released file against the new export too. That comparison is information, not a gate: the released Langley and Wright files were
exported before the look module changed (PR #74), so their materials differ from a rebuild's and nothing else does. It also reports the contract the site serves (the file in `web/`) against the
rebuilt one: only the asset hash differs, for the same reason. The contract inside an older package can be older than the one in `web/` (the Langley package holds an earlier system tree), so
that comparison is the one to read. The shipped GLBs are unchanged by this work.

## Not covered

* R10's `--bake-gltf` path is untested: it needs the full R10 presentation stage, which is not on every machine.
* The geometry drift check (`scripts/check_geometry_drift.py`, see [freecad-blender-boundary.md](freecad-blender-boundary.md)) runs on the packages that carry their geometry record; R10's is not in Git.
