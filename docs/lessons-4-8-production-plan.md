# Lessons 4-8 production plan

Status: unreviewed content and media plan, prepared 24 September 2026. The lesson pack is live locally as a draft but must not be presented as instructor-approved or published as final.

## Scope

The next five lessons in the authoritative 18-lesson sequence are:

| No. | Lesson | Primary question |
|---:|---|---|
| 4 | Thermodynamic Cycles | How does the engine repeat intake, compression, heat release/expansion and exhaust? |
| 5 | Cylinder Arrangements & Configurations | How are the cylinders placed around the crankshaft? |
| 6 | Ignition Methods | What initiates combustion, and when? |
| 7 | Cooling Methods | How does unwanted heat reach the atmosphere? |
| 8 | Aspiration Methods | How does the cylinder receive an adequate air charge as operating conditions change? |

The source-backed drafts live in [`web/fundamentals-lessons.json`](../web/fundamentals-lessons.json). They contain 37 lesson steps, two check-yourself items per lesson and an explicit source/media record on every step. Placeholder cards remain visible for assets that do not yet exist.

## Source hierarchy applied

The instructor's hierarchy is treated as a stopping rule, not a suggestion to blend all six tiers:

1. Search the FAA Powerplant handbook first.
2. Use EASA Module 16 to cross-check terminology, structure or a missing explanation.
3. Use the GTSIO-520 manual only for the applicable reference-engine configuration.
4. Use downloaded reputable textbooks only if tiers 1-3 leave a material gap.
5. Search trusted internet sources only for a remaining factual or visual gap, recording the URL, publisher, licence and access date.
6. Use AI-synthesised technical text only after an instructor discussion identifies the exact unresolved gap and approves the assumptions.

Lessons 4-8 currently stop at tier 3. No technical claim requires internet research or AI synthesis. The current course slide deck remains useful for curriculum alignment, but it does not override the higher-ranked evidence sources.

### Evidence map

| Lesson | FAA-H-8083-32B (2023), PDF pages | EASA Module 16, PDF pages | GTSIO-520 manual, PDF pages |
|---|---|---|---|
| 4 | 46-48 | 20-23 | Reference-engine identity only |
| 5 | 24-27 | 23-25 | 13 (six-cylinder horizontally opposed) |
| 6 | 47-48 | 23 | 15, 18-19, 50 (dual ignition and wiring) |
| 7 | 24, 278-282 | 23, 201, 338-339 | 13 (air cooled) |
| 8 | 133-142, 476 | 205-216 | 13, 15, 18, 144/161 subject to variant-effectivity review |

The locators above are PDF page numbers, not necessarily the printed handbook page numbers. Configuration-specific limits and procedures require an additional effectivity check before use.

## Media decisions

The central rule is: choose the least complicated medium that makes the learning relationship observable.

| Medium | Use when | Do not use when |
|---|---|---|
| Short text | A definition, boundary or comparison is already clear | Motion, time or spatial relationships are the actual learning target |
| Source image | The learner must identify parts, routes or geometry in a stable view | The task depends on changing state or cause and effect |
| Existing 3D model | Spatial inspection of the GTSIO-520 or operating cylinder is central | The model lacks the required component/evidence or a 2D diagram is clearer |
| Native HTML interactive | A learner should scrub time, change one or two inputs, or compare responses under controlled conditions | The interaction would imply unsupported quantitative accuracy |
| Web media | Real footage or a licensed animation captures a phenomenon we cannot represent adequately | A higher-ranked manual figure or our own small HTML animation is sufficient |
| ImageGen | A non-authoritative illustrative scene is missing and manual/source art cannot meet the need | Labels, dimensions, wiring, fluid routes, maintenance geometry or component identity must be exact |

### Native HTML interactives worth building

| Priority | Interactive | Learner control | Output and evidence boundary |
|---:|---|---|---|
| 1 | Four-stroke phase scrubber | Crank angle, 0-720 degrees | Stroke, piston direction and ideal valve state. No pressure, temperature or certified timing. |
| 2 | Aspiration/altitude comparator | Altitude and aspiration mode | Normalised schematic curves for naturally aspirated, normalising turbocharged and ground-boosted systems. Persistent label: not engine performance data. |
| 3 | Turbocharger energy path | Wastegate state | Exhaust-to-turbine-to-compressor flow and labelled pressure regions. No boost calculation. |
| 4 | Air-cooling path explorer | Airflow level, fin obstruction, baffle seal condition | Relative airflow-path quality only. No cylinder-head temperature or airworthiness result. |
| 5 | Ignition-method comparator | Ignition mode and compression-phase scrubber | Spark versus fuel injection/auto-ignition trigger at the same piston position. No unsourced temperature, pressure or compression ratio. |
| 6 | Arrangement comparator | Layout and front/side view | Controlled schematic comparison of bank count and cylinder direction. No performance ranking. |
| 7 | Two-stroke port timing | One-revolution phase scrubber | Qualitative port states and overlapping gas-exchange functions. |

