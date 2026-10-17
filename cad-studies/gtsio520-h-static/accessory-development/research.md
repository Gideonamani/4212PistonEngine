# Internal accessory drives: scoped construction review

2026-10-13. Target: static GTSIO-520-H teaching reconstruction extending the accepted drive milestone. FreeCAD remains the sole geometry master. The user prioritizes internal drives before exterior contours and permits one simplified stationary starter shell around deferred motor/worm/clutch contents.

Source: Continental X-30045A, March 1981, H difference pages June 1980, local `Notes/gtsio520_series.pdf`, SHA-256 c8e7828e978772a55a9271d7bf678cc464ac772987ce7c44cfa3af89c9c21a07. Reviewed full figures A-4-8/PDF25, A-4-11/PDF28, A-4-15/PDF32, A-4-16/PDF33, assembly A-11-5/PDF73-74, A-11-10/PDF75-76, A-12-6/PDF78, construction A-3-1/2/3/PDF16-18, H C-3-2/3/PDF152-153 and replacement fuel-pump instructions C-3-6/PDF156. Existing accepted engine/source review is retained separately.

## Observed construction and consequences

The crank gear drives the idler, cam gear and starter shaftgear. The idler drives the two magneto gears. The compound idler has a separately attached accessory wheel and four screws, plus a bush rotating around a stationary support pin. The pin is installed from the rear with its gasket and two attachments; it is not a floating axle. Magneto gears have bearing journals, sleeves and coupling/adapter interfaces. The main shaft, bushing and housing must have distinct material boundaries and running clearance.

The oil-pump driver has a splined front end mating the internal cam-gear spline. Its long pressure gear meshes a separate driven gear carried on a fixed spindle with end bushes. The same driver shaft carries the keyed scavenge driver behind the pressure pump; the other scavenge gear runs on the fixed spindle. Pressure and scavenge chambers are separate. The tachometer branch has a separate bevel pair and transverse output, not the scavenge driver mislabeled as a tach gear. Its output remains deferred until the bevel method is proven.

The starter external spur wheel and shaft are separate rotating geometry. A front journal is supported in the right crankcase; its rear support is inside the simplified stationary shell. The shell does not implement the worm reduction, clutch engagement or 32:1 motor/crank transmission. A permanently coupled motor animation would be wrong.

The H replacement fuel-pump configuration is selected explicitly: gear74, coupling76 and gasket73; old adapter/seal/insulator69-72 are not mixed into it. Source stud projection is .75in instead of the old 1.31in. The fuel pump itself remains a later external component; its attachment datum and coupling are included now.

## Documented anchors and explicit estimates

B-13/PDF104 provides source ranges for the idler pin and bush, magneto shaft and adapter bush, oil driver shaft and housing bore, driven spindle and gear bore, and starter front journal. Midpoints are used as selected in-range dimensions, not nominal drawing values. Pump chamber depth is 2.6235-2.6250in. Its gear width is derived by subtracting a declared axial clearance. Original table images are retained locally and checked visually before freezing the build.

The existing crank/cam datum is 126mm at estimated 30/60 teeth and module2.8. This iteration retains it. New spur count/module, angular axis layout, axial stations, face widths except the pressure-pump depth, hubs, shoulders, spline counts/profiles, bolt patterns and support-stock contours remain **estimates**. The shared declaration derives centres, phase and rates, rather than the builder placing teeth independently. The magneto path closes 1.5 times crank speed. Fuel speed is derived from the estimated pair and is not asserted to be an OEM specification.

The generic text says optional accessories use internal magneto gear splines, while H lists vacuum drive1.14 and magnetos1.5. Their variant-specific routing is unresolved. The secondary idler wheel can be represented as part of the documented assembly, but no completed H vacuum transmission or pad placement is claimed. The unconnected downstream interface is retained as a named gap.

## Correction to the preceding alternator assessment

The previous review described the face gear as mounted on the crankshaft. A-7-18f/PDF59 and A-11-10f/PDF75 explicitly fasten A-4-20 key23 to the propeller **drive** gear19 with four screws21 and two lock plates22; B-2/PDF93 likewise names the reduction gear. Thus the physical host is our ReductionPinion, coaxial with the crank and quill-driven at crank speed. It is neither mounted on the .667-speed PropellerShaft nor directly on the crank forging. The looser A-12-10 wording is resolved by the explicit assembly instructions. Retain this correction when implementing the front face drive.

## Native method and acceptance plan

Reuse the saved/reopened linked polygon/extrusion involute method on FreeCAD1.1.1/OCCT7.8.1 and the shared gear_geometry phase solver. Use stepped cylinders, matched bores, native linked spline polygons and Boolean housing chambers. Unknown cast contours remain simple fitted stock for this internal phase. Do not use a tapered spur extrusion as evidence of an authentic bevel or face gear; prove those methods separately.

Development checks: valid single solids, all current mesh neighbours, measured shaft/bush fits, source-based pressure chamber depth and end clearance, positive spline/key engagement and mechanical support. Final: hash-bound native extension, save/reopen and strict STEP, independent direct agreement, complete neighbour enumeration with exact prior-pair reuse only for unchanged saved geometry, actual GLB intersections and source-comparison views. Geometry acceptance, source resemblance and manufacturer fidelity are separate. No operating animation, stress, pump capacity or manufacturing claim is made.

## Magneto support correction after R3

Observed: A-10-7/PDF71 specifies a .942in bush body, 1.454-1.458in forward flange projection from the adapter parting surface and a 1/16in-deep 45-degree flange-end bore chamfer. A-12-12/PDF81 mounts the adapters on the upper rear four-stud pads; A-3-3/PDF18 places the magnetos at the front. The previous short/front adapter interpretation was wrong despite passing intersections.

R4 models rear adapters with long forward-projecting flanged bushes, rearward shaft journals and front coupling slots. The selected projection is 1.456in; the estimated rear mating datum is -74.5mm and the gear rear face -37mm, giving a calculated .5176mm flange gap. Body diameter, projection and gap are independently measured on built solids. Adapter outline, bolt layout, seal envelope and coupling/retainer arrangement remain estimates; internal oil grooves and full axial retention are deferred. This is a corrected support relationship, not an OEM-exact magneto assembly.
