# Revision 2: measured checks, repairs and limitations

Reviewed 4 October 2026. This record distinguishes source coverage, static CAD checks, export consistency and unresolved operating/manufacturing claims. The full source interpretation is in [research.md](research.md).

## Source comparison and interface repairs

Inspected the final assembly overview and native-derived first-cylinder section alongside the full Hobbs Figures 5–6. Earlier subsystem/detail plates were compared with Figures 1–2 and 7. The revised section exposes the short liner and projecting piston, separate bronze rod ends, liner/head/case junction, open valve cages, springs, stem/guide arrangement and two-cheek rocker. The named views also expose bearing stations, separate cams/washers, the slotted spark control, chamber contacts/busbar, generator friction wheel, timing links and tensioner.

The sloping casting perimeter, ribs, cheek/rod shapes, springs, ports and accessory proportions remain estimated static geometry. The faceted casting is a polygon-sketch approximation of the source's casting contour. Neither the overview nor the section is a trace of an acquired production drawing. Source drawings and the scan do not establish all hidden dimensions, thread fits, exact cam laws, magneto internals or operating phases.

Assembly review found concrete problems and reopened the feature plan: the lower coolant feed was moved between liners; the liner flange received a counterbore; main journals received through-bores and upper cap access; induction/manifold passages were opened; spring/guide and rocker-cheek clearances were repaired; valve roller contact was corrected. The inlet, chamber, exhaust and upper liner oil-jet interfaces were checked in saved geometry. A generic oil-drive cross shaft would intersect the water jacket, so the disputed drive was removed and its source item marked deferred.

The final saved model has 413 engineering solids and 1,251 native operations. All 107 bounded static checks in `engineering-checks.json` passed. They include documented nominal dimensions, selected opening/clearance/contact checks and parameter propagation in a disposable reopened model. They do not cover strength, compression ratio, dynamic timing, every manufacturing fit or complete service-line continuity. The equal-arc-length chain layout produces unequal chord spacing (about 24.38–25.43 mm for a nominal estimated 25.4 mm pitch) and remains explicitly unverified as an operating chain.

## Saved metadata bounds discrepancy

The original reopening comparison reported bounds errors for 74 parts, with a maximum 3.65517 mm, while relative volume differences stayed below 5.4e-7. Investigation found that the default shape bounding box depended on optional cached tessellation, most visibly on springs. This was metadata disagreement, not a change to native engineering features. The failed comparison remains in `metadata-differences.json`.

Metadata now uses `Shape.optimalBoundingBox(False, False)` to exclude triangulation and tolerance expansion. `refresh_metadata.py` checked native file hashes and volumes before normalization. The final verifier independently checks this canonical metadata after reopening. A native feature regression test checks stable bounds before and after reopening as well as actual sketch/spring parameter regeneration.

## STEP mass-property exception

The engineering STEP reopens as 413 valid solids. Aggregate relative volume difference is 9.6985e-6, within the unchanged 1e-5 limit. The original 1e-4 (0.01%) per-solid volume limit failed for four ported valve boxes; the worst relative discrepancy is 1.89668e-4 (0.018967%). Each box differs by approximately 36.87–36.97 mm³ out of 194,942 mm³. The original comparison is retained in `step-differences.json`.

Repeated boxes have nearly equal volumes and can change volume sort order on import. The independent boundary investigation matches suspects by physical center rather than their position in the volume sort. All four matched boxes have identical optimal bounds and identical 112-vertex/50-face counts. It sampled every vertex and the closest point on each face to its centroid in both directions. The maximum point-to-boundary distance was 1.33042e-11 mm. See `step-boundary-checks.json` for every result and saved-file hashes.

**Inference:** these measurements support numerical mass integration as the explanation rather than a visibly displaced surface. They do not prove the exact CAD-kernel cause or continuous boundary equivalence. FreeCAD delegates volume calculation to Open CASCADE's mass-property routine; [FreeCAD TopoShape implementation](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/Part/App/TopoShape.cpp) and the [OCCT mass-property API](https://occt3d.com/dev/doc/refman/html/class_b_rep_g_prop.html) distinguish standard and adaptive integration methods. No stronger accuracy claim is based on those API descriptions.

An explicit reviewed exception in `step-exception-policy.json` accepts only these saved native/STEP hashes and exactly these four failing IDs, with mass error no greater than 2e-4 (0.02%), sampled boundary/bounds error no greater than 1e-6 mm, matching topology counts and the unchanged aggregate limit. The final report retains `strict_solid_volume_check_passed: false` and `validation_status: passed_with_documented_step_mass_exception`. New geometry requires fresh investigation and review. A negative regression test rejects changed file hashes, additional failing parts, excessive mass differences and distorted boundary evidence.

## Presentation and coverage

The Blender/GLB verification checks all 413 engineering IDs, 26 named view/title/visibility configurations and export axes/bounds. The measured bounds difference is zero. Sixty-one hidden CAD-derived section copies are presentation objects; they do not enter engineering STEP/GLB counts. Section copies are snapshots with source links and must be regenerated after engineering geometry changes.

The gallery includes 26 rendered plates, a contact sheet and a 78-second MP4 with 26 chapters; the video was decoded successfully. These are inspection views, not an engine-operation simulation. Eleven pipeline unit tests passed in total (ten native/research/backend tests plus the exception-scope regression).

All 47 numbered Figure 5 callouts and 11 supplemental records have explicit source-to-CAD dispositions: 55 simplified, one deferred drive and two outside the cropped assembly. This accounts for the selected source inventory; it does not certify authentic manufacturing geometry. Four exterior scan-region deviations remain in the check report, at an inferred scale, without claiming a global mesh reconstruction.
