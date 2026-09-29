# Lesson production plan (originally lessons 4-8)

Status: unreviewed content and media plan, prepared 24 September 2026. The lesson pack is live locally as a draft but must not be presented as instructor-approved or published as final.

## Curriculum update - 29 September 2026

The instructor confirmed a final 18-lesson list, ending with Practicals. It supersedes both the "lessons 4-8" scope this plan was first written for and the older 17-item mapping. Valve Operating follows Accessories & Drives (the camshaft is driven from the accessory gear train) and precedes Power Generation.

| No. | Lesson | Status |
|---:|---|---|
| 1 | History of Mechanical Engines | Draft built |
| 2 | History of Aircraft Engines | Draft built |
| 3 | Terminologies | Draft built; vocabulary extended (dead centres, bore, stroke, swept/clearance volume, compression ratio) |
| 4 | Thermodynamic Cycles (Otto and Diesel) | Rebuilt around PV diagrams, valve lead/lag/overlap and the Diesel cycle; two-stroke and rotary are deep dives |
| 5 | Classification | Draft built (arrangements plus the spark vs compression-ignition comparison) |
| 6 | Parts & Construction | Draft built (13 steps, 8 checks; spotlighted 3D parts, FAA figures, GTSIO-520-H vs IO-520 comparison) |
| 7 | Cooling Methods | Draft built |
| 8 | Accessories & Drives | Not started; absorbs magnetos and dual ignition |
| 9 | Valve Operating | Not started |
| 10 | Power Generation | Not started |
| 11 | Induction & Exhaust | Not started; absorbs aspiration |
| 12 | Performance Calculations | Not started |
| 13 | Factors Affecting Power | Not started |
| 14 | Engine Requirements | Not started |
| 15 | Operation Malfunctions | Not started |
| 16 | Maintenance & Servicing | Not started |
| 17 | Light Sport Aircraft (optional) | Not started |
| 18 | Practicals | Not started |

### Repair batch (29 September 2026)

- **Stroke labels corrected.** In the 720-degree teaching profile (`web/cycle-cues.mjs`) 450 degrees is the power stroke, not compression. Lesson 4's "Compression pose" is now "Power pose", and the operating-cylinder lesson has a new compression step (270 degrees) plus a corrected power step (450 degrees). `scripts/stroke-labels.mjs` is a regression check run by the lesson-pack tests.
- **Ignition folded in.** The ignition comparator and the three-classification summary moved into lesson 5; the compression-ignition explanation was dropped as a duplicate of lesson 4's diesel step. The remaining ignition steps (spark before TDC, dual-plug wiring, manual controls timing) are kept in an unlisted lesson `ignition-methods` for lesson 8.
- **Aspiration parked.** `aspiration-methods` is unlisted and kept intact as source material for lesson 11. Unlisted lessons carry a `parkedFor` note and no sequence number. The React loader (`src/data/loadProductionData.ts`) now hides unlisted lessons and their checks.
- **Lesson 5 renamed** to Classification (id `classification`). Cylinder numbering, a module outcome under 3.7.3, is not yet covered.

### Lessons 3 and 4 (29 September 2026)

**Lesson 3 (Terminologies)** gained four steps: top and bottom dead centre (operating-cylinder model at 0 and 180 degrees; the model's readout gives 219.1 mm and 117.5 mm, a 101.6 mm = 4.000 in stroke that matches the GTSIO-520-H manual), swept and clearance volume (new interactive drawn at the -H's 7.5:1 ratio) and a GTSIO-520-H versus IO-520 data comparison. Definitions only; the calculations stay in lesson 12. Two checks added.

**Lesson 4 (Thermodynamic Cycles)** now runs: prediction, four-stroke scrubber, intake and power poses, ideal Otto PV diagram, why constant volume, ideal versus practical, valve lead/lag/overlap chart, why overlap helps, other cycles (links to the two-stroke and rotary deep dives), Diesel versus Otto, Diesel combustion, Diesel in aviation, and the evidence boundary. Five checks added (seven in total). New native interactives are in `src/components/CycleArtifacts.tsx`.

