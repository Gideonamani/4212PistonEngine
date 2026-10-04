# Wright engine reconstruction evidence

Accessed 4 October 2026. Target: an editable teaching reconstruction guided by the repo's Smithsonian engine mesh, with nominal 1903 engine dimensions where documented. This is a first candidate, not a dimensionally complete replica. The cropped scan does not expose the pistons, rods, crank throws or water passages.

## Evidence register

| Source | Locator | Grounded claim | Model consequence |
|---|---|---|---|
| [NASA: Bore and Stroke](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bore-and-stroke-old/) | Bore and Stroke | Four cylinders, 4 in bore and 4 in stroke | 101.6 mm bore/stroke; 50.8 mm crank throw |
| [NASA: Crankcase](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/crankcase/) | Cylinders/Radiator/Carburetor; Crankshaft/Pistons/Cylinders | Aluminium casting combines crankcase and water jacket; sheet steel closes crank bays | One case casting plus separate curved cover; two upper water outlet bosses |
| [NASA: Combustion Chamber](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/combustion-chamber/) | Mechanical description | Suction-operated inlet and cam-operated exhaust; valve cages | Opposed valve ends in each vertical valve housing; no invented intake pushrods |
| [NASA: Timing](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/timing-system/) | Mechanical Operation | Six/twelve timing sprockets give half-speed exhaust camshaft; separate ignition shaft | Named 2:1 pitch envelopes; detailed chain/teeth and cam profiles deferred |
| [NASA: Electrical System](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/electrical-system/) | Mechanical Operation | Low-tension generator, friction drive and make-and-break contacts | Generator/bus study; no modern high-tension spark-plug system substituted |
| [Hobbs: The Wright Brothers' Engines and Their Design](https://repository.si.edu/bitstream/handle/10088/18675/SAoF-0005-Lo_res.pdf) | Printed pp. 5-8; PDF pp. 16-19 | Surviving drawing sets conflict; original details uncertain | Preserve variant/history gaps; do not promise exact original reproduction |
| Hobbs, same monograph | Printed pp. 16-26; PDF pp. 27-37; Figures 5-7 | Perpendicular valve boxes; cast-iron barrels/pistons; built-up steel-tube/bronze-end rods | Separate component definitions follow the reported construction; dimensions remain estimated |
| [Smithsonian object record](https://airandspace.si.edu/collection-objects/wright-flyer-1903/nasm_A19610048000) | 3D mesh downloads | Parent mesh lists scale in cm | Candidate 10 mm per imported unit; standalone crop calibration remains unverified |
| Local `web/wright-1903-engine.glb` | SHA-256 `e626ab347a7f587fee2169f81ac3516185aef033adf32c920533f85293b52daf` | One joined triangle-soup surface, not a named assembly | Rebuild semantic parts; never claim the original CAD feature history was recovered |

NASA's timing text and the monograph are not fully consistent about in-flight timing control. The first candidate does not model that control. The existing viewer's high-voltage magneto wording also differs from NASA's low-tension description; that curriculum wording needs a separately scoped correction.

## Mesh-derived layout

`mesh-rois.json` records four manually reviewed exterior valve-housing bands and a radial exclusion gate. `primitive-fits.json` retains fitted centers/radii, point counts and residuals. These are deduplicated vertex-weighted algebraic fits; triangulation density and radial gating can bias results. A small residual is evidence of local circularity, not a dimensional tolerance or global source match.

The fitted pitch is about 129.69 mm and mean housing radius about 34.67 mm under the provisional cm scale. Approximate source-to-CAD alignment is `CAD_mm = 10 * (Blender_imported_XYZ - [-46, 1.2, -21])`. This approximate origin places the shaft/cylinder datums near the scanned layout. The model uses a regular cylinder array, so the measured X drift of individual scan housings is not copied into the assembly.

## Fidelity limits and next evidence

| Area | Current treatment | Evidence needed for refinement |
|---|---|---|
| Interior piston/rod/crank | Source-grounded part types, estimated dimensions, static TDC/BDC pose | A selected Smithsonian or Science Museum drawing set with pin centers, journals, piston and rod dimensions |
| Casting | Simplified joined curved case/box jacket and mounting legs | Dimensioned casting sections, rib and bearing-cap details |
| Valve mechanism | Hollow boxes, simple cages/stems and spring envelopes | Seat angles, cage windows, actual spring wire, lift and cam drawings |
| Drive | Native flywheel and two un-toothed pitch disks | Flywheel drawing, chain pitch, tooth profile, tensioner and shaft interfaces |
| Fuel/cooling/oil/ignition | Named external envelopes and connectors | Routing, mounting, gallery and purchased generator records |
| Scale and agreement | cm assumption; reviewed local circle fits | Independent known external dimension, calibrated point sampling and registered surface comparison |

Follow the [Smithsonian Wright Flyer drawings collection](https://collections.si.edu/search/detail/ead_collection%3Asova-nasm-1986-0152) for full component drawings. Choose one drawing lineage explicitly before refining hidden dimensions. The web-readable monograph was inspected for construction and conflicts; direct PDF download/render was unavailable from the Smithsonian server during this run, so figure dimensions were not transcribed.

The first candidate includes three editable grooves and separate split rings on each piston. Their dimensions and gaps are estimates. It omits true cam lobes, spring wire, detailed chain/teeth, threads, complete fluid passages and several mounting interfaces. Geometric validity is tested separately from those gaps. Its focused Blender plates are identification views, not operating-mechanism validation.
