# Model optimisation, release opt1 (5 October 2026)

The six teaching models are re-encoded so students download and parse less, without changing what they see. This note records what was
done, what it saved, how it is checked, and the one step that has to be done by hand before the new files can go live.

**Status: built and verified, not published.** The new files exist under `web/` (ignored by Git) with new names, the current release is
untouched, and nothing in the app points at them yet. Publishing needs the files on Drive with link sharing (see "Publishing" below).

## What it saves

Sizes are MiB. "Transfer" is the file a student downloads (gzip); "decoded" is the GLB after unpacking.

| Model | Transfer | Decoded | Animation keys |
|---|---|---|---|
| Operating cylinder (`cylinder-reviewed-20261001`) | 15.20 -> 8.65 (-43%) | 33.24 -> 12.36 (-63%) | none |
| Hydraulic tappet | 6.80 -> 5.48 (-19%) | 20.51 -> 7.88 (-62%) | 6979 -> 575 |
| Oil pump | 4.48 -> 3.59 (-20%) | 14.58 -> 5.27 (-64%) | 9800 -> 278 |
| Accessory drives | 11.82 -> 8.26 (-30%) | 53.13 -> 13.84 (-74%) | 1,496,490 -> 5,965 |
| Full engine | 4.03 -> 1.26 (-69%) | 38.18 -> 5.09 (-87%) | 45,569 -> 19,558 |
| Wright 1903 engine | 9.12 -> 5.56 (-39%) | 9.12 -> 6.16 (-32%) | none |
| **All six** | **51.45 -> 32.79 (-36%)** | **168.77 -> 50.60 (-70%)** | |

The transfer saving is modest for the tappet and oil pump because their tessellation is flat-shaded (a separate face normal at each
vertex), so almost no vertices repeat and floating-point positions do not compress much further. The engine gains most because it holds
many identical copies of the same part (cylinders, bolts, gears) that are now stored once. Much of the Wright model's size is its two embedded
textures, which are left exactly as they were.

Not measured: load and parse time, GPU memory, or behaviour on the Galaxy A16. The decoded size is a proxy for parse work, not a
measurement of it. Measure on the phone before quoting a time saving (`docs/galaxy-a16-release-check.md`).

## What was and was not changed

Never changed: node names, hierarchy, transforms, materials, textures, morph targets, animation names, triangle winding. Geometry is not
simplified, there is no Draco and no KTX2.

| Step | Effect | Lossless? | How it is checked |
|---|---|---|---|
| Weld identical vertices, reorder for the GPU cache | Almost nothing on these flat-shaded models; kept because it is free | Yes | Triangle fingerprint before and after |
| Positions kept as float32 but rounded to a 16-bit mantissa | About 2 micrometres on a 300 mm part; makes the numbers compress | No, bounded | Largest change measured per model and held under 1e-5 of the model's size |
| Normals as 12-bit integers in 16-bit normalized form (`KHR_mesh_quantization`) | At most 0.025 degrees; shaders normalise anyway | No, bounded | Largest angle measured and held under 0.1 degrees |
| Identical data shared between parts (accessor instancing) | Each part keeps its own mesh, node, name, transform and material; only the numbers underneath are stored once | Yes | Triangle fingerprint before and after |
| Keyframes that interpolation reproduces are dropped, the values left are rounded | The accessory drives' 1.5 million keyframes become 6,000 | No, bounded | Every original keyframe is compared with the new track: translation under 1e-4 of the model size, rotation under 0.01 degrees |
| `EXT_meshopt_compression`, written, read back, compared | Lossless packing | Yes | The decoded file must hold exactly the numbers that were packed |

The triangle fingerprint is a hash of every triangle's corners (position, normal, texture coordinates, morph deltas) that does not change
when vertices or triangles are reordered or a triangle's corners are rotated, but does change if any value or the winding changes.

Two ideas were tried and rejected:

