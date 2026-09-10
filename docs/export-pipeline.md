# Repeatable CAD / Blender package

This is the initial M3 export path. It creates isolated packages and does not replace the current Drive asset or website configuration.

Run from the repository directory, using FreeCAD's Python for the first stage:

```powershell
& 'C:/Program Files/FreeCAD 1.1/bin/python.exe' scripts/export_cad_package.py --source '../EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Cylinder.FCStd' --output build/pipeline-baseline --angle 0
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python scripts/build_blender_package.py -- --package build/pipeline-baseline
python scripts/verify_export_package.py --package build/pipeline-baseline
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

## Baseline result

`data/pipeline-baseline.json` records the completed baseline: all 60 IDs survived, the explicit bind pose is 0°, and maximum per-part world-bounds disagreement is 1.49e-8 metres. The generated GLB is 25,223,044 bytes. The established smooth-surface/35° sharp-edge shading rule is retained without altering vertex positions. This verifies the initial export path, not the two required CAD-edit propagation exercises or browser integration.
