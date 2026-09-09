# 4212PistonEngine — project roadmap

Planning baseline: 9 September 2026. This is the proposed working roadmap; sequence and scope can be revised with the instructor. Milestone completion is based on evidence, not elapsed time. Calendar dates will follow a representative module build and review.

## Purpose and intended experience

Build a manual-grounded, interactive piston-engine teaching platform for module 4212. A student should be able to locate and identify components, explain their functions, follow the four-stroke cycle and connected engine systems, inspect relationships and clearances, and check understanding through guided activities.

The long-term deliverable is one cumulative engine assembled from reusable, independently reviewable subsystems. It must support both free exploration and structured lessons. FreeCAD remains the dimensional design master; Blender supplies presentation and animation; GitHub Pages supplies the learning interface; the existing synced Google Drive stores model and media assets, with the Drive API supplying browser models.

The initial engineering reference is the current GTSIO-520-H study. Engine variant, document revision and applicable configurations must be checked before expanding. General four-stroke explanations can be shared across variants; variant-specific dimensions and timing must remain separate.

## Current baseline

| Area | Verified now | Remaining work |
|---|---|---|
| CAD | Detailed single-cylinder study: 60 bodies and 284 constrained sketches; selected geometry/motion checks completed | Audit reconstructed features and interfaces; not a validated complete engine |
| Blender | Editable presentation scenes; assembly orbit, illustrative cycle and 60-component tour videos | Web-compatible operation data and animation; polish and refinement |
| Audio | Soft original Quiet Workshop score in video versions; silent versions retained | Optional website playback and controls |
| Website | GitHub Pages loads the 24.1 MiB GLB through restricted Drive API; all 60 IDs present; orbit, zoom, selection, functions and ghost isolation verified in browser | Operating animation, evidence display, lessons, mobile validation and optimization |
| Evidence | Manual procedure, seed component catalogue and example claims | Complete claim review for the first release; resolve critical unknowns |
| Pipeline | Individual export/update scripts and working Drive synchronization | One reproducible build, versioned release manifest, rollback and CAD-edit propagation proof |

Live prototype: https://gideonamani.github.io/4212PistonEngine/

## Milestones and release gates

| Milestone | Deliverable | Completion evidence |
|---|---|---|
| M0 — delivery proof | Static cylinder in a browser, served from synced Drive through the API | Completed: successful load and component interaction. Broader device coverage remains in M1. |
| M1 — usable cylinder explorer | Readable inspection materials, reliable loading/retry, component groups/search, select/isolate/reset, section view, evidence status and optional music | All 60 catalogue entries accessible; desktop and one representative phone tested; controls usable by keyboard; no sign-in/manual file saving; selected interior parts clearly visible. Record asset size, first-load time and interaction performance. |
| M2 — operating cylinder lesson | Play/pause, speed, crank-angle scrub, stroke labels, synchronized piston/rod/crank and valve motion, intake/combustion/exhaust cues | One 720-degree state drives the mechanism; pause/scrub/resume agree; agreed poses match CAD/operation data; no jumps at loop boundary. Illustrative gas flow and timing are explicitly labelled. Instructor reviews the learning sequence. |
| M3 — reproducible update pipeline | CAD export manifest, shared operation profile, Blender refresh/export, validation and versioned publication to synced Drive + Pages | On a disposable CAD copy, a fin change and a rod-length change reach Blender and browser; stable IDs, labels, materials and motion remain correct. Release names/hashes match; failed validation prevents promotion; previous release can be restored. |
| M4 — whole-engine foundation | Engine coordinate system, crankcase/crankshaft/bearings, cylinder mounting stations and reusable cylinder instances | Applicable manual evidence and interface register reviewed; modules fit at their datums; cylinder orientation, crank phases and firing sequence verified; no independent hand-maintained cylinder copies. |
| M5 — connected subsystems | Cam/valve train, reduction/accessory drives, induction/fuel, ignition, exhaust, lubrication and cooling lessons | Each subsystem passes the common module checklist and integrates into the cumulative engine. Shared crank-angle state and explicit fluid/power connections remain consistent. |
| M6 — teaching release | Guided lessons, identification and sequence exercises, self-check feedback, instructor notes and fallback media | Representative classroom trial; explanations and assessment answers reviewed; device/loading findings addressed; coherent engine release and documented remaining approximations. |

M1 and the data-contract work in M3 can develop together. M2 depends on the shared operation profile; M3 is a required gate before substantial M4/M5 expansion. Integrate after each module instead of postponing assembly until the end.

## First three work packages

1. **Explorer usability and release inventory.** Review the current cylinder visually, improve materials/framing and loading feedback, group the 60 components, surface evidence categories, and measure a desktop/phone baseline. Preserve stable IDs during any mesh optimization.
2. **Motion contract and four-stroke lesson.** Extract the required CAD dimensions and joint frames; define a versioned operation profile; connect web controls and phase cues. Begin with the clearly labelled illustrative profile already used in the videos. Manufacturer timing is a separate evidence task.
3. **Change propagation and first teaching review.** Exercise the two controlled CAD changes, check exported poses and catalogue identity, package a versioned release, and review the single-cylinder lesson before authoring the next subsystem.

The active package is 1. Delivered so far: component name/function search, download progress, source/review status, and a movable section view with three axes and reversible cut side. Section view works with selection/ghost isolation; Show assembly restores the complete model. The desktop model remains visible while scrolling the inspection controls. Browser checks covered section rendering, piston isolation, keyboard slider adjustment and reset. Physical-phone testing, material polish, optional music and the performance baseline remain open; M1 is not complete.

The section now fills the cut faces of opaque parts using per-mesh stencil passes, following the [Three.js solid clipping example](https://github.com/mrdoob/three.js/blob/r180/examples/webgl_clipping_stencil.html). This corrects the hollow-shell appearance of the initial uncapped cut. Actual cavities remain open; ghosted surrounding parts omit caps. It is a display section, not a dimensional measurement, and depends on closed, consistently oriented source meshes. Choose cut faces through the component list; surface picking excludes the removed half-space.

Inspection colours distinguish intake, exhaust and other parts without claiming verified material specifications; original CAD colours remain selectable. Narrow-screen layouts keep the model above the scrolling controls. Browser preview checks cover filled piston sections, appearance switching and selection; representative physical-phone performance is still pending. Section filling adds rendering work and needs that device baseline before M1 sign-off.

Full-screen inspection now includes a normal-view toggle and optional hidden controls, preserving camera and selection. Browsers without the Fullscreen API use an expanded in-page view. Six teaching groups combine with name/function search: cylinder structure, piston/rings/pin, crank/connecting rod, intake valve train, exhaust valve train and spark plugs. These organize the current study and are not manufacturer parts-list classifications. Desktop checks cover full-screen entry/return, hidden controls, retained piston isolation and combined search; broad phone coverage remains open. Next work: optional audio, device/performance baseline and the shared operation profile needed for M2.

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
- Which representative student phone and classroom connection should define the performance baseline?
- Which manual revision/configuration governs the full-engine assembly beyond the existing cylinder study?

These questions do not prevent the initial explorer and evidence-inventory work. Performance targets and calendar estimates should be set from the measured baseline rather than invented now.