- **Integer position quantization** (`KHR_mesh_quantization` positions). glTF-Transform has to compensate with a scale and offset on the
  node, and for an animated part it does that by inserting a new child node and moving the mesh onto it. That breaks the viewer's mapping
  from component names to meshes (it labels parts from the node's original name). Rounding the float mantissa gets most of the
  compression with no scene-graph change.
- **Resampler tolerance as the error bound.** The keyframe resampler drops keyframes greedily and the errors add up: with a nominal
  tolerance of 1e-5 the tappet's 4 mm travel drifted by 0.15 mm. The optimiser now resamples each track again with a tighter tolerance
  until the measured error is within the limit, and keeps a track exactly as it was if it never gets there.

## Does it look the same?

`scripts/compare_model_renders.mjs` loads the original and the optimised file with the app's own loader, poses both at three moments of
their animation and once with every morph target at full strength, draws each from three directions with the same camera and lights, and
compares the pixels. Across all six models no picture had more than 0.013% of its pixels differ by more than 16 levels (limit 0.05%) and
the mean difference was at most 0.023 levels (limit 0.05). The differences are single pixels along silhouettes. A control (the oil pump
against the tappet) correctly fails at 38%. The results are in the record, per model.

## Reproduce

```powershell
python scripts/fetch_drive_assets.py            # restore the current models (and verify their hashes)
node scripts/build_optimized_models.mjs          # writes web/*-opt1.glb.gz and releases/model-optimization-opt1.json (about 6 minutes)
npm run dev                                      # another terminal, for the render check
node scripts/compare_model_renders.mjs web/oil-pump.glb.gz web/oil-pump-opt1.glb.gz oil-pump --record releases/model-optimization-opt1.json --model oil-pump
npm test                                         # test_optimize_model, test_model_release_record, test_engine_stations ...
```

The build is deterministic: the same input gives the same bytes (and the same gzip), so the hashes in the record can be reproduced.

## Publishing (needs a person)

New files must be on Drive with link sharing, the same way the current models are. The Drive connector available to the assistant can
only share with a named person, not "anyone with the link", and uploads through it are impractical at this size, so this step is manual:

1. Put these seven files in the Drive `web` folder (https://drive.google.com/drive/folders/1l6ao_l0r-WJ9wq2_Yxh3flmI8zn-aM3M), either
   by starting Google Drive for desktop (the working folder is its sync source) or by dragging them in from the browser:
   `cylinder-reviewed-20261001-opt1.glb.gz`, `hydraulic-tappet-opt1.glb.gz`, `oil-pump-opt1.glb.gz`, `accessory-drives-opt1.glb.gz`,
   `engine-opt1.glb.gz`, `engine-opt1.glb`, `wright-1903-engine-opt1.glb.gz` (all in `web/`).
2. For each, set General access to "Anyone with the link: Viewer".
3. Tell the assistant, or collect the seven file ids yourself.

Then the binding, which is deliberately not scripted blind because it touches checks CI runs against the current files:

- record each Drive id in `releases/model-optimization-opt1.json` and confirm anonymous delivery with the published-site referrer
  (`python scripts/fetch_drive_assets.py --verify-remote` after the manifest is updated);
- `docs/drive-asset-manifest.json`: new `web_assets` entries (path, drive id, bytes, sha256 of the transfer file); the current entries move
  to `previous_web_releases` with a `retained_reason`;
- `src/data/models.json`: each model's `sources` (new `localUrl`, `transferBytes`, `decodedBytes`, `driveId`, `compressed: true`; the Wright
  model becomes a `.glb.gz` too) and the `?v=` of its catalogue, motion or contract URL;
- the decoded-file hash, which the viewer checks before it trusts a model: `asset_sha256` in `web/motion.json`, `source_asset_sha256` in
  `web/cylinder-saved-motions.json`, `asset_sha256` in the tappet, oil pump and accessory contracts, and `asset` and `asset.transport` in
  both copies of the engine contract (`data/engine-contracts/gtsio520-h-v5.json`, `web/engine-contract.json`);
- the scripts and tests that name the current files or hashes (`grep -rn "cylinder-reviewed-20261001"`); then `npm run lint`, `npm test`, the
  Python checks CI runs, `npm run build`, `npm run e2e`.

Rollback is a revert of that binding commit: the old files stay on Drive and in the manifest's `previous_web_releases`.
