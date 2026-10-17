# Tachometer installation design reasoning

Source reviewed: X-30045A A-4-16/PDF33 exploded oil-pump assembly, B-3
tachometer-shaft running-fit row84, and H specifications. The original manual
has SHA256 c8e7828e978772a55a9271d7bf678cc464ac772987ce7c44cfa3af89c9c21a07.

Observed: separate driver bevel24 and dowel23 on oil shaft22; separate driven
bevel47, dowel46 and shaft45; cover35 includes a transverse chamber and output
pad; oil seal36, four pad studs37, gasket38 and blank39; access gasket48,
closure49 and hardware50-52. The pressure/scavenge spur pair is a different
mechanism. The exact tooth counts, installation dimensions and shaft diameter
are not specified by this exploded view.

Deduction: oil-shaft half speed and tach half speed require a1:1 branch.
The known clockwise pad rotation constrains cone orientation as well as shaft
rates. With a provisional outward +X output, use the proven -Z/-X fixture
rotated180 degrees about Z: input +0.5 about -Z, output -0.5 about +X. Placing
the driving cone facing the opposite direction would reverse the output;
matching ratio alone is insufficient. The +X side choice remains an estimate,
not an H-specific arrangement fact established by speed specifications.

The24/24 module1 face4 mm tooth method already passed its native fixture.
Set common apex z=-216 mm: the input large-end face is z=-228 mm, the
transverse tooth envelope remains behind the scavenge-body face z=-198 mm.
Extend the oil shaft from z=-198 to -231.25 mm. A separate pinned input hub
and output hub transmit torque; shoulder and cover guide provide a load path.
Use an estimated9.5 mm output journal plus selected diametral running
clearance0.00225in (0.05715 mm), within manual row84's0.0015-0.0030in range.
This does not establish an OEM shaft diameter or pin fit.

The housing needs a chamber for both complete rotating envelopes, a through
output guide, separate seal seat, side access aperture and closure, plus a
blank mounting pad. Keep the existing pump cover studs separate from access
screws. The blank must clear the shaft end. Do not count a hidden gear inside
uncut solid stock as a completed interface.

Readiness: ready for a labelled development installation and small native
fit checks. Pin diameters, chamber dimensions, seal dimensions, output socket,
side choice and fastener sizes are estimates. Final case contours, cable
attachment detail and operating animation are deferred. Verify all new
connections and neighboring pump parts before whole-engine integration.

The first direct trial cleared its42 solids and static neighbors. Reviewing
the pin's load path prompted a refinement before native adoption: move the
input pin centre to12.25 mm behind the apex and use16 mm length. Its complete
1.25 mm radius cross-section then lies inside the8.5 mm radius cylindrical hub,
whose axial extent is10-15 mm behind the apex. This avoids relying on a tooth
near the small cone end to cover the pin. Explicit pin-minus-unbored-hub
Booleans must be zero for both input and output pins. This checks material
support geometry; it is not a pin shear/bearing-stress calculation.

The three changed parts are the oil shaft, driver bevel and driver pin. Their
other39 development parts retain identical per-part keys and can be adopted
from the direct build cache. The refined preflight checks static geometry;
the required24-position installed sweep is performed on the final saved
native subset, rather than repeating it in both evaluators after this edit.
