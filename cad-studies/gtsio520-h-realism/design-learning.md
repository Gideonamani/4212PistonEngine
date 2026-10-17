# Crankshaft design reasoning and learning

8 October 2026. The working loop is **observe -> understand -> deduce -> model -> compare/test -> explain -> learn**. The source remains X-30045A; numerical choices without manufacturer dimensions remain estimates.

## Hypothesis 1: a blade is not a full-thickness crank cheek

- **Original assumption:** extrude the counterweight blade with the cheek's 14 mm selected thickness.
- **Observation:** the user's design review points out the thinner flanges. A-4-30 (PDF43) shows a forked counterweight/bushing section, while A-3-1/2 and A-10-3 describe blades, hardened bushings and oscillating weights on pins.
- **Interpretation:** the blade is the central support between the counterweight fork's sides. Its thickness must allow that mating arrangement and end clearance. It is not the main web transmitting crankpin load between the main journals.
- **Relationship:** blade thickness < cheek thickness; fork-slot width > blade thickness plus the required end-clearance allowance. The actual slot width is still unknown.
- **Modelling consequence:** choose an explicitly inferred 8 mm blade, centred within the 14 mm middle cheek, rather than copying the cheek extrusion depth. Preserve the paired bare bushing seats. Counterweight fork/hardware geometry remains a separate unfinished module.
- **Test:** measure the actual saved bore-wall axial spans and blade centring, then check the complete core for intersections. The relative thickness can be checked; actual fork fit cannot be certified until its dimensions and geometry are available.
- **Transfer:** infer relative geometry from mating sections and assembly/motion purpose; do not carry 8/14 mm into another engine as a universal ratio.

## Hypothesis 2: the cheek's outline does not define its 3D face

- **Original assumption:** a differentiated 2D outline with a uniform-depth extrusion is enough.
- **Observation:** the user's review and the oblique A-4-20 illustration indicate slight taper on the throw-supporting cheek surfaces.
- **Interpretation:** distinguish the forged web from machined pin/journal contact lands. The web can have inclined axial faces while the lands keep their size and station to preserve connections and rod side clearance. This is a construction hypothesis, not a proved stress-optimal shape.
- **Modelling consequence:** use native ruled lofts between inclined polygon sections on the six outer cheeks. Choose an inferred 2 mm thickness reduction toward each crankpin (about 1.13 degrees per face over the 50.8 mm throw). Add full-depth circular support lands at the journal/pin positions; retain the middle load-bearing cheeks at full selected depth.
- **Test:** inspect actual planar surface normals for taper; verify critical diameters and rod side clearance, native recomputation, STEP, and every bound-meeting pair in the full core. Preserve a fixed reference view and add section/edge views when the shallow angle is hard to judge in the exterior image.
- **Transfer:** select a CAD operation that can express the deduced 3D construction. A near-perfect silhouette can still conceal the wrong thickness distribution.

## Hypothesis 3: declared CAD parameters must actually control geometry

The first native loft regression saved indexed polygon-node expressions but a taper change left the solid volume unchanged. This was a real failed propagation test, not a geometry acceptance. Whole-vector-list expressions update the native polygon correctly in the installed FreeCAD runtime. The loft test now checks saved/reopened geometry, actual node coordinates, analytical volume and agreement with the direct evaluator after a taper mutation. Future feature extensions need a similar propagation proof.

## Tested revision-3 result

Saved geometry confirms twelve blade openings with 8.0 mm axial wall spans, centred at the three middle-cheek stations, against the selected 14 mm cheek thickness. Thirty-six retained planar face regions measure approximately 1.1277 degrees from the axial-normal face plane. Native parameter regeneration, direct/native volume agreement, strict STEP round trip and Blender/GLB identity/scale checks pass. The full 103-part saved assembly and exported static GLB have no overlapping pairs under the unchanged policies.

These results support the implemented geometric relationships and the chosen CAD operations. They do not establish the actual manufacturer's blade thickness/taper, a completed counterweight-fork fit or strength. The remaining evidence below stays open.

## Remaining evidence and operations

Exact blade/fork widths, taper angle, cheek profiles and fillet radii remain unmeasured. Separate damper weights, bushings/pins and correct operating clearance still need their own geometry and swept audit. Interpret unresolved cheek openings from a section/part drawing before drilling a guessed passage. The comparison therefore continues to require another fidelity iteration even when the saved solid and static assembly checks pass.

## Learn existing implementation methods too

`implementation-research.md` adds software-method research to the reasoning loop: official FreeCAD feature guidance and original examples, installed-version prototypes, Blender action/export and visual-bake checks, and repeatable inspection settings. Revolve/Fillet fixtures prove editable shoulder construction, not the manufacturer's radius or success on the full forging. Preserve the ruled loft and unrefined union that already passed the actual web tests; bring a researched fillet method back to source review before adopting it. The next project should inherit this tested decision process and its failure conditions, not this engine's estimated numbers.

## Revision 4: calculated estimates can move the reconstruction forward

With explicit authorization to estimate, the known journal/pin and damper-bushing diameters become anchors for linked support margins, root radii and blade/bore envelopes. The adopted coefficients remain selected judgement. The web taper is corrected to stay within its nominal cheek stations; previously its negative inset could intrude into a journal region. Eighteen native root blends replace sharp joins, and the split liners receive matching edge relief. Visible circular features become measured, closed blind recesses with uncertain purpose/depth clearly stated. `crankshaft-estimation.md` and `crankshaft-estimates.json` retain the derivation and scope.

Actual saved toroidal surfaces, blind floors, full-size bearing lands, liner reliefs and root-radius regeneration are tested independently of the render. The full core and exported static GLB remain the assembly checks. A plausible estimate is a testable construction hypothesis; it does not become a manufacturer dimension after passing CAD checks. No requirement to wait for a missing radius prevents this authorized teaching approximation, while hidden oil routes, axial calibration and damper fit remain unverified.
