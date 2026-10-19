# Engineering reconstruction pipeline

Images, text and meshes converge on a reviewed JSON feature specification. These are agent-guided interpretation routes: the software does not pretend to recover hidden features or arbitrary mechanical designs automatically. `engineering-research` grounds the identity, variant and construction first. The runnable backend creates expression-driven FreeCAD primitives and linked Boolean history, STEP solids, a validation report, and named Blender components. No additional package installation is required on this workstation.

## Skills

The nine repo skills are under `.agents/skills/`. Example requests:

- “Use $image-to-cad to reconstruct this dimensioned drawing; mark hidden details as estimates.”
- “Use $text-to-cad to make a 100 × 65 × 50 mm bearing housing with a 30 mm bore.”
- “Use $mesh-to-cad and $engineering-research to reconstruct this historical engine as editable major parts.”
- “Use $cad-to-blender to focus on and name each major component.”
- “Use $image-matcher to compare the reconstruction with the original drawing and identify missing features and the CAD operations needed.”
- “Use $mechanism-animation to animate this validated assembly so its parts drive each other without passing through one another.”

Reload/open the repo in a new Codex chat if newly added skills have not been discovered. `AGENTS.md` routes reconstruction tasks to the same instructions.

## Commands (PowerShell, repo root)

```powershell
$cadPython = 'C:\Program Files\FreeCAD 1.1\bin\python.exe'
$blenderExe = 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe'
& $cadPython cad_pipeline/generate.py --spec cad_pipeline/examples/bearing-housing.json --output build/bearing-housing
& $cadPython cad_pipeline/verify.py --package build/bearing-housing
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/inspect_mesh.py -- --source web/wright-1903-engine.glb --output build/wright-reconstruction/source
& $cadPython cad_pipeline/fit_mesh.py --points build/wright-reconstruction/source/source-points.npz --roi cad-studies/wright-1903/mesh-rois.json --output build/wright-reconstruction/source/primitive-fits.json
& $cadPython cad_pipeline/wright_spec.py
& $cadPython cad_pipeline/generate.py --spec cad-studies/wright-1903/part-spec.json --output build/wright-reconstruction/cad
& $cadPython cad_pipeline/verify.py --package build/wright-reconstruction/cad
& $cadPython cad_pipeline/audit_wright.py --package build/wright-reconstruction/cad
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/present.py -- --package build/wright-reconstruction/cad --output build/wright-reconstruction/presentation
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/verify_blender.py -- --package build/wright-reconstruction/presentation
& $cadPython cad_pipeline/package_presentation.py --package build/wright-reconstruction/presentation
& $cadPython -m unittest discover -s cad_pipeline/tests -v
```

Paths are examples for this machine; use the corresponding installed runtimes elsewhere. `spec.py` uses only the standard library. Mesh inspection uses Blender's bundled NumPy; fitting uses FreeCAD's NumPy. Do not use a system Python lacking `FreeCAD` for generation/verification.

## Source resemblance loop

`image-matcher` starts with design understanding before feature planning: interpret load/motion, mating, manufacture and sections; separate observations, deductions and estimates; choose geometry from that reasoning. After reconstruction, compare the same part and pose, record a matched camera, register landmarks without non-uniform warping, explain why mismatches arose and retain tested learning. Fitted landmark agreement does not establish authenticity; silhouettes need deliberately prepared masks.

The GTSIO-520-H study demonstrates this loop: `cad_pipeline/render_match_view.py` renders a fixed view, `scripts/compare_gtsio_crankshaft.py` invokes the reusable helper, and `cad-studies/gtsio520-h-realism/design-learning.md` records why outline copying failed. Revision 3 uses thinner blades deduced from the fork relationship and tilted-section native lofts for tapered webs, preserving machined lands. Fillets and dimensional calibration remain pending; geometry, interference and design/source fidelity remain separate conclusions.

Revision 4 starts a calculated-estimate crankshaft rebuild: `gtsio_crankshaft_estimates.py` derives blade/support envelopes and radii from known diameters and selected ratios; the study's `crankshaft-estimation.md` records the limits. Eighteen actual root blends, twelve closed recesses, contained taper and matching liner edge relief are measured in saved CAD by `audit_gtsio_crankshaft.py`. The fixed `rebuilt` comparison preserves R3's camera/registration; exact axial calibration and hidden drilling remain open.

