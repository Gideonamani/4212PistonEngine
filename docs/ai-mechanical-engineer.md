# The AI Mechanical Engineer: vision, structure and roadmap

Living document. First drafted 7 October 2026 from the instructor's vision notes; reviewed about every two weeks (log at the end).
Next review: about 21 October 2026. Phase A (foundations) was delivered on 7 October 2026; see section 13.

## 1. Purpose

Build a specialist mechanical engineer that can take a part or an assembly described by an image, a research text or a mesh, work out
what it is, how it is built, what it does and how it moves, rebuild it as editable parametric CAD, prove the CAD is sound and agrees with
the sources, and then show it working through physics-honest animation and explainer video. Piston engines are the first domain, and
deliberately so: depth in one domain is what produces expertise, and the grammar below stays general.

## 2. The four questions are four pillars

| # | Question from the notes | What the repo already has | Gap | First build |
|---|---|---|---|---|
| 1 | Better engineering research | `engineering-research` skill, `research_gate.py`, claim-level dossiers, motion dossier, packaging record | Each study's knowledge stays inside that study. No cross-study memory, no reusable estimation rules | `knowledge/` store: priors, part cards, mechanism patterns, retrospectives |
| 2 | Better research to CAD | `spec.py` (provenance-bearing spec), `generate.py`, `fast_build.py`, per-engine builders `wright_*.py` and `langley_*.py`, `image-to-cad`, `text-to-cad`, `mesh-to-cad`, `cad-generation` skills | The two studies share a feature vocabulary and a gear module, but each engine's builder writes its parts from scratch; there is no named, tested geometry grammar and no explicit "geometric intent" step between reading and building | `cad_pipeline/grammar/` and `recipes/`, built by extracting what the two engine builders already do |
| 3 | Validate integrity and alignment with research | The 10-rung validation ladder, interference audits, mass and closure checks, mutation-tested audits | Rung 9 (resemblance to the sources) is the weakest and is done by eye. No plausibility rung (loads, inertia, power) and no manufacturability rung | Automated image-fit loop; two new rungs |
| 4 | CAD to dynamic, physics-compliant animation | `mechanism-animation` skill, one motion definition per engine, baked clips audited between keys | Kinematic only. The skill states it establishes no dynamics, forces, inertia or gas pressure | Motion tiers 0 to 3 with a rule for what each tier may claim |

Your other notes map onto these: the explainer video is a consumer of pillars 1 and 4 (section 10); "gets faster and smarter with every
part" and "witty, expert estimation" are the learning loop and the estimation store (sections 3 and 7).

## 3. How it "learns", honestly

The model does not retain anything between sessions, so the learning has to live in versioned artefacts that every session loads.
Three stores, one loop:

| Store | Holds | Form | Changes when |
|---|---|---|---|
| Skills (`.agents/skills/`) | How to work: procedures, rules that came from mistakes | Markdown | A retrospective finds a better procedure |
| Recipes (`cad_pipeline/grammar`, `recipes`) | What can be built: tested geometry code | Python plus tests | A part is built a second time and the first build is generalised |
| Knowledge (`knowledge/`) | What is known: estimation priors, part cards, mechanism patterns, retrospectives, metrics | JSON, Markdown, CSV | Every study ends with a retrospective |

The loop closes at the end of each study: **retrospective, then promote.** Anything built twice becomes a recipe; any rule of thumb
confirmed against a source becomes a prior; any mistake becomes a skill rule. The Wright study already did this by hand
(`docs/wright-reconstruction-lessons.md`, seven skill edits, the `mechanism-animation` skill). This document makes it a routine with
numbers, so "faster and smarter" is measured and not felt (section 11).

## 4. The data objects (the contract between stages)

Every stage reads and writes one of these, so any stage can be replaced or improved without breaking the others.

| Object | Status | Written by | Read by |
|---|---|---|---|
| Evidence dossier (claims with source, locator, confidence, consequence) | exists | research | everything |
| **Part card** (six fields, below; `knowledge/part-cards/`) | exists (Phase A) | part understanding | spec, estimation, validation, explainer |
| **Geometry intent** (ordered feature list in grammar terms, with evidence refs) | new | reasoning step | generator |
| Parametric spec (`spec.py`, dimensions with provenance) | exists | intent compiler | generator, audits |
| Validation report (result per rung, per system) | exists, extend | validators | review, release gate |
| Motion definition (`*_motion.py`, one source of truth) | exists | motion design | baker, rig, tests, audits, explainer |
| **Storyboard** (shots bound to dossier claims) | new | explainer step | renderer |

