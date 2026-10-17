# Face-ring calculation recovery — 16 October 2026

The interrupted R2 job spent more than ten hours on its first complete ring,
without producing a completed part checkpoint. CPU activity alone did not prove
forward progress. Its source, logs, previous native engine and prepared part
caches remain retained locally. No model was released from that run.

The repaired complete 60-slot ring subsequently built in **160.1 seconds** as
a valid positive-volume single solid. The direct full-pair gate subsequently
passed all24 pitch poses with minimum gap **0.03569669 mm**, including the
wrong-phase interference control. Native and whole-engine gates remain separate;
a constructed ring is not a released engine.

## Cause and scope

The sampled shaper cutter used seven radial sections and 124 polygon vertices
per section. The ruled loft has **746 faces**. Patterning it 60 times supplies
**44,760 tool faces** to one Boolean, before the finished part can be cached.
The previously checked seven-slot fixture did not establish full-ring scaling.
The job also lacked a stage deadline and logging inside the expensive operation.

The first instrumented full-ring trial pinpointed an additional bottleneck:
the actual cut had returned, and the process remained in optional
`removeSplitter` (`fast_build.py:128`). The final ring therefore uses the
backend's existing `boolean_refine: false` policy. No meshing refinement is
enabled. The original boundary edges remain; solidity, saved/direct agreement,
STEP, actual neighbors and exported topology are still required. Hole-edit
references apply that same policy instead of silently refining the large ring.

This is a construction/performance problem. Tooth counts, module, packaging and
the sampled shaper envelope are still calculated teaching estimates; this work
does not establish manufacturer tooth geometry or production suitability.

## Alternatives retained

1. The two-tool scheduling probe passed original bidirectional material checks
   and a missing-tool negative control. Sequential cuts took 30.656 s versus
   23.141 s for the bulk cut. This supplied no reason to restart the full job
   with sequential cuts.
2. One machined periodic sector took 5.312 s. Joining two sectors took 13.297 s;
   joining four scaled poorly and was interrupted. A separate boundary sewing
   experiment produced a closed, valid 60-sector solid in about 111 s, but still
   carried 40,740 boundary faces. It was not adopted as a native engine source.
3. Degree-one merged BSpline patches reduced the cutter to six faces. A small
   fixture passed. The actual complete cutter comparison failed: both Boolean
   differences returned approximately the entire cutter volume, despite matching
   original quadrilateral vertices and 35 inspected interior classifications.
   The failure is retained; production specifications reject this representation.
4. An intermediate candidate interpolated long smooth flank curves through the
   existing points, retaining straight floor and first root segments. This is
   explicitly **new geometry between samples**, not exact polygon equivalence.
   The first interpolation exceeded the selected 0.005-module sampled-deviation
   bound (0.00517698 module). Keeping the first root segment straight reduced
   the worst sampled deviation to **0.00286868 module** (0.00458989 mm at m=1.6).
   The bound was not increased. Every interpolation point was retained. This
   representation subsequently failed the strict STEP mass gate by 2.24%; a
   shared-parameter variant failed by 4.36%. Both were rejected for this gear.
5. The selected candidate uses short Bezier spans of degree at most five,
   fixed endpoints and least-squares fits to the original sampled flanks.
   Shorter root spans replaced fits that overshot the declared bound. The final
   maximum sampled curve deviation is **0.00468727 module**, and maximum source
   point residual is **0.00476093 module**. Both remain below 0.005 module.
   This is a new bounded approximation, not exact interpolation or polygon
   equivalence. Counts, physical placement and every other prepared part remain
   unchanged.

The final clipped cutter has **121 faces**, versus the original 746. Its seven-
slot direct fixture built in **19.5 s**, versus 243.7 s recorded for the old
polygon fixture. This is a local measurement, not a full-ring timing claim.
The numerical stability trial met the unchanged native/direct 1e-6 and STEP
1e-5 relative-volume limits: measured errors were about 6.07e-8 and 7.34e-8.
The 24 direct pitch poses all cleared; the minimum gap was **0.03807648 mm**
against the existing 0.02 mm gate. A deliberately wrong tooth phase must still
produce interference. Those checks do not certify
continuous conjugacy, torque capacity, clutch operation or OEM dimensions.

## Remove irrelevant tool interference

The original neighboring polygon cutters actually intersected by
0.000578661 mm³ **outside** the tooth stock. Their overlap begins at about
Z=1.83556 mm in the m=1.6 fixture; the stock ends at Z=1.6 mm. A computational
cap at +1.01 module keeps +0.01 module of tool above the stock, removes none of
the material capable of cutting it, and eliminates this tool/tool intersection.
The original clipped cutters have 0.268536 mm adjacent clearance. The fitted
clipped cutters have 0.267411 mm clearance and zero measured tool overlap.
This is a tool-construction change, not an added physical engine clearance.
It removes an unnecessary closed loop of cutter interference from the bulk
Boolean in addition to reducing the topology size.

## Native authority and comparisons