Research suitable implementation methods as well as the object's design when a feature, rig or rendering technique is unfamiliar. `image-matcher/references/implementation-research.md` explains source/version checks and adoption criteria. `cad-studies/gtsio520-h-realism/implementation-research.md` records FreeCAD and Blender sources, alternatives, tested fixtures and remaining limits. `probe_freecad_methods.py` proves linked native Revolution/Fillet edits, reopening and STEP; `probe_blender_methods.py` reuses the Wright track writer to check shared-action exports and visual baking on copies. These are isolated method fixtures, not newly accepted engine features.

`render_match_view.py` records the installed renderer, neutral shading/cavity, color management and output hash. A plan may specify `view_settings` (`view_transform`, `look`, `exposure`, `gamma`); `--save-scene` preserves the editable diagnostic view. Omitted settings preserve the prior renderer defaults. Keep settings fixed across an established comparison, or explicitly recalibrate all candidates together.

The `loft` primitive uses corresponding closed XYZ polygon sections, linked native `Part::Polygon` objects and a solid ruled `Part::Loft`. Whole-vector-list expressions control the section coordinates; indexed vector-component expressions in the installed FreeCAD runtime did not propagate correctly. `cad_pipeline/tests/test_loft.py` verifies the saved/reopened taper mutation and analytical/direct-evaluator volume agreement. It provides inclined 3D faces, not a cosmetic mesh deformation.

Sampled flank sections can explicitly opt into `profile_spline_runs` and one
`scale_parameter`. Those point runs become interpolated curves or endpoint-fixed
Bezier fits (`profile_curve_mode`), with ruled lofts between radial sections.
This is a new smooth approximation, not an exact replacement of the polygon.
Use a geometry-specific deviation,
mesh-gap and wrong-phase study before adoption. A derived unit master and native
`App::Link.Scale` preserve uniform module edits without a Python proxy; other
section and topology changes require regeneration. The link is wrapped in a
native Part Compound for STEP export. `test_sampled_loft.py` checks reopening,
scale edits, source-independent copied histories and STEP. The degree-one merged
patch alternative is rejected by the specification: its small fixture passed
but its complete cutter's coincident Booleans failed.

Subtractive patterns may have a linked basic-solid `tool_clip` before their
copies. Prove that the clip removes no tool/stock intersection. The GTSIO face
study measured cutter/cutter overlap wholly above the actual stock; a cap with
positive stock clearance removed that unnecessary interference. Its large
post-cut refinement still stalled, so the ring explicitly disables optional
Boolean refinement. Periodic stack traces identified the exact kernel call;
CPU activity alone had not. The full ring then built in 160.1 seconds. See the
study's `accessory-development/face-method-recovery.md` for rejected methods,
unchanged acceptance limits and the final reconstruction's approximation scope.

For large thin solids whose raw mass properties disagree, the original-solid
material comparison can partition the complete bounding region into angular
sectors. Every sector is evaluated and both material differences are summed
against the original **total** tolerance. This is exhaustive spatial coverage,
not sampling or a tolerance per sector. `test_partitioned_material.py` includes
a missing feature in the final sector and an alternate-axis check. Identical
fingerprint comparisons retain their fast path; ordinary small comparisons
retain their original evaluator.

Parts can set `boolean_refine: false` to preserve the Boolean-generated boundary edges when optional native face refinement fails; the GTSIO loft/support-land union required this. It changes the native healing step, not geometry acceptance: valid single solids, source dimensions, volume agreement, STEP and complete assembly audits still have to pass. The failed refined build is retained in the study's validation history.

Optional part `dressups` add radius-driven circular-edge fillets after the Boolean history. Select circles by centre, axis, radius and arc coverage, then create native PartDesign fillets in a Body linked through BaseFeature to the Part result. This retains live Radius expressions; the fixture verifies saved radius and source edits against the direct evaluator. Parameter `expression` fields preserve checked arithmetic dependencies in the native controller. Complete contour/topology changes regenerate from the spec; `update_native.py` refuses dressup histories. The method is a linked Part history with native PartDesign dressups, not an automatic sketch reconstruction.

