# Valve-train modelling methods and retained failures

Reviewed 2026-10-09. Runtime: FreeCAD 1.1.1 / Blender 5.0.1. Engine construction evidence is in valvetrain-plan.md; software sources below establish methods only.

## Rounded rocker cup and STEP

The first native cylinder-3 fixture had 75 valid single solids, yet its closed intake rocker lost 32.6% of volume after STEP import. Same bounds and face counts concealed an actual boundary/classification failure. Changing sphere axis, Boolean refinement, cone overlap or the contact pad did not repair it. Removing the cup isolated the failing sphere/cone cavity seam.

A polygonal circular-bowl section revolved about the cup axis preserves a continuous explicit inner/outer profile and an open oil passage. The ball remains spherical. Its chord approximation and radii are estimates, not a manufactured socket drawing. The revised saved fixture passes the original STEP limits: total relative mass error 3.832535e-7; worst individual solid 1.725753e-5. It keeps pad/stem tangency within 1.84e-8 mm and zero intersection. Recheck complete assembly and source shape separately.

## Helix constructor agreement

Primary sources inspected: [FreeCAD 1.1.1 PrimitiveFeature.cpp](https://github.com/FreeCAD/FreeCAD/blob/1.1.1/src/Mod/Part/App/PrimitiveFeature.cpp), Helix execute; [TopoShape.cpp](https://github.com/FreeCAD/FreeCAD/blob/1.1.1/src/Mod/Part/App/TopoShape.cpp), makeSpiralHelix; [PartFeatures.cpp](https://github.com/FreeCAD/FreeCAD/blob/1.1.1/src/Mod/Part/App/PartFeatures.cpp), Sweep execute. The relevant source was read locally as well as checked at its versioned URL.

Part.makeHelix and native Part::Helix do not construct the same curve representation. Native uses makeSpiralHelix on a revolved Bezier meridian and a tightly approximated 3D curve. Original direct sweeps missed the 1e-6 agreement limit for seating/check springs (1.04194e-6 and 3.808914e-6). Changing transition, profile parameterization or global/local placement did not fix it. makeLongHelix passed one spring but failed others; it was rejected.

The direct evaluator now constructs a fresh transient Part::Helix centreline from the spec, copies it, closes the document, and performs its own Part pipe sweep and Boolean operations. It never reads a saved native tip. This shares the primitive centreline algorithm and therefore does not independently validate that algorithm; independent pose, shape, export, saved-history and interference checks remain necessary. Cache keys are versioned for every helix-containing part. The 75-part fixture's worst native/direct mass error is 6.951825e-10 with unchanged tolerances.

The existing sweep profile starts in the transverse plane, rather than exactly normal to the helix tangent. Spring contours remain educational estimates, not wire manufacturing geometry. A path-height edit preserved nearly constant mass, so mass alone was a misleading propagation test. The corrected fixture checks a 0.505 mm decrease in the solid's axial extent and a 0.04518 mm decrease in centreline length; the result survives reopening. A rod-radius edit separately decreases volume from 11585.73 to 10228.65 mm3 and survives reopening.

## Revised case topology

The R16 right-case mesh-only removeSplitter policy did not preserve the revised housing/lifter casting boundary. The first full development GLB left that case unverified even though other parts showed no overlap. An explicit refined native Boolean construction produced a watertight case mesh in the focused trial. The specification now declares boolean_refine=True for that case; mesh-only refinement is removed. Full saved/export verification is still the acceptance gate.

## Transferable lessons

- Solid validity and unchanged bounds do not establish STEP boundary fidelity. Isolate the feature that creates the mismatch and retain failed alternatives.
- Mass differences can reveal different curve approximations; correct the constructor before considering numerical exceptions.
- Test a parameter with a measurement that must respond to it. Coil height needs bounds/path length; tube radius needs mass or section area.
- A clearance hole must cover all stock crossed by its guest. Initial housing bores stopped at the head collar, leaving overlaps in fin stock; the revised bore follows the actual straight guest route.
- Internal retainer bosses must connect to stock while clearing adjacent collars. Their first webs overlapped the collars; adjusted stock contours clear them without deleting the source retention hardware.

## Hollow-feature fusion failure retained

The R3 cup/ball isolated primitive cleared, but its full rocker did not: forged-arm stock filled the additive bowl's void during union. Exact cup/rod intersection was approximately 105.31 mm3, confirmed by the exported GLB audit (all twelve sockets failed, around 103 mm3 after tessellation). The fixture previously checked pad/stem tangency but omitted socket/rod fit; that gap is now corrected.

R4 cuts a continuous revolved bowl and tapered articulated mouth through the complete forging after its additive union. Isolated closed/lifted rockers have zero exact rod intersection and STEP mass errors 7.832727e-7 / 2.131176e-6. The next gates are the fresh native fixture, complete saved assembly and actual final GLB. This is a general lesson: an additive hollow guest does not remove pre-existing host material in its cavity.

## Total rocker endplay

The initial collar inner faces at +/-8.25 mm leave 16.5 - 14 - 2(0.7) = 1.1 mm total play. Checking each visible gap separately incorrectly appeared to satisfy the manual. Keeping the estimated mounting centres at +/-12.75 mm and increasing collar width to 9.3 mm sets inner faces at +/-8.1 mm; total play is 0.8 mm. A-4-36 / A-12-7's .005-.035 in range converts to 0.127-0.889 mm. The saved fixture measures 0.8 mm independently from shaft-end datums and projected solid extents, including both washers. The calculation test checks the complete stack.

The scoped native rebuild method was adopted on this 75-part fixture: four collar histories were regenerated with the existing native builder into a new package; the original was preserved. Unchanged shapes were checked on reopening, the replacement package retained its incomplete-fixture status, and native/direct, STEP, contacts and meaningful edits/reopening passed. Full-assembly replacement remains subject to its own saved/export audits.

The spherical seats retain an estimated 0.05 mm assembly clearance. Rod-length closure is an ideal datum constraint, not a solved pressure-loaded ball-seat contact or a hydraulic/dynamic model. Cam-envelope changes require rebuilding the derived outline; the native journal and rod dimension expressions remain editable.

## CPU rendering fallback (2026-10-10)

The complete R5 GLB exported, then Workbench rendering failed in nvoglv64.dll. Preserve workbench-driver-failure.txt; it does not invalidate the completed mesh export, whose 1,128 parts and 4,191 neighbouring pairs passed without overlaps or waivers. A CPU Cycles comparison fixture rendered and reopened with eight section IDs and unchanged unit scale.

Primary implementation evidence: installed Blender 5.0.1 cycles/properties.py and [versioned Cycles settings source](https://github.com/blender/blender/blob/v5.0.1/intern/cycles/blender/addon/properties.py). Device is explicitly CPU; OpenImageDenoise GPU use is disabled. The first Standard-color trial clipped the part to white. Lower-energy area lights and separate camera-background/ambient shaders restored readable recesses; the failed image remains local. Record the new lighting separately from the locked geometry and camera. A rendering-method pass does not establish resemblance.

The component tour may focus its image plates on the changed systems through group_views. Every engineering mesh still enters the assembly, saved scene and GLB; the validation count is not reduced to the image selection.

## Interrupted native construction and recovery (2026-10-10)

The R3 worker ended after the pause without saving a complete assembly. Its last retained log line was `Building ExhaustCoverGasket6`; no FCStd, STEP or validation package was present. The reason for process termination is unknown. Reusing its development meshes would not recover editable native histories.

`extend_saved_native.py` instead starts from the hash-verified accepted R16 package. The current specification retains 729 histories, changes 110 parts and adds 289 parts. Changed parameter expressions and shared-master dependents are included in the rebuild plan. A first fixture incorrectly treated a dictionary key named `width` as a parameter reference, causing an unnecessary rebuild; the revised dependency scan reads arithmetic-expression names in values.

The saved FreeCAD 1.1.1 fixture interrupts after a rebuilt master, reopens its partial checkpoint, relinks its dependent instance and adds a new hollow component. It also skips a deliberately corrupted newest checkpoint, preserves the base file hash, verifies the four final solids against fresh direct recipes and STEP, changes both an existing and an added controlling parameter, then saves/reopens and exports again. Both recovery tests pass; `native-recovery-method-checks.json` records their scope.

Engine checkpoints are separate hash-bound construction files every 30 new/rebuilt parts. They declare `complete_spec=false` and cannot be accepted as full packages. Reused histories must retain their original mass and bounds under the existing 1e-6 / 1e-5 mm limits. Final native/STEP, direct-recipe, all-pair and actual exported-GLB checks remain mandatory. Recovery improves durability; it does not establish source resemblance or hidden geometry.

Primary API source checked: [FreeCAD 1.1.1 DocumentPyImp.cpp](https://github.com/FreeCAD/FreeCAD/blob/1.1.1/src/App/DocumentPyImp.cpp), `saveAs` and `recompute` bindings. The fixture exercises these installed native APIs. Object-scoped recomputation is available in the binding but has not been adopted as a performance shortcut in this build; complete final recomputation remains required.

To reduce presentation memory use on this 8 GB machine, the renderers release the parsed tessellation lists after copying them into Blender meshes. Blender verification accumulates exact vertex bounds without retaining a second list of every transformed vertex. Identities, copied meshes, units and round-trip tolerance are unchanged; full saved-scene and GLB checks still apply. Presentation overrides merge group titles so the GTSIO crankcase caption does not inherit the Wright water-jacket label or discard its other component names.

The first complete native checkpoint stopped at the unchanged-history guard for `RodBoltB5`: bounds agreed within 4.27e-14 mm and both Boolean boundary differences were zero, but reported mass differed by 1.12447e-6, above the existing 1e-6 limit. `native-reuse-failure.json` preserves the hash-bound diagnosis. An explicit same-recipe native refresh reconstructed this independent bolt and retessellated it instead of reusing its old mass/mesh record. The remaining reuse checks then passed. This does not waive native/direct or STEP acceptance; both are required on the full new package.

The recovery fixture now also reconstructs an unchanged independent part from an intact checkpoint and verifies its identity, volume and preservation of the base package. Both tests pass with that refresh path. Exact-pair validation measures bounding boxes once for the saved pose, avoiding repeated kernel traversals while preserving every candidate-pair test and the original overlap limit.

The final recovery tests also prove dependency propagation through unchanged derived expressions (`width` -> `span` -> `half_span`), then through a shared geometry master to its instance. Changing an input can change a derived dimension even when the derived expression text stays the same. The helper's planning closure now includes that chain; a failed reuse guard is not the normal way to discover stale dependent meshes.

## Final scoped acceptance (2026-10-10)

The complete 1,128-solid native package passed strict saved/STEP checks with no exception, independent direct-recipe agreement under the original limits, and all 4,249 native neighbouring-pair intersections without overlap. The actual final native-derived GLB passed 4,191 neighbouring-pair checks with no unverified parts, overlaps or waivers. Reopening the complete Blender scene and importing that GLB retained every ID and scale with zero bounds error.

All eleven component plates and four neutral comparison views were inspected. Each final comparison scene was separately reopened and checked against its input mesh vertex bounds, part identities, unit scale and locked orthographic camera scale (worst error 2.909e-8 m, unchanged limit 1e-6 m). The lifter half-section is derived from eight saved native parts and explicitly excluded from engineering exports. Numerical and presentation acceptance do not resolve the visible source mismatches recorded in `image-review.json`.
