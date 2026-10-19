# Fidelity classes: what is critical and what is cosmetic

Every part and feature in a study has a fidelity class. Before this, every part was checked, tessellated and shaded alike, because nothing in a spec said which parts a gate depends
on. The class says it, and other decisions (which gates run, how fine a part is tessellated, what Blender may touch) follow from it.

| Class | Meaning | May change without re-running the engineering gates? |
|---|---|---|
| `engineering` | Anything a gate depends on: a part that moves or meshes, sits in the interference ledger, feeds a mass-check line or lies on a mechanism path of the inventory; and any feature that makes a bore, journal, seat, groove, land, gallery, opening or other fit. | No. |
| `visual-structure` | The shapes a student uses to recognise a part: casting contours outside the interfaces, ribs, bosses, fastener heads. It may deviate from the source only inside a stated envelope that contains every interface. | No, but only a resemblance check applies. |
| `cosmetic` | Blends, chamfers, edge breaks, texture, lettering. | Yes, if an envelope check proves that no interface or clearance moved. |

A part is at least as critical as its most critical feature. A part that moves, meshes or sits in the interference ledger is bound to a gate, so no override can lower it.

## The field

`class` is an optional field on a part, a feature and a dressup in `cad_pipeline/schemas/part_spec.schema.json`. `cad_pipeline/spec.py` refuses an unknown value and a part whose class
is lower than one of its features. A new study may declare classes in its spec; the derivation checks a declared class against what the records say and reports a conflict when the author
declared a part less critical than a gate makes it (a stricter declaration stands).

The tracked studies keep their derived classes beside the spec instead of inside it, because their validation records and direct caches are bound to the spec's SHA-256 (a spec edit would
invalidate them), and because R10's full spec (1,396 parts) is a build output outside Git:

| File | What it holds |
|---|---|
| `cad-studies/gtsio520-h-static/fidelity-classes.json` | R10: one row per part (class, why, one letter per feature where the spec is known). Derived. |
| `cad-studies/langley-manly-balzer-1903/fidelity-classes.json` | Langley: the same. Derived. |
| `cad-studies/<study>/fidelity-overrides.json` | The manual file: `class_overrides`, `coverage_waivers`, and for R10 the draft `lesson_focus`. |
| `docs/fidelity-class-report.md` | Counts per class, audit coverage per class, the tessellation tiers the classes imply, and the lesson map summary. Generated. |
| `data/gtsio520-lesson-fidelity-map.json` | The draft map from each of the 18 lessons to the R10 parts it needs and the class it needs them at. Generated. |

## How a class is derived

`python scripts/derive_fidelity_classes.py` reads the records the study already keeps (`cad_pipeline/fidelity.py` has the rules):

| Signal | Where it comes from | Class |
|---|---|---|
| `motion` | The part is on a moving body: R10's `body` field in the contract, Langley's `cad_pipeline/langley_bodies.py`. | engineering |
| `gear` | The part is in a declared gear mesh: `gearMeshes` in the Langley contract, `GTSIO_STATIC_DRIVE_MESHES` and `GTSIO_ACCESSORY_MESHES` in `scripts/accessory_gears.py` for R10. | engineering |
| `ledger` | The part is in the policy's `known_defects` or `unverified_waivers`. Both studies' ledgers are empty today. | engineering |
| `mass:Wxx` | The part is in a line of the mass check (`scripts/langley_mass_check.py`). Membership, not sensitivity. | engineering |
| `path:<id>` | The part belongs to a component on a `mechanisms` path of the inventory (load, seal, phase, valve train...). The inventories keep interfaces only as free text, so this is the nearest structured interface record. | engineering |
| feature label | A label naming a bore, journal, seat, groove, land, gap, hole, opening, passage, relief and the like makes the feature engineering and so its part. A label naming a rib, boss, web, flange, shell or head makes a feature of a *static* part visual-structure. A label naming a chamfer, edge break, blend, texture or lettering makes it cosmetic. An unlabelled feature takes its part's class. | per feature |
| none | A part with no signal. | visual-structure |