## Specification and fidelity

`schemas/part_spec.schema.json` describes the interchange contract; `spec.validate_spec` performs runtime semantic checks, including references and arithmetic. Each parameter has value, unit, provenance status, source references and rationale. Measured values also carry a method. Unknown values are null and cannot drive a feature. Derived arithmetic and estimated geometry are explicit. Every primitive dimension and origin can reference parameters; the native document retains those expressions and the source specification.

Supported generic features: box, cylinder, tube, cone, sphere, constrained polygon-sketch extrusion (`prism`), derived profile revolution (`revolve`), linked ruled polygon-section loft (`loft`) and linked helix/profile sweep (`helix`); additive/subtractive linked Booleans and optional circular fillet dressups. Tubes generate linked outer/inner cylinders, allowing annular groove cuts. This is editable parametric CAD, with no custom Python proxy needed to reopen. It is not a full automatic feature recognizer or an all-purpose sketch solver. Extend the backend with further native features as required. The linked `Part::Revolution` fixture differs from the existing derived `Part::Feature` revolution and remains a separate method probe. The first Wright trial remains available, but the researched second revision adds casting sections/baffles, open cages, physical springs, separate rocker rollers, chain links, sliding ignition control and generator components. Tooth profiles, thread detail, spring rates and cam laws remain unverified manufacturing choices.

FreeCAD owns shape and mm units. Blender consumes hash-verified tessellation, converts to metres once, and owns materials/cameras/captions. `present.py` saves an assembly and keyed component tour plus isolated component plates. Its tour changes inspection visibility/cameras; it is not an engine-operation animation.

Parts and features carry an optional fidelity `class` (`engineering`, `visual-structure`, `cosmetic`). `fidelity.py` derives it from the audit policy and records, the gear and mesh declarations, the mass check, the moving bodies and the inventory's mechanism paths; `python scripts/derive_fidelity_classes.py` checks it and `--write` regenerates each study's `fidelity-classes.json`, `docs/fidelity-class-report.md` and the draft lesson map. A test fails if an engineering part has no gate coverage. See [fidelity-classes.md](../docs/fidelity-classes.md). Blender may change normals, materials, lighting and labels and no geometry; `scripts/check_geometry_drift.py` compares the frozen tessellation with the exported GLB part by part and fails above a stated bound. See [freecad-blender-boundary.md](../docs/freecad-blender-boundary.md).

Tessellation is set per spec by `tessellation`: named `tiers` (millimetres of linear deflection), a `groups` map from part group to tier, a `default_mm`, and optionally `classes` (a ceiling per fidelity class). `spec.deflection_for` resolves a part (its own `tessellation_tier`, then its group, then the default, then the class ceiling) and `validate_spec` refuses an unknown tier. The Langley spec names eight tiers (`fit` 0.02 mm for pistons and liners up to `coarse` 0.4 mm); R10 keeps its single 0.1 mm. See [animated-study-rig.md](../docs/animated-study-rig.md).

## Validation and storage

Calculated polygon outlines can opt into `derived: true, linked_profile: true` on a prism. The expression-driven `Part::Polygon` feeds a native `Part::Extrusion`, preserving scalar profile, height and bore edits through save/reopen; default derived profiles retain their existing behavior. `test_linked_profile.py` checks off-axis placement/roll, parameter mutation, direct agreement and strict STEP. Counts, topology and solved gear phase still need specification regeneration. See the GTSIO drive study's method-research.md for the versioned FreeCAD source and fixture evidence.

Replacing a part removes its recursively owned Group history, including nested PartDesign dressups, while retaining externally linked masters. `test_owned_history_removal.py` exercises that distinction in a native document. Verified direct caches can be carried to a new specification with `adopt_direct_cache.py`; controlling-parameter and shared-master changes exclude affected records. Cache provenance tests cover changed files, incomplete bases, specification mismatch and missing/wrong cache keys. Reuse accelerates reconstruction; final saved/direct/export checks remain mandatory.

