# 4212PistonEngine — project roadmap

Planning baseline: 9 September 2026. This is the proposed working roadmap; sequence and scope can be revised with the instructor. Milestone completion is based on evidence, not elapsed time. Calendar dates will follow a representative module build and review.

## Purpose and intended experience

Build a manual-grounded, interactive piston-engine teaching platform for module 4212. A student should be able to locate and identify components, explain their functions, follow the four-stroke cycle and connected engine systems, inspect relationships and clearances, and check understanding through guided activities.

The long-term deliverable is one cumulative engine assembled from reusable, independently reviewable subsystems. It must support both free exploration and structured lessons. FreeCAD remains the dimensional design master; Blender supplies presentation and animation; GitHub Pages supplies the learning interface; the existing synced Google Drive stores model and media assets, with the Drive API supplying browser models.

The initial engineering reference is the current GTSIO-520-H study. Engine variant, document revision and applicable configurations must be checked before expanding. General four-stroke explanations can be shared across variants; variant-specific dimensions and timing must remain separate.

## Current baseline

12 September update: the local operating-cylinder preview now uses a lossless 20.2 MB download instead of 35.0 MB (42.25% reduction), with identical decoded geometry and motion. Thirteen numerical/transfer tests and 14,497 browser checks pass. This reduces network transfer, not triangle count or GPU memory. M2 physical-motion validation and production publication remain open. See [download optimization](model-download-optimization.md).

M3 continuation, 12 September: `releases/operating-cylinder-20260912.json` records the proposed release's exact model and transport hashes. The release-assembly command creates a self-contained, hash-verified candidate with the matching operating motion profile while deliberately removing the old Drive binding. This lets versioned Drive/Pages promotion be a final atomic review step rather than mixing the new operating model with the existing static asset. See [release rollback](release-rollback.md).

## Status update - 12 September 2026

**M1 is complete.** The project owner supplied physical Samsung Galaxy A16 captures of the published experience, including full-engine loading and the responsive viewer toolbar. Together with the existing desktop checks, the 60-component cylinder explorer meets the M1 exit gate. UI, loading and performance refinement remain continuous work; they do not reopen this completed milestone.


| Area | Verified now | Remaining work |
|---|---|---|
| CAD | Detailed single-cylinder study: 60 bodies and 284 constrained sketches; selected geometry/motion checks completed | Audit reconstructed features and interfaces; not a validated complete engine |
| Blender | Editable presentation scenes; assembly orbit, illustrative cycle and 60-component tour videos | Web-compatible operation data and animation; polish and refinement |
| Audio | Soft original Quiet Workshop score in video versions; silent versions retained; optional website playback and volume controls | Physical-phone playback check |
| Website | GitHub Pages loads the 24.1 MiB GLB through restricted Drive API; 60 IDs, selection/isolation, solid sections, fullscreen, progress/retry, evidence status and slider-crank playback implemented | Lesson review, M2 physical-motion validation and optimization |
| Evidence | Manual procedure, seed component catalogue and example claims | Complete claim review for the first release; resolve critical unknowns |
| Pipeline | Individual export/update scripts and working Drive synchronization | One reproducible build, versioned release manifest, rollback and CAD-edit propagation proof |

Live prototype: https://gideonamani.github.io/4212PistonEngine/

## Milestones and release gates

| Milestone | Deliverable | Completion evidence |
|---|---|---|
| M0 — delivery proof | Static cylinder in a browser, served from synced Drive through the API | Completed: successful load and component interaction. Broader device coverage remains in M1. |
| M1 - usable cylinder explorer | Readable inspection materials, reliable loading/retry, component groups/search, select/isolate/reset, section view, evidence status and optional music | **Completed 12 September 2026:** all 60 catalogue entries are accessible; desktop checks and project-owner Samsung Galaxy A16 evidence confirm use on a representative phone. Ongoing UI refinement continues outside this gate. |
| M2 — operating cylinder lesson | Play/pause, speed, crank-angle scrub, stroke labels, synchronized piston/rod/crank and valve motion, intake/combustion/exhaust cues | One 720-degree state drives the mechanism; pause/scrub/resume agree; agreed poses match CAD/operation data; no jumps at loop boundary. Illustrative gas flow and timing are explicitly labelled. Instructor reviews the learning sequence. |
| M3 — reproducible update pipeline | CAD export manifest, shared operation profile, Blender refresh/export, validation and versioned publication to synced Drive + Pages | On a disposable CAD copy, a fin change and a rod-length change reach Blender and browser; stable IDs, labels, materials and motion remain correct. Release names/hashes match; failed validation prevents promotion; previous release can be restored. |
| M4 — whole-engine foundation | Engine coordinate system, crankcase/crankshaft/bearings, cylinder mounting stations and reusable cylinder instances | Applicable manual evidence and interface register reviewed; modules fit at their datums; cylinder orientation, crank phases and firing sequence verified; no independent hand-maintained cylinder copies. |
| M5 — connected subsystems | Cam/valve train, reduction/accessory drives, induction/fuel, ignition, exhaust, lubrication and cooling lessons | Each subsystem passes the common module checklist and integrates into the cumulative engine. Shared crank-angle state and explicit fluid/power connections remain consistent. |
| M6 — teaching release | Guided lessons, identification and sequence exercises, self-check feedback, instructor notes and fallback media | Representative classroom trial; explanations and assessment answers reviewed; device/loading findings addressed; coherent engine release and documented remaining approximations. |

