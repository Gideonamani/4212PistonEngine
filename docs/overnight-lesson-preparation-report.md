# AMT 04212 lesson preparation and browser review report

Prepared 12 September 2026. This report turns the supplied module outcomes, nine-day schedule, lesson plans, presentation deck, and selected FAA handbook extract into a reviewable web-lesson backlog. It records what already works in the browser, what has been prepared as a lesson design, and what still needs instructor approval before implementation or publication.

## Review outcome

The current browser experience is ready to review as the first interactive lesson: **M2 Follow one four-stroke cycle**. It uses the detailed operating-cylinder model, the one shared 720-degree state, section view, valve motion, explicitly illustrative cycle cues, and three self-check questions. It is not a completed replacement for the nine-day module. The remaining lesson units below are prepared curriculum designs, not yet published web lessons.

No GitHub Pages or Drive production asset was changed or promoted while preparing this report.

## Curriculum basis

| Source | What it establishes | How it is used here |
|---|---|---|
| `Notes/Module Description AMT 04212 - Piston Engine.docx` | Sub-enabling outcomes 3.7.1 to 3.8.4 and their required knowledge, calculation, maintenance, and inspection capabilities | The primary curriculum authority for outcomes and assessment boundaries. |
| `AMT04212 - 9-Day Master Schedule.docx` | Nine-day sequence, Daily Quiz activities, Tests 1 and 2, practical days, group work, and final examination | The primary sequencing authority. |
| `Lesson Plans/AMT04212 - Lesson Plan - Day 1.docx` through `Day 9.docx` | Day aims, student activities, assessment criteria, teaching aids, and lesson-specific objectives | The primary authority for each day’s learner-facing purpose and formative evidence. |
| `Notes/Aircraft Piston Engine Slides - 21May2026.pptx` | Existing explanatory material and its slide sequence | Retain its terminology and use the web activities to make the concepts observable and practised. |
| `Notes/AMT Handbook - Powerplant (FAA-H-8083-32B) 22-57, 328-329, 369-412, 434-458.pdf` | FAA supporting reading: reciprocating-engine design and operating cycles; removal/replacement; maintenance and operation; light-sport engines | Supporting technical reading. Manufacturer data remains the authority for a particular engine’s maintenance limits and procedures. |

## Lesson-design rules applied

The prepared web lessons use a common pattern: orient the learner, ask for a prediction, let the learner manipulate or inspect the representation, explain the result, then use a short retrieval check with feedback and retry. This gives a clear next action, keeps explanations short enough to read beside a model, and makes progress visible without collecting learner identity or transmitting answers.

The pattern is informed by public learning-design principles visible in Khan Academy’s mastery practice and immediate explanatory feedback, and Brilliant’s visual, hands-on conceptual exploration. It is an adaptation for aircraft-engine education; no third-party lesson content, branding, or proprietary material is copied.

All pages must continue to label the difference between a documented claim, a CAD/profile-checked mechanism observation, a reconstruction, and an illustrative teaching cue. A visually persuasive animation is not evidence of a manufacturer timing value, a service limit, pressure, temperature, flow rate, or airworthiness decision.

## Detailed lesson inventory

Status key: **Ready to review** means there is working local browser content. **Prepared design** means objectives, interactions, checks, and source links are defined but the browser activity is not yet implemented. **Instructor decision** means the item cannot responsibly be finalised without academic or configuration confirmation.