FreeCAD remains the CAD authority (1.1.1, OCCT 7.8.1). The smooth cutter has a
derived unit master and a native `App::Link.Scale` expression. A Part Compound
wraps the link for STEP export; a bare App Link tip was omitted by Part.export
in the initial small fixture. Uniform module edits remain live. Changing section
definitions or topology requires regeneration, as with the derived gear profiles.
There is no custom Python proxy in the saved construction. The computational
cap is a linked native Part Common before the pattern copies; module edits
update the cutter and its cap together. A pocket-depth fixture proves this link.

The first native/direct smooth-ring comparison reported different default mass
integrals although bounds agreed. The strict original-material comparison was
itself expensive. `partitioned_material.py` evaluates both differences over an
exhaustive angular partition of the complete conservative bounding region.
Every sector contributes to the **same total 1e-5 mm³ limit**. It does not sample
the boundary or grant a separate tolerance to each sector. Tests detect a small
missing feature in the final sector and exercise another partition axis. The
original input shapes are copied for the operations and checked for mutation.

The ordinary fingerprint and raw-measurement fast paths remain. Grafting reuses
an actual bidirectional difference proof already computed by recipe agreement,
rather than immediately performing that same comparison again. No intersection
or assembly acceptance is transferred by a copied feature history.

The full-ring pitch sweep also has a tested working-region optimization. It
intersects the actual complete face solid once with a box enclosing all25
inverse-transformed original pinion clip boxes (24 poses plus the negative
control). Every subsequent measurement retains the original full-face bounds,
so both compared regions and the gap definition remain unchanged. This reduced
the actual face count from **7,153 to 1,028**. Independent overlap and positive-gap
fixtures passed, and the actual first/last full-ring measurements matched exactly.
It is not a proxy gear or a waiver for other neighbors or untested motion.

Method sources are separate from engine evidence:

- [FreeCAD 1.1.1 Boolean Python binding](https://github.com/FreeCAD/FreeCAD/blob/1.1.1/src/Mod/Part/App/TopoShapePyImp.cpp)
  and the installed Part API were inspected for solid operations and constructors.
- [FreeCAD Link properties](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Std_LinkMake.md)
  describe native uniform scale. The installed 1.1.1 API and saved fixtures,
  rather than documentation alone, establish this reconstruction's adoption gate.
- [FreeCAD 1.1.1 BSpline surface binding](https://github.com/FreeCAD/FreeCAD/blob/1.1.1/src/Mod/Part/App/BSplineSurfacePyImp.cpp)
  and installed degree-one constructor documentation informed the rejected trial.
  No FreeCAD implementation source was copied into the mathematical scripts.

## Reuse and recovery safeguards

`recover_face_method.py` requires passed current direct and native local-method
gates and hash-bound native/STEP files. It changes only the previously unbuilt
AlternatorFaceGear recipe. The other 1,439 prepared recipes, all parameters and
the inventory must remain equal as JSON data. The previous specification and
preparation report are archived. A new immutable full-pair study is kept under
`face-pair-r3`; the original `face-pair` and refined `face-pair-r2` trials remain
untouched. The profile and refinement migrations have separate receipts.

The prior direct-gallery pass can be rebound only when every actual audited BREP
hash, audited recipe, parameter, plan and audit-code hash stays identical. The
regular gallery command independently checks those inputs and the installed
engine again before reuse. Mutation tests reject changed solids, recipes,
parameters and audit code. Native galleries and whole-assembly checks remain
separate gates. Static neighboring pair audits retain their existing exact-shape
cache, recomputing changed/new pairs.

The finite queue now records stage start, child PID, elapsed time and log size.
Face stages have a one-hour wall-clock deadline; other stages default to six
hours. A timeout terminates only its child tree and stops the queue. The host
test verified successful exit, failure exit and termination of a descendant.
Complex direct parts and full-pair probes also write periodic Python stack
traces, so a long kernel call can be identified from its actual call site.

Current completion and acceptance are recorded by the hash-bound reports under
`build/gtsio520-face-smooth-r3/` and `build/gtsio520-systems-r2/`. A running stage,
constructed solid or local fixture pass does not imply an accepted full engine.

The complete `face-pair-r3` native gate passed on 2026-10-16 after approximately
32 minutes 40 seconds. Both saved parts agree with their independent direct
construction. The ring's relative volume difference is 8.9901e-9 and its bounds
difference is 7e-7 mm. Editing all four real mounting-hole radius expressions by
0.05 mm also passed independent comparison without changing the saved baseline.
The valid STEP re-read contains two solids; its total relative volume error is
3.1076e-7, below the unchanged 1e-5 gate. All 24 native pitch poses have zero
overlap and a minimum contact-region gap of 0.0356967 mm. The wrong half-tooth
phase produces 96.5644 mm³ of overlap, confirming that the check detects an
incorrect engagement. `face-complete-native-checks.json` retains this evidence.
The queue then advanced to complete direct construction; full-engine native,
installed-neighbor, bearing/gallery stock and exported-mesh acceptance remain
separate stages.
