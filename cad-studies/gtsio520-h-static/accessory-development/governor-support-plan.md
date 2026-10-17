# Governor support and output-end reasoning

Observed in X-30045A A-3-1/PDF16: the governor guide is bored through a lateral
crankcase boss; the pad is on the left case's lower front corner. A-4-19/PDF37
shows the shaftgear as one component with a shoulder and longitudinal output
detail. A-12-4/PDF77 inserts that shaftgear in its bearing before the camshaft
is laid into the left case. A-3-3/PDF18 describes a bearing feed and separate
governor supply/return ports. These passages remain absent from this candidate.

Deduction: the support must connect to actual case stock, transmit gear loads
through that stock and preserve the transverse running guide. A free-floating
support sleeve would misrepresent the documented construction. The mounting
pad and shaft axis must be established together, because later governor and
oil-transfer attachments depend on them. The shoulder needs a clearance
recess and an eventual axial-retention interface; merely adding a collar does
not prove that the shaft is retained in both directions.

Calculated anchors: selected bore0.8755in =22.2377 mm, within B-12's
0.8750-0.8760in range. Selected diametral gap0.0024in =0.06096 mm, within
B-2 row62's0.0014-0.0034in range. Journal =22.17674 mm. These are selected
new-part targets from ranges, not measurements of a particular engine.

Packaging estimates: bearing faces x=-104 and -31 mm give73 mm length;
outer radius18 mm leaves6.88115 mm radial stock. The inner support face is
3.5 mm behind the estimated driven cone's large-end plane. A lower web joins
the boss to the existing case; a70 mm clipped-square pad sits at x=-116 mm.
Both actual stock continuity and neighboring components must be checked.
This is geometry planning, not a strength, lubrication or thermal analysis.

R2's historical interpretation, superseded below: the estimated output neck,
outer collar and six straight splines treated longitudinal ink lines as drive
detail. The enlarged original does not support that inference. Do not use
those R2 details for a mating governor. Pad studs, pressure/return ports and
final retention remain deferred in R3 as well.

Method: preserve frozen R4 native and direct stock. In a small saved study,
add parametric native boss/web/pad Booleans to the full frozen left-case BREP,
reopen, compare new native edits with an independent evaluator, export/re-read
STEP, and edit the linked bore/journal. The base stock is explicitly frozen;
its original editable history stays in R4. This study is not a complete
1282-part saved-engine rebuild.

Audit reuse: bind source stock to a passed saved-package audit and the exact
archive/specification hashes. Extract one identity-placement saved tip instead
of loading thousands of document objects. Test new parts and added case
material against every bound-meeting existing part. Reuse the previous bevel
sweep only after the changed shaft's contact region is independently shown
unchanged and the earlier native/report hashes match. Whole-engine saved and
final exported-file acceptance remain separate gates.

## Enlarged-source correction, R3

Enlarging A-4-19:1 exposed unsupported detail in R2. The source shows a recessed
end and a shoulder beside the gear. R2 had placed a male external spline and
collar at the outside end. Those additions were plausible generic hardware,
but the drawing does not support them; they are superseded.

R3 preserves a continuous22.17674 mm journal, moves the estimated12.5 mm
radius shoulder to x=-34..-27.5 mm and puts its recess at the inner guide face.
The end opening is represented by a simple estimated circular recess, radius
4.5 mm and depth14 mm. Its actual internal drive profile remains unresolved.
Longitudinal ink lines are not interpreted as splines or lubricant grooves
without additional evidence. The original enlarged drawing and an isolated
same-component comparison are retained in the R3 review.

The new shoulder lies above the bevel driver's entire axial material envelope.
A comparison crop based on the two complete original AABBs therefore contains
all possible gear intersection material and excludes the changed noncontact
shoulder. Verify the old/new shaft material in this crop before reusing the
prior24-position result. The case/shaft edits, STEP, static neighbors and
axisymmetric shaft sweep still need their own new checks. Retain R2's valid
geometric results as historical development, not current source fidelity.

The R3 saved study subsequently passed four native/direct agreements, two
linked bore/journal edits, STEP four solids, ten local pairs and three further
development neighbors. Both directions of the complete intersection-support
material comparison measured zero difference. This crop may contain several
disconnected solids; its dedicated comparison accepts valid positive-volume
regions, while the ordinary part-agreement gate still requires single solids.
The first run stopped on that distinction; the retry skipped construction
only and repeated every saved geometry gate. The shaft envelopes clear the
case at every angle. The five-part presentation export passed seven pairs.
These are local study results; complete native engine integration is pending.