| Unit and course day | Learner should be able to do | Prepared web lesson and formative evidence | Source traceability | Status |
|---|---|---|---|---|
| 0. Orientation and evidence literacy - Day 1 | Explain the module route and distinguish a source-backed fact from a modelled or illustrative statement. | A short start card introduces Explore, Learn, and Check yourself. Learner opens the modelling-status note for one part and classifies one statement as documented, reconstructed, CAD/profile-checked, or illustrative. Exit: identify why a section view is not a measurement. | Module learning context; Day 1 orientation objectives; Slides 1-5; project evidence rules. | Prepared design |
| 1. History and continuing role - Day 1 | Sequence major developments from early powered flight through current general-aviation, FADEC, LSA, and future contexts; explain why engine trade-offs changed. | Interactive timeline with six milestone cards. Learner matches an engine/configuration to an era and explains one trade-off: power-to-weight, cooling, reliability, controllability, efficiency, or maintainability. Exit: 5-item chronological retrieval check. | Day 1 plan; master schedule Day 1; Slides 6-43. | Prepared design; factual wording requires source check before release. |
| 2. Engine fundamentals and classifications - Day 2 | Define reciprocating-engine terminology; compare four-stroke Otto, two-stroke, Diesel, and Wankel cycles; classify inline, V, radial, rotary, and horizontally opposed arrangements. | Card-sort activity first asks learners to predict the arrangement from an outline, then reveals a labelled view and a short function/cooling explanation. A comparison matrix asks for one advantage, limitation, and common use only where source-supported. Exit: configuration and cycle sorting check. | Outcomes 3.7.1-3.7.3; Day 2 plan; Slides 44-114; FAA extract pp. 22-57. | Prepared design |
| 3. Four-stroke operating cylinder - Day 2, M2 | Relate crankshaft rotation, piston direction, connecting-rod angle, valve state, and the four ideal strokes over 720 degrees; identify the evidence boundary of the cues. | Existing `Follow one four-stroke cycle` guided lesson: each step asks for a prediction before the learner chooses **Reveal observation** and the shared 720-degree model moves to 90, 270, 450, or 630/720 degrees. It includes an optional gas section and five self-check questions with retry and explanation. | Outcome 3.7.1; Day 2 objectives; Slides on four-stroke/ideal versus practical cycle; FAA extract pp. 46-57; `docs/m2-operating-cylinder-learning-design.md`; `web/m2-cylinder-lessons.json`. | **Ready to review**; physical-device and instructor gates remain open. |
| 4. Power-generation assembly - Day 3 | Identify the crankcase, crankshaft, connecting rod, piston, rings, cylinder barrel/head, valves, and relevant materials/functions; relate the parts as one power-generating assembly. | Model-led identification path: find, select, isolate, and state each part’s function before reveal. A section-view task follows force/motion from piston pin through rod to crankshaft. Exit: label five internal parts and match each to its principal function. | Outcomes 3.7.3 and 3.8.1; Day 3 plan; Slides 116-163; FAA extract pp. 22-45; component registry. | Identification supports **Ready to review** in Explore; guided sequence/check is prepared design. |
| 5. Valve train, firing order, mixtures, bearings, and drives - Day 4 | Explain valve action, lead/lag/overlap as a concept, firing order by configuration, mixture purpose, bearing function, and propeller/accessory drive roles. | Guided valve train trace: select cam/lifter/pushrod/rocker/valve and predict which part moves next. A separate firing-order visual uses a clearly labelled representative sequence, never claiming a variant-specific sequence without a cited configuration. Exit: valve-train ordering and mixture-purpose check. | Outcomes 3.8.1-3.8.3; Day 4 plan; Slides 168-192; FAA extract pp. 22-57 and 369-412. | Prepared design; exact timing, firing order, and ratios need configuration-specific evidence. |
| 6. Performance and parameters - Day 5 | Calculate displacement, compression ratio, and basic power values; distinguish IHP, BHP, FHP, THP, and efficiency types; reason about environmental and mechanical power losses. | Worked calculation panel uses a supplied question, exposes one step at a time after a learner attempt, and gives unit-aware feedback. A cause-and-effect simulator changes density/temperature or a mechanical fault state qualitatively; it must not claim an uncited numerical engine result. Exit: one compression-ratio calculation, one PLAN-formula interpretation, and one fault-to-performance explanation. | Outcomes 3.7.4 and 3.8.1; Day 5 plan; Slides 196-244; FAA extract pp. 46-57 and 369-412. | Prepared design; confirm the course’s preferred equations, units, and marks before implementation. |
| 7. Operation, defects, removal, overhaul, and preservation - Day 6 | Describe general operating checks, separate scheduled/unscheduled maintenance, sequence removal/installation at a high level, recognise common defect categories, and explain preservation purpose. | Scenario cards begin with a symptom or inspection observation. Learner chooses the next safe information-gathering step, then sees the reasoning and a reminder to use the applicable maintenance manual. A preservation ordering activity sorts drain, protect, seal, store, and return-to-service checks. Exit: defect category and preservation sequence check. | Outcomes 3.7.4 and 3.8.1; Day 6 plan; Slides 246-265; FAA extract pp. 328-329 and 369-412. | Prepared design; not a maintenance procedure or return-to-service authority. |
| 8. Light-sport engines - Day 6 | Describe LSA-engine characteristics and compare the Rotax 912/914 reference example with other common LSA configurations at the intended course level. | Compare air/liquid cooling, cycle, configuration, and installation context in a limited table; learner decides what must be verified in the engine’s own manual before maintenance. Exit: match a feature to an LSA-engine example and identify the governing data source. | Day 6 plan; Slides 266-275; FAA extract pp. 434-458. | Prepared design; regulatory and maintenance-authorisation content needs local/institutional review. |
| 9. Internal and external component practical preparation - Day 7 | Select correct PPE/tools, identify internal and external components, and connect an observed component to a function before the supervised workshop. | Browser pre-lab uses the 60-component explorer as a no-risk preparation station: locate five internal and five external components, state their functions, then print/display a checklist for the instructor’s issued worksheet. Exit: readiness check; the actual disassembly remains supervised and off-platform. | Outcome 3.8.1; Day 7 plan; master schedule Day 7; Slides 278-279; component registry. | Explore identification is **Ready to review**; pre-lab check is prepared design. |
| 10. Inspection, group synthesis, and module review - Day 8 | Follow a systematic visual inspection sequence, present a subsystem explanation accurately, and retrieve links among types, construction, performance, and maintenance. | Inspection walk-around checklist shows generic observation categories (security, leaks, chafing, damage, connections) and directs the learner to the actual approved checklist. A group storyboard template asks each group to explain one system, its components, its normal purpose, a risk, and evidence source. Exit: cumulative mixed retrieval set, not an assessed grade record. | Outcomes 3.7.1-3.8.4; Day 8 plan; master schedule Day 8; Slides 276-280; FAA extract pp. 369-412. | Prepared design; instructor must approve the inspection checklist and presentation rubric. |
| 11. Exam readiness - Day 9 | Retrieve and explain the module’s core ideas without treating the platform as the examination or storing grades. | A voluntary, local-only cumulative self-check draws from the approved lesson checks. Feedback identifies the lesson to revisit; it does not show a predicted exam score or retain a learner record. | Day 9 plan; all module outcomes; assessment schedule. | Prepared design; question bank requires instructor moderation. |

