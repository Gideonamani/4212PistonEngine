# M2 operating-cylinder learning design

Status: proposed lesson design for instructor review. This document defines what the existing detailed-cylinder model and shared training UI should help a learner do; it is not an approval of M2 or of illustrative timing/gas behaviour.

## Learning outcome

After a guided 25–35 minute exploration, a student can use a 720-degree crank-angle reference to explain how one cylinder converts reciprocating motion into rotation across intake, compression, power and exhaust, and can identify the moving parts/valves that support that explanation.

## Observable objectives and evidence

| Objective | Student evidence | Model/UI support | Evidence boundary |
|---|---|---|---|
| Identify piston, connecting rod, crankshaft, intake valve train and exhaust valve train. | Correctly selects/isolates each named group and states a plain-language function. | Component groups, search, labelled picker, isolate, inspection colours. | Component identity comes from the shared catalogue; colours are teaching aids, not material specifications. |
| Describe the rotary-to-reciprocating relationship. | At two chosen angles, predicts piston direction and locates the rod/crank relationship before revealing the pose. | Play/pause, angle scrub, slow speed, section view, reset. | Piston/rod/crank poses are driven by the shared CAD-derived operation profile. |
| Sequence the four strokes over two crankshaft revolutions. | Places Intake, Compression, Power and Exhaust into the correct 0–720-degree regions and explains why 720 degrees are required. | 0/90/180/270/360/450/540/630/720 presets, crank-angle readout, stroke explanation. | Stroke boundaries are the ideal teaching-cycle convention, not manufacturer valve/ignition timing. |
| Relate valve state to charge/exhaust movement. | At an assigned angle, identifies which valve is open in the lesson profile and predicts whether a schematic stream should be visible. | Valve motion, cycle-cue toggle, `View gas inside`, section view. | Port streams, particles, combustion colour and timing are schematic/illustrative; they are not pressure, temperature, CFD, complete chamber-volume or certified timing data. |
| Distinguish a model observation from an engineering claim. | Marks one claim as CAD/profile-checked and one as illustrative, with a reason. | “What this shows” and source/modelling-status disclosures. | This is an explicit M2 safety objective: visual plausibility is not evidence. |

## Guided interaction sequence

1. **Orient (2–3 min).** Learner rotates/zooms the complete cylinder and uses the component picker to find the piston, rod, crank, and both valve trains. Prompt: “Which parts must move together for the piston to turn a shaft?”
2. **Predict, then inspect (6–8 min).** Instructor assigns two angles, initially 90 and 270 degrees. Learner pauses, predicts piston direction/rod position, then scrubs to each angle and checks in a section view. Slow speed lets the learner connect successive poses rather than infer motion from a single image.
3. **Build the 720-degree sequence (8–10 min).** Learner jumps through the eight 90-degree presets, completes a four-stroke table, and uses 720 degrees to explain why a four-stroke cycle needs two crankshaft revolutions.
4. **Valve and flow reasoning (6–8 min).** With cycle cues on and a gas section visible, learner predicts the corresponding valve/stream state before moving to 90, 270, 450 and 630 degrees. The learner then reads the illustrative-model disclosure and identifies what the cue cannot establish.
5. **Exit check (3–5 min).** Individual short response: label one supplied angle with stroke, piston direction, expected valve state and the mechanism/visualisation evidence category.

## Interaction design rules

- The crank-angle slider is the lesson's source of truth. Play, pause, reset, presets, valve motion and cycle explanations must resolve to the same angle.
- Preserve free exploration. The lesson should add prompts/checkpoints around the current shell, not create a separate model or a duplicate animation implementation.
- Every prompt should name the exact UI action required, then ask for a prediction before the action reveals the answer.
- Use section view to support spatial reasoning, but label it as a display cut rather than a measurement tool.
- Keep the gas-cue toggle optional and visibly labelled as illustrative; do not use cue colour/particles as evidence for a real thermodynamic state.
- The detailed-cylinder lesson remains separate from the full-engine module. It may not imply that valve/gas detail has been verified for all six engine cylinders.

## Minimum instructor review pack

Before M2 sign-off, review the learner prompts, correct-response rationale, terminology, the ideal-cycle disclaimer, and whether the required UI actions remain usable on the target Samsung Galaxy A16. Record a physical-device pass for play, pause, scrub, presets, section view and cue toggle. A rendering model alone does not satisfy this review.

## Implementation status and remaining backlog

Completed local implementation:

1. A compact guided-mode panel is driven by `web/m2-cylinder-lessons.json` and calls the existing shared angle/cycle controls; it does not calculate a second cycle.
2. Five prediction-before-inspection prompts use the named angles 90, 270, 90 with cycle cues, 450, and 630/720 degrees. The learner must choose `Reveal observation` before the lesson applies that step’s model angle; the panel also shows the learner’s current step.
3. Five local self-check questions each provide an optional hint and explanatory feedback. An incorrect selection gives a retry prompt; the learner must select the correct answer before moving to the next question. No learner identity, answers, or completion state are transmitted or stored beyond the page session.
4. Local automated checks cover the lesson pack, training shell, profile/kinematics, valve/cue behaviour, transfer handling, and the unpromoted release binding. A local-browser check confirmed the retry/advance interaction and all 60 loaded components.

Remaining before M2 sign-off:

1. Instructor review of the prompts, terminology, correct-response rationale, ideal-cycle disclosure, and the desired balance of guidance versus free exploration.
2. Decide whether an instructor-visible completion summary is useful. The default remains no learner account, no score persistence, and no transmitted answer data.
3. Run Samsung Galaxy A16 interaction checks against the exact review asset and profile.
4. Obtain instructor approval; only then assess M2 completion.
