# Wright engine revision 2: illustrative operating motion and exploded view

Revision 2 was a static study: its research (`research.md`) concluded that the sources do not support an authenticated running
animation, because the cam law, the valve and ignition phases and the firing order are unresolved (`inventory.json`, gap "Cam law and
phases"). This note records the **illustrative** animation added on top of it, what in it follows the sources, what is a teaching
choice, and how it is checked. The motion is defined once in `cad_pipeline/wright_motion.py` and baked by `cad_pipeline/rig_wright.py`.

## What follows the sources

| Motion | Basis |
|---|---|
| Crank, rods, pistons | Four-throw crank, stroke 101.6 mm, rods about 245 mm (estimated from Figure 6, `part-spec.json`), pistons sliding in horizontal liners: exact slider-crank geometry, so the rod swings through about 12 degrees. |
| Timing chain and cam | 6-tooth crank sprocket driving a 12-tooth cam sprocket (L1 p.65, N1): the exhaust camshaft and its cams turn at half crank speed, exactly 2:1 (`chain-layout.json`). |
| Exhaust valve | Cam, two-cheek rocker with a roller at each end, valve roller on the stem end (H1 p.21, Figure 5): the rocker angle is solved from the cam profile, and peak valve lift is the documented nominal 7.9375 mm (5/16 in., H1 p.57). The valve spring compresses by the same amount. |
| Inlet valves | Automatic: they open from suction against their springs with no positive drive (research.md, "Gas path"). |
| Ignition drive | An equal-size spur gear drives the solid ignition shaft in the opposite direction at the same speed (H1 pp.25-26): the ignition shaft turns at half crank speed against the cam shaft. |
| Generator | The friction wheel turns against the flywheel rim with no slip, so its speed is the flywheel speed times the rim-to-wheel radius ratio, opposite in direction. |

## What is a teaching choice (labelled illustrative everywhere)

- **Firing order 1-3-4-2.** H1 finds the two source drawing sets incompatible in firing order, so it is chosen, and every phase below follows from it.
- **Valve and ignition timing.** Each exhaust valve opens through the middle of its cylinder's exhaust stroke; the inlet valve lift is a smooth bump through the middle of its intake stroke; each contact snaps open 20 degrees before compression top dead centre and closes again. None of these is a source value.
- **Ignition levers and springs.** The trip lever rides 0.6 mm off the cam along its whole underside (the gap also covers the linear interpolation between 1-degree keys); the igniter lever and moving contact swing together through 8 degrees. The igniter main spring and inter-spring are shown fixed: they are not stretched as the lever swings, which would need a deforming part.
- **Cam lobe shape.** A base circle and a circular nose, sized so the roller-follower lift is the nominal valve lift and the lift window (159 degrees of crank) lies inside the exhaust stroke. The sources give no cam law.
- **Chain.** Plates are straight between rollers (no chordal action) and the roller pockets carry the involute-style relief a roller sweeps on entering and leaving a wrap. It demonstrates a closed 2:1 drive, not a certified roller-chain pitch.
- **Oil pump.** Its drive route is deferred (the narrative and Figure 5 conflict), so the pump and its gears do not move.

## Exploded view

A single "Systems exploded view" separates the engine system by system in three stages: covers, induction and pipework; valve gear and
ignition; then the crank assembly, the piston-and-rod assembly, the camshafts, the timing drive, the flywheel and the generator.
Directions and order are pedagogical, not an assembly procedure; the casting is the fixed reference.

## How the motion is baked

The clips are baked at one key per crank degree and a viewer interpolates linearly between keys. That is exact for a part that turns about
its own node origin and for slow, smooth motion, and wrong between keys for a part whose origin is far from its axis: the generator
friction wheel (4.75 degrees per key, axis 230 mm from the origin) drifted 0.2 mm between keys, enough to enter the flywheel rim in the audit.
So every part that turns about one fixed axis (crank, cam shaft, ignition shaft, generator wheel) has its node origin on that axis
(`wright_motion.pivot()`), and the rig keys a pure rotation. Parts that swing or follow a cam get clearance margin instead (the 0.6 mm trip
lever gap).

## How it is checked

- `scripts/test_wright_layout.py` (standard library) checks the chain closes with whole links at exactly 2:1, keeps every roller in its pocket
  and clear of every tooth through the motion, the seat rules, and the rigid-body classification.
- `scripts/audit_assembly_interference.py` audits the exported GLB at the assembled pose and at sampled poses through the baked operating
  clip, measures the timing-gear clearance through the clip, and `interference-policy.json` records an empty ledger. Pairs that cannot
  move relative to each other (one rigid body) are covered by the assembled-pose check.
- `cad_pipeline/audit_motion.py` runs the same audit at chosen crank angles from the CAD tessellation, without a Blender export. It poses the exact motion, so it cannot see the interpolation effect above: only the audit of the baked file does, which is why the exported GLB is what gets audited and committed.
- `scripts/test_wright_reconstruction.mjs` loads the released GLB and checks the drive ratios, the slider-crank travel, the valve lift, the exploded stages, the fixed-axis origins and the tree.

Nothing here certifies historical accuracy, operating dynamics, strength or manufacturing suitability.