## Prepared activity blueprints

These are ready-to-author lesson blueprints. Each one deliberately separates the student-facing teaching action from the instructor’s source/moderation work.

### 0. Orientation and evidence literacy

- **Opening prompt:** “Before you trust an engine visualisation, what can it honestly show and what must be checked in a manual?”
- **Student action:** Open the component source/modelling-status panel for the piston and the section-view explanation. Sort four short statements into documented, CAD/profile-checked, reconstructed, or illustrative.
- **Feedback:** Explain that a source-backed part function and a profile-checked position can both be useful, while neither establishes a service limit or a measured thermodynamic state.
- **Completion evidence:** The learner identifies the section view as a visual aid rather than a dimensional measurement.

### 1. History and continuing role

- **Opening prompt:** “Why did engine designers not simply choose the highest-power engine?”
- **Student action:** Place six milestone cards in chronological order, then choose the dominant design concern for each: control, power-to-weight, cooling, reliability, altitude performance, or digital control.
- **Feedback:** Show a concise explanation of the trade-off and point the learner to the relevant slide for the fuller narrative.
- **Completion evidence:** The learner explains one change in piston-engine design as a trade-off rather than a single linear improvement.

### 2. Fundamentals and classifications

- **Opening prompt:** “What must an engine arrangement achieve besides producing power?”
- **Student action:** Match a visual engine arrangement to inline, V, radial, rotary, or horizontally opposed. Then sort four operating-cycle descriptions into four-stroke Otto, two-stroke, Diesel, or Wankel.
- **Feedback:** Reveal the names, basic layout, cooling implications, and a limited source-backed comparison. Avoid universal claims about all examples of an arrangement.
- **Completion evidence:** Correctly identify an arrangement and state one reason its geometry affects cooling, balance, installation, or maintenance access.

