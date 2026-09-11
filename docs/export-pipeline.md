# Repeatable CAD / Blender package

This is the initial M3 export path. It creates isolated packages and does not replace the current Drive asset or website configuration.

Run from the repository directory, using FreeCAD's Python for the first stage:

```powershell
& 'C:/Program Files/FreeCAD 1.1/bin/python.exe' scripts/export_cad_package.py --source '../EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Cylinder.FCStd' --output build/pipeline-baseline --angle 0
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python scripts/build_blender_package.py -- --package build/pipeline-baseline
python scripts/verify_export_package.py --package build/pipeline-baseline --full-vertices
```

Use a fresh output directory for each CAD export. The exporter rejects a directory containing an earlier CAD package so that a failed run cannot silently reuse its manifest. It recomputes the requested bind angle in memory, validates native single solids and unique stable IDs, exports tessellated geometry with group frames and evidence annotations, and checks that the source file hash has not changed. It does not save the source CAD.

The Blender stage verifies the geometry hash, creates motion-group parents, imports each part under its stable ID, assigns material categories and saves an editable `engine.blend` plus `engine.glb`. It exports a static bind pose; the website's operation profile remains responsible for teaching playback. CAD millimetres become Blender metres; Blender's glTF exporter performs the Y-up conversion.

The regular Python verification stage checks hashes, GLB structure, exact part-ID membership, finite vertex positions and each part's world-space bounds against the CAD mesh package. Its tolerance is 0.000001 metres for export agreement, not manufacturing accuracy. Bounds agreement does not verify every triangle, motion poses, material appearance or browser behaviour.

## Required before release promotion

- Verify geometry and source/profile hashes together; a readable GLB alone is insufficient.
- Exercise the prescribed fin and connecting-rod-length changes on disposable CAD copies, rebuilding these stages.
- Check appearance, identity, labels, joint poses and interaction in the browser.
- Produce the web motion profile for the new asset's recorded bind pose and hash.
- Publish a versioned asset/configuration pair and retain a working rollback target.

These remaining steps are M3 release gates. The package scripts do not mark M3 complete, and the large generated files remain outside Git under `build/`.

## Controlled refinement results — 10 September 2026

`build_propagation_variants.py` creates disposable fin-thickness (1.5 to 1.75 mm) and rod-length (168.275 to 170.275 mm) variants. Both were exported through Blender and GLB. `data/propagation-package-check.json` records preserved IDs, labels, groups and materials, increased head mesh volume, and the expected 2 mm rod extent and piston bind-position changes.

The optional `--full-vertices` check uses SciPy to compare each part's world-space vertex sets in both directions. All three packages pass with maximum error 1.56e-8 metres. This adds point-set agreement to bounds checks; it does not certify triangle connectivity or manufacturing accuracy.

`prepare_package_preview.py` builds isolated localhost viewers with asset-bound slider-crank profiles. Browser observations: both variants loaded all 60 components; the fin variant retained cylinder-head selection and gold/transparent isolation; the rod variant showed 221.1 mm piston position at zero degrees, advanced during playback, paused at 591 degrees, reset to zero, and retained connecting-rod function text and isolation. These were desktop browser checks, not physical-phone results. Exact 180/720-degree browser scrubbing, full valve motion and versioned publication/rollback remain release gates. Optional audio is not included in these isolated previews.

## Baseline result

Exact-angle browser follow-up: the Jump to angle control pauses motion at the chosen 0–720 degree position. The rod variant displayed 221.1 mm at 0/720 degrees and 119.5 mm at 180 degrees; the fin variant displayed 219.1 mm at 0/720 and 117.5 mm at 180. These rounded browser readings agree with the CAD-derived values and preserve the intended 2 mm rod-change displacement. The earlier exact-angle browser gate is therefore satisfied for slider-crank propagation. Complete valve-profile propagation and versioned production release/rollback remain open.

`data/pipeline-baseline.json` records the completed baseline: all 60 IDs survived, the explicit bind pose is 0°, and maximum per-part world-bounds disagreement is 1.49e-8 metres. The generated GLB is 25,223,044 bytes. The established smooth-surface/35° sharp-edge shading rule is retained without altering vertex positions. This verifies the initial export path, not the two required CAD-edit propagation exercises or browser integration.
