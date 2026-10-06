# Wright engine reconstruction: what we learnt (6 October 2026)

Adding the fully modelled Wright revision-2 engine to the Explore gallery took a working day because the model had been built as a
*static* study and was being asked to be a *running, overlap-free* one. This note records what that exposed, what we built to cope, and
what the engineering skills (`.agents/skills/`) now ask for so the next model starts further ahead. The skills were updated from this
note; the numbers below are from the actual run.

## What was delivered

| Item | Result |
|---|---|
| Model | 413 separate parts, 1,682 native features, 78 rigid bodies, 125 static parts. A second Explore card (`wright-1903-reconstruction`); the Smithsonian scan card is unchanged. |
| Tree | 18 systems, then the 58 research-inventory components, then parts. A part's description is the inventory text for its component (function, interfaces, modelling decision, source locator). |
| Clips | "Operating mechanism (illustrative)": 288 moving parts, 721 keys (one per crank degree, two crank turns). "Systems exploded view": 412 parts in three stages. |
| Interference | Rest pose: 1,121 neighbouring pairs, all touching only. Operating clip: 133 poses, 0 overlaps; the exhaust-to-ignition gear mesh keeps at least 0.078 mm. 185 seats (27 swept). Ledger empty. |
| Not clean | The exploded clip passes parts through each other in transit and at its held poses (below). The accessory exploded clips share that exception. |

## What went wrong, in the order we met it

1. **Overlap was never a design constraint.** The first audit found hundreds of overlapping pairs, nearly all one part passing through
   another where the layout had simply placed them (bolts through caps, shafts through castings, hoses through bosses). Fixing them one at
   a time would have been endless; the fix was a rule: *real parts sit in holes*. A stationary host is cut with the guest's outline grown
   by 0.15 mm (a seat), derived from the audit and stored as data, never typed into the generator (`wright_seats.py`, `seats.json`).
2. **A crude swept seat hid a layout conflict.** A rotating guest cleared by one cylinder around the whole part (a gear plus its sleeve)
   bit 14 percent out of an exhaust valve cage. The sleeve and spring of the sliding ignition gear really do pass through the first
   cage; the honest fix is a stepped silhouette (disc, then tube), which leaves a 4 percent notch and shows the conflict plainly. The
   conflict itself is a layout fact the research should have recorded (below).
3. **Thirty-degree sampling missed six overlaps.** The development audit poses the *exact* motion at chosen crank angles. The real audit
   poses the *baked* clip, interpolating linearly between one-degree keys. A friction wheel turning 4.75 degrees per key about an axis
   230 mm from its node origin drifted 0.2 mm between keys and entered the flywheel; a trip lever followed its cam by the nose only; two
   springs swung into a valve box. Only the audit of the exported file, sampled between keys, could see these. Fixes: put the node origin
   on the axis of every fixed-axis part, ride cam followers 0.6 mm clear along their whole underside, show springs fixed.
4. **The native build took hours.** FreeCAD recomputes a refined Boolean per feature; a casting with 158 features (111 of them seat cuts)
   did not finish in 2.5 hours. Applying each run of six or more same-operation features as one fused tool in one Boolean builds it in
   about ten minutes (whole model 19.5 minutes) with the same volume to 1e-7. Gear outlines as constrained sketches had the same
   problem; direct-solid ("derived") prisms took 20 seconds.
5. **Open CASCADE changes inputs.** A Boolean can leave its base shape invalid (an intermediate fuse went from 21,999 to 6,920 mm³ after a
   later cut used it), so touching a batched result and recomputing emptied two small parts. The generator now validates and meshes every
   part *after* the final recompute, the state that is saved, and rebuilds one Boolean per feature any part that did not survive it.
6. **A reboot ended four hours of background jobs.** Long runs must be restartable from files on disk and print progress; scratch state
   and logs belong in a known folder.
