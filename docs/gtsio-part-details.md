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
| `data/gtsio520-part-definitions.json` | The single source: one definition per kind of part (188 cover all 1,396 parts). Each has a `student` block (what a learner may read once reviewed), an `engineering` block (catalogue cross-check, never shipped), and the id patterns that say which parts it covers. Generated; do not edit by hand. |
| `scripts/gtsio_part_authoring/` | The scripts that write it. The words are in `defs_*.py` (by system), the id patterns in `patterns.py`, the review state in `reviewed.py`. `assemble.py` validates and writes the file. |
| `data/gtsio_part_authoring/` | The source snapshots the scripts read: the IO-520 catalogue rows, the GTSIO manual figure keys, the model's materials, and what the contract carried before it was stripped (see below). |
| `web/gtsio520-r10-parts.json` | What ships: the `student` fields only, plus a table from each part id to its definition and instance label. Built by `scripts/build_gtsio_part_details.mjs`, which also keeps the `?v=` token on `partDetailsUrl` in `src/data/models.json` in step. |
| `src/data/learnerPartDetails.ts` | Loads the shipped file and answers "what do I show for this part id". A missing, broken or mis-scoped file is ignored and the model opens with its contract labels. |
| `src/viewer/PartCard.tsx`, `src/viewer/adapters/animatedStudyAdapter.ts` | The card, and the adapter that names the Parts list from the details. |

The shipped model contract (`web/gtsio520-r10-contract.json`) carries none of it. The earlier register (display labels, IPC part numbers,
material specs, a per-part description) was removed from the contract in one scripted pass and its values live on only in the engineering
block, marked unverified.

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

The engineering block records, for each definition, the matching IO-520 catalogue rows (page, figure, index, part number, description),
the GTSIO manual figure keys, the GTSIO-520-H1B online catalogue rows (provenance unverified; a third cross-check only), and an alignment
result: *confirmed*, *gtsio_only*, *io520_only*, *mismatch* (the books and the model disagree) or *not_found*, with a note.

## Changing the text

1. Edit the words in `scripts/gtsio_part_authoring/defs_*.py` (or the patterns in `patterns.py`).
2. `python scripts/gtsio_part_authoring/assemble.py --write` validates and rewrites the definitions file.
3. `node scripts/build_gtsio_part_details.mjs` rewrites the shipped file and the registry token.
4. `node --test scripts/test_gtsio_part_definitions.mjs scripts/test_part_metadata.mjs` checks the rules (below).

Both writers have a `--check` mode that fails when a file is out of date; the tests run them.

**Review.** `python scripts/build_gtsio_part_review_sheet.py` writes a Word sheet (not committed) listing, for every definition, what a
learner would read, the evidence behind each line, the catalogue cross-check and an empty comments column. A definition ships as a draft
until its id is added to `REVIEWED` in `scripts/gtsio_part_authoring/reviewed.py`; the "Draft text" chip then goes away for it.

## What the tests hold

`scripts/test_gtsio_part_definitions.mjs`: every definition meets the text rules (title length, one-sentence limits, a source or a basis
for every claim, "look for" is illustrative); every part id maps to exactly one definition and every definition covers a part; no two
parts share a label; the learner text contains no part numbers, specifications or placeholder words; no JSON in `web/` or build in `dist/`
contains the engineering block; the definitions file is exactly what the authoring scripts produce.

`scripts/test_part_metadata.mjs`: only the R10 registry entry has `partDetailsUrl` and its token matches the built file; the learner file
names every contract part; a file for another model, or a broken one, is ignored; no other model's data repeats the learner text; the
card prints no part number and says when text is a draft; the contract carries none of the retired part references.

`e2e/part-details.spec.ts` opens the model, finds a part by an alias, and reads the card as a learner would.

## Refreshing the source snapshots

- `ipc_rows.json`: `python scripts/gtsio_part_authoring/ipcrows.py <folder of OCR pages p06.txt...>` from the IO-520 catalogue (Form
  X-30040A) page text, which lives outside the repository. Doubtful OCR rows carry `ocrClean: false`; check them against the page images.
- `gtsio_keys.json`: the figure keys of the GTSIO-520 overhaul manual (Form X-30045A, figures A-4-8 to A-4-20), read from its text layer
  and corrected against the page images (`keys.py` holds the corrections).
- `glb_materials.json`: each part's material name in the exported model.
- `prior_contract_parts.json`: the values the contract carried before 18 October 2026. Engineering use only; the part numbers have known
  errors (535661 is the camshaft, not the crankshaft, and 42 of its 91 distinct numbers are not found in the IO-520 catalogue rows).
- The H1B online catalogue is read from `cad-studies/gtsio520-h-realism/ipc-catalog.json`, and lesson mentions are counted from the
  lesson packs in `web/`.