### 3. Four-stroke operating cylinder

- **Opening prompt:** “At this crank angle, where is the piston moving and what evidence can you use to decide?”
- **Student action:** Predict first, then choose **Reveal observation** to move the shared model. Inspect 90, 270, 450, and 630/720 degrees, optionally opening the section and ideal cycle cues.
- **Feedback:** Give the mechanism/valve explanation after reveal and keep the distinction between CAD/profile-checked positions and illustrative gas/timing cues visible.
- **Completion evidence:** Complete the five-step guided path and the five-question retry-based self-check.

### 4. Power-generation assembly

- **Opening prompt:** “Trace the path by which a piston force becomes useful rotary output.”
- **Student action:** Locate and isolate piston, piston pin, connecting rod, crankshaft, cylinder barrel/head, rings, and a valve. Drag numbered labels into a force/motion path.
- **Feedback:** State each part’s main function in plain language, then invite the learner to inspect it in the 3D model rather than presenting a static answer sheet.
- **Completion evidence:** Identify five parts and explain the piston-pin-to-rod-to-crankshaft relationship in order.

### 5. Valve train, firing order, mixtures, bearings, and drives

- **Opening prompt:** “Which parts must coordinate to admit charge and seal the cylinder at the right part of the cycle?”
- **Student action:** Build a valve-motion chain from cam/lifter through pushrod and rocker to valve; choose the consequence of an incorrect sequence. Use a separate, labelled representative firing-order visual only after selecting the engine configuration.
- **Feedback:** Explain valve action and the function of bearings/drives. Label lead, lag, overlap, timing, firing order, and ratios as configuration-dependent until the applicable source is selected.
- **Completion evidence:** Sequence the valve train and name the source needed before treating a timing or firing-order value as authoritative.

### 6. Performance and parameters

- **Opening prompt:** “Two engines look similar; why might their useful propeller power differ?”
- **Student action:** Solve a worked displacement or compression-ratio problem. Choose a next calculation step before it is revealed. Then link a changed environmental/mechanical condition to a qualitative effect on power.
- **Feedback:** Show units, formula substitutions, and the difference between indicated, brake, friction, and thrust-related power. Give a hint before revealing a worked step.
- **Completion evidence:** Obtain the correct calculated value with units and give one justified factor affecting power output.

### 7. Operation, defects, removal, overhaul, and preservation

- **Opening prompt:** “What is the safest next information-gathering action when an engine symptom is reported?”
- **Student action:** Work through low-risk scenario cards: abnormal indication, oil-screen observation, low compression, suspected ignition/fuel issue, and storage preparation. Select an inspection/record/manual-reference action, not an unsupervised maintenance action.
- **Feedback:** Explain the reasoning and state that the applicable maintenance manual controls actual limits, tooling, torque, and return-to-service work.
- **Completion evidence:** Classify a symptom as an observation requiring inspection, troubleshooting, removal/overhaul evaluation, or preservation action without making an airworthiness decision online.