### The part card

Your list for inspecting a part, as a schema. Each field names where its truth comes from and which rung can test it.

| Field | Answers | Source of truth | Tested by |
|---|---|---|---|
| Geometric dimensions | How big, with what certainty | spec dimensions, each marked specified, measured, derived, inferred or illustrative (the spec's own words, plus derived and illustrative) | rungs 1, 3, 9 |
| Feature construction | How it is built up | ordered grammar operations | rung 2 (regenerates), rung 9 |
| Functional abilities | What it does and what it touches | interfaces, motion role | rungs 4 to 6 |
| Constraint envelope | The space, speed, load and temperature it lives in | packaging record, motion dossier | rungs 4, 5, plausibility |
| Design intent | Why it has this shape | claim linked to evidence, with confidence | review only; no machine can verify intent |
| Manufacturing process | Cast, forged, machined, brazed, sheet | source claim | manufacturability rung |

Design intent is the one field that cannot be checked mechanically. Mark it as inferred unless a source states it.

Cards are JSON, not YAML, because the repository's records (spec, inventory, contract) are JSON and the validator stays standard-library only.
A claim marked documented, specified or measured must carry evidence (study, source id, locator); a claim marked derived, inferred or
illustrative must say what it rests on. The validator (`python -m cad_pipeline.intent.part_card`) also checks each card against the studies
it cites: the source ids exist, the part ids exist in the study's part spec, and the inventory components exist and contain those parts.

## 4a. The component gallery

An idea from the instructor on 7 October 2026: a gallery of components, each with its various types and iterations, so the knowledge of
how to build things is kept where it can be browsed and reused, and later used to design new parts or assemble new systems. It is
logical, and it is not a separate system: it is the browsable face of what Phase A (part cards) and Phase B (recipes) create anyway.

| Level | Example | Lives in |
|---|---|---|
| Family | piston | `knowledge/part-cards/piston.json` |
| Variant (type) | domed two-rib cast-iron; long trunk three-ring | `variants` in that file |
| Instance (iteration) | Langley `Piston1` to `Piston5`; Wright `Piston1` to `Piston4` | `instances` of the variant: study, part ids, inventory components, validation state |

What makes it useful for building, and later for assembling:

- **How to build.** The six fields record the construction steps in the feature vocabulary the generator already uses, why the part has its
  shape, and the envelope it lives in.
- **How it joins.** Each variant declares its interfaces, with a kind from a short vocabulary (fixed, revolute, prismatic, cylindrical,
  sliding-contact, gear-mesh, cam-follower, seat, threaded, spring). An assembler can then ask whether two variants can be joined, and the
  Tier 2 constraint solver (section 9) can take its joints from the cards instead of hand-written motion.
- **How to build it again.** Each variant has a `recipe` status: none, candidate or extracted. An entry with an extracted recipe is something
  the system can build on demand with new parameters. The gear family already has one (`scripts/gear_geometry.py`).
- **Design from the gallery.** Pick a variant and set its parameters within the range its evidence supports to get a new part; join variants
  whose interfaces are compatible to get a new assembly. The audits (rungs 4 to 6, later 11 and 12) decide whether the result is sane. This
  is grammar level 8 in practice, which is why it comes late.

Rules that keep it honest:

- **It grows by extraction, not by encyclopaedia.** A family or variant enters only when a study has built it, with an instance and
  evidence. We do not list every kind of piston from general knowledge, because nothing could validate such a list. The taxonomy comes from
  real built parts, the same discipline as the lesson list.
- **Variants record what differs, not only what is typical.** The two 1903 engines break several modern rules of thumb; the cards keep both
  the typical and the exceptions.
- **Every claim carries its status and its basis**, and the validator ties each card to the study files, so a card cannot drift from the
  evidence quietly.

Delivered in Phase A: five families (piston, connecting rod, valve, cam, gear), ten variants and eleven instances drawn from the Wright
revision-2 and Langley studies. The same command prints the gallery listing. Phase H adds a generated browsable view and the assembler. A
student-facing version, an Explore-style "Components" track in the app, is a product decision and is parked.

## 5. The pipeline

Your four copies of the diagram are one pipeline with a loop. Written once:

```
SOURCES (image, text, mesh, drawing plate)
  -> RESEARCH                 evidence dossier, motion dossier, packaging record     [pillar 1]
  -> PART UNDERSTANDING       part card (six fields), estimates from priors           [pillars 1, 2]
  -> GEOMETRIC INTENT         ordered grammar features with evidence refs             [pillar 2]
  -> PARAMETRIC SPEC          spec.py, every dimension with provenance                [pillar 2]
  -> FREECAD GENERATOR        recipes, B-rep solids, FCStd + STEP                     [pillar 2]
  -> VALIDATION LADDER        rungs 1-12                                              [pillar 3]
       ^                          |
       |   rung 9: render matching view, compare with source figure, residual report
       +------ refine parametric description (parameters first, topology only if the residual shows a missing feature)
  -> MOTION                   tiers 0-3, baked clip, audited between keys             [pillar 4]
  -> PRESENTATION             viewer, Blender, storyboard -> explainer video          [pillars 1, 4]
  -> RETROSPECTIVE            promote recipes, priors, skill rules, metrics           [learning loop]
```

The fit loop has two rules. It refines parameters first and changes the feature list only when the residual pattern shows a missing
feature (a systematic strip of error where a hole or rib should be). It also stops after a bounded number of rounds and reports the
residual it could not remove, so it cannot hide a wrong hypothesis behind a good-looking fit. Matching needs calibrated views: the
existing `image-to-cad` rule (same camera, axis, scale and crop) stands, so start with orthographic drawing plates, not photographs.

## 6. The geometry grammar

Your eight levels, mapped to where each lives in code, the image cue that suggests it, and when to build it.
FreeCAD supplies the operations; the grammar is the named, parameterised, tested layer above them.

| Level | Contents | Module (new) | Cue that suggests it | Piston-engine use | Build |
|---|---|---|---|---|---|
| 1 Primitives | line, arc, circle, ellipse, polygon | `grammar/primitives.py` | outline fragments | every profile | Phase B |
| 2 Curves | Bezier, B-spline, NURBS, interpolation, approximation | `grammar/curves.py` | smooth outlines not made of arcs | cam lobes, port outlines | Phase B (interpolation), later (NURBS) |
| 3 Profiles | closed wires, compound profiles, holes, offsets, parameterised sections | `grammar/profiles.py` | closed outline with holes | rod section, flange with bolt circle | Phase B |
| 4 Solid generators | extrude, revolve, loft, sweep, pipe, shell | `grammar/solids.py` | concentric circles in one view and a rectangle in the other means revolve; constant section along a path means sweep | pistons, shafts, valves, pipes, housings | Phase B |
| 5 Transformations | translate, rotate, scale, twist, bend, taper | `grammar/transforms.py` | repeated or skewed copies | cylinder pattern, tapered fins | Phase B |
| 6 Interpolation | profile morphing, section schedules, variable thickness, variable twist | `grammar/schedules.py` | section changes smoothly along a length | crank webs, blade-like parts, ribs | Phase G |
| 7 Surface mathematics | B-spline and NURBS surfaces, Coons patches, guide curves, G0/G1/G2 continuity | `grammar/surfaces.py` | doubly curved skin | manifold runners, cowling, port blends | Phase G |
| 8 Generative engineering geometry | constraints, optimisation, physics, manufacturing rules, AI-generated parameter sets | `grammar/generative.py` | not a cue; a goal | weight-optimised web, rib layout | Parked until levels 1 to 5, the fit loop and motion tier 2 exist |

What exists today: the two studies already share a feature vocabulary in the spec (`box`, `cylinder`, `tube`, `cone`, `sphere`, `prism`,
`helix`, `revolve`, each added or cut), which is levels 1 to 4 in miniature, and `scripts/gear_geometry.py` (involute tooth outline,
backlash, solved mesh phase), which is already a recipe in all but name. What is missing is the layer above them: named, parameterised
parts, curves beyond polygon points (levels 2 and 6) and transformations (level 5).

Levels 1 to 5 cover nearly every piston, rod, shaft, valve, gear, spring and housing in the two completed studies, so they come first.
Levels 6 and 7 are needed for the doubly curved parts, and level 8 needs the validators and physics in place to be anything but a guess.

Each grammar operation carries three things: its parameters with units, a regeneration test (change a controlling parameter in a
disposable reopened copy and require the shape to follow), and its recognition cue. The cue is what lets the reasoning step turn
"looks like a revolve with a groove" into a geometry intent with a named operation.

A **recipe** is a named part built only from grammar operations (`piston`, `conrod`, `poppet_valve`, `cam_lobe`, `compression_spring`,
`spur_gear`, `bolt_circle_flange`). Recipes are created by extraction: when a part appears a second time across studies, lift it out of the
engine builder, parameterise it, test it, and replace both uses. How much `wright_*.py` and `langley_*.py` share beyond the spec
vocabulary and the gear module was audited on 8 October 2026 (`docs/builder-overlap-audit.md`): nothing else is shared, and the five part
families are 29 to 33 percent of each model's features. The audit also set the order of the first extractions (gear, piston, valve, rod
sub-recipes, cam lobe) and four design constraints for recipes: they must carry expression strings as well as numbers, work in a local
frame, compose the existing primitives, and be checked against golden `part-spec.json` files.