The four-stroke scrubber and altitude comparator have the highest learning return: both connect a continuous learner input to a state change that is difficult to communicate in a sequence of still images.

### Images to extract from the supplied sources

| Lesson | Asset | Preferred source | Treatment |
|---|---|---|---|
| 4 | Rotary/Wankel phases and rotor/housing | EASA Figures 1-4 and 1-5 | Clean source extraction; retain geometry and labels. |
| 5 | Inline, V-type, radial and opposed views | FAA Chapter 1 figures | Use the original figures or accuracy-checked redraws. Keep each view at a comparable scale where the source permits. |
| 6 | GTSIO-520 ignition wiring | Manufacturer Figure A4-43 | Digitise faithfully; verify every cable, plug and callout against the scan. |
| 7 | Cylinder fins, cowling and baffles | FAA cooling-system figures | Pair the solid heat-transfer surface with the installation airflow path. |
| 7 | Combined air/liquid cooling | EASA Rotax schematic | Preserve the legend; label it as an example, not GTSIO-520 architecture. |
| 8 | Internally driven supercharger | FAA Figure 3-10 | Clean source extraction. |
| 8 | GTSIO-520 induction path | Applicable manufacturer figure | Confirm H-variant effectivity before extraction or annotation. |

### Web media and ImageGen

No web video is required for the first release of these five lessons. Two optional gaps may remain after learner testing:

- A short licensed Wankel rotor animation, if learners cannot infer chamber movement from the EASA phase figure.
- Real smoke-flow or test-cell footage showing baffle-directed cooling air, if the native HTML airflow explorer does not make bypass leakage intuitive.

If either becomes necessary, search official manufacturers, FAA/EASA training sources, museums or universities first. Record licence and attribution before embedding or copying the asset.

ImageGen should not redraw the ignition wiring, GTSIO induction system, cooling baffles, turbo plumbing or engine arrangements as technical evidence. It may later create a clearly labelled illustrative opening scene or background, provided no learner must rely on it to identify a component, route, dimension or maintenance condition.

## Repeatable lesson-production workflow

Use this sequence for each future batch:

1. **Freeze scope.** Record the authoritative lesson number, title, outcome and boundary with adjacent lessons.
2. **Create the source registry.** Register candidate sources with tier, edition, local path/URL and applicability.
3. **Build a claim ledger.** For every proposed statement, record a page/figure locator and whether it is general, configuration-specific or illustrative. Stop at the first sufficient source tier.
4. **Write the lesson spine.** Opening prompt, learner action, feedback/synthesis and completion criteria. Aim for one central question per lesson.
5. **Choose media by learning need.** Use the decision table above. Animation must expose a changing relationship; interaction must give the learner a meaningful variable, choice or viewpoint.
6. **Draft checks separately.** Two or three retrieval items are usually enough. Checks should test the objective, not minor wording in the source.
7. **Run automated validation.** Validate schema, source references, lesson numbers, placeholder visibility and supported check types.
8. **Review in the browser.** Check desktop and the target Samsung Galaxy A16. Complete every step and both Training/Exam check flows.
9. **Instructor moderation.** Approve technical wording, cognitive level, length, checks, source applicability and every place where a schematic could be mistaken for measured data.
10. **Asset release gate.** Replace placeholders only with assets that have a source/licence record and a visual accuracy review. Publish content, model and asset versions together.

## Review gates for this batch

Before lessons 4-8 can move from draft to reviewed:

1. Confirm that the five titles and lesson boundaries match the instructor's 18-lesson mapping.
2. Review whether lesson 4 should mention diesel advantages/limitations. The current draft deliberately omits generic claims not established by the selected FAA/EASA passages.
3. Approve the use of the GTSIO-520-H as the recurring example in lessons 5-8.
4. Confirm the exact GTSIO-520-H induction-system figure and its effectivity.
5. Moderate the ten check-yourself items.
6. Decide whether seven or eight steps per lesson is appropriate for this cohort, or whether some comparisons should become optional deep dives.
7. Approve the qualitative-only boundaries for the planned interactives before implementation.

## Local review

From the repository folder:

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test scripts/test_general_lessons.mjs scripts/test_fundamentals_lessons.mjs scripts/test_lesson_pack.mjs
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8765 --bind 127.0.0.1 --directory web
```

Then open:

- `http://127.0.0.1:8765/learn.html?track=fundamentals-and-classification`
- `http://127.0.0.1:8765/check.html`

The source scan helper is reusable for later batches:

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' ..\tools\lesson_source_scan.py '..\Notes\amt_powerplant_handbook 2023.pdf' --term 'turbocharger' --term 'cooling fins'
```

It reports one-based PDF page numbers and a compact excerpt. It locates evidence; it does not decide applicability or replace page-image review.