M1 is complete. M2 depends on the shared operation profile; M3 remains a required gate before substantial M4/M5 expansion. Integrate after each module instead of postponing assembly until the end.

## First three work packages

1. **Explorer usability and release inventory.** Review the current cylinder visually, improve materials/framing and loading feedback, group the 60 components, surface evidence categories, and measure a desktop/phone baseline. Preserve stable IDs during any mesh optimization.
2. **Motion contract and four-stroke lesson.** Extract the required CAD dimensions and joint frames; define a versioned operation profile; connect web controls and phase cues. Begin with the clearly labelled illustrative profile already used in the videos. Manufacturer timing is a separate evidence task.
3. **Change propagation and first teaching review.** Exercise the two controlled CAD changes, check exported poses and catalogue identity, package a versioned release, and review the single-cylinder lesson before authoring the next subsystem.

The active engineering packages are M2/M3 close-out and M4 whole-engine foundation. M1 is complete following physical Samsung Galaxy A16 evidence. UI polish and further device/performance refinement continue without reopening M1. M2/M3 still need their own lesson, release and propagation gates.

Latest engineering result: the housing-clearance candidate passes four moving-pair checks at 58 sampled poses. The revised spring-seat candidate now passes 12 native spring solids and 36 listed interfaces at three lift positions; see [spring-seat review](spring-seat-review.md). Controlled fin and rod changes have reached Blender and isolated browser previews with stable IDs and expected geometry changes; see [export pipeline](export-pipeline.md). No candidate is promoted yet. Initial M3 publication checks run mechanism/transfer tests and reject a stale generated motion profile; controlled geometry changes have passed export checks and local browser observations, while full motion propagation and versioned rollback remain open. The isolated preview now includes synchronized valve gear and CAD-derived spring compression; see [spring animation](spring-animation.md). Gas cues and lesson review remain open. The project owner has confirmed physical Samsung Galaxy A16 use for the completed M1 gate. Physical-device validation for M2 motion and M3 release promotion remains separate work.

## Update — 11 September 2026: cycle cues and spring-section checks

Follow-up visual correction: square/static particles and exterior-only flow cues have been replaced by round moving sprites and schematic port/valve/chamber streams. Full particle-radius bounds and depth testing address apparent piston intrusion. The gas-view button opens and frames a section. Updated verification passes ten numerical tests and 14,497 browser checks; details and flow-path limitations are in [cycle verification](cycle-preview-verification.md). This supersedes the overlay behaviour described below.

The isolated spring-seat preview now includes intake/exhaust port arrows and tracers, a central charge overlay, and compression/combustion/exhaust colours and explanations driven by the same 720-degree state. These are illustrative overlays, not measured gas properties. The preview builder verifies the completed region-audit hash before enabling the profile. Earlier statements above that gas cues are pending are superseded by this update.

Desktop browser verification passed 2,825 checks covering all four spring morphs, matching deformed stencil vertices/transforms, three section axes, both cut sides, ten crank poses, loop closure, scrubbing and play/pause. Visual comparison of the isolated intake outer spring at 0 and 90 degrees confirmed capped section faces follow its changing pitch. A nonnegative frame-time guard prevents an initial animation callback from moving the mechanism backwards. Eight numerical/transfer tests pass. See [cycle verification](cycle-preview-verification.md) for reproduction and limits.

Steps 1 and 2 of the current continuation package are complete in the local preview. Instructor lesson review, M2 physical-motion checks, asset optimization and versioned production promotion remain open; M2/M3 are not signed off. Local release capture/restore has already been rehearsed, as documented in [release rollback](release-rollback.md).

## Repeatable procedure for every subsystem

