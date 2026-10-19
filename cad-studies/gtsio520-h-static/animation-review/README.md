# R10 private animation review — 17 October 2026

The user explicitly selected **illustrative review drafts first** before completing the outstanding whole-engine engineering checks. This is a presentation scope decision. It does not accept disassembly paths, swept clearance, OEM timing or source fidelity. Frozen R10 and the accepted face study remain unchanged; R11 is excluded.

The local player uses <http://127.0.0.1:8766/> when its server is running. It has three clips, stage stepping, a scrubber, pause/play, speed selection, loop selection, four camera directions and part identification. The core view hides unresolved connected mechanisms; an optional ghosted barrel display gives piston context. Its optional video export control can regenerate labelled review copies.

## End-of-session state

At the user's request, the preview server was stopped and all six generated MP4/WebM animation videos were deleted. The editable Blender masters, animated/static GLBs, rebuild scripts, local player, still images and validation evidence remain preserved. `video-checks.json` retains historical format/hash evidence with an explicit discarded-artifact disposition; it does not describe available video files. No publication, Drive upload or student-release replacement occurred.

The user found the browser model coarse and cartoonish. The presentation review identified blanket `polygon.use_smooth=True` in the draft exporter, generic browser colour/metallicity/roughness overrides, simple lighting without realistic reflections/contact shadows, and the small preview with a 1.5× pixel-density cap. These presentation choices soften machined edges and fine detail. The source still contains 2,080,106 triangles; no low-polygon decimation was used. R10's simplified outer case is a separate recorded geometry limitation.

Next presentation work: preserve sharp machined-edge normals while smoothing curved faces; restore distinct material behaviour; improve environment lighting and contact shadows; reassess framing and display resolution. No such corrections were implemented in this session. Keep the frozen R10 CAD unchanged unless the user reopens contour work. Engineering motion-clearance/native/STEP gates and the integration recommendations below remain pending.

## Outputs

All binaries remain ignored under `build/gtsio520-animation-review/`:

- `gtsio520-r10-animated-review.blend`: editable Blender 5.0.1 master, three shared slotted actions with muted per-object NLA references.
- `gtsio520-r10-animated-review.glb` / `.glb.gz`: all 1,396 named source parts; 63,271,640 decoded bytes and 23,264,927 gzip bytes. No external assets are needed by the model.
- `review-contract.json`: exact asset hash, component inventory, body assignments, clip stages, scope and exclusions. Not a student-release contract.
- Generated `exploded-layout`, `collapse-layout` and `core-cycle` MP4/WebM copies were discarded at the user's request; video binaries are no longer retained.
- Original static review `.blend` / `.glb`, source-mesh bounds and shared-definition pose samples remain available for independent comparison.

The animated GLB SHA-256 is `27054c1c7d0714537462dafca2f3ab870e603cd6c50808227622e60add0c7281`.

## Motion and its limits

`cad_pipeline/gtsio_review_motion.py` owns all transforms and the review visibility list. `rig_gtsio_review.py` samples it; the exported-file checker compares its saved reference poses with Three.js playback. The source layout, firing phases, declared cam ratio and existing inferred follower/rocker calculation are reused.

The clips are:

1. **Explode - illustrative layout**: five system-layout separations. External fasteners/covers first, then accessories/sump, cylinder packages, case halves/bearings and core/drive detail. These are visual system packages, not certified rigid assemblies or a maintenance procedure. Internal hardware remains within its displayed package. Removal transit and held-stage clearance are unaccepted.
2. **Collapse - illustrative layout**: exactly the same keys in reverse, ending at the frozen assembly pose.
3. **Core cycle - illustrative**: 720 crank degrees at one-degree keys, linear interpolation, 12 seconds at nominal 1× playback. The crank drives six slider-crank pairs; the declared -0.5 cam ratio drives the existing inferred harmonic cam, lifters, pushrods, rockers, valves and axis-scaled springs. Spring feet stay fixed; retainer travel changes spring length. Hydraulic internals follow their lifter body without an internal hydraulic animation. The counterweight articulation/dynamics, reduction/propeller and accessory motion are hidden/excluded.

