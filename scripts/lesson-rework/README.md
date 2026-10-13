# Lesson rework tools

Small command-line tools used to rework lessons in the hand-formatted packs `web/*-lessons.json` without reformatting them. They edit the pack as text, so a lesson's diff shows only what changed. Run everything from the repository root. The method, the rules and the traps are in `.claude/skills/lesson-rework/SKILL.md`.

| Tool | What it does |
|---|---|
| `show.mjs <pack> <lesson id> [--notes] [--checks] [--sources]` | Prints a lesson readably, with step indexes. |
| `dry_run.mjs <pack> <draft>` | Applies a draft to a copy of the pack and checks it against the lesson rules. Read its last line: `dry run clean` or `PROBLEMS:`. |
| `apply_lesson.mjs <pack> <draft>` | Replaces one lesson's steps, checks, completion criteria and the pack's source registry. Apply once; a draft that exports `EXPECTED_STEP_COUNT` refuses a second application. |
| `patch_pack.mjs <pack> <patch module>` | In-place fixes after applying: `api.step(lessonId, index, fn)`, `api.check(id, fn)`, `api.source(id, fn)`, `api.addSource(obj)`. |
| `register_media.mjs <module>` | Registers figure crops (`figure-sources.json`) and credits (`attribution.json`) as text. |
| `to_webp.py <in> <out.webp> [max width]` | Converts a downloaded picture to a lesson WebP. Run it as `python -E -P`, with the input in its own folder. |
| `shot.mjs <outdir> <width> <height> <scheme> <hash>...` | Screenshots lesson steps from the dev server on port 5199. |
| `pg.mjs`, `findpage.mjs` | Read pages, or find the page of a phrase, in a `pdftotext` file (pages separated by form feeds). |

Drafts (`lessonN-content.mjs`) and patches are working files: keep them in `.local/lesson-rework/`, which Git ignores. `.claude/skills/lesson-rework/lesson-template.mjs` shows the shape of a draft.

`scripts/test_lesson_rework_tools.mjs` runs the apply and show tools on a copy of a real pack.