1. Define the student learning outcome and engine/configuration applicability.
2. Study the manual descriptions, figures, parts lists and limits; build an evidence-backed inventory.
3. Record documented values, derived values, measurements, reconstructions, illustrative choices and unresolved questions separately.
4. Define stable part/instance IDs, mating datums, joint axes, fluid ports and dependencies on existing modules.
5. Model and dimension in FreeCAD; check solids, critical dimensions, fit and selected operating positions.
6. Generate/update Blender presentation using exported geometry and joint frames. Draw operational timing from the shared profile.
7. Export GLB, component information and teaching media. Add web interaction deliberately; do not assume Blender effects transfer automatically.
8. Validate in the browser, review against sources, integrate with the cumulative engine and publish a versioned release.

Detailed source procedure: [manual-workflow.md](manual-workflow.md).

## Meaning of realistic

- **Geometry:** critical dimensions and assembly interfaces are supported by evidence; reconstructed contours are identified.
- **Operation:** moving relationships are internally consistent and timing is attributed to either an applicable source or an illustrative profile.
- **Presentation:** materials, lighting and camera motion improve readability without implying unsupported engineering precision.
- **Physics:** directional tracers illustrate flow. Pressure, temperature, stress and flow-rate claims require a separate mathematical model and validation. CFD/FEA are deferred studies, not implicit promises of the first release.

Every module must have an inventory, source references, assumption register, stable IDs, interfaces, appropriate CAD/operation checks, a browser asset, a teaching view and an integration result before being marked complete. An unknown can remain if it does not invalidate the lesson and is clearly labelled; a critical fit/timing conflict blocks the corresponding claim or feature.

## How we stay aligned

- Maintain this roadmap as the scope reference; keep detailed technical architecture in the root README.
- Keep one active work package and a short next-up list. Record new ideas in the parking lot before inserting them into active work.
- At the start of a package, state its intended outcome, dependencies and acceptance checks. At completion, show the artifact and report what changed, what was tested, remaining assumptions and the next step.
- The assistant handles routine implementation, reversible fixes and checks within the authorized package. Instructor judgement is needed for learning priorities, ambiguous manual interpretation and accepting substantive fidelity compromises. Bundle these at meaningful review points.
- Update decisions and milestone status when scope changes. A working preview is not a claim that a milestone has passed every gate.
- Give each published release an asset/catalogue/operation version. Keep the prior working release until the next is validated. Drive sync alone is not a release approval or atomic multi-file publication mechanism.

## Decisions already established

Credential decision: [ADR 001 — restricted public Drive browser key](decisions/001-public-drive-browser-key.md). The project owner accepts the quota-abuse trade-off and defers a server proxy. Monitoring is a documented manual procedure, not an installed automated monitor.

| Decision | Basis |
|---|---|
| FreeCAD owns dimensions; Blender owns presentation | User direction |
| Manual-grounded realism with visible assumptions | User direction |
| GitHub Pages website; existing synced Drive for model assets | User direction and successful API delivery test |
| Dedicated restricted standard Drive API browser key in reused Cloud project | User selection; initial load verified |
| Stable component IDs connect geometry, names/functions and lessons | Current 60-part proof and scalable design requirement |
| Soft background music for presentation videos; user-controlled audio on the web | User preference; browser playback needs an explicit user action |
| Finish and validate one cylinder workflow before broad expansion | Proposed sequencing for this roadmap |

## Parking lot and later possibilities

Exploded assembly sequences; synchronized piston position/velocity plots; documented valve-overlap diagrams; gear-ratio views; oil and cooling pathways; dual-ignition demonstrations; clearance/wear studies; narrated tours; multilingual captions; offline lesson packs; quizzes; AR/VR; validated thermodynamic/CFD/FEA studies.

Choose these by learning value, available source evidence, dependency readiness and device cost. Student accounts, grade storage and LMS integration are outside the initial public teaching release unless separately requested.

## Open decisions for the first review

- Which learning outcomes should students master first: component identification, cycle explanation or maintenance inspection? Working default: identification, then cycle explanation.
- Confirmed target: Google Chrome on Samsung Galaxy A16. The M1 physical-device gate is complete; use the [release checklist](galaxy-a16-release-check.md) for M2/M3 loading, motion and release observations.
- Confirmed reference family: GTSIO-520, using the current `gtsio520_series.pdf`. Retain the current GTSIO-520-H study configuration and check variant/revision applicability for each full-engine subsystem.

These questions do not prevent the initial explorer and evidence-inventory work. Performance targets and calendar estimates should be set from the measured baseline rather than invented now.

## Implementation history (earlier status statements are superseded by the active package above)

The active package is 1. Delivered so far: component name/function search, download progress, source/review status, and a movable section view with three axes and reversible cut side. Section view works with selection/ghost isolation; Show assembly restores the complete model. The desktop model remains visible while scrolling the inspection controls. Browser checks covered section rendering, piston isolation, keyboard slider adjustment and reset. Physical-phone testing, material polish, optional music and the performance baseline remain open; M1 is not complete.