### 8. Light-sport engines

- **Opening prompt:** “What changes when the same piston-engine principles are applied to a light-sport installation?”
- **Student action:** Compare a limited set of source-approved characteristics: cycle, cooling, configuration, installation context, and maintenance-data source. Identify which answer is general and which depends on the exact engine/authority.
- **Feedback:** Reinforce that the course example aids comparison; it does not replace the approved data for Rotax or another specific engine.
- **Completion evidence:** State one LSA-engine characteristic and one question that must be answered from the applicable manual or regulatory framework.

### 9. Practical preparation

- **Opening prompt:** “Can you find the part and explain its function before touching the trainer?”
- **Student action:** Complete a five-internal/five-external component find-and-function challenge in the 60-component explorer. Review PPE/tool expectations and the instructor’s practical boundaries before entering the workshop.
- **Feedback:** Provide component function feedback and route the student to the course-issued worksheet; do not simulate authorization to dismantle an engine.
- **Completion evidence:** A locally displayed readiness checklist, followed by instructor-observed practical performance.

### 10. Inspection, synthesis, and exam readiness

- **Opening prompt:** “How do construction, operation, performance, and maintenance evidence connect in one engine explanation?”
- **Student action:** Use a generic visual-inspection order, then build a five-card group explanation: system purpose, components, normal relationship, risk/defect cue, and evidence source. Finish with a mixed retrieval set that links prior lessons.
- **Feedback:** Identify the earlier lesson to revisit rather than awarding an unmoderated course mark.
- **Completion evidence:** A technically coherent group explanation and instructor-approved practical/assessment evidence.

## Current M2 lesson content available now

Open the cylinder model’s **Learn** tab to review the following five guided prompts.

1. At 90 degrees, predict whether the piston travels toward or away from the cylinder head; use **Reveal observation** to show the pose in a section.
2. At 270 degrees, inspect the rod angle and identify the continuously rotating part while the piston reverses direction.
3. Turn on cycle cues at 90 degrees; predict the lesson-profile valve/stream state before revealing it.
4. At 450 degrees, identify the compression region and compare piston position/cue colour with intake.
5. At 630 degrees, inspect the exhaust region; complete the cycle at 720 degrees and observe loop closure.

The **Check yourself** tab asks five questions, each with an optional hint, immediate explanatory feedback, retry after an incorrect selection, and no stored answers:

1. How many crankshaft degrees make one four-stroke cycle?
2. Which component converts connecting-rod force to rotary output in this study?
3. At which positions does the piston reverse direction?
4. What do the coloured charge/flow cues establish?
5. Which observation is supported by the current operation profile?

Local browser verification on 13 September 2026 confirmed the delivered interaction: both the five-step Learn lesson and five-question self-check show their current position. The first Learn prompt holds the model at 0 degrees and offers **Reveal observation**; only that action moves the shared model to the requested 90-degree pose. After selecting an incorrect first self-check answer, the selected answer is disabled, the rationale is shown with a retry instruction, and **Next question** remains disabled. Selecting the correct answer disables the remaining choices, shows the rationale, and enables **Next question**. The model also loaded with all 60 components and enabled both Learn and Check-yourself tabs.

## Browser review before publication

### 1. Run the automated checks

From `4212PistonEngine`, run the following before opening the browser:

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test scripts/test_lesson_pack.mjs scripts/test_training_shell.mjs scripts/test_kinematics.mjs scripts/test_valve_kinematics.mjs scripts/test_cycle_cues.mjs scripts/test_transfer.mjs
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/test_cylinder_motion_profile.py
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/test_operating_release.py
```

This review run passed on 12 September 2026: 12 Node tests passed; the published cylinder asset/profile binding passed; and an unpromoted release candidate was assembled and verified. These are local validation results, not a production promotion.

An additional M3 validation run passed on 13 September 2026: the model registry was valid; the gzip and decoded transport represented identical GLB bytes; invalid, incomplete, corrupted, oversized, and cancelled transfers were rejected before model loading; and the release-assembly test created and verified a 35-file unpromoted candidate. The planned manifest remains `releases/operating-cylinder-20260912.json`; its state is deliberately `planned-unpromoted-candidate`.

### 2. Serve the review site locally

In a separate PowerShell window, from `4212PistonEngine`, run:

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8765 --bind 127.0.0.1 --directory web
```

