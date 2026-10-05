# Documentation index

Every document here is either a **guide**, kept accurate as the project changes, or a **record**, a dated review, experiment or
report that says what was true on its date and is not updated. A test (`scripts/test_docs_fresh.mjs`) holds the guides to that: they may
not point at files that no longer exist, link to documents that are not there, or name things the app has retired. Add a new document to
the table below, as a record unless you intend to maintain it.

Where the truth lives, in order: the code and the lesson packs (`src/`, `web/*-lessons.json`), then `README.md` (how to run, test and
publish), then `AGENTS.md` (storage and validation rules), then the guides here.

| Document | Kind | What it is |
|---|---|---|
| [README.md](README.md) | index | This index. |
| [ROADMAP.md](ROADMAP.md) | guide | Milestones, what is done and what is next. |
| [lesson-and-assessment-architecture.md](lesson-and-assessment-architecture.md) | guide | How lesson packs, steps, checks and progress are structured, with the decisions behind them. |
| [explore-mode-content-architecture.md](explore-mode-content-architecture.md) | guide | The component and group tree behind Explore mode. |
| [explore-section-isolation.md](explore-section-isolation.md) | guide | Section faces and sub-assembly isolation in Explore. |
| [mode-shell-viewer-separation.md](mode-shell-viewer-separation.md) | guide | The shared 3D viewer and how the app shell uses it. |
| [engine-platform-architecture.md](engine-platform-architecture.md) | guide | How more engines and modules plug into the same app. |
| [card-thumbnails.md](card-thumbnails.md) | guide | How course, lesson and Explore card images are built from `sources.json`. |
| [model-optimization.md](model-optimization.md) | guide | The optimised model release: method, measured results, and the manual publishing step. |
| [release-rollback.md](release-rollback.md) | guide | Release snapshots and how to roll back. |
| [reviewed-cylinder-release.md](reviewed-cylinder-release.md) | guide | The reviewed operating-cylinder release in Explore and lesson steps. |
| [saved-assembly-motions.md](saved-assembly-motions.md) | guide | The saved assembly motions of the cylinder. |
| [motion-profile.md](motion-profile.md) | guide | The shared cylinder motion profile. |
| [export-pipeline.md](export-pipeline.md) | guide | The repeatable CAD and Blender export package. |
| [manual-workflow.md](manual-workflow.md) | guide | From a manual to a modelled, animated teaching module. |
| [accessories-and-drives.md](accessories-and-drives.md) | guide | The accessories and drives lesson and its model. |
| [assembly-interference.md](assembly-interference.md) | guide | Parts touch but never overlap: the gear train, the CAD checks and the swept audit that enforce it. |
| [galaxy-a16-release-check.md](galaxy-a16-release-check.md) | guide | The release check to run on a Samsung Galaxy A16 in Chrome. |
| [accessory-shape-review.md](accessory-shape-review.md) | record | Manual illustration and model shape audit, 3 October 2026. |
| [cycle-cues-reference.md](cycle-cues-reference.md) | record | Operating-cycle cue reference, 12 September 2026. |
| [cycle-preview-verification.md](cycle-preview-verification.md) | record | Operating-cylinder preview verification, 11 September 2026. |
| [drive-delivery-test.md](drive-delivery-test.md) | record | The Google Drive delivery experiment, 8 September 2026. |
| [full-engine-web-preview.md](full-engine-web-preview.md) | record | Six-cylinder operating-engine web preview, 29 September 2026. |
| [history-lessons-content-draft.md](history-lessons-content-draft.md) | record | History and terminology lessons, content draft. |
| [housing-clearance-review.md](housing-clearance-review.md) | record | Rocker housing clearance correction, 10 September 2026. |
| [lessons-4-8-production-plan.md](lessons-4-8-production-plan.md) | record | Production plan and notes for lessons 4 to 8. |
| [m2-operating-cylinder-learning-design.md](m2-operating-cylinder-learning-design.md) | record | Learning design proposed for the operating cylinder, 21 September 2026. |
| [m4-whole-engine-audit.md](m4-whole-engine-audit.md) | record | Whole-engine contract and export audit, 12 September 2026. |
| [model-download-optimization.md](model-download-optimization.md) | record | Lossless model download by gzip, 12 September 2026 (superseded by model-optimization.md). |
| [overnight-lesson-preparation-report.md](overnight-lesson-preparation-report.md) | record | Lesson preparation and browser review report, 29 September 2026. |
| [pushrod-layout-study.md](pushrod-layout-study.md) | record | Pushrod layout correction study, 10 September 2026. |
| [spring-animation.md](spring-animation.md) | record | CAD-derived spring compression, 11 September 2026. |
| [spring-seat-review.md](spring-seat-review.md) | record | Spring-seat candidate review, 10 September 2026. |
| [valve-train-review.md](valve-train-review.md) | record | Valve-train motion preparation, 10 September 2026. |

Other folders: `docs/decisions/` holds numbered decision records, `docs/operations/` operating notes, `docs/paper-mockups/` and
`docs/ui-concepts/` design references.
