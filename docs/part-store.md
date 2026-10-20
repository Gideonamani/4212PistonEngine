# The part store

What the project knows about each part, kept in one place at three levels, and what a learner reads from it when they tap a part in
Explore. Two models read it so far: the GTSIO-520-H whole engine (`gtsio520-h-r10-mechanism-study`, 1,396 parts) and the operating
cylinder (`cylinder`, 61 parts, the pilot). Every other model still shows the general fallback described at the end.

## Three levels

| Level | What it is | Where it lives |
|---|---|---|
| **Definition** | What a kind of part is: a plain title, what it does, what it is made of, where it sits, what it works with, something to look for, the lessons that mention it. Each claim has a status and a source or basis. A separate engineering block (manual figure keys, the alignment note, the model's materials, retired values) never ships to the browser. | `knowledge/part-cards/parts/definitions/` |
| **Instance** | Which of one model's part ids is which definition, which system it belongs to, any wording of its own, and its own review state. Written as id patterns for a big model and as explicit rows for a small one. | `knowledge/part-cards/parts/instances/` |
| **System** | The flat list a learner filters by (structure, power, gas, ignition, lubrication, output, accessories). No hierarchy. | `knowledge/part-cards/parts/store.json` |

The family cards beside them (`knowledge/part-cards/piston.json` and the others) stay the engineering description of a family and its
variants. A definition may name the variant that describes it in `engineering.variant`. See `knowledge/README.md`.

The design follows decision D9 of the ship-and-scale plan: extend the part cards into one part store rather than start a second one.

## What a learner sees

Tapping a part (or choosing it in Parts) opens the part card. Its heading is the part's plain name with what tells it apart from the others
of its kind: `Valve lifter body · cylinder 1 · intake`, `Screw · camshaft gear · no. 2`, `Compression ring · top groove`. Under it are one
sentence on what the part does and a **Draft text** chip. Details adds what it is made of, where it sits, the system it belongs to, the lessons that
mention it, the parts it works with, one "look for" prompt, the parts-catalogue wording (tagged as the IO-520 book unless the GTSIO manual
confirms it) and a folded list, "Where this text comes from", that gives the evidence for every line.

The GTSIO-520-H card also names its Parts list from these titles, and its search finds a part by the other names a learner knows it by
(tappet for valve lifter, quill for quill shaft). **The cylinder's Parts list keeps the catalogue's names** (`Top compression ring`,
`Crankshaft throw`): lesson 18 and the check questions refer to them. Only the card speaks in the learner's names. Whether to switch the
cylinder's Parts list, spotlight and lesson chips to the learner names is an open decision for the instructor.

No part number is ever shown. The catalogue for this engine (Form X-30046A) is not available, and the IO-520 numbers that stood in for
it had errors.

## Claims, statuses and review

Every line a learner reads is a claim: `{text, status, source | basis}`.

| Status | Meaning | Evidence |
|---|---|---|
| `specified` | A source states it. | `source`: the manual section, the lesson, the catalogue. |
| `derived` | Worked out from a source by a stated step. | `source`, saying the step. |
| `inferred` | Reasoned, but in no source read. These are the lines to check first. | `basis`, saying what it rests on. |
| `illustrative` | A learning prompt ("look for"); claims nothing about the engine. | `basis`. |

A claim never has both a source and a basis, and a guess is never recorded as a source. The old hand-written table is the one place a
fifth status, `unsourced`, exists, and only in `engineering.legacyValues`, which never ships (see below).

Rules the validator holds for the learner text: a title of four words at most with no digits (sizes go in the catalogue line); a shared
catalogue noun gets a short `context` and a unique one has none; one-sentence limits (function 22 words, made-of 8, sits 28, look-for 22);
`worksWith` names one to six other definitions; no part number, specification (material standards, treatments, hardness, pressures),
catalogue row or placeholder text; numbers only where a lesson or the manual gives them.

**Review gates.** Every record is `draft` until the instructor marks it `reviewed` with `reviewed_by` and `reviewed_on` (YYYY-MM-DD). A
reviewed definition may carry no placeholder text and no unsourced legacy value. An instance with wording of its own under a reviewed
definition needs its own review state, and an instance cannot be reviewed under a draft definition. A learner file is `reviewed` only when
every definition it uses (and every review state of its own) is. While any part is a draft, its card shows **Draft text**.

## The files

| File | What it is |
|---|---|
| `knowledge/part-cards/parts/store.json` | The systems and the status rules. |
| `knowledge/part-cards/parts/definitions/gtsio520-h.json` | 191 definitions: the 188 that cover the R10 engine plus 3 the cylinder needs (crankshaft throw, rocker housing, fuel discharge nozzle). A definition enters the store with the model that needs it. |
| `knowledge/part-cards/parts/instances/*.json` | One file per model: where its part ids come from (`idsFrom`), its id `rules` and explicit `parts` rows, and where its learner file is written (`projection`). |
| `cad_pipeline/intent/part_store.py` | The validator (standard library only). `python -m cad_pipeline.intent.part_store` checks the store; `--refresh-lessons` rewrites each definition's lesson mentions from the lesson packs. |
| `scripts/part_store.mjs` | The projection: the learner-only file for one model. Shared by the build script and the tests. |
| `scripts/build_part_details.mjs` | Writes `web/gtsio520-r10-parts.json` and `web/cylinder-parts.json`, and keeps the `?v=` token on each `partDetailsUrl` in `src/data/models.json` in step. `--check` fails when a file is out of date. |
| `src/data/learnerPartDetails.ts` | Loads a shipped file and answers "what do I show for this part id". A missing, broken or mis-scoped file is ignored and the model opens with its own labels. |
| `src/viewer/PartCard.tsx`, `src/viewer/adapters/animatedStudyAdapter.ts`, `src/viewer/adapters/cylinderAdapter.ts` | The card, and the adapters that give it the details (and, for the R10 engine, name the Parts list). |
| `src/data/genericPartInfo.ts` | The general fallback for a model with no details (below). |
| `data/gtsio_part_authoring/` | Committed source snapshots: the GTSIO manual figure keys and the model's materials. Also the private folder (below). |
| `scripts/gtsio_part_authoring/private_check.py` | Cross-checks the store against the private catalogue rows, when they are present. |

### What ships

The learner file is `{schema, model, state, systems, statuses, definitions, parts, overrides?}`: the `student` fields only, plus a table
from each part id to `[definition, instance label]`. When every part of a kind carries the same wording of its own, that wording becomes
the kind's line in that model's file, so the file ships only what a learner can read. Where parts of one kind differ, `overrides` carries
each part's own function, made-of, sits, system or review state. A model with none has no `overrides` key. The shipped model contract
carries none of it.

### Wording of its own

A definition says what a kind of part is in general, and some lines are specific to a model. The R10 engine's material line for a ring
rests on the R10 model's material, which says nothing about the cylinder. The cylinder gives its own lines, with their own evidence, for
those parts (the rings, the rod body and cap, the spark plug shells, insulators and terminals, the valve guides, the exhaust rotocoil
retainer) in the `claims` of its explicit rows. The validator allows only `function`, `madeOf` and `sits` to be overridden.

## Catalogue data kept out of Git

The repository is public, so the transcription of the IO-520 parts catalogue (Form X-30040A) is not committed, and neither is anything
that quotes its part numbers. They live in `data/gtsio_part_authoring/private/`, which Git ignores:

| Private file | What it is |
|---|---|
| `data/gtsio_part_authoring/private/ipc_rows.json` | The catalogue rows read by OCR (page, figure, index, part number, description, quantity). Rebuilt from the page text with `python scripts/gtsio_part_authoring/ipcrows.py <folder of the OCR pages p06.txt ... p101.txt>`. The text-searchable copy of the catalogue is in the course's DigiMan deliverables folder. |
| `data/gtsio_part_authoring/private/ipc_corrections.json` | Rows the parser misses and descriptions it garbles, corrected by hand. |
| `data/gtsio_part_authoring/private/ipc_refs.json` | For each definition, which catalogue rows it rests on (part number, description fragment, page). |
| `data/gtsio_part_authoring/private/prior_contract_parts.json` | The values the contract carried before 18 October 2026 (labels, part numbers, material specs). Unverified, with known errors. |
| `data/gtsio_part_authoring/private/engineering_notes.json` | Notes on where the earlier card was wrong. |
| `data/gtsio_part_authoring/private/definitions-engineering.json` | Written by `private_check.py` when the files above are present: the full engineering block with the resolved catalogue rows. |

The committed store records only what the rows showed: the alignment result and its note (no part numbers). With the private files present,
`python scripts/gtsio_part_authoring/private_check.py` resolves each definition's rows and fails if an alignment result disagrees with
them (a catalogue row and a manual key give *confirmed*; a manual key alone gives *gtsio_only*; a row alone gives *io520_only*). Without
them it says so and the committed fields are the validator's to check, which is what CI does. Copy the private folder when you move to a
new checkout; it cannot be recovered from Git.

A test fails if the catalogue rows file or anything in the private folder is ever tracked, or if a part number, a catalogue row key or a
mention of the retired H1B capture appears in the committed store, a shipped file or the authoring scripts. The GTSIO-520-H1B online
capture in `cad-studies/gtsio520-h-realism/` is not used by any of this.

## How the text is written

- **Title.** The part noun from the IO-520 parts catalogue, in plain order, four words at most (`Stud, 3/8 x 3-3/16 inch long` is `Stud`;
  `Cover, Valve Rocker` is `Rocker cover`). Where the IO-520 book has no row, the figure key in the GTSIO-520 overhaul manual gives the
  name by the same rule. When several kinds of part share a noun (nine different `Screw`s), a short `context` ("camshaft gear") tells
  them apart.
- **Sizes and descriptions from the IO-520 book** go in the catalogue line and are tagged "the GTSIO-520-H may differ".
- **Vocabulary** follows the lessons (tappet, pushrod, quill shaft, reduction gear, dynamic damper), kept as aliases where the catalogue
  noun differs.
- **Sources** are the GTSIO-520 overhaul manual (X-30045A), the IO-520 maintenance manual, the IO-520 parts catalogue (names only), and the
  lesson text for vocabulary. Where a source and the old register disagree, the source wins.

The engineering block records, for each definition, the GTSIO manual figure keys and an alignment result: *confirmed* (named in both the
IO-520 catalogue and the manual), *gtsio_only*, *io520_only*, *mismatch* (the books and the model disagree, as where the model draws a
bolt and the books list a stud) or *not_found*, with a note.

## Changing the text

1. Edit the definition (or the model's instance file) in `knowledge/part-cards/parts/`. The JSON is the source; there is no generator.
2. `python -m cad_pipeline.intent.part_store` validates it. After lesson edits run it with `--refresh-lessons`.
3. `node scripts/build_part_details.mjs` rewrites the learner files and the registry tokens.
4. `node --test scripts/test_part_store.mjs scripts/test_part_metadata.mjs` and `python scripts/test_knowledge_store.py` check the rules.

**Adding a model.** Give it an instance file (`idsFrom` names the file and key its part ids come from), add the definitions it needs
(each must be used by some model), add the `partDetailsUrl` line to its entry in `src/data/models.json`, build, and wire its adapter to
`loadLearnerParts` as `src/viewer/adapters/cylinderAdapter.ts` does. Remove the model from `STILL_ON_THE_FALLBACK` in
`scripts/test_part_metadata.mjs`.

**Review.** `python scripts/build_part_review_sheet.py --model cylinder` (or `--model gtsio520-h-r10-mechanism-study`) writes a Word
sheet, not committed, to the course's `Review sheets` folder: for every kind of part, what a learner would read, the evidence behind
each line, the alignment result and an empty comments column. With the private files present it also names the catalogue page, figure and
item for each row. The cylinder sheet ends with what became of every value in the retired table. A definition ships as a draft until the
instructor sets `review` to `reviewed`, with `reviewed_by` and `reviewed_on`, in its record.

## The retired hand-written table

Until the pilot, the cylinder's part card read a hand-written table (the old component metadata file) for 28 parts: a material line with alloy
specifications and an operating line with loads and temperatures, none with a source. Each of its 56 values was checked against the
GTSIO-520 overhaul manual, the IO-520 maintenance manual and the lesson text, and recorded in `engineering.legacyValues` of the
definition that replaced it, with a status and a fate (`kept` or `dropped`). Most were `unsourced` and are not on the card. Several
contradicted the manuals (H-section against I-beam rods, hollow sodium-filled stems against solid, a check ball against a plate, a
hard facing on the intake valve, the magneto circuit). A reviewed definition may keep no unsourced value, so these must be resolved or
dropped before review. The file is now `src/data/genericPartInfo.ts` and holds no per-part values.

## The general fallback

A model with no learner details shows `src/data/genericPartInfo.ts`: a name from the model, a function default, a system guessed from the
part's id, and one stock material line. The stock line is the same for every part and claims nothing about it. These models are still
on it (pinned in `scripts/test_part_metadata.mjs`): the V5 teaching engine, both Wright models, the Langley study, the hydraulic tappet,
the oil pump and the accessory drives. Giving a model definitions retires the fallback for that model.

## What the tests hold

`python scripts/test_knowledge_store.py`: the store validates; lesson mentions are current; no committed text carries catalogue data; all
61 cylinder ids and all 1,396 R10 ids map to exactly one definition; all 56 retired values are accounted for, with none unsourced value
reaching a learner; and each rule above is mutation-tested, so that a deliberate defect is seen to be rejected.

`scripts/test_part_store.mjs`: every part maps to one definition and every definition is used; no two parts of a model share a label;
learner text is plain with a status and evidence on every claim; learner files carry no engineering block or part number; no JSON in
`web/` or build in `dist/` contains the engineering cross-check; each shipped file is what the store projects; the R10 file is unchanged
by the move into the store (a hash, to be updated in the same pull request as any deliberate R10 text edit); the cylinder's own wording
is what its file says; the catalogue rows stay out of Git; and the Python validator and the build `--check` accept the store. With the
private files present it also checks the known catalogue errors and every alignment result against the rows, and skips those checks
and says so otherwise.

`scripts/test_part_metadata.mjs`: only the R10 and cylinder registry entries have `partDetailsUrl` and their tokens match the built files;
the learner files name every contract part; a file for another model, or a broken one, is ignored; the fallback makes no claim about a
part; the retired table is gone and no source file reads it; no other model's data repeats the learner text; the card prints no part
number and says when text is a draft.

`e2e/part-details.spec.ts` (R10) and `e2e/cylinder-part-details.spec.ts` open the model and read the card as a learner would.

## Other source snapshots

- `data/gtsio_part_authoring/gtsio_keys.json`: the figure keys of the GTSIO-520 overhaul manual (Form X-30045A, figures A-4-8 to A-4-20),
  read from its text layer and corrected against the page images (`keys.py` holds the corrections).
- `data/gtsio_part_authoring/glb_materials.json`: each part's material name in the exported model.
- Lesson mentions are counted from the lesson packs in `web/` each time `--refresh-lessons` runs.