All three actual GLB clips retain 721 input keys per animated channel. Source rest geometry is preserved through node-pivot/basis changes. Spring meshes use an axis-aligned local basis so their length scaling survives glTF TRS decomposition without introducing shear. Blender uses `ACTIONS` export with explicit `ACTION` merge; the existing locally validated Blender 5 method is reused.

## Checks completed

- Frozen geometry/specification/inventory hashes match the handoff before import.
- Three.js loads exactly the three declared clips and all 1,396 stable CAD IDs; asset and contract hashes agree.
- Exported source-mesh rest bounds agree within 0.000052 mm. These compare actual tessellation to export, not tessellation to the native analytic boundary.
- Shared-definition sample matrices agree within 1.84e-7 per matrix component.
- Independent between-key slider-crank probes of all six pairs: maximum piston error 0.002523 mm; maximum rod endpoint error 0.001940 mm. These are interpolation residuals at the checked samples, not collision results.
- Collapse/reverse error below 9.50e-8 per matrix component; cycle closure and repeated clip-switch return below 2.94e-7.
- **Actual animated GLB, assembled pose only:** all 1,396 parts can be intersected; all 5,168 bounding-neighbour pairs checked with the unchanged study interference policy; zero overlaps or waivers. See `interference-audit.json`. Its `clips` object is empty because `--rest-only` was used.
- Browser review: source assembly and visible core open in the local Three.js player. The persistent interface and video captions identify the draft scope.
- Saved Blender master reopened independently: all 1,396 source IDs, three shared actions, their 1,191/1,191/328 part slots, muted reference tracks and finite rest transforms retained. This presentation check does not replace a FreeCAD native/edit/reopen check.

The full current native/direct agreement, real CAD parameter edit/reopen, STEP round trip, complete native neighbours, support/gallery/return interfaces and swept exported motion remain pending exactly as recorded in the handoff. No engineering or student release is authorised. A static export pass and kinematic checks do not establish moving contact, removal access, dynamics or fluid performance.

## Incorporating it in the current web app

Inspected the primary `4212PistonEngine` checkout at `b08e2a9` on `feat/section-cut-lifts-highlight-fallback`. This is the user's current main working checkout; it is not assumed to be the remote default branch. No files there were edited. Its existing untracked lesson UI mockups were left intact.

### Recommended first integration: a separate Explore model

Add a new, explicitly labelled `gtsio520-r10-reconstruction` entry to `src/data/models.json`, using the existing **`animated-study`** adapter. That adapter already verifies the decoded asset SHA-256 and part inventory, reads saved clips/stages, provides picking/group isolation, sections, spotlight controls, speed and looping, and restores poses through `AnimationMixer`.

The current V5 full-engine card uses **`full-engine`**, a different contract and legacy component buckets. Replacing its asset URL with R10 will not preserve its selectors or lesson semantics. Keep it while the R10 entry and migrated lessons are reviewed.

For the new entry, derive a production contract from the reviewed R10 inventory: `asset_sha256`, `parts`, nested `groups`, `motions`, scope, reference and transport identity. Keep every mesh's `cad_part_id` extras. Organise the 51 raw groups into understandable parent systems and six cylinder packages. These teaching groups are independent of the motion's rigid-body ownership.

### One adapter addition is necessary for the core clip

The private player applies `cycle_visible` metadata to expose the core. **The main `animatedStudyAdapter.ts` does not currently read that field.** A plain asset/registry addition would leave opaque case/head geometry in front of the mechanism.

Add optional per-motion display metadata, for example `display: { visiblePartIds, ghostPartIds }`, resolved from the inventory. Apply it when selecting a clip, combine it with the existing focus/isolation/section state, and reset it when changing clips. Provide an explicit “assembled / core / cylinder 1 detail” view choice. Test that switching back to exploded/collapse restores all appropriate parts. Use an indexed part map instead of repeated per-mesh linear searches when implementing this for 1,396 components.

The generic adapter's motion position is a percentage. Keep it that way for exploded/collapse. Derive `crankAngle = progress * 7.2` only for this 720-degree core clip, and keep the cylinder-1 firing reference and inferred cam-law disclosure visible. Do not pass that percentage directly into the existing single-cylinder degree controls.

### Migrate five lesson poses and three click checks deliberately