**Sources.** FAA-H-8083-32B (PDF pp. 46-51) supplies dead centres, bore and stroke, displacement, compression ratio, the valve timing chart, and lead/lag/overlap. Neither the FAA handbook nor EASA Module 16 contains Otto or Diesel pressure-volume theory (both searched), so that came from the instructor's deck (slides 56-58, 76; tier 4) and Wikipedia's Otto and Diesel cycle articles (tier 5, CC BY-SA 4.0, accessed 29 September 2026), all recorded in the pack's source registry. GTSIO-520-H values were read from the scanned pages (PDF pp. 152-153); IO-520 values are from its overhaul manual (Tables II and III and the test data).

**Instructor decisions (resolved 29 September 2026):**

1. **Diesel limitations in aero application.** Use common sense and online research. The step now draws on the FAA's proposed special conditions for a diesel-engined Piper PA-28-236 (Federal Register vol. 71 no. 114, 14 June 2006), which name turbine fuel in gasoline-designed systems, vibration and failure modes with a cylinder inoperative, high-energy fragments, and FADEC control with limits and indications, and says these concerns are not universal. The deck's slide 78 (weight, complex injection, cold cranking) and EASA's misfuelling passage complete the list.
2. **Otto and Diesel PV theory.** Cross-checked against textbook-grade sources: MIT Unified Engineering, Thermodynamics and Propulsion, sections 3.5-3.6 (tier 4), and NASA Glenn's Otto cycle page (tier 5). Both agree with the deck and Wikipedia.
3. **GTSIO-520-H spark timing.** Manual values carry more weight: the lesson uses the -H manual's 20 degrees BTC. Deck slide 207 (22 degrees BTDC) should be corrected to match.
4. **Two-stroke and rotary.** Now standalone deep-dive lessons (`two-stroke-cycle`, `rotary-cycle`; unlisted, `deepDiveOf: thermodynamic-cycles`), reached from lesson 4's "Other cycles" step. The React app gained deep-dive support: `deepDiveLinks` on a step renders an "Optional deep dive" button, and the loader keeps linked unlisted lessons (with their checks) while hiding parked drafts. Lesson 4 is now 14 steps.
5. **Valve timing.** FAA charts are acceptable; the lesson keeps the FAA example chart (Figure 1-37). Lesson 9 may still look for GTSIO-520-H figures.

Still noted in the steps: the IO-520 compression ratio is not stated in its overhaul manual and its displacement is calculated from bore and stroke.

### Lesson 6 (29 September 2026)

**Parts and Construction** has 13 steps and 8 checks: basic parts, crankcase (whole-engine model), case sections (FAA Figure 1-6), crankshaft, connecting rods, rod types (FAA Figure 1-11), piston and pin, piston rings, cylinder, bearings, propeller shaft and reduction gears (FAA Figure 1-34), engine mounts (FAA Figure 8-16), and a GTSIO-520-H versus IO-520 construction table.

- **Sources.** FAA-H-8083-32B PDF pp. 26-36 and 43-45 (construction) and pp. 343-344 (mounts); EASA Module 16 PDF pp. 51-70 and 275-276 as cross-check; GTSIO-520 overhaul manual Section III (PDF pp. 16-17) and C-3 (PDF p. 152) for the course engine; IO-520 overhaul manual paragraphs 2-3 to 2-9 for the comparison.
- **New viewer option.** A model-pose step may set `focusParts` (component ids from the operating-cylinder catalogue); those parts render normally, everything else is ghosted, and the camera frames the group. Lessons 8 and 9 (accessories, valve train) can reuse it.
- **Bug fixed along the way.** The 3D canvas overflowed its container on any display scaled above 100% (the renderer's pixel ratio scaled the drawing buffer while the CSS size was left unset), so every 3D view was zoomed and cropped there. The canvas now fills its container.
- **Not covered yet.** Cylinder numbering and firing order (outcomes 3.7.3 and 3.7.4) are still not taught in any lesson; lesson 5 (Classification) is the natural home for numbering.

### Additional editable sources

Reflowed and editable IO-520 manual copies exist in `C:/Users/user/KeonGeraldo/CodeProjects/DigiMan/work/deliverables` (`io520_overhaul`, `io520_ipc`, `io520_ops_install`, and a reviewed `gtsio520` docx/pdf). They are text-searchable, so use them for the claim ledger in lessons 6, 8, 9, 16 and 18. The IO-520 is a related but different engine: use it as a cross-check and for comparison, and confirm GTSIO-520-H applicability before quoting any limit, dimension or procedure.

## Scope

The first batch covered these five lessons. Under the final list above, ignition and aspiration were folded into lessons 5/8 and 11, so the built lessons are now 4, 5 and 7:

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

