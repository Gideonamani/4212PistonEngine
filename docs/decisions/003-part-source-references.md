# ADR 003: resolvable source references in learner part cards

Status: **proposal**, 27 October 2026 (issue 107). Nothing here is built. The payload below is for MEDIS to accept, amend or refuse before the website consumes it; the part store and the generated `web/*-parts.json` are MEDIS output and are not edited here.

## What exists, measured on 27 October 2026

- A learner parts file (`src/data/learnerPartDetails.ts`, schema `<model>-parts/1`) gives each claim as `{ text, status, source? , basis? }`. The part card's "Where this text comes from" list shows `source ?? basis` as plain text next to the status label, and the card says Draft until the instructor has reviewed the definition. Both stay.
- `web/gtsio520-r10-parts.json` has 188 definitions. Across their title, function, made-of, sits and look-for claims there are 240 distinct free-text source strings. Counted by claim, 132 cite "IO-520 parts catalogue (a similar engine)", 34 cite "GTSIO-520 overhaul manual figure key", and the rest cite manual sections and figures, lessons, the model layout and the oil-pump study. `web/cylinder-parts.json` has 128 sourced claims, 90 of which name the IO-520.
- So the words "a similar engine" are the only thing separating an IO-520 claim from a GTSIO-520-H one, and a claim from the IO-520 catalogue can carry the status `specified` (the strongest) on a GTSIO-520-H model. That is honest today because a person wrote the caveat in the string; nothing stops the next regeneration dropping it.
- The loader accepts only schemas that end in `-parts/1`. A file with `-parts/2` is not an error: it is ignored and the card shows no learner details. This decides the order of work below.
- Lesson packs already have what parts lack: a source registry and validated `sourceRefs` (`web/schema/content-schema.mjs`).

## Proposed payload: `<model>-parts/2`

A top-level `sources` table, and claims that point into it. Each reference carries a locator and an applicability, so one claim can rest on several sources and each is labelled for what it can establish.

```json
"sources": {
  "gtsio520-overhaul": {
    "title": "GTSIO-520 overhaul manual",
    "edition": "<as printed>",
    "engine": "GTSIO-520-H",
    "kind": "manual",
    "destination": { "type": "citation-only", "citation": "Teledyne Continental Motors, GTSIO-520 overhaul manual, <edition>" }
  },
  "io520-ipc": {
    "title": "IO-520 illustrated parts catalogue",
    "edition": "<as printed>",
    "engine": "IO-520",
    "kind": "parts-catalogue",
    "destination": { "type": "citation-only", "citation": "Teledyne Continental Motors, IO-520 illustrated parts catalogue, <edition>" }
  }
}
```

```json
"function": {
  "text": "Holds the crankshaft and camshaft in line and carries the cylinders.",
  "status": "derived",
  "sourceRefs": [
    { "id": "gtsio520-overhaul", "locator": { "section": "3-1b" }, "applicability": "exact" },
    { "id": "lesson-7", "locator": { "step": "Parts and Construction" }, "applicability": "course" }
  ]
}
```

- `destination.type` is `public-url` (with `url`), or `citation-only` (with the citation text a learner can use to find the source). There is no third type for a private file: a catalogue page that is not public never gets a link. A part number may be published as part of a claim or a citation (the owner's decision of 27 October 2026: people search a part number to buy the part, so it is not a secret). That does not make the catalogue pages themselves public; they stay private.
- `locator` has any of `edition`, `figure`, `page`, `section`, `item`, `callout`, `step`; none is required, and an unknown key is a validation error, not ignored.
- `applicability` is one of `exact` (the source covers this engine and variant), `similar-engine` (a different engine of the same family, named in the source entry), `course` (the course material itself), `general` (textbook-level). It is stated by the author in MEDIS, never inferred by the website from the source's name.
- `basis` stays for `inferred` and `illustrative` claims and is not replaced by references.
- `sourceRefs` and the legacy `source` string may both be present during migration; when they are, the references win and the string is ignored. A `/1` file stays valid forever.

## Rules the website enforces (to build once MEDIS agrees)

1. **Applicability guard.** On a model whose engine is GTSIO-520-H, a claim may show `specified` or `derived` only if at least one of its references is `exact` for that engine. If its only references are `similar-engine`, it is shown with a plain label, "from a similar engine (IO-520), not confirmed for the GTSIO-520-H", and the status badge never says specified. An IO-520 reference therefore cannot establish a GTSIO-520-H-specific claim even if the data says `specified`; the data and the guard disagree visibly, in tests, instead of quietly.
2. **No false evidence.** A reference to an id that is not in `sources`, a locator with an unknown key, or an unknown `applicability` is a validation error for that claim. The claim's text still shows, its Sources line says "source not found", and it is counted as having no evidence for review purposes. It is never shown as reviewed. One bad claim never blanks the card, and the viewer keeps working.
3. **Presentation.** The Sources list shows the source title, edition and locator ("GTSIO-520 overhaul manual, 3-1b"), the applicability in words, and a link only for `public-url`. Basis text and the Draft or Reviewed badge stay as now.
4. **Versions.** The loader accepts `/1` and `/2`. Any other version of the schema is ignored with a console notice, not an error, as `/2` is today.

## A case from the course's copy of Form X-30046 (27 October 2026)

The GTSIO-520 series catalogue the course holds (Form X-30046, with Change 1) is the kind of source this record is about, and it shows why applicability has to be a recorded fact. Its cover names models C, D, F, H, K, L, M and N. But its quantity columns, which are how a series catalogue says which model a line is used on, can be read for C, D, F and K only: on the figures checked (5 to 8) the columns for H, L, M and N are blacked out, and its contents marks four of its eight customer specifications DELETED. Nothing in that copy states that any line is used on the GTSIO-520-H. A reader who took the cover for the answer would have presented its numbers as the H's. So a number is shown as the model's own only when the entry records that the catalogue lists it for that model, never because the catalogue's title or cover includes the model.

## Order of work, because of the loader

1. MEDIS agrees or amends the payload (the questions below).
2. The website ships the consumer that reads `/1` and `/2`, with fixtures, **before** any `/2` file is published. If it were the other way round, a deployed `/2` file would be dropped by the older loader and students would lose part names.
3. MEDIS regenerates the R10 projection as `/2` from the reviewed part store, including the figure and section locators it already holds, and publishes it through its normal tool.
4. The cylinder projection follows the same way.

## Acceptance for the website work (from issue 107)

- A generated fixture links one real cylinder part claim and one R10 claim to their source entries and locators end to end.
- Unit tests: valid structured references; dangling ids; unknown locator keys; legacy text; absent, public and citation-only destinations; inferred and illustrative bases; the applicability guard with an IO-520-only claim on the GTSIO-520-H model.
- A browser test in `e2e/part-details.spec.ts` and `e2e/cylinder-part-details.spec.ts`: the source details read correctly, the review badge is accurate, and model selection and isolation still work.

## Questions for MEDIS

1. Does the part store already record a source entry and a locator per claim? If so, under what names, so the projection can use them as they are?
2. Where is applicability decided today (per source, per claim, or per part)? The proposal puts it on the reference. Is that too fine?
3. Can the projection list, for each source entry, the engine and variant it covers, so `exact` can be checked against the model's engine?
4. Which of the 188 R10 definitions would have no `exact` reference after regeneration? That list is the review queue for the instructor, and it is the same as the work of issue 76.