The saved static GTSIO audit can reuse individual completed intersections through exact assembled BREP/placement fingerprints. It still enumerates every current bounding neighbour and tests every changed/new pair, retaining cached failures and original tolerances. `index_saved_pair_audit.py` binds a legacy complete pass to its hash-verified saved shapes; `check_static_pair_reuse.py` measures warm reuse without allowing unexpected new Booleans. Optional atomic pair checkpoints preserve completed work across interruptions. See [static-audit-reuse.md](../docs/static-audit-reuse.md) for commands, provenance, software-version gates, fixtures and static-only scope.

Checks cover spec integrity, valid single solids, saved native recomputation, STEP solid/volume round trips and actual parameter regeneration. Source fitting and historical fidelity have separate results. `cad-studies/wright-1903/research.md` records the evidence and unanswered questions. All outputs under `build/` are ignored. Keep source scripts/specs/reports in Git; native FCStd/Blender/STEP/GLB remain local and are archived through the existing Drive workflow when requested. Candidate models do not replace the working viewer release.

## Research-led Wright revision 2

Read `cad-studies/wright-1903/revision-2/research.md` before generating this candidate. The target is the surviving rebuilt horizontal engine following the Science Museum construction lineage; it is not an authenticated manufacturing reconstruction of the original 1903 engine. The source inventory covers all 47 keyed Figure 5 items and 11 supplemental records. One pump-drive item is deliberately deferred and two airframe-service items are outside this cropped assembly. All generated parts map to the reviewed inventory. Research readiness means sufficient understanding for the stated static scope; the gate cannot judge source interpretation by itself.

```powershell
py -3.14 -m cad_pipeline.wright_research
py -3.14 -m cad_pipeline.wright_v2
py -3.14 -m cad_pipeline.research_gate --inventory cad-studies/wright-1903/revision-2/inventory.json --spec cad-studies/wright-1903/revision-2/part-spec.json
& $cadPython cad_pipeline/generate.py --spec cad-studies/wright-1903/revision-2/part-spec.json --output build/wright-reconstruction-v2/cad
& $cadPython cad_pipeline/verify.py --package build/wright-reconstruction-v2/cad
& $cadPython cad_pipeline/audit_wright_v2.py --package build/wright-reconstruction-v2/cad
& $cadPython cad_pipeline/add_sections.py --package build/wright-reconstruction-v2/cad
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/present.py -- --package build/wright-reconstruction-v2/cad --output build/wright-reconstruction-v2/presentation
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/verify_blender.py -- --package build/wright-reconstruction-v2/presentation
& $cadPython cad_pipeline/package_presentation.py --package build/wright-reconstruction-v2/presentation
```

Source acquisition is recorded by URL, inspected locators and local hashes; the builder does not fetch or pretend to reread sources. The final study includes bounded interface checks and limited four-region mesh correspondence, with estimated scale and residuals. Static chain chord spacing, dynamic timing and the disputed oil-drive route remain unverified. Native-derived section copies are hidden presentation objects, excluded from the engineering STEP/GLB and part count.

For development, `generate.py --only PartID ...` writes a subset marked incomplete. Release validation rejects it. `update_native.py --package ... --spec ...` supports reviewed basic-feature edits and appended features with identical parameters/part IDs; unsupported reorder/deletion/rich-feature edits require regeneration. It must be followed by the saved-geometry checks. `export_saved.py --native ...` recovers a failed tessellation/report export from a complete saved native build, streaming through a temporary file. Never run writers against the same package concurrently.

CAD metadata uses `Shape.optimalBoundingBox(False, False)` so bounds do not depend on OCC's optional cached triangulation or tolerance expansion. Legacy metadata can be normalized with `refresh_metadata.py --package ...`; it verifies unchanged native hashes and volumes and does not edit geometry. `verify.py` checks native/report identity, volume and deterministic bounds before STEP checks. Presentation section copies are derived snapshots with source links; regenerate them after an engineering change.