7. **Static checks with hard-coded probe points break when the layout moves.** A "four legs" check probed a point the sleeve notch now
   removed. Probe points should come from the spec's own parameters and sit away from known interfaces.

## What we would do from the start next time

**Research (feeds everything).** Ask what the model must let a student *see operate*, then research that: a motion dossier per mechanism
(driver, ratio, stroke or lift, phase window, source locator, status: documented, derived or illustrative, and every conflict, such as
the two drawing sets that disagree on firing order) and a packaging record (which axes pass through which parts, clearances to
neighbours). The revision-2 inventory listed 58 components and their interfaces but not where the ignition shaft runs relative to the
exhaust cages, so the conflict surfaced in the audit, not in the research.

**Design from the mechanism.** Declare the kinematic skeleton once (axes, ratios, stroke, lift, phases) and derive geometry from it:
the chain from its arc pitch (38 links, exactly 2:1), the gears from centre distance and tooth count, the rocker from the cam
profile and the lift, the generator wheel from the flywheel ratio. Declare the rigid bodies once: they decide the seats, the animation
tracks and which pairs the audit may skip. Use a fast direct evaluator (one to three minutes) for the loop and the native feature history
only for the release.

**Validate in a ladder, on the exported file.** Spec and research gate; valid single solids; research-derived static checks (109 here);
the exhaustive pair audit at rest; the audit of the baked clip between keys; kinematic checks on the exported GLB (ratios, travel, lift,
no drift of fixed axes); saved-equals-recomputed; STEP round trip. Test the checks: a mutation (lever sitting low, ratio wrong) must make
each fail. Resemblance to the sources is the weakest rung (inventory coverage plus dimensional checks; the earlier four-region scan
correspondence was not extended); the skills now ask for per-system figure overlays and a dimension table with locators.

**Animate from one definition.** `wright_motion.py` is read by the dev baker, the Blender rig, the tests and the audit tool, so they
cannot disagree. Drive followers from their drivers (rocker and trip lever from the cam, spring length from valve lift, inlet valves
automatic, chain per link), put origins on axes, bake one key per degree, and label everything the sources do not give as illustrative
(see `cad-studies/wright-1903/revision-2/operating-motion.md`).

## Known limits

- The exploded clip is straight-line stage motion. Pistons and rods cross the crankcase, liners cross the valve boxes and cams cross
  pistons in transit, and the held poses at the end of stages 2 and 3 leave 14 and 18 overlapping pairs. The audit skips exploded
  clips by default (their order is pedagogical). A removal-order planner that uses the audit as its oracle is the next step.
- Springs are shown fixed beside swinging levers; the oil pump and its drive do not move (the source figure and narrative conflict);
  chain plates are straight between rollers, so the chain shows a closed 2:1 drive, not a certified pitch.
- The STEP round trip of four valve boxes exceeds the per-solid volume limit by 0.019 to 0.020 percent while their boundaries agree to
  1e-11 mm. This is the documented numerical exception, re-measured for these files (`step-exception-policy-animated.json`) and awaiting
  instructor review.
- Nothing here establishes historical accuracy, operating dynamics, strength or manufacturing suitability.

## Tools now in the repo

`cad_pipeline/`: `wright_v2.py` (spec), `wright_bodies.py`, `wright_seats.py`, `wright_chain.py`, `wright_motion.py`, `wright_explode.py`,
`wright_contract.py`, `rig_wright.py`, `fast_build.py`, `geometry_to_glb.py --motion`, `audit_motion.py`, `audit_wright_v2.py`,
`package_animated.py`, `generate.py --batch-runs`. `scripts/`: `audit_assembly_interference.py`, `test_wright_layout.py` (in CI),
`test_wright_reconstruction.mjs`, `test_interference_audit.mjs`. A new mechanism follows `cad_pipeline/README.md`, "Wright revision 2 in the
Explore gallery", and the `mechanism-animation` skill.
