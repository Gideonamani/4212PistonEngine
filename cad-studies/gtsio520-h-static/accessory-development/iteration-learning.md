# Accessory reconstruction: retained failures and learning

## First trial

The support gasket's bore split a narrow plate into two islands. The case split tool also missed the highest new stock, leaving each case with an extra disconnected cap. Widening the gasket and extending the split restored single solids. The next export exposed an approximately 1 micrometre lip caused by using the front extension's split datum at the rear. Restoring the original rear datum removed the nonmanifold edges without changing validation tolerances or patching exported triangles.

The first mesh audit could not verify those two case meshes, and found eleven other overlaps. The proposed magneto axes crossed an existing estimated case through-bolt. Keeping the solved pitch distance but changing the angular layout and pad plane removed that conflict. The fuel coupling also had an unintended default twelve-tooth spline in a ten-tooth socket; explicitly sharing ten teeth corrected it. Both counts remain estimates.

## Second trial

All 1,279 parts became single valid solids and all exported meshes could be intersected. The complete mesh audit then found twenty overlaps, mostly with newly testable case stock. A gear's swept envelope must include its rotating attachment heads; clearing only the toothed rim missed crank, cam and idler screws. The correction adds circular screw-head sweep clearances with a declared 0.5 mm margin. Two magneto bolts extended into the idler's plane; their lengths now stop in the supporting front wall. A circular clearance missed the rectangular adapter corners, so the actual rectangular mounting envelope is used.

The interface audit measured passing journal fits, both pump chambers/end clearances, local open ports and bearing-seat stock. Its initial whole-solid spline distance test treated seated end contact as a failure and became expensive on distant gear rims. That diagnostic run was stopped after its logged partial checks; it is not a completed pass. The revised check measures the actual engaged flanks, excluding 0.25 mm at each axial end and distant rims. The complete assembly intersection audit remains responsible for all whole-solid overlaps. A local interface probe cannot replace it.

## Reuse without inheriting acceptance

The corrected third trial reuses 1,269 exact recipe/parameter/tessellation cache entries and reconstructs ten changed parts. The transport helper supports hard links for immutable keyed BREP files, with a copy fallback and independent JSON records. This Windows run used the copy fallback for all 1,269 entries; its saving is avoided reconstruction, not zero-copy transport. Reusing a valid component from a failed assembly does not reuse an assembly pass. Native-pair reuse separately requires exact saved BREP/placement fingerprints and verified source, software and policy provenance.

Three transport tests passed: changed geometry/parameters/tessellation are rejected; invalid or misidentified records are rejected; modifying destination JSON leaves the source intact. Temporary test files use a checked workspace directory because the sandbox's default temporary directory did not permit nested file creation.

## Source identity corrections

The starter front bearing is A-4-18 key24; key23 is its housing. Fuel-system C-3-1 key75 is a plug, not a stud. Replacement stud projection is supported by C-3-6 paragraph h and is represented with a text-derived inventory identity. The C-3-1 figure/legend are PDF159–160. The alternator face gear attaches to the propeller drive gear (our ReductionPinion), as explained in the research note.

Carry the interface reasoning, cache criteria and failure conditions to other engines. Do not carry over these estimated counts, centres, spline forms or mounting patterns as if they were a standard aircraft-engine design.

## R3 source correction

R3's 25 interface and 4,726 mesh-pair checks passed, but subsequent installation-text review exposed a reversed magneto support arrangement. Its native build was stopped before acceptance. R4 moves the adapters rearward and uses the specified long bush projection. Transferable lesson: collision-free geometry cannot establish the correct side of a mounting pad; connect exploded drawings to installation datums before committing to a support arrangement.
