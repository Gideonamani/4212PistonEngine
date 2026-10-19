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

Parse time, measured as the app's loader turning each file's bytes into a scene (best of three, desktop Chrome; excludes the download,
the gzip unpacking and the GPU upload):

| Model | Original | Optimised |
|---|---|---|
| Operating cylinder | 143 ms | 150 ms |
| Hydraulic tappet | 69 ms | 79 ms |
| Oil pump | 57 ms | 72 ms |
| Accessory drives | 358 ms | 235 ms |
| Full engine | 480 ms | 251 ms |
| Wright 1903 engine | 288 ms | 276 ms |

So the smaller decoded size does not mean faster parsing everywhere. The large models with repeated parts and thousands of animation
tracks (full engine, accessory drives) parse much faster; the small ones pay a few milliseconds for the meshopt decoder, which is
negligible next to their download. Nothing is slower in a way a student could notice here, but this is one desktop; GPU memory and the
Galaxy A16 are not measured. Measure on the phone before quoting a time saving (`docs/galaxy-a16-release-check.md`).

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

## GTSIO-520-H R10 mechanism study (19 October 2026)

The R10 file is optimised on its own, with a stated phone budget (decision D3, 18 October: about 16 MB gzip at most, then measured on the Galaxy A16). Record:
`releases/model-optimization-gtsio520-r10.json`. Tools: `scripts/build_gtsio_r10_optimized.mjs` (build), `scripts/bind_gtsio_r10_optimized.mjs` (bind into the contract,
`src/data/models.json` and the Drive manifest), `scripts/test_gtsio520_r10_optimization.mjs` (checks the record).

**Status: built and verified on a desktop, not published.** `web/gtsio520-r10-static-opt1.glb.gz` exists locally (ignored by Git). The registry and manifest carry a visible placeholder Drive id,
`PENDING_DRIVE_UPLOAD_gtsio520_r10_opt1`, so the asset download fails in CI until the file is uploaded and the real id is bound. Nothing was uploaded to Drive by this change.

| | Before (`gtsio520-r10-static.glb.gz`) | After (`gtsio520-r10-static-opt1.glb.gz`) |
|---|---|---|
| Transfer (gzip) | 25,327,875 bytes (24.2 MiB) | 11,998,800 bytes (11.4 MiB), -52.6% |
| Decoded | 51,199,204 bytes | 21,115,472 bytes, -58.8% |
| SHA-256 of the transfer file | `df420184b1a7…` | `64f433abefa78a102d731040762753c0a6a6c7a6f4b07ad973e79250035e2f52` |
| SHA-256 of the decoded GLB (what the contract checks) | `80991fa8b0d5…` | `1dcf07ccd0f2951780dd5ae76ad8f1b5e2707616309067f1645f15f892d51abc` |
| Parse (app loader, desktop Chrome, best of three) | 376 ms | 470 ms |

Budget met at 12.0 MB. Levers 1 to 3 of the plan (coarser tessellation of the small fasteners, a second on-demand file, a Wi-Fi note) were not needed, and the first was not touched: no geometry was simplified.
Triangles are unchanged (2,080,106), part count, names, hierarchy and transforms are unchanged, and accessors drop from 4,188 to 3,553 where identical data is shared.

**One setting differs from the other models: positions are rounded to a 20-bit mantissa, not 16.** At 16 bits the file is 10.3 MB, but the two crankcase halves and the governor-driven shaft gear stop being
closed solids and the exact-intersection audit (`docs/assembly-interference.md`) cannot test them. At 18 bits (11.3 MB) the two crankcase halves still fail. At 20 bits all 1,396 parts are verifiable.

**Measured error against the unoptimised file:** positions within 2.4e-7 m on a 1.068 m model (2.2e-7 of the model size; limit 1e-5), normals within 0.024 degrees (limit 0.1), and the lossless packing round-trips exactly.
`scripts/check_gtsio_review.mjs --asset … --expect-sha256 … --position-tolerance 5e-7` passes on the optimised file; its rest-bounds check has to allow for the rounding (largest difference 2.67e-7 m, against the default 3e-7).

**Render check** (`scripts/compare_model_renders.mjs`, recorded in the JSON): same, within limits (worst picture 0.0017% of pixels differ, mean difference 0.018 levels). R10 has no baked animation and no morph targets, so
the 12 pictures are three distinct rest views drawn four times. The cycle and explosion the viewer computes were not rendered; the pose audit checked them instead and found the same 159 overlapping pairs before and after.

**Viewer check:** `npx playwright test e2e/part-details.spec.ts --project=phone-390` opens the R10 card from the optimised file and passes (19 October). That is desktop Chromium at a phone-sized viewport; it says nothing about the Galaxy A16.

**Not measured:** transfer and parse time on the phone, memory, and the first rendered frame there. The saving in bytes is certain; the saving in time is not until `docs/galaxy-a16-release-check.md` has been run.
Parse time went up by about 94 ms on the desktop (the meshopt decoder), which may matter more on a slower phone.

```powershell
node scripts/build_gtsio_r10_optimized.mjs                  # web/gtsio520-r10-static-opt1.glb.gz and the record, from web/gtsio520-r10-static.glb.gz (about 30 s)
node scripts/bind_gtsio_r10_optimized.mjs                   # contract, registry and manifest (placeholder Drive id)
node scripts/bind_gtsio_r10_optimized.mjs --drive-id <id>   # after the file is on Drive with link sharing
python scripts/fetch_drive_assets.py --verify-remote        # anonymous download, size and hash
```