Then open these local URLs in Chrome or Edge:

| URL | Review purpose |
|---|---|
| `http://127.0.0.1:8765/training.html` | Detailed operating-cylinder lesson. |
| `http://127.0.0.1:8765/training.html?model=gtsio520-h-v5-teaching-engine` | Whole-engine foundation preview; not yet a complete lesson. |
| `http://127.0.0.1:8765/engine.html` | Alternate whole-engine entry point. |

Use `Ctrl+C` in the serving window when finished. The server is bound only to the local computer and does not publish a site.

### 3. Instructor browser-review checklist for M2

1. Wait for the cylinder to load. In **Explore**, rotate, zoom, select a piston/rod/crank component, use **Isolate**, then restore **Show all**.
2. Open **Mechanism motion**. Scrub to 0, 90, 180, 270, 360, 450, 540, 630, and 720 degrees; use Play, Pause, and Reset. Confirm that the 720-degree pose returns to the starting state.
3. Open **Look inside**, enable **Section view**, change all three cut directions, reverse the cut, and confirm the explanatory note is clear that this is a display section rather than a measurement.
4. Open **Operating cycle**, enable cycle cues, select **View gas inside**, then revisit 90, 450, and 630 degrees. Confirm that the wording visibly says that timing and gas cues are illustrative, not measured pressure/temperature/CFD or certified timing.
5. Select **Learn**. Complete all five prompts. Check that the stated learning goal is appropriate, terminology is consistent with the course, and every required action is usable without an extra explanation from the instructor.
6. Select **Check yourself**. Open a hint for one question, answer each question incorrectly once, then correctly. Check that feedback explains why, the learner can retry, the next question remains unavailable until the correct answer is selected, and no answer, name, or completion result is retained after a fresh page load.
7. Open **About** and **Settings**. Check the evidence boundary, the local-only privacy wording, keyboard focus, touch target size, and reduced-interface-motion setting.
8. Repeat the learner flow on the target Samsung Galaxy A16 before signing off M2. Record loading, play/pause, slider, presets, section view, cycle toggle, Learn, and Check-yourself observations using `docs/galaxy-a16-release-check.md`.

## Publication gate and unresolved decisions

Do not publish the prepared lesson inventory as a completed teaching release until the instructor has:

1. Approved the ordered learning outcomes and terminology, especially the balance between identification, cycle explanation, and maintenance inspection.
2. Reviewed each future lesson’s source wording, calculation methods/units, question rationale, and assessment alignment.
3. Confirmed the configuration-specific data required for firing order, valve timing, gear ratio, limits, maintenance actions, and LSA/regulatory claims.
4. Completed the physical Samsung Galaxy A16 M2 interaction check.
5. Reviewed the M3 versioned release and rollback evidence, then explicitly authorised promotion of coherent model, lesson, and catalogue versions.

## Recommended build order after review

1. Apply instructor edits to the existing M2 guided lesson and its three checks; complete physical-device evidence.
2. Build the Day 3/Day 7 component-identification guided layer from the existing 60-part catalogue, because it reuses the strongest working asset.
3. Build the Day 4 valve-train/firing-order layer only after configuration evidence is approved.
4. Build Day 5 calculations and Day 6 maintenance/LSA scenarios with moderated problem statements and explicit manufacturer-manual boundaries.
5. Add Day 8 inspection and Day 9 cumulative practice after the actual practical checklists, rubric, and assessment bank are approved.