The revision-2 STEP has a documented mass-property exception for four ported valve boxes. The original 0.01% per-solid volume limit failed at about 0.019%, although bounds and face/vertex counts agree and bidirectional sampled boundaries differ by less than 1.4e-11 mm. `inspect_step_difference.py --package ...` records this evidence. The optional verifier flag requires a reviewed policy, matching native/STEP hashes, exact failing-part coverage, volume error at most 0.02%, and bounds/sampled boundary error at most 1e-6 mm. The aggregate limit stays 1e-5. It records `strict_solid_volume_check_passed: false` and the exception; it does not turn the original failure into a strict pass. New geometry needs new evidence and review. See the study's `validation-history.md`. To verify the delivered saved candidate, run `verify.py --package build/wright-reconstruction-v2/cad --step-boundary-exception cad-studies/wright-1903/revision-2/step-exception-policy.json`. A fresh build first uses strict verification and needs a newly reviewed policy if that check fails; the delivered policy cannot apply to different file hashes.

After visual inspection and round-trip checks, use `py -3.14 cad_pipeline/build_review.py --study cad-studies/wright-1903/revision-2 --package build/wright-reconstruction-v2`, then `py -3.14 cad_pipeline/package_reconstruction.py --study cad-studies/wright-1903/revision-2 --package build/wright-reconstruction-v2 --name wright-research-revision-2-20261004.zip`. The review builder needs Python-Markdown; the archive preserves repo-relative paths and excludes probes/backups/caches.

## Wright revision 2 in the Explore gallery: seats, operating motion and exploded view

The revision-2 engine is the second Wright card in the Explore gallery (`wright-1903-reconstruction`, the first is the Smithsonian scan). It is released the same way as the accessory drives: native FreeCAD build, then a Blender rig that bakes the clips, then an exhaustive interference audit of the exported GLB. The rules are in `docs/assembly-interference.md`; the content of the motion is in `cad-studies/wright-1903/revision-2/operating-motion.md`.

Pieces:

- `wright_v2.py` writes `part-spec.json`. Parts that sit in a stationary host are *seated*: `wright_seats.py` derives, from an audit of the unseated build, a cut in the host that is the guest's outline grown by 0.15 mm, so the guest touches the host and does not overlap it (`seats.json`). A fixed-axis rotating body can be seated by its revolution envelope (`swept`). Re-derive the seats after changing any geometry: `python -m cad_pipeline.wright_seats derive --audit <audit.json> --geometry <geometry.json> --seats cad-studies/wright-1903/revision-2/seats.json`. The audit may be a rest audit and/or an `audit_motion.py` output.
- `wright_bodies.py` says which parts are one rigid unit (crank assembly, each piston with its pin, each rod, each valve with its cage, the cam shaft with its cams, ...). Pairs inside a unit cannot move relative to each other and are covered by the assembled-pose check.
- `wright_chain.py` derives the chain from the 25.2556 mm arc pitch (38 links, exact 2:1), so every roller sits in its pocket and clear of every tooth at every angle.
- `wright_motion.py` is the single definition of the illustrative operating motion (slider-crank, 2:1 chain drive, the cam-rocker-valve train, the make-and-break igniters, the generator friction drive). `wright_explode.py` is the systems exploded view. `wright_contract.py` writes the viewer contract (the tree: 18 systems, then the inventory components of `inventory.json`, then parts).
- `rig_animated_study.py` (Blender) is the one rig for every animated study (Wright, Langley, GTSIO R10). It bakes the clips with per-body tracks and exports the `.blend`, the GLB and the contract: `blender --background --python-exit-code 1 --python cad_pipeline/rig_animated_study.py -- --study wright --package <cad package> --output <folder>`. `rig_wright.py`, `rig_langley.py` and `rig_gtsio_review.py` are thin entry points that call it, so the older command lines still work. What differs per engine is a `Study` in `animated_studies.py`; the contract comes from the shared `study_contract.py` and the engine's config (`wright_contract.py`, `langley_contract.py`, `gtsio_contract.py`). See [animated-study-rig.md](../docs/animated-study-rig.md).

Fast loop while changing geometry or motion (about one to three minutes per cycle, not for release):

```powershell
python -m cad_pipeline.wright_v2 --no-seats --out build/dev/part-spec.json
& $cadPython cad_pipeline/fast_build.py --spec build/dev/part-spec.json --output build/dev/out --jobs 4
python -m pip install -r scripts/requirements-audit.txt
python cad_pipeline/geometry_to_glb.py build/dev/out/geometry.json build/dev/out/model.glb --motion
python scripts/audit_assembly_interference.py build/dev/out/model.glb --rest-only
python cad_pipeline/audit_motion.py --geometry build/dev/out/geometry.json --step 30
```

