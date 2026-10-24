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
| [lesson-objectives.md](lesson-objectives.md) | guide | What each of the 18 lessons is for and what a learner should be able to do at its end, in the instructor's words, generated from the lesson packs by `scripts/build_objectives_guide.mjs`. |
| [explore-mode-content-architecture.md](explore-mode-content-architecture.md) | guide | The component and group tree behind Explore mode. |
| [explore-section-isolation.md](explore-section-isolation.md) | guide | Section faces and sub-assembly isolation in Explore. |
| [mode-shell-viewer-separation.md](mode-shell-viewer-separation.md) | guide | The shared 3D viewer and how the app shell uses it. |
| [engine-platform-architecture.md](engine-platform-architecture.md) | guide | How more engines and modules plug into the same app. |
| [card-thumbnails.md](card-thumbnails.md) | guide | How course, lesson and Explore card images are built from `sources.json`. |
| [model-optimization.md](model-optimization.md) | guide | The optimised model release: method, measured results, and the manual publishing step. |
| [release-rollback.md](release-rollback.md) | guide | Release snapshots and how to roll back. |
| [manual-workflow.md](manual-workflow.md) | guide | From a manual to a modelled, animated teaching module. |
| [galaxy-a16-release-check.md](galaxy-a16-release-check.md) | guide | The release check to run on a Samsung Galaxy A16 in Chrome. |
| [drive-delivery-test.md](drive-delivery-test.md) | record | The Google Drive delivery experiment, 8 September 2026. |
| [history-lessons-content-draft.md](history-lessons-content-draft.md) | record | History and terminology lessons, content draft. |
| [lessons-4-8-production-plan.md](lessons-4-8-production-plan.md) | record | Production plan and notes for lessons 4 to 8. |
| [m2-operating-cylinder-learning-design.md](m2-operating-cylinder-learning-design.md) | record | Learning design proposed for the operating cylinder, 21 September 2026. |
| [model-download-optimization.md](model-download-optimization.md) | record | Lossless model download by gzip, 12 September 2026 (superseded by model-optimization.md). |
| [overnight-lesson-preparation-report.md](overnight-lesson-preparation-report.md) | record | Lesson preparation and browser review report, 29 September 2026. |
| [wright-reconstruction-lessons.md](wright-reconstruction-lessons.md) | record | Adding the 413-part Wright engine to Explore: what went wrong, what we built, what the engineering skills now ask for, 6 October 2026. |
| [lesson-coverage-audit-2026-10-12.md](lesson-coverage-audit-2026-10-12.md) | record | Each lesson read against the instructor's outcomes: what is covered, partial and missing, and the order for the rework, 12 October 2026. |

The CAD reconstruction, export, audit and release documents (export pipeline, motion profile, part store, assembly interference,
fidelity classes, constraints, the FreeCAD/Blender boundary, the study rig and the dated CAD reviews) moved with the CAD work to the
EngineReverseEngineering_MEDIS repository on 24 October 2026.

Other folders: `docs/decisions/` holds numbered decision records, `docs/operations/` operating notes, `docs/paper-mockups/` and
`docs/ui-concepts/` design references.
