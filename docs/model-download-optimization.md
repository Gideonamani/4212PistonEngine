# Lossless model download — 12 September 2026

The spring-seat operating-cylinder preview now downloads a gzip asset and reconstructs the original GLB before its existing SHA-256, motion and rendering checks. It retains all 60 component identities, materials, mesh positions, normals, triangle indices and spring morphs exactly. This is download optimization; no geometry was simplified.

| Measure | Result |
|---|---:|
| Original GLB | 35,023,520 bytes |
| Gzip download | 20,224,725 bytes |
| Bytes saved | 14,798,795 (42.25%) |
| Decoded vertices | 575,225 |
| Decoded triangles | 1,015,876 |

The decoded SHA-256 remains `f1f54fa57ae1ccc1aa23a635674eeece7ee1c518db1e6fbd5b508ab09bb2da3c`. The compressed-file SHA-256 is `05d58e64b7035bfda2b466dfbebf17efabb31ee758bd5a5c677984fe45af1978`. The packaging script requires an existing passing export verification and proves a byte-exact decompression round trip before writing its manifest. Source GLB and Blender manifests stay unchanged.

## Reproduce

From the repository directory:

```powershell
python scripts/package_model_transport.py --package build/pipeline-spring-seat
python scripts/prepare_package_preview.py --package build/pipeline-spring-seat --valves
node --test scripts/test_model_transport.mjs scripts/test_cycle_cues.mjs scripts/test_kinematics.mjs scripts/test_valve_kinematics.mjs scripts/test_transfer.mjs
```

The package gains `engine.glb.gz` and `transport.json`. Preview preparation checks the compressed hash and its decoded/source bindings, then sets the local model URL to `control.glb.gz`. Browsers without native gzip decompression select the retained `control.glb` fallback. The decoder also accepts ordinary GLBs and HTTP responses already decompressed by the browser. The local Reload model button now reloads the configured local asset.

Cancellation remains active during both download and decompression. Corrupt gzip data, invalid GLB headers, truncated models and oversized decoded output are rejected. The existing motion profile still checks the decoded GLB hash before enabling motion. Diagnostics distinguish received bytes, unpacking time and model preparation. The visible progress bar reserves its final segment for validation and preparation, so it does not claim completion while browser work remains.

## Verification

Thirteen Node tests passed, covering plain/gzip equivalence, damaged inputs, output bounds, cancellation before/during unpacking and the existing motion/particle/transfer tests. The real browser downloaded the gzip file, decoded it and passed 14,497 particle/spring/section/playback checks.

Observed desktop localhost run: 0.36 s download, 0.58 s unpack, 2.04 s preparation/first render at 639 × 282 CSS pixels and device pixel ratio 1.25. These are observations from one local run, not internet or phone performance estimates.

## Remaining gate

GPU memory and triangle count are unchanged, and decompression uses temporary CPU memory. Physical A16 testing must measure load/preparation, orbit and playback both with and without sections. If rendering is too heavy, the next optimization is a separately validated lower-detail mesh, especially the spring coils; lossless transport alone cannot establish phone usability. No new Drive asset or Pages revision has been published by this package.