Every outer surface of a moving or meshing part is in a clearance, so a rib on such a part stays engineering.

At the first run (19 October 2026): R10 has 694 engineering and 702 visual-structure parts; Langley 338 and 20. No cosmetic part or feature exists yet, because no spec names one. Details and
the coverage tables are in [fidelity-class-report.md](fidelity-class-report.md).

## Adding an exception

Edit the study's `fidelity-overrides.json`, then run `python scripts/derive_fidelity_classes.py --write`. The part ids below are illustrative.

```json
"class_overrides": [
  {"parts": ["OilGalleryPlug"], "class": "engineering", "reason": "it closes the main oil gallery"},
  {"match": "SumpScrew\\d+", "class": "cosmetic", "reason": "the heads are lettering-sized detail; the threads are not modelled"},
  {"parts": ["CrankcaseLeft"], "feature": 3, "class": "cosmetic", "reason": "casting texture patch"}
]
```

Every override needs a reason. A part pattern that matches nothing, an unknown part and a bad class are refused. An override may raise any class; it may lower one only if no gate binds
the part.

## The rule that no engineering part is left without a gate

`scripts/test_fidelity_classes.py` (run in CI) fails if an engineering part lacks a gate it needs. An engineering part needs:

| Gate | Needed by | Covered when |
|---|---|---|
| `rest` | every engineering part | A rest-pose interference audit was run on the study's present asset (same SHA-256), audited every part, and could intersect this one. |
| `clip` | every engineering part that moves | A swept audit of a baked clip, on the present asset, moved at least as many parts as the study's motion declares. |
| `gear` | every engineering part in a declared mesh | The present asset's audit lists each of its meshes with the minimum clearance met. |

An audit record of another file, or of fewer parts, does not count. Any `interference-audit.json` kept in the study's folder (R10: anywhere under `cad-studies/gtsio520-h-static`) is read, so a new audit of the shipped file is counted as soon as it is committed. Langley passes with no waiver. R10's rest and clip gates are covered by the exported-file audit of the shipped static asset (`cad-studies/gtsio520-h-static/shipped-r10/`, 19 October 2026: the assembled pose, and the core cycle posed through the viewer's sampler, recorded as a swept clip of 328 moving parts; coverage says an audit exists, not that it was clean, and that audit found overlaps, which are in its own ledger). No audit measures the declared gear meshes, so the 14 engineering part/gate pairs of the gear gate stay accepted by a `coverage_waivers` entry in R10's override file. Each waiver is bound to the asset's SHA-256. The waiver expires by itself when the asset changes, which makes the gap fail again until an audit covers it or someone waives it on purpose, with a
reason and a statement of what clears it. A new asset (for example the optimised file) needs its own audit record, or the rest and clip gates fail. `python scripts/derive_fidelity_classes.py --gaps` lists every open and waived gap. When an audit for the asset lands, the test requires removing
the waiver it makes unnecessary.

## What the classes drive (and what is not done yet)

1. Tessellation tiers (plan item B1): not applied. The report shows what the classes would imply; today the tier follows the part group, and 126 of Langley's engineering parts sit at its
   coarsest tier.
2. Which gates run per iteration (B5): the coverage table is the input.
3. What Blender may edit: [freecad-blender-boundary.md](freecad-blender-boundary.md).
4. Where per-part colour variation applies, what a card says is accurate, and the lesson map: the lesson map is a draft; the other two are not started.

## Limits

- R10's full 1,396-part spec is a build output, so feature classes exist for the 335 foundation parts whose spec is in Git. Pass the full spec to extend them.
- Pairs of surfaces closer than the clearance limit are not in any record (the audit counts neighbouring pairs and does not list them), so that signal is not used. Having the audit write
  the pair list would add it.
- Membership of a mass-check line is a weak signal: the line is checked to 15 percent. Per-part volumes would let it weigh by share.
- The lesson map counts mentions in the lesson text and keeps the top four lessons per part kind; the focus of each lesson (operate, identify or concept) is a draft judgement the
  instructor has not reviewed.