## 7. Estimation and expertise

"Witty and filled with expertise" means the system can say what a dimension probably is, why, and how sure it is, and can reject its
own estimate when a closure check fails. Two instruments:

**Closure checks** (exact, always trusted). Quantities that must agree with each other. The Langley study is the template: displacement
from bore, stroke and cylinder count matched the stated 540 cubic inches; stated horsepower matched the stated pull; the cam ratio closed
with the firing order only at one speed and direction; and a shoe-clearance check showed the rod length implied by the 37-inch
envelope could not carry shoes as wide as the drawing suggested, which sent the study back to measure both. Put these in
`cad_pipeline/estimate/closure.py` as reusable functions (displacement, tooth count against pitch radius, rod and crank against stroke,
adjacent-rod swing, firing-order phase), called by the research gate.

**Priors** (rules of thumb, trusted only once sourced). Stored as one JSON entry each:

```json
{
  "id": "rod-ratio-piston-engine",
  "statement": "connecting-rod length divided by stroke lies in a typical band",
  "band": [1.5, 2.0],
  "band_note": "illustrative; confirm against the FAA/EASA texts and the two studies before use",
  "applies_to": ["four-stroke piston engine, inline or opposed"],
  "evidence": [],
  "status": "candidate",
  "counterexamples": ["langley-1903-master-and-link rod"]
}
```
Status moves candidate, then sourced, then retired.

