# GTSIO-520-H part details

What a learner reads when they tap a part of the GTSIO-520-H whole engine (the "reconstruction draft" card in Explore), how that text is
written and sourced, and how to change it. It covers the R10 model only (`gtsio520-h-r10-mechanism-study`); no other model reads any of it.

## What a learner sees

Tapping a part (or choosing it in Parts) opens the part card. Its heading is the part's plain name with what tells it apart from the others
of its kind: `Valve lifter body · cylinder 1 · intake`, `Screw · camshaft gear · no. 2`. Under it are one sentence on what the part does
and a **Draft text** chip. Details adds what it is made of, where it sits, the system it belongs to, the lessons that mention it, the parts
it works with, one "look for" prompt, the parts-catalogue wording (tagged as the IO-520 book unless the GTSIO manual confirms it) and a
folded list, "Where this text comes from", that gives the evidence for every line. The Parts search also finds a part by the other names
a learner knows it by (tappet for valve lifter, quill for quill shaft) and by its catalogue noun.

No part number is ever shown. The catalogue for this engine (Form X-30046A) is not available, and the IO-520 numbers that stood in for
it had errors.

## The files

| File | What it is |
|---|---|
| `data/gtsio520-part-definitions.json` | The single source: one definition per kind of part (188 cover all 1,396 parts). Each has a `student` block (what a learner may read once reviewed), an `engineering` block (the GTSIO manual figure keys and the alignment result and note; never shipped), and the id patterns that say which parts it covers. Generated; do not edit by hand. |
| `scripts/gtsio_part_authoring/` | The scripts that write it. The words are in `defs_*.py` (by system), the id patterns in `patterns.py`, the review state in `reviewed.py`. `assemble.py` validates and writes the file. |
| `data/gtsio_part_authoring/` | The committed source snapshots the scripts read: the GTSIO manual figure keys and the model's materials. |
| `data/gtsio_part_authoring/private/` | **Not in Git** (ignored): the IO-520 catalogue rows and what goes with them. See below. |
| `web/gtsio520-r10-parts.json` | What ships: the `student` fields only, plus a table from each part id to its definition and instance label. Built by `scripts/build_gtsio_part_details.mjs`, which also keeps the `?v=` token on `partDetailsUrl` in `src/data/models.json` in step. |
| `src/data/learnerPartDetails.ts` | Loads the shipped file and answers "what do I show for this part id". A missing, broken or mis-scoped file is ignored and the model opens with its contract labels. |
| `src/viewer/PartCard.tsx`, `src/viewer/adapters/animatedStudyAdapter.ts` | The card, and the adapter that names the Parts list from the details. |

The shipped model contract (`web/gtsio520-r10-contract.json`) carries none of it. The earlier register (display labels, IPC part numbers,
material specs, a per-part description) was removed from the contract in one scripted pass.

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
| `data/gtsio_part_authoring/private/definitions-engineering.json` | Written by `assemble.py --write` when the files above are present: the full engineering block with the resolved catalogue rows. |

The committed file records only what the rows showed: the alignment result and its note (no part numbers). With the private files present,
`assemble.py` resolves each definition's rows and fails if an alignment result disagrees with them (a catalogue row and a manual key give
*confirmed*; a manual key alone gives *gtsio_only*; a row alone gives *io520_only*). Without them it says so and checks the committed
fields only, which is what CI does. Copy the private folder when you move to a new checkout; it cannot be recovered from Git.

A test fails if the catalogue rows file or anything in the private folder is ever tracked, or if a part number, a catalogue row key or a mention
of the retired H1B capture appears in the committed definitions, the shipped file or the authoring scripts.

The GTSIO-520-H1B online capture that is in `cad-studies/gtsio520-h-realism/` is not used by any of this.

## How the text is written