The section now fills the cut faces of opaque parts using per-mesh stencil passes, following the [Three.js solid clipping example](https://github.com/mrdoob/three.js/blob/r180/examples/webgl_clipping_stencil.html). This corrects the hollow-shell appearance of the initial uncapped cut. Actual cavities remain open; ghosted surrounding parts omit caps. It is a display section, not a dimensional measurement, and depends on closed, consistently oriented source meshes. Choose cut faces through the component list; surface picking excludes the removed half-space.

Inspection colours distinguish intake, exhaust and other parts without claiming verified material specifications; original CAD colours remain selectable. Narrow-screen layouts keep the model above the scrolling controls. Browser preview checks cover filled piston sections, appearance switching and selection; representative physical-phone performance is still pending. Section filling adds rendering work and needs that device baseline before M1 sign-off.

Full-screen inspection now includes a normal-view toggle and optional hidden controls, preserving camera and selection. Browsers without the Fullscreen API use an expanded in-page view. Six teaching groups combine with name/function search: cylinder structure, piston/rings/pin, crank/connecting rod, intake valve train, exhaust valve train and spark plugs. These organize the current study and are not manufacturer parts-list classifications. Desktop checks cover full-screen entry/return, hidden controls, retained piston isolation and combined search; broad phone coverage remains open. Next work: optional audio, device/performance baseline and the shared operation profile needed for M2.



Valve-train preparation: native valve axes, rocker pivots, pushrod endpoints/socket centres and spring envelopes are extracted in `data/valve-frames.json`. Both static ball/socket alignment checks pass. [The valve-train review](valve-train-review.md) records the A-3-1 manual check and distinguishes functional evidence from reconstructed dimensions. The next geometry task is rocker/valve contact and full-lift clearance; the old video's 7 mm lift and 22 mm lever must not be treated as manufacturer specifications.

M2 first mechanism preview: play/pause, three teaching speeds, 0–720° scrubbing and reset now drive piston, rod and crank through the CAD-derived motion contract. `scripts/build_web_motion.py` generates the web profile from the verified CAD and GLB records. SHA-256 mismatch disables motion while retaining static inspection. Motion applies group changes relative to the verified bind pose and updates section stencil matrices. Numerical tests match all eight CAD poses, rod joint closure, stroke and cycle closure; browser checks cover playback, paused scrubbing, 0/180/720° positions and isolated piston section faces. This is not the complete four-stroke lesson: valves remain closed, and combustion/flow cues are absent. Next: extract valve/rocker/pushrod joint frames, review their source basis, then synchronize the valve train.

Loading-reliability follow-up: an HTTP 200 followed by a body-stream abort revealed that the viewer's fixed 120-second deadline could terminate a slow but active download. This is a plausible contributor, not proof of the reported abort's cause. Transfers now time out after 120 seconds without progress, offer explicit cancellation, and retry transient network/abort failures once from the beginning. Authorization and invalid-file errors are not retried. GLB declared length must match received bytes before parsing. Timer tests cover continuing progress, idle timeout, cancellation and cleanup. Motion integration remains the next package after this reliability correction.

M2/M3 foundation started: [shared motion profile](motion-profile.md) exports current CAD dimensions, source annotations, four group frames and 60 IDs. Eight crank-angle poses agree with CAD joint placements. The current GLB bind pose is separately verified at 36 degrees and tied to its hash; CAD inspection is 35 degrees. No browser operating animation is published yet. Next: apply the verified slider-crank transforms to the web model with play/pause/scrub controls, keep stencil matrices synchronized, then extract and review valve-train frames before adding valve motion and flow cues.

Optional Quiet Workshop background music is now implemented with explicit play/pause and volume controls. The 120-second, 1.44 MB excerpt is generated from the original score by `scripts/build_web_music.py`; this small web presentation asset is served with Pages, while large models and source media remain in Drive. The audio URL is assigned only on Play; it does not compete with the initial model download unless requested. Physical-device audio/performance checks and the evidence audit remain open. Next engineering package: extract CAD dimensions and joint frames into the shared operation profile before adding M2 mechanism animation.

M1 loading feedback now includes a download percentage and progress bar. If Content-Length is absent, the viewer queries the current Drive file's `size`; if neither is available it explicitly reports an unknown total. Completion is followed by a separate preparation stage. Loading details record elapsed download (including any metadata lookup), preparation/first render submission, viewport and pixel ratio. These are per-session diagnostics, not uploaded telemetry or a completed device benchmark; network/cache conditions and physical-device interaction still need recording. The size source is the [Drive files metadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