The rule that keeps this honest: a `candidate` prior may only suggest where to look. Only a `sourced` prior may fill a dimension, and
then the dimension is marked `inferred` with the prior's id as its basis, never `specified`. This matches the existing spec rule that unknown
dimensions stay null until an explicitly labelled estimate is chosen. Counterexamples are part of the entry, because the 1903 engines
break several modern rules of thumb and the system must know where its rules stop applying.

## 8. Validation: ladder, new rungs, and the weak rung

The existing ladder (`.agents/skills/cad-validation/references/validation-ladder.md`) stays as rungs 1 to 10. Proposed additions:

| # | Question | How | Status |
|---|---|---|---|
| 9 (extend) | Does it look like the sources, per system? | Automated fit loop: render matching view, silhouette overlap and edge distance against the source figure, residual map, per-system report. Start with Plate 79 of the Langley memoir, which is already an open item | Build in Phase C |
| 11 | Are the loads, inertias and powers plausible? | Closure checks, mass check against any weight table, section sizing sanity (shaft, pin and bolt stress with a stated allowable), balance of the crank group | Phase D |
| 12 | Could it be made the way the part card says? | Manufacturing rules per process: wall minimums, drafts for cast parts, tool access for machined features, brazed joint geometry | Phase D, later |

Rungs 11 and 12 report ranges and flags, not pass or fail certificates. They exist to catch a part that is geometrically valid and
mechanically absurd, which rungs 1 to 8 cannot see.

## 9. Motion and physics tiers

A tier is a promise about what the animation may claim. A model is labelled at the highest tier it has earned.

| Tier | Name | What produces the motion | May claim | May not claim |
|---|---|---|---|---|
| 0 | Illustrative | Hand-chosen motion | "Shows roughly how it works" | Any numbers |
| 1 | Kinematic (today) | One motion definition from declared ratios, stroke, lift and phases; collision audited between keys | Ratios and strokes from sources; no part passes through another | Forces, inertia, pressures |
| 2 | Constraint-solved | Joints and constraints declared; a solver computes the motion from the joints, so the mechanism cannot be inconsistent | Kinematics follow from the mechanism; over-constrained or locking designs are found automatically | Forces |
| 3 | Dynamic | Masses and inertias from the CAD, gas pressure from the thermodynamic cycle, friction optional; time integration | Torque pulses, inertia loads, speed fluctuation, balance | Anything outside the stated model (heat, vibration modes) |

