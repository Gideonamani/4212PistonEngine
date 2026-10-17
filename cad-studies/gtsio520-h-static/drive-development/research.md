# GTSIO-520-H cam drive, reduction and propeller support

Reviewed 2026-10-10 before feature planning. This phase extends the accepted valve-train package, keeping the detailed static engine ahead of animation. It is a source-led teaching reconstruction with calculated estimates, not a recovered manufacturing drawing or an authenticated serial-number configuration.

Primary engine source: Continental X-30045A, March 1981 / relevant June and October 1980 leaves, original `../Notes/gtsio520_series.pdf`, SHA-256 `c8e7828e978772a55a9271d7bf678cc464ac772987ce7c44cfa3af89c9c21a07`. The user-supplied reviewed DOCX was consulted for the H ratio: `C:/Users/user/KeonGeraldo/CodeProjects/DigiMan/work/deliverables/gtsio520/GTSIO520_full_reviewed.docx`, 37,163,918 bytes, SHA-256 `5bee23535a64031dc8f660298c36a274598f570076e3c018aa8ba990556db5f9`. The original scan controls construction and ambiguous values.

Inspected full figures/legends: A-4-4 H front photograph (PDF23); A-4-8 gear train with all 25 keys (PDF25); A-4-19 camshaft with all seven keys (PDF37); A-4-20 crankshaft/propeller assembly with 42 keys (PDF38); A-4-40 timing marks (PDF48); A-4-41/42 seal installation and shaft photograph (PDF49); B-2 longitudinal limits chart (PDF97). Read construction/torque/oil paths A-3-1/2/3 (PDF16-18), assembly A-11-3/4 (PDF75-76), A-12-1/2/3 (PDF77-79), fit/backlash tables B-2/3 (PDF93-94), Table 6 (PDF103-104) and H specifications C-3-2/3 (PDF152-153). C/D/H share the crankshaft assembly family in Table 11 (PDF117). Other variants' exterior pictures do not determine the H induction or accessory layout.

## Design interpretation

Observed: the rear crank gear drives the cam gear directly. The smaller cluster is separately bolted to the cam gear and supplies the fuel-pump branch. Six crank gear screws and a locating dowel are distinct from the four unequally indexed cam screws. Their hole patterns must agree with the existing shaft datums, rather than being independently drawn on each wheel.

Observed: the crank's front internal splines drive a separately splined quill, which drives the reduction pinion. A retaining plate uses two screws, followed by a retaining ring. The quill has a split end and a line-milled tooth; assembly instructions align these to the crank oil tube and journal hole. The propeller shaft is a separate, higher shaft with an integral spur gear, ground bearing lands, a front flange and oil-transfer parts. The thin transfer tube is not a torque-carrying quill.

Deduction: the quill's long, reduced central section provides a compliant torque connection. Its spline ends need positive overlap length with two mating sockets, clear roots/flanks and axial capture. The exact spline count, pressure angle, torsional stiffness and hidden crank oil route are not recovered. Represent the visible coupling with an explicitly estimated straight-sided spline family; do not claim an OEM involute spline or its strength.

Observed/deduced: radial gear loads require shaft bearings supported in line-bored split case stock. Propeller thrust requires the washer/shoulder stack, separately from radial clearance. A global cylindrical gear cavity must not erase bearing support. Use stepped rotating envelopes and station-specific seats. The upper propeller shaft and the lower reduction pinion explain the front case extension; the H photograph constrains its external contour qualitatively.

Oil path: governor return enters the crankcase and the stationary rear sleeve assembly, then the central transfer tube, forward sleeve and propeller. The rear sleeve's right-angle branch enters a case bore. Model those documented interfaces and open passages; stop at the case supply interface while the governor and hidden gallery remain deferred. Do not invent a gallery route through unrelated cast stock.

## Dimensional anchors and estimates