`fast_build.py` evaluates the same specification with direct Part booleans and per-part caching; it is a development evaluator. A release goes through `generate.py --batch-runs 6` (native feature history; the option applies each run of six or more consecutive same-operation features, such as the casting's seat cuts, as one fused tool in one Boolean, which builds the Crankcase in about ten minutes instead of hours and matches the one-Boolean-per-feature volume to 1e-7; leave it off for `update_native.py` workflows), `verify.py`, `audit_wright_v2.py`, then `rig_wright.py`, then the real audit on the exported GLB. Audit the exported file, not only the CAD: the clips are baked at one key per crank degree and a viewer interpolates linearly between keys, which can move a part whose origin is far from its axis (see `cad-studies/wright-1903/revision-2/operating-motion.md`). `scripts/test_wright_layout.py` (standard library only) checks the chain, the seat rules and the rigid bodies; `scripts/test_wright_reconstruction.mjs` checks the released file's ratios, stroke, valve lift, the exploded stages and the tree.

## Langley / Manly-Balzer 1903 radial in the Explore gallery

The five-cylinder water-cooled radial of Langley's Aerodrome A is the third reconstruction card (`langley-manly-balzer-1903`). It follows the Wright route (native FreeCAD build, Blender rig that bakes two clips, exhaustive audit of the exported GLB) with a research dossier in `cad-studies/langley-manly-balzer-1903/` (`research.md`, `operating-motion.md`, `build-notes.md`, `inventory.json`). Its notes are in `docs/langley-reconstruction-notes.md`.

- `langley_v1.py` writes `part-spec.json` (358 parts, every parameter with provenance) from the subsystems `langley_crank`, `langley_cylinder`, `langley_drum`, `langley_drive`, `langley_pipes` and `langley_flywheel`; every part is written in a local frame and placed by `langley_frame.Frame` (a rotation about the shaft axis). The spec uses two primitives added for this model: `revolve` (a profile (r, z) turned about local Z, optionally through `angle`) and a per-feature `roll`.
- `langley_cam.py` is the one definition of the cycle timing and the ring cam, imported by the geometry and the motion; `langley_motion.py` is the single definition of the illustrative operating motion (transforms per part and crank angle), `langley_bodies.py` says which parts move together, `langley_explode.py` is the systems exploded view and `langley_contract.py` writes the viewer contract (seven systems, each with a few assemblies, then the parts; `python -m cad_pipeline.langley_contract web/langley-manly-balzer-1903-contract.json` rebuilds the tree of a released contract without a new export). `rig_langley.py` bakes both clips.
- `langley_research.py` generates `inventory.json`, `research-readiness.json` and `source-manifest.json`; `scripts/langley_mass_check.py` compares the model with Manly's weight table; `overlay_plate.py` overlays a section of the model on a plate render.

```powershell
python -m cad_pipeline.langley_research
python -m cad_pipeline.langley_v1                       # writes cad-studies/langley-manly-balzer-1903/part-spec.json
py -3.14 -m cad_pipeline.research_gate --inventory cad-studies/langley-manly-balzer-1903/inventory.json --spec cad-studies/langley-manly-balzer-1903/part-spec.json
# fast loop (one build at a time; about two minutes)
python -m cad_pipeline.langley_v1 --out build/dev/langley-spec.json
& $cadPython cad_pipeline/fast_build.py --spec build/dev/langley-spec.json --output build/dev/out --jobs 2
python cad_pipeline/geometry_to_glb.py build/dev/out/geometry.json build/dev/out/model.glb
python scripts/audit_assembly_interference.py build/dev/out/model.glb --rest-only
python cad_pipeline/audit_motion.py --geometry build/dev/out/geometry.json --motion cad_pipeline.langley_motion --step 15 --jobs 2
python scripts/langley_mass_check.py build/dev/out/geometry.json
# release
& $cadPython cad_pipeline/generate.py --spec cad-studies/langley-manly-balzer-1903/part-spec.json --output build/langley/cad --batch-runs 6
& $cadPython cad_pipeline/verify.py --package build/langley/cad --step-boundary-exception cad-studies/langley-manly-balzer-1903/step-exception-policy.json
blender --background --python-exit-code 1 --python cad_pipeline/rig_langley.py -- --package build/langley/cad --output build/langley/rig
python scripts/audit_assembly_interference.py build/langley/rig/langley-manly-balzer-1903-animated.glb --contract build/langley/rig/langley-manly-balzer-1903-animated-contract.json --policy cad-studies/langley-manly-balzer-1903/interference-policy.json
```

`scripts/test_langley_research.py` and `scripts/test_langley_motion.py` (standard library only) check the dossier, the kinematics and the exploded rules; `scripts/test_langley_reconstruction.mjs` checks the released file's ratios, stroke, valve lift, exploded stages and tree.

## Repeated local castings and meshing topology

`geometry_instance_of` places an earlier master's linked local solid through a separate native `Part::Compound`, retaining each stable part identity. Both parts must have identical feature/dressup/Boolean recipes and local mirror planes, with explicit independent assembly placements. The direct evaluator still reconstructs each recipe independently. The saved/reopened shared-local fixture checks edits, opposite-bank placement and all STEP solids. Native instance feature counts describe the placement operation; the full recipe stays in the specification for independent checking.

`boolean_batch_runs` overrides batching for one part (zero means sequential). Native and direct choices must be checked against one another; batching is not a substitute for fixing coincident or unstable feature boundaries. The GTSIO head trials traced discrepancies to cylinders ending on a revolution seam and tested cutters overlapping the seam before accepting their saved/STEP results.

`mesh_refine` requests FreeCAD seam refinement for **tessellation only**. The original native history and STEP remain authoritative. `meshing.py` rejects refinement unless valid single-solid status, bounds, volume and both Boolean differences preserve the original boundary. Use it only where a diagnosed tessellation defect warrants it; one GTSIO split casting passed these checks while its counterpart did not. No exported-mesh waiver is implied.

`render_match_view.py --export-diagnostic-glb` can export selected CAD development meshes for the existing interference audit. These files carry a diagnostic flag and remain separate from native-CAD acceptance and teaching releases. Comparison plans can specify gravity `up`; include every visible assembled component before interpreting apparent holes.

Presentation configuration can also specify `direction` and `smooth_angle_deg`. On installed Blender 5.0.1, the mesh **instance** exposes `set_sharp_from_angle`; set smooth polygons and tag edges with the chosen angle to preserve sharp machined edges. The type-class lookup alone did not expose this RNA method. This changes shading attributes only. Reopen the saved scene, reimport GLB and audit the final export; it is not a replacement for finer CAD contours or a source-match result.



## GTSIO cross-axis drive development

`gtsio_governor_support` prepares the integrated bearing stock and selected
manual fit. `gtsio_governor_reference_refinement` corrects the output end from
an enlarged source, preserving tach development in the combined specification.
`probe_governor_support --root ... --native-base ...` retains eligible driver/key
histories while changing stock and shaft; `--saved-only` skips construction
only and repeats all validation. `audit_governor_support_context --root ...`
checks development neighbors. These are partial studies, not engine releases.

`gtsio_tach_installation` prepares the separate pinned bevels, shaft, chamber,
seal, closures and hardware. `probe_tach_direct --static-only` is a preflight;
`run_tach_native_subset` requires its current specification hash, saves the
native42-part subset and runs reopening, edits, STEP, exact pairs and24 native
pitch poses. The native/export comparisons are built by `build_tach_review`.
Keep the first failed/trial evidence, original accepted R4 and all editable
files in ignored build folders. `remaining-drives.md` tracks unresolved source
interfaces and whole-engine integration rather than treating subset passes as
complete-engine acceptance.

Before finalizing those reviews, run `check_drive_source_bindings`. It checks
the actual stock BREP identities and current native/specification/check hashes,
reusing recorded accepted hashes where available and checking legacy source
agreements where not. It also verifies unchanged governor driver/key recipe
dependencies before retaining the prior bevel sweep. Review generation checks
these bindings, render hashes, current STEP and final mesh audit again.