For the teaching platform the valuable Tier 3 case is narrow and analytic: a slider-crank with gas pressure and reciprocating mass,
producing the torque curve and the firing-order smoothing a student needs for indicated power, mean torque and flywheel purpose. It
does not need a general physics engine. Choose the solver and the physics library for Tier 2 only when Phase E starts, after trying
what FreeCAD's own assembly tooling and a small Python constraint solver can do; I have not evaluated them yet.

## 10. Explainer video

A video is a sequence of shots, and every shot is bound to a claim so the narration cannot drift from the research.

```json
{
  "shot": 7,
  "claim": "wright-1903/claim-cam-ratio",
  "focus": ["camshaft", "exhaust-rocker-1"],
  "clip": "operating-cycle",
  "camera": {"from": "overview", "to": "orbit-focus", "duration_s": 4},
  "caption": "The cam turns at half crank speed.",
  "status": "derived"
}
```
`claim` points into the evidence dossier, `focus` names component ids from the contract tree, `clip` is an existing baked clip, and
`status` (specified, derived or illustrative) is shown on screen.

Pipeline: research dossier, script (each sentence cites a claim id), storyboard, render, review. The render comes from the same exported
GLB and motion clip that the app uses, through Blender headless (`cad-to-blender`, `present.py`) to frames and then ffmpeg, so the video
cannot disagree with the model. New skill `explainer-video` to record the storyboard rules (status label always on screen, no motion
shown that the tier does not allow). The viewer stays the home of interactive learning; video is for introductions and for lessons where a
guided view of one mechanism is better than free exploration.

## 11. Metrics (how we know it is getting better)

One row per completed study in `knowledge/metrics.csv`, filled by the retrospective:

| Metric | Why it matters |
|---|---|
| Parts, and share built from existing recipes (reuse ratio) | The direct measure of "faster with every part" |
| Wall-clock for a cold build and for a rebuild | Speed |
| Conflicts found late (after CAD existed) versus at research | Wright found its packaging conflicts only in the audit; the target is to find them at the research gate |
| Rungs passed on first full validation | Quality of the first build |
| Rung 9 residual per system | Fidelity to the sources |
| Count of dimensions by status: specified, measured, derived, inferred, illustrative | Honesty and how much is guesswork |
| Estimates later contradicted by a source | Whether the priors deserve trust |

Baseline rows for Wright revision 2 (413 parts) and Langley/Manly-Balzer (358 parts) were filled on 7 October 2026 from the study records; cells the records do not give are left blank, not guessed.

## 12. Proposed project layout

New items marked. Existing code does not move; the new directories sit beside it, and nothing under `cad_pipeline/` or `knowledge/`
imports from `src/`, so extracting this into its own repository later is cheap.

```
cad_pipeline/                      existing: research gate, spec, generators, audits, per-engine builders
  grammar/        NEW   levels 1-5 first, each op with parameters, regeneration test, recognition cue
  recipes/        NEW   named parts built from grammar ops (extracted from wright_*/langley_* builders)
  intent/         part_card.py exists (Phase A); geometry-intent schema and the compiler to spec.py are NEW
  fit/            NEW   render matching view, silhouette and edge comparison, residual report, parameter refinement
  estimate/       NEW   closure.py (exact checks), priors.py (loader enforcing candidate vs sourced)
  physics/        NEW   tier 2 constraint solve, tier 3 slider-crank dynamics
  storyboard/     NEW   shot schema, claim binding, Blender render driver
knowledge/        exists (Phase A)   git-tracked text only
  priors/*.json           Phase D
  part-cards/*.json       five families so far; the gallery's data
  patterns/*.md           slider-crank, cam-follower, gear train, master-and-link rod, ...
  retrospectives/YYYY-MM-DD-<study>.md   template exists
  metrics.csv                              baseline rows exist
.agents/skills/                    existing eight skills, plus NEW: part-understanding, geometry-grammar,
                                   engineering-estimation, explainer-video, (later) physics-simulation
docs/ai-mechanical-engineer.md     this document, with the review log
cad-studies/                       existing: one folder per study (dossier, inventory, build notes)
```

Rules carried over from the repo: CAD and model binaries stay in Drive, not Git; every dimension keeps its provenance; the
specified/measured/derived/inferred/illustrative distinction survives every new stage.

## 13. Roadmap

Ordered by dependency. Effort is relative (S small, M medium, L large), not a time estimate.