The inspected primary checkout contains four V5 model poses in `web/fundamentals-lessons.json`, one in `web/valve-train-and-power-lessons.json`, and three corresponding model-click checks. The old focus component names are not R10 CAD part IDs:

| Existing component bucket | R10 mapping to review |
|---|---|
| `crankcase-and-mounts` | `CrankcaseRight`, `CrankcaseLeft`; missing or deferred external mounts must be disclosed rather than implied by this mapping |
| `crankshaft` | `Crankshaft`, with counterweights included only where the lesson explicitly discusses their static construction |
| `propeller-reduction-drive` | Actual IDs in the inventory's `front_drive`, `propeller_shaft` and related bearing/retention groups; keep this a static identification step until drive motion is accepted |
| `camshaft-and-timing-drive` | `Camshaft`, `CamshaftGear`, `CamClusterGear`, `CrankshaftGear` and reviewed retained attachments |

Expand legacy buckets to explicit CAD IDs in `focusParts`, remap click-check targets and reframe each lesson camera. R10's source shaft axis is CAD Z; Blender exports it as glTF Y. The private player applies a presentation rotation for a horizontal engine. V5's contract describes a different inherited scene datum, so V5 camera/cut-plane coordinates cannot be reused without conversion. Prefer a contract-driven presentation orientation and retested source-bound section planes.

Existing lesson fields `savedMotionId`, `motionProgress`, `focusParts`, `focusMode` and `sectionPlane` can express a guided staged disassembly layout or a paused core-cycle view. Keep the detailed single-cylinder model for combustion/pressure teaching until that scope is separately supported by R10; this draft contains no gas or oil-performance model.

### Delivery and performance

This draft has 2,080,106 triangles and up to 1,396 mesh draws; the core view shows 396 parts but the whole file is still loaded. Its compressed transfer is about 5.5 times the current V5 asset's 4.23 MB. Profile startup, frame rate and memory on teaching devices before adopting it as a default.

The main app already has a lossless `MeshoptDecoder` in `src/viewer/core/gltf-loader.ts`. First try a lossless meshopt export while preserving node IDs, extras, tracks and precision; rerun hash, coordinate, motion and interference checks on the actual deliverable. Consider a separately loaded core detail or lower-detail hardware presentation only if measurements justify it; retain the full source geometry locally and make any simplified scope explicit. Avoid geometry merging that destroys part picking or rigid-body ownership.

Only after approval and the applicable release checks: upload a new, separate teaching export through the existing Drive workflow, verify anonymous delivery size/SHA-256, add its identity to `docs/drive-asset-manifest.json`, then bind the new registry entry. Keep native archives private and CAD/GLB binaries out of Git and the production build. No upload or release change was made for this review.

Implementation acceptance: `npm run lint`, `npm test`, `npm run build`, `npm run e2e`, plus actual candidate-file checks for clip switching, part picking, each migrated lesson/check, section/spotlight combinations and loading failure recovery. These app checks are for the future integration; this task did not modify the production viewer.

## Rebuild and open locally

From the realism worktree in PowerShell:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --threads 4 --python-exit-code 1 --python cad_pipeline/review_gtsio_r10.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --threads 4 --python-exit-code 1 --python cad_pipeline/rig_gtsio_review.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --threads 2 --python-exit-code 1 --python cad_pipeline/verify_gtsio_review.py
node scripts/check_gtsio_review.mjs
python scripts/serve_gtsio_review.py --port 8766
```

The local server binds only `127.0.0.1`. It resolves Three.js from the primary checkout's existing `node_modules`. The local HTML, rig scripts and checks are tracked-source candidates; all generated model/video binaries remain ignored. The review page's video control records its own canvas and uses local ffmpeg to create H.264 MP4 copies.

## Update, 19 October 2026: audit of the shipped file

`interference-audit.json` in this folder describes the earlier animated file (sha256 `27054c...`, 63,271,640 bytes, assembled pose only). The file that ships now is the static
`gtsio520-r10-static.glb.gz` (sha256 `80991fa8...`, 51,199,204 bytes), whose cycle the viewer computes. It was audited at its assembled pose and through the sampled cycle and
exploded layouts; see `../shipped-r10/` and `docs/assembly-interference.md`. The assembled pose is clean; the sampled cycle is not (159 overlapping pairs, recorded in a ledger).
