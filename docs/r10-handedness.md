# R10 handedness: the model is now the real engine's way round (20 October 2026)

The GTSIO-520-H R10 card was the left-right mirror image of the real engine. It is now reflected once, as a whole, and the viewer, the contract, the audits and the closure checks all describe the reflected model. This page says what was wrong, what the one parameter does, how the geometry was reflected, and what is derived, inferred or still open.

## What was wrong

- The manual (X-30045A, section 1-7 and Fig A-4-1) puts cylinders 1, 3 and 5 on the **right** looking forward from the accessory end. In the model they were on the left.
- The user, looking at the real engine from the front, sees the alternator on the left; in the model it was on the right (the alternator pad is on the right crankcase half in the manual, A-3-1).
- Cause (inferred): the build used the three.js habit "X is right" together with +Z forward, which is a left-handed combination. In a right-handed frame with +Z forward and +Y up, right is `forward x up` = **-X**, and the build had the odd cylinders on +X.
- The closure-check session (the framework of PR #84; its written analysis is a working note outside the repository) tested the hypothesis "the model is the exact mirror image" against every item it could test, and it held: bank side, alternator, governor and magneto pads were all on the wrong side, and the pad layout was right relative to the banks. One reflection fixes all of them.

## The target, and what is sourced

| Item | Real engine (now the model) | Basis |
|---|---|---|
| Odd cylinders 1, 3, 5 | right, -X | manual 1-7, Fig A-4-1 (specified) |
| Even cylinders | left, +X | manual (specified) |
| Numbering and firing order | from the rear; 1-4-5-2-3-6 | unchanged by a reflection (z does not change) |
| Alternator pad | right, -X | manual A-3-1 and the user's observation |
| Governor pad, left magneto | left, +X | manual A-3-1, A-3-2 |
| Right magneto | right, -X | manual A-3-2 |
| Propeller | clockwise looking forward | manual C-3-2 ("Looking Forward"), specified |
| Crank | **counterclockwise** looking forward | **derived** from the propeller line and one external mesh; the manual states no crank direction |
| Starter, fuel-pump drive, tachometer pad | starter -X, fuel pump +X, tach -X | **inferred** from the reflection only; the manual is silent |

The pad-rotation labels of the manual ("clockwise facing the drive pad") come in two self-consistent sets that differ only in a viewpoint no source defines, so they cannot confirm the crank direction (check `pad-rotation-labels-need-a-viewpoint`, `unknown`). Only one reading makes every source line agree, and it is the one the model follows. One cheap physical check by the user would settle it: on a real GTSIO-520 with the rear pads open, turn the propeller by hand in its running direction; the magneto drive coupling, seen from behind, should turn **counterclockwise**. If it turns with the propeller instead, the crank direction (and only that) reverses. The starter side should also be confirmed on a real engine.

## One parameter, two frames

Two frames exist:

- the **CAD frame**: the frozen build (recipes, `part-spec.json`, the gear declarations of `scripts/accessory_gears.py`, `cad_pipeline/gtsio_layout.py`), odd cylinders on +X;
- the **export frame**: what the card shows, odd cylinders on -X.

`EXPORT_MIRROR_X = True` in `cad_pipeline/gtsio_layout.py` says the export frame is the reflection `x -> -x` of the CAD frame. It is the only handedness parameter. It reaches everything else by derivation, never by a second copy:

- **Python motion** (`cad_pipeline/gtsio_review_motion.py`): the maths stays in the CAD frame (`CAD_LAYOUT`, `cad_matrix`, `cad_explosion`) and the results are reflected. A rigid motion `M` becomes `R M R`, so the crank turns the other way about +Z and every body is the exact mirror image of its CAD-frame self. `LAYOUT` is the layout as the export sees it (positions reflected in x, roll angles reversed, bank sign swapped), which is what the closure checks read. The spinning bodies (`spin:` strings) are written in the export frame, built from the same declarations: centre and axis reflected in x, rate negated (a reflection turns a rotation about an axis into a rotation about the reflected axis the other way round). The explosion offsets are the reflected CAD-frame layout; the rear accessory lanes therefore explode outwards on their own side.
- **The contract** records the parameter as `procedural.mirror_x` (written by `cad_pipeline/gtsio_contract.py`, which also mirrors the default camera side in `display.fit_direction` so the first view shows the same parts as before).
- **The viewer** (`src/viewer/core/animated-study-motion.mjs`) reads `procedural.mirror_x` and conjugates every non-spinning body the same way. `scripts/check_gtsio_review.mjs` compares it with the Python definition and re-derives the slider-crank, the rod ends and the part bounds independently, reflected by hand.
- **The closure checks** (`cad-studies/gtsio520-h-static/constraints.json`): `numbering-bank-side` passes with its `accepted` record removed; `crank-rotation-direction` is a normal check; `motion-pins-match-spec-crank` compares the spec's pins with the motion's after reflection (the new `maxsum` function, with `export_mirror_x` bound from the layout); `tdc-vs-crank-pins` reads the motion's pins; two pad checks and two `unknown` checks are new (`docs/constraints.md`).

A reflection is an isometry, so every clearance and overlap of the unreflected model is unchanged by it, and the firing order and the top-centre closure survive (`scripts/test_constraints.py` has the mirror-image test).

## The geometry

The editable CAD recipes could not be re-run in the other handedness here: the frozen R10 inputs (`build/gtsio520-case-contours-r10/`, a 91 MB geometry file and an 8 MB part spec) are an ignored build output that is not in the repository, and the recipes carry the bank sign in many places. So the exported GLB is reflected directly by `scripts/mirror_gtsio_r10.mjs` (run on the unoptimised source, then `scripts/build_gtsio_r10_optimized.mjs`): positions and normals change x, the winding of every triangle is reversed once per shared index buffer so the faces keep pointing outwards, and nothing else changes. Compared with its source, all 1,396 parts have x negated exactly, y and z equal, normals reflected, the swapped winding and the same positive volume. `scripts/test_mirror_gtsio_r10.mjs` covers the shared-buffer case that an earlier version got wrong.

**Consequence.** The CAD sources and the specs stay in the old frame, and the reflection lives in the export. **At the next full CAD rebuild** (when the frozen inputs are back), build in the real handedness instead: flip the odd/even bank sign everywhere it appears (`gtsio_layout.pose`, `gtsio_valve_layout`, `gtsio_valvetrain_pose`, the cylinder, crankcase and head recipes), flip the x of the gear centres, axes and `pad_x` in `scripts/accessory_gears.py`, set the root crank rate to -1 and re-solve the tooth phases, regenerate the spec, then set `EXPORT_MIRROR_X = False`. The starter worm changes hand under a reflection (cosmetic).

## What to review (learner-facing text)

- Part names and the learner file (`web/gtsio520-r10-parts.json`) use "left" and "right" as parts of the real engine's names (left magneto, right crankcase half), which are now where the names say. One phrase is tied to a drawing: "pressed into the right crankcase, to the right of the rear main bearing". It reads the same in both frames and needs the instructor's eye only if the drawing it came from is shown.
- The lesson diagram (`src/components/CycleArtifacts.tsx`) says "Right bank (odd)" and "Left bank (even)", numbered from the rear: now consistent with the model.
- The card's default view looks from the side of the odd cylinders and the alternator, as before (the mirror image of the old default).

## Open

- The crank direction is derived, not confirmed (hand-turn check above, or the handbook X-30129).
- The starter, fuel-pump drive and tachometer pad sides are inferred.
- `gtsio_governor_development` and `gtsio_tach_development` fitted the governor and tachometer senses to the pad labels under one reading of the viewpoint; their docstrings still say so.
- The optional accessory gears turn the same way as the magnetos while the labels give them opposite senses; Fig A-4-11 shows three gears in the adapter, so a third mesh is plausible. Independent of the reflection, still open.
