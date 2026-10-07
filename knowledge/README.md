# Knowledge store

What the project knows about building mechanical parts, kept as text in Git so every session starts from it. The plan and the reasons are in
`docs/ai-mechanical-engineer.md`; this file says what is here and how to add to it.

| Path | Holds | Checked by |
|---|---|---|
| `part-cards/<family>.json` | One family (piston, connecting rod, valve, cam, gear) with its variants (types) and the instances each study built. This is the data of the component gallery | `python -m cad_pipeline.intent.part_card`, `scripts/test_knowledge_store.py` |
| `metrics.csv` | One row per completed study: parts, features, audits, parameter statuses, reuse ratio | `scripts/test_knowledge_store.py` |
| `retrospectives/` | One note per study, from `TEMPLATE.md`: what went wrong, what to promote | by reading, at the fortnightly review |

Later: `priors/` (estimation rules of thumb) and `patterns/` (named mechanism arrangements).

## Rules

- **Grow by extraction.** A family or variant enters only when a study has built it. Each variant needs at least one instance, and an
  instance names real part ids in a study's `part-spec.json` and real components in its `inventory.json`. Do not add a variant from general
  knowledge; nothing could validate it.
- **Every claim has a status.** Dimensions use the spec's words: `specified` (a source states it), `measured` (taken from a drawing or
  scan), `derived` (computed from other values), `inferred` (a teaching estimate), `illustrative` (a choice that claims nothing about the
  object). Envelope, intent and manufacturing claims use `documented`, `derived`, `inferred` or `illustrative`. Specified, measured and
  documented claims carry evidence (study, source id, locator). The others carry a basis saying what they rest on.
- **A guess is never recorded as a source.** Design intent is inferred unless a source states it. A rule of thumb stays a `candidate` prior
  until it is sourced; only a sourced prior may fill a dimension, and then as `inferred`, with the prior as its basis.
- **Keep the exceptions.** The 1903 engines break several modern rules of thumb. A variant records what differs, not only what is typical.
- **Standard library only, text only.** No CAD or model binaries here (they live in Drive); the validator runs in CI, FreeCAD and Blender
  without extra packages.
- **Nothing under `cad_pipeline/` or `knowledge/` imports from `src/`**, so this can be extracted into its own project later.

## Adding a part card

1. Finish the study's research and build first; cards describe what was built and where the evidence is.
2. Add the variant to its family file (or a new `<family>.json`). Copy an existing variant for the shape of the fields.
3. Run `python -m cad_pipeline.intent.part_card`. It fails on an unknown source, part id or component, a missing basis, or an unknown
   primitive or interface kind. The interface kinds and primitives live at the top of `cad_pipeline/intent/part_card.py`; extend them at a
   review, not ad hoc.
4. Add the study's row to `metrics.csv` and write its retrospective.