| Phase | Deliver | Exit test | Effort |
|---|---|---|---|
| A. Foundations (done 7 Oct 2026) | `knowledge/` skeleton, part-card schema and validator, metrics file with Wright and Langley baseline rows, retrospective template, this document agreed | Part cards for five existing parts (piston, rod, valve, cam, gear) validate; baseline rows exist | S |
| B. Grammar levels 1-5 and first recipes (audit done 8 Oct 2026) | Audit of builder overlap (`docs/builder-overlap-audit.md`, done); golden-file test and one primitive table; `grammar/` with tests; recipes for the five parts in the audit's order; Langley switched to them first, then Wright | The same part regenerates identically from its recipe; reuse ratio measured | L |
| C. Fit loop (rung 9) | Render matching view, comparison, residual report, bounded refinement; run on Langley Plate 79 | Residual report per system on Plate 79; a deliberately wrong dimension is detected (mutation test) | M |
| D. Estimation and plausibility | `closure.py` lifted from the Langley research generator; priors loader; rungs 11 and 12 first versions | Closure checks run in the research gate; one prior promoted from candidate to sourced | M |
| E. Motion tier 2, then slider-crank tier 3 | Constraint-solved motion for one assembly; torque curve with gas pressure and reciprocating mass | A mechanism that should lock is detected; torque curve matches the analytic check | L |
| F. Explainer video | Storyboard schema, claim binding, Blender render, one finished 2-3 minute video on a single mechanism | Every caption resolves to a claim id; the render uses the exported GLB | M |
| G. Grammar levels 6-7, then 8 | Schedules, surfaces; later generative parameter search | A doubly curved part (inlet runner) reconstructed within a stated residual | L |
| H. Gallery view and assembly from interfaces | Generated browsable gallery from the part cards; assembler that joins variants by compatible interfaces; first new assembly built from the gallery | A new assembly passes rungs 4 to 6 using only gallery variants | M |

Why this order: A and C give the system memory and eyes (without them nothing else is measurable); B makes it faster; D makes it
sceptical; E and F make it show its work. Phase C uses an open item we already have (the Langley Plate 79 overlay), so it starts with
a real target.

## 14. Fortnightly review

A 45-minute conversation, one written entry per review. Agenda:

1. What we built since last time and what the metrics did (reuse ratio, late conflicts, rung 9 residual).
2. What went wrong or was slower than expected, and the rule that would prevent it.
3. What to promote: recipes, priors (candidate to sourced), skill edits.
4. Decisions needed (list below) and what to park.
5. The next two weeks, in order.

Review log (newest first):

| Date | Decisions | Promoted | Next two weeks |
|---|---|---|---|
| 2026-10-07 | Structure written from the vision notes; all five section-15 decisions accepted as recommended; component gallery idea adopted (section 4a, decision 6) | Phase A delivered: `knowledge/`, part-card validator, five part cards, baseline metrics, retrospective template. One stale note found: build-notes says 12 idler teeth, code and inventory say 20 | Start Phase B with the builder-overlap audit; fill in the cards' open gaps as sources allow; first review about 21 October |

## 15. Decisions

Decided 7 October 2026 (all five recommendations accepted):

1. **Scope.** Engines first, with a general grammar. Domain depth comes before breadth; the grammar modules stay engine-agnostic so a
   second domain can reuse them.
2. **Physics.** Tier 2 (constraint-solved) in general; Tier 3 (dynamic) only for the slider-crank cycle with gas pressure and
   reciprocating mass. No general physics engine for now.
3. **Home.** Stay in the 4212 repository, keeping the import boundary in section 12 (nothing under `cad_pipeline/` or `knowledge/`
   imports from `src/`). Extract into its own project when a second product needs it.
4. **First image-fit target.** Orthographic drawing plates only (Langley Plate 79 first). Photographs come later, once the loop is
   trusted on calibrated views.
5. **Explainer video.** Blender-rendered MP4s for explainers, hosted like the other assets; the in-app viewer stays the home of
   interactive learning.

6. **Component gallery.** Adopted as the browsable face of the part cards and recipes (section 4a): family, variant and instance levels,
   interfaces on every variant, growth by extraction from built studies only. Data first (Phase A, done), generated view and assembler
   later (Phase H). A student-facing version is parked.

Open: none. Revisit at the first review.

## 16. Parked

Generative optimisation (grammar level 8), full multi-body physics, general-purpose image-to-mesh generation (the repo rejects it:
reconstruction here is evidence-bearing and parametric), automated manufacturing drawings, a student-facing components track in the app.
