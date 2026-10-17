# Accepted static valve-train construction milestone

Research began 2026-10-09; the complete saved/native/export milestone passed on 2026-10-10. This extends the accepted R16 cylinder milestone on `feat/gtsio520-realism`. Source resemblance still needs another iteration, and the full engine is unfinished.

The specification adds a four-journal nine-lobe camshaft, twelve eight-piece hydraulic lifters, hollow ball-ended pushrods, beaded housings and their sealing/seating hardware, rounded rocker pads/cups, internal shaft retainers and a complete thrust-washer clearance stack. Journal/body/guide sizes and the new socket's oil hole follow the manual. Other dimensions and the harmonic cam law/phase are explicit estimates.

Verified in the final R5 package:

- Five analytical tests cover envelope curvature, follower coverage, nine lobes/twelve followers, rod closure, pad contact, spring gaps and total rocker endplay.
- The 75-part saved native fixture passes STEP, native/direct agreement, socket clearance, pad/stem contact, meaningful edits and reopening. Projected native solids measure 0.8 mm total endplay, within the source's 0.127-0.889 mm range.
- All 1,128 saved engineering solids and 4,337 native feature operations pass reopening, full recomputation and strict STEP checks. The worst STEP solid-volume error is 1.725754e-5 against the unchanged 1e-4 limit; no exception applies.
- Saved/direct checks pass at the original 1e-5 mm bounds and 1e-6 relative-volume limits. All 4,249 bound-neighbouring native pairs were intersected, with no overlap above 1e-5 mm3.
- The actual final native-derived GLB has 1,128 intersectable parts and 4,191 neighbouring pairs, with no detected overlap, unverified parts or waivers. `interference-audit.json` binds this result to that file; `development-export-checks.json` remains a separate earlier diagnostic.
- The reopened Blender scene and imported final GLB retain every identity and scale, with zero round-trip bounds error. All eleven component plates and four comparison views were visually inspected. Each saved comparison scene also passes independent reopening, identity, vertex-bounds, units and camera-scale checks.
- Five analytical tests, 21 native/specification tests and two saved native-recovery tests pass. The latter include transitive parameter dependencies, shared-master relinking, interruption/resume, corrupt-checkpoint recovery, meaningful edits and same-recipe refresh.

`validation-summary.json` binds the inputs, complete native/STEP/Blender/GLB files, numerical checks and inspected source comparison. `image-review.json` now names the verified native geometry hash. Geometry/export acceptance covers this static construction milestone; it does not establish manufacturer accuracy, loaded joint operation or a completed engine. The generation report's pending-independent-validation flag is its generation-time snapshot; completion is recorded separately in the bound final reports.

Substantive failures remain in the records: housing passages stopped short of crossed head stock; retainer stock clipped collars; the spherical cup seam failed STEP; the additive revolved cup left forging material in the ball cavity; per-side gaps concealed excessive total rocker endplay; a full Workbench render failed in the graphics driver. `method-research.md` and `design-learning.md` explain the corrections and what remains uncertain.

The accepted artifacts and local review are under `build/gtsio520-valvetrain-r5`, with native files in `cad/`, presentation files in `presentation/`, and comparison views in `comparison/`. Direct meshes/BREP cache remain under `build/gtsio520-valvetrain-r1/development`; the corrected direct mesh is `geometry-merged.json`.

The interrupted R3 worker ended without a complete saved package. R5 retained 728 unchanged R16 histories and reconstructed 400 parts, including one explicit same-recipe refresh after an unchanged bolt failed the original mass guard. Its diagnosed failure and final agreement remain in `native-reuse-failure.json`; no tolerance was relaxed. Separate incomplete checkpoints every 30 parts support recovery. The accepted R16 package is hash-preserved. All CAD/model binaries remain ignored and local.

Rebuild with FreeCAD's bundled Python:

```powershell
& 'C:\Program Files\FreeCAD 1.1\bin\python.exe' 'cad-studies/gtsio520-h-static/valvetrain-development/rebuild.py' --output 'build/gtsio520-valvetrain-rebuild/cad'
```

After generating the four comparison scenes, the retained scoped verifier reopens their saved files and checks identity, measured vertex bounds, units and camera scale:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python 'cad-studies/gtsio520-h-static/valvetrain-development/verify-comparisons.py' -- --package 'build/gtsio520-valvetrain-r5'
```

The default rebuild uses the frozen specification from scratch. An optional `--source-package build/gtsio520-static-cylinders-r16/cad` reuses verified unchanged native histories; `--resume` recovers an intact compatible checkpoint. Independent saved/direct, strict STEP, all-pair and final-export validation is required for every rebuilt package. The saved audit's spec hash is the raw input-file hash; the generation report's spec hash is normalized sorted JSON.

Source resemblance still needs another iteration: forged rocker taper, casting/fin/cover contours, lifter axial proportions and measured joint details need stronger calibration. Loaded spherical-seat contact, hydraulic pressure behaviour, hidden galleries and OEM timing are unverified. Reduction/propeller support, accessories and H external systems follow; animation follows detailed static completion.