- **Title.** The part noun from the IO-520 parts catalogue, in plain order, four words at most (`Stud, 3/8 x 3-3/16 inch long` is `Stud`;
  `Cover, Valve Rocker` is `Rocker cover`). Where the IO-520 book has no row, the figure key in the GTSIO-520 overhaul manual gives the
  name by the same rule. When several kinds of part share a noun (nine different `Screw`s), a short `context` ("camshaft gear") tells
  them apart.
- **Claims and their status.** Every line is a claim with a status and its evidence. *Specified*: a source states it. *Derived*: worked
  out from a source by a stated step. *Inferred*: reasoned, with its basis, but in no source read; these are the lines to check first.
  *Illustrative*: the "look for" prompt, which claims nothing about the engine. Specified and derived claims name their source (the manual
  section, the lesson, the catalogue); inferred and illustrative ones give a basis. A guess is never recorded as a source.
- **Numbers** appear only where a lesson or the manual gives them. Specifications (material standards, treatments, hardness, pressures)
  stay out of the plain lines.
- **Sizes and descriptions from the IO-520 book** go in the catalogue line and are tagged "the GTSIO-520-H may differ".
- **Vocabulary** follows the lessons (tappet, pushrod, quill shaft, reduction gear, dynamic damper), kept as aliases where the catalogue
  noun differs.

The engineering block records, for each definition, the GTSIO manual figure keys and an alignment result: *confirmed* (named in both the
IO-520 catalogue and the manual), *gtsio_only*, *io520_only*, *mismatch* (the books and the model disagree, as where the model draws a
bolt and the books list a stud) or *not_found*, with a note.

## Changing the text

1. Edit the words in `scripts/gtsio_part_authoring/defs_*.py` (or the patterns in `patterns.py`).
2. `python scripts/gtsio_part_authoring/assemble.py --write` validates and rewrites the definitions file.
3. `node scripts/build_gtsio_part_details.mjs` rewrites the shipped file and the registry token.
4. `node --test scripts/test_gtsio_part_definitions.mjs scripts/test_part_metadata.mjs` checks the rules (below).

Both writers have a `--check` mode that fails when a file is out of date; the tests run them.

**Review.** `python scripts/build_gtsio_part_review_sheet.py` writes a Word sheet (not committed) listing, for every definition, what a
learner would read, the evidence behind each line, the alignment result and an empty comments column; with the private files present it
also names the catalogue page, figure and item for each row. A definition ships as a draft until its id is added to `REVIEWED` in
`scripts/gtsio_part_authoring/reviewed.py`; the "Draft text" chip then goes away for it.

## What the tests hold

`scripts/test_gtsio_part_definitions.mjs`: every definition meets the text rules (title length, one-sentence limits, a source or a basis
for every claim, "look for" is illustrative); every part id maps to exactly one definition and every definition covers a part; no two
parts share a label; the learner text contains no part numbers, specifications or placeholder words; no JSON in `web/` or build in `dist/`
contains the engineering block; the catalogue rows stay out of Git; the definitions file is exactly what the authoring scripts produce.
When the private files are present it also checks the known catalogue errors and every alignment result against the rows; otherwise it
skips those checks and says so.

`scripts/test_part_metadata.mjs`: only the R10 registry entry has `partDetailsUrl` and its token matches the built file; the learner file
names every contract part; a file for another model, or a broken one, is ignored; no other model's data repeats the learner text; the
card prints no part number and says when text is a draft; the contract carries none of the retired part references.

`e2e/part-details.spec.ts` opens the model, finds a part by an alias, and reads the card as a learner would.

## Other source snapshots

- `data/gtsio_part_authoring/gtsio_keys.json`: the figure keys of the GTSIO-520 overhaul manual (Form X-30045A, figures A-4-8 to A-4-20),
  read from its text layer and corrected against the page images (`keys.py` holds the corrections).
- `data/gtsio_part_authoring/glb_materials.json`: each part's material name in the exported model.
- Lesson mentions are counted from the lesson packs in `web/` each time the scripts run.