| Quantity | Source / status | Chosen constraint |
|---|---|---|
| Propeller speed ratio | H C-3-2 PDF152, 0.667:1 | 30/45 = 2/3, rounding-compatible; tooth counts remain estimates |
| Cam rate | Four-stroke mechanism / derived | Opposite rotation, half crank rate; OEM lobe timing remains unverified |
| Reduction journal diameter | Table 6 PDF103, 2.6240-2.6250 in | Midpoint 66.6623 mm |
| Propeller journal diameter | Table 6 PDF103, 2.3733-2.3743 in | Midpoint 60.29452 mm |
| Case bearing seats | Table 6, reduction 2.8160-2.8170; prop 2.5625-2.5635 in | Midpoints, with separate steel-backed bearing inserts |
| Running diametral clearance | B-2 rows 40/41, .001-.004 in | Midpoint .0635 mm; radial clearance is half this |
| Propeller endplay | B-2 row45, .006-.0152 in | .010 in / .254 mm, including both thrust washers |
| Reduction endplay | B-2 row46, .0055-.0115 in | Midpoint .0085 in / .2159 mm |
| Crank/cam backlash | B-3 row101, .0035-.0082 in | Midpoint .00585 in / .14859 mm |
| Reduction backlash | B-3 row102, .0013-.0067 in | Midpoint .0040 in / .1016 mm |
| Transfer tube OD / receiving ID | Table 6 PDF103, tube printed .4965-.4960; sleeve ID .4973-.4980 in | Sorted tube endpoints give midpoint 12.60475 mm; receiving ID 12.64031 mm, diametral gap .03556 mm |

The 300-dpi original-table crop confirms the transfer tube's printed endpoints **.4965-.4960** are descending. Preserve that order as evidence, and sort the endpoints for the chosen midpoint. The resulting .0014 in tube clearance lies within B-2 row44-2's .0008-.0020 in range. The small transfer sleeve row visibly gives a suspicious .4095 lower OD alongside .4705; the corresponding crankcase row gives .4695-.4705. Use the latter as the compatible nominal-OD anchor and preserve the conflict. With the .468-.469 in shaft hole, their midpoints imply .0015 in nominal press interference, within B-2 row44-1. In a rigid assembled model, the press seat is represented at contact; free-part interference is retained as evidence and is not an elastic-deformation result.

All axial stations, gear modules/counts, bearing widths, case profiles, groove/clip sections and spline dimensions are estimates. The reduction pitch radii are 50.4 and 75.6 mm from the declared 3.36 mm module and 30/45 counts, giving 126 mm centre distance. The nominal pinion root is 46.2 mm; subtracting the 33.33115 mm journal radius leaves 12.86885 mm of nominal radial stock. This corrects the earlier 11.82 mm note without changing the model. These are packing relationships, not stress validation. The complete rotating envelopes, bearing seats and axial stacks must be measured in saved CAD and checked against every neighbour.

## Flange reference conflict and decision

The H manual names APR 502 Type I, without supplying a detailed flange drawing here. Primary Hartzell [HC-SB-61-227 Rev6 Figure1](https://hartzellprop.com/wp-content/uploads/2012/12/SB227-R06-W.pdf), printed p3 / PDF5, distinguishes two GTSIO-family interfaces: D (eight 1/2-in attachments on 4.00-in circle, no dowels) and N (eight 9/16-in attachments on 4.25-in circle, two 1/2-in dowels). Its [421B/421C application page](https://hartzellprop.com/products/top-prop/cessna/cessna-421b-421c/) lists H/L/N engines together, with D for 421B and N for 421C. That combined list does not identify this reconstruction's H serial-number flange.

Choose the documented D-family pattern as an explicitly selected teaching configuration, with a switchable N alternative. Do not label either as proved for this H serial number. The original Hartzell Figure1 table was rendered and inspected locally; PDF SHA-256 `f1a582852a002e23f46d6410e31b3f9ca0bbf3eb6134fcb273cffb3aec427678`. Outer flange diameter, thickness, centring pilot and angular clocking remain estimates. X-30046A or a measured applicable shaft/flange is the next evidence needed. No propeller or spinner is built in this phase.

## Scope and readiness

Build the two spur meshes, cam cluster and attachment hardware; matched quill sockets and retention; the integral propeller gear/shaft, bearings, thrust retention, oil seal and oil-transfer parts; and fitted split front case stock with source-backed attaching families. Leave alternator face teeth, governor bevel mesh, rear accessories and H external systems to their documented modules. Keep hidden galleries and operating claims unverified.

The mechanism arrangement, resolved tube transcription and source callout identities support this scoped static reconstruction. The linked native polygon/extrusion method passed saved/reopened module, face-width and bore edits, an off-axis origin/roll case, independent direct agreement and strict STEP. Subsequent assembly acceptance requires saved/recomputed positive single solids, strict STEP, direct-recipe agreement, full neighbouring-pair audits, actual final GLB checks and visible source comparison. Source resemblance is a separate result.
