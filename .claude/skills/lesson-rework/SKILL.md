---
name: lesson-rework
description: Rework, extend or review a lesson in a hand-formatted lesson pack (web/*-lessons.json) against the instructor's outcomes. Audit coverage, draft sourced steps and checks, validate on a copy, apply once, test, look at it in the browser, commit. Use when asked to rebuild, improve, add or check a lesson.
---

The outcomes the instructor wrote are the specification. A lesson is finished when every outcome has a step that teaches it, every claim says where it comes from, and the checks test the outcomes. Read `docs/lesson-coverage-audit-*.md` (per-lesson coverage tables and the decisions already made) and the project memory note on this work first. The tools are in `scripts/lesson-rework/` (see its README); the sources method is in the `lesson-sources` skill, pictures in `lesson-figures`, interactives in `lesson-interactive`.

## Method

1. **Orient.** `git status`. Stage only your own files, by explicit path: the user's uncommitted records (`.agents/`, `cad_pipeline/`, `cad-studies/wright-1903/`, `AGENTS.md`, `docs/drive-asset-manifest.json`) are theirs. Work on the branch you were given; do not push or open a PR until the user says.
2. **Audit.** For each outcome of the lesson (`node scripts/lesson-rework/show.mjs <pack> <lesson id> --notes --checks`), mark it covered, partial or missing against the steps. Note content that belongs in another lesson. Record the counts in the audit document.
3. **Gather sources before writing** (`lesson-sources`). Find the page for each claim. Decide what you cannot support and either leave it out or label it.
4. **Draft** `.local/lesson-rework/lessonN-content.mjs` (Git ignores `.local/`; copy `lesson-template.mjs` from this folder). Keep the good existing steps with `{ keep: n }`. Set `EXPECTED_STEP_COUNT` to the lesson's current step count so a second application fails.
5. **Validate on a copy:** `node scripts/lesson-rework/dry_run.mjs <pack> <draft> > .local/lesson-rework/dry.log 2>&1; tail -3 .local/lesson-rework/dry.log`. It must end `dry run clean`; otherwise it prints `PROBLEMS:`. A pipe to `tail` inside an `&&` chain hides the failure, so read the last line yourself.
6. **Apply once:** `node scripts/lesson-rework/apply_lesson.mjs <pack> <draft>`. Later fixes go through `patch_pack.mjs` with a small patch module; never apply the draft again (`keep` would index the new steps).
7. **Test.** Run the content tests to a log and check the exit code before any commit: `node --test scripts/test_syllabus_lessons.mjs scripts/test_general_lessons.mjs scripts/test_lesson_pack.mjs scripts/test_pack_mapping.mjs scripts/test_content_schema.mjs scripts/test_lesson_objectives.mjs scripts/test_lesson_paragraphs.mjs scripts/test_lesson_text.mjs scripts/test_unified_gallery.mjs scripts/test_lesson_media.mjs scripts/test_credits.mjs scripts/test_model_click_questions.mjs > log 2>&1; echo $?`. Never chain `git commit` after a `grep` of test output: `grep` succeeds when it finds the summary line even if a test failed.
8. **Look at it.** Start the dev server (`vite` on port 5199), screenshot the new steps with `scripts/lesson-rework/shot.mjs` and open the PNGs. Check that each 3D pose shows what the text says (a closed-up cylinder hides the piston; the cylinder model uses idealised valve timing with no overlap, so it cannot show overlap). Label anything the model only illustrates.
9. **Browser regression** in the background, `--workers=1`, one project at a time: `npx playwright test --workers=1 --project=phone-360`. Do not edit `src/` or `web/` while it runs. Many specs run on one or two projects only (`onlyIn(...)` at the top of each spec): `focus-switch`, `smoke`, `syllabus-courses`, `layout`, `model-cache`, `viewer-controls` and `production` on phone-390; `lesson-text`, `lesson-opener` and `self-check` on phone-320 and phone-390; `accessibility` on phone-360 and tablet-768. CI runs all four projects, so running only phone-360 and tablet-768 leaves those specs untested. When a rework adds, removes or moves steps, also run phone-390 and phone-320 (or at least the specs listed) before you push. If one test fails with "Execution context was destroyed", rerun that spec alone before you suspect the change.
10. **Commit** one commit per lesson (the audit-document update as a second commit), message ending `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Then update the audit document's Progress section and the project memory note.

## Rules the tests hold every lesson to (`scripts/test_syllabus_lessons.mjs`)

- Step prompt of 150 words or fewer; title of 40 characters or fewer; every step has `note` (what it is documented from, with page locators, and what is the lesson's own inference), `sourceRefs` that exist in the pack's `sources`, and a `mediaPlan`.
- At least 8 checks of at least 3 kinds, each with a `hint` and a `rationale`; numeric checks always have a hint. The correct multiple-choice answer is index 0 in the data. A matching question whose right-hand column is already alphabetical gives its answer away, so reorder it.
- Lessons stay `Instructor review pending` until the instructor says otherwise; do not claim a review.
- Check ids are unique; model-click ids must exist on the model (the test reads the real part list).

## Traps already met

- The browser tests hard-code step positions: `valve-operating` steps 2 and 6, `performance-calculations` step 4, `factors-affecting-power` step 2, `accessories-and-drives` step 6, `power-generation` step 2, `practicals` step 1, and `parts-construction` step 5 (`SPOTLIGHT_STEP` in `e2e/viewer-helpers.ts`; `focus-switch.spec.ts` counts the steps after it from that number: a spotlight, a picture, a spotlight). `grep -rn "step/[0-9]\|Step [0-9]" e2e/` before adding, removing or reordering steps in a lesson.
- In Git Bash, heredocs halve doubled backslashes, including a Python script piped in as a heredoc: write anything that contains a regular expression or a `\d` with the file tool, and read the result back. (A `\d` inside a JavaScript template string silently becomes `d`.) Set `MSYS_NO_PATHCONV=1` only with Windows-style paths. Foreground `sleep` is blocked; run long jobs in the background.
- Never `git stash`, `clean` or `reset` in the user's checkout.
- Text claims you could not source (for example "this engine is direct drive" because its name has no G) come out of the lesson or get a plain label; the instructor, not you, supplies the facts about their own labs and rigs. Ask, and record the answer's source in the note.
- A step that depends on a fact only the instructor has (set-up, safety, marking) says so in its note and in the lesson text, and goes on the list of open questions.
