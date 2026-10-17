# Cross-axis development, 14 October 2026

The frozen R4 rear-drive package remains under its own saved-shape audit. New
development is generated separately in `build/gtsio520-governor-r1`; its status
must not replace the R4 review or imply installation acceptance.

## Governor

Re-read A-4-19/PDF37: a separate keyed driver, transverse shaftgear and Woodruff
key. The key carries torque; the cylindrical bore establishes concentricity.
The shaft journal requires a fitted bearing surface rather than a decorative
shaft passing through an arbitrary oversized case hole.

The candidate uses the previously tested 55/34 spherical-involute method.
Its common apex is an **estimated** z617 mm, selected from the current cam's
front journal end z589.8 and nose end z608. The driver back face is z600, with
an overlapping hub extending to z590.3. Both axes/phases are declared centrally
in `scripts/accessory_gears.py`. Bore and journal calculations use the recorded
manual fit ranges; all tooth counts, hub dimensions, key dimensions and the
installation datum remain estimates. A circular-segment Woodruff key has its
own identity and matched clearance pockets. The transverse shaft currently
lacks its output coupling and retention details.

Next acceptance steps: build the native subset, measure the key/cam/hub
interfaces, compare the source figure, establish bearing-stock continuity and
pad attachment, then check the installed pair and neighbours. No case contour
work or governor oil-circuit claim follows merely from this specification.

## Tachometer

A-4-16 shows separate bevel gears24/47, pin23, shaft45 and pin46, within
cover35 with access cover49 and gasket48. It is not the scavenge spur pair.
A 24/24, module1, face4 mm pair is an explicit method/packaging estimate for
the half-speed output. The generalized fixture retains 24 tooth-pitch samples,
parameter edits, native reopening and STEP checks. The earlier 55/34 result is
preserved and is not counted as proof of this different geometry.

The finite `run_crossaxis_development` job waits for the existing native audit,
then runs the tach fixture and governor subset serially. It stops if the audit
or a subsequent stage fails. It does not run a final engine acceptance audit.

## Starter-shell mass integration diagnosis

The first saved audit completed5091 pairs with zero overlaps, but rejected
one recipe-agreement measurement: native361874.741356 mm3 versus direct
361858.186246 mm3. Fresh native reconstruction, sequential direct cuts,
batched direct cuts and local-frame construction reproduced the discrepancy.
Identity conversion changed both calculated masses substantially and did not
resolve it, so canonicalized mass was rejected as a repair. Partitioned
original-solid measurements varied with the number of integration sections;
see `shell-sliced-diagnosis.json`.

Both original-solid Boolean differences measured zero. The audit now retains
the raw mass outlier and requires valid bidirectional material differences
below the existing1e-5 mm3 tolerance for any mass/bounds outlier. Bounds still
must meet the existing1e-5 mm limit. The raw-volume screening limit remains
1e-6; no mass is rewritten and no shell-only exemption is present. A real
0.008 mm3 cavity and0.01 mm translation both fail the regression fixture.

[FreeCAD1.1.1 TopoShapePyImp.cpp](https://raw.githubusercontent.com/FreeCAD/FreeCAD/1.1.1/src/Mod/Part/App/TopoShapePyImp.cpp)
was reviewed at `getVolume`: the Python property delegates to OCCT
`BRepGProp::VolumeProperties`. This establishes the measurement implementation,
not a new engine dimension. The geometry discrepancy diagnosis is empirical.

Reproduce with `python -m cad_pipeline.diagnose_starter_shell`, then
`python -m cad_pipeline.probe_shell_agreement` using installed FreeCAD Python.
`shell-agreement-fixture.json` retains original BREP hashes and rejection
measurements. The failed audit is preserved under the ignored R4 package.
Its measured intersections are eligible for reuse because the intersection
method, original geometry and thresholds have not changed.

## Optional accessory drive evidence

[EASA TCDS IM.E.248 issue01, 8 November2022, page8](https://www.easa.europa.eu/sites/default/files/dfu/tcds_im_e248_gtsio520_20221108.pdf)
lists the H optional drives at1.14 times crank speed, versus1.5 for the C.
The same table supports governor0.809, tachometer0.5 and gear-driven generator3.
Direction is specified looking at the drive pad. Retrieved14 October2026 via
the indexed primary-source table; direct PDF opening failed in the web tool.
This confirms the variant distinction, but does not identify intermediate
gears, their centres or the H-specific route. Do not join the H accessory
output rigidly to the current1.5-speed magneto merely to close the inventory.

## Efficient bevel checks and next face-gear method lead

The tach fixture's original whole-gear distance calculation was slow. Five
completed original poses were preserved with the original native/log hashes.
The revised check clips both intersection operands to their overlapping
original AABBs, which contains every possible material intersection. Clearance
is separately measured in a declared region around the shared pitch generator;
it is labelled contact-region clearance rather than a global shaft distance.
All five completed original gap/intersection measurements agree within1e-5.
The24/24 tach fixture passed24 poses, native edits/reopening and STEP; minimum
contact gap0.0436527 mm. See `tach-bevel-method-checks.json`.

For the next alternator method, [NASA/TM-2001-210614, PDF7 and sections6-7](https://ntrs.nasa.gov/api/citations/20010037595/downloads/20010037595.pdf)
describes face-gear surfaces generated by an involute shaper and limits against
undercutting/tooth pointing. It distinguishes the mating pinion from a shaper
with slightly more teeth used to localize contact. This supports researching
an envelope/relative-motion construction instead of assuming a radially
extruded crown profile is conjugate. The paper concerns modified helicopter
transmission geometry, not Continental OEM dimensions. No face-gear method
fixture or engine installation is accepted from this source alone.

## Earlier R1 development checkpoint

The1279-part R4 native package passed saved reopening/STEP,31 interface checks
and5091 exact neighbouring pairs:5091 reused,0 new Booleans,0 overlaps.
1206 ordinary recipe-agreement measurements were reused using exact identities;
73 were checked again, including the shell material-difference gate. A later
checkpoint lock was recovered with bounded retry and provenance-bound
`--resume-exact`; the earlier complete checkpoint remained available.

The new governor subset contains three valid native solids and eight feature
recipes. Native reopening/direct agreement, STEP, six static pairs against the
actual cam nose,24 pitch samples and a journal-diameter edit passed. Minimum
contact-region gap is0.044431 mm. Deliberately shifting the driven gear by half
a tooth produces34.675988 mm3 overlap; the cropped support calculation agrees
with the whole-original-gear Boolean within1e-5 mm3. Its exported3-part GLB
passes both neighbouring pairs with no overlap or unverified mesh.

The source review remains **needs another iteration**: driven-shaft neck/collar
and output-end detail, integrated case bearing stock/pad, retention and oil
passages remain pending. The full engine still needs integration of the new
parts and repeated whole-assembly/export checks. The tach pair is a passed
method fixture, not an installed cover/shaft assembly. The reviewed native
render and source-vs-candidate page are under `build/gtsio520-governor-r1`.

Regression checks:9 saved pair-cache mutation/provenance tests and4 recipe
reuse/Windows checkpoint retry tests passed. The mesh checker uses the existing
Python3.11 audit dependencies. No viewer release or engine-operation clip was
changed.


## Governor support and installed tach development

The governor R2 study passed its full frozen-case patch, source guide/journal
edit, STEP4 solids, ten local pairs, three additional development neighbors
and five-part exported mesh (seven neighboring pairs). R2 remains a historical
geometric pass, not the current source-resemblance result: an enlarged OEM
shaft drawing exposed an unsupported male end spline and outer collar.
R3 replaces them with a continuous journal, gear-side shoulder/counterbore
and a simplified recessed end. The actual internal profile remains unresolved.
Two unchanged native driver/key histories were retained during construction;
new stock/shaft edits were checked again. R3 passed four saved/direct agreements,
two linked edits, STEP four solids, ten local pairs and three additional
development neighbors. The prior bevel sweep was retained after both original
material differences on its complete possible-intersection support measured
zero. The first crop check stopped because a valid cropped region had several
solids; its dedicated region comparator was corrected without weakening the
single-solid part gate. The saved-only retry repeated all saved checks.
R3's five-part export passed seven neighboring pairs. The enlarged original
and isolated corrected shaft render are included in the current local review.

The tach study adds38 parts and revises four existing ones. Its42-part native
subset passed all saved/direct agreements, four linked diameter edits, STEP42
solids,86 original-solid neighboring pairs and24 native installed pitch poses.
Minimum contact-region clearance0.0436527 mm. Its direct pump-context check
covered eight additional pairs, all zero overlap. Both pins lie fully inside
uncut cylindrical hubs; the input pin was moved back after reasoning about
its support near the small cone end. Only three recipes rebuilt;39 direct
parts reused their caches. The42-part export passed90 neighbors, with zero
unverified or overlapping mesh. Rendering/lighting are separate from CAD;
read the recorded native/export hashes rather than inferring acceptance from
an image alone.

The combined1320-part specification remains a development integration plan.
The complete native engine, source-specific interfaces and final engine export
still need their own gates. Alternator face-drive method, H optional route,
pump controls and complete galleries remain open. No operating clip or viewer
release was changed. The frozen-stock extraction helper passed eight source
mutation/roundtrip/schema gates and avoids opening an entire engine document
merely to inspect one saved identity-placement tip.

Final images were inspected directly. A Workbench graphics-driver crash led
to the recorded Cycles CPU fallback, with two render threads and no concurrent
heavy CAD job. The tach header was moved into clear background space. Neither
lighting nor camera edits change the native geometry. The last caption-only
render retained the audited GLB unchanged.

Source binding supplements both local reviews: current native/spec/check
hashes, accepted R4 stock, and unchanged governor driver/key dependencies must
match. Source records with an existing direct-BREP hash reuse it; legacy
records without one require a fresh saved/direct stock agreement. This adds
no pair intersections and does not promote the full1320-part engine.

The completed supplement checked nine affected R4 source parts: two retained
exact accepted direct-BREP hashes and seven legacy parts passed fresh saved/
direct agreements. Both final review pages passed their source, STEP, render
and export hash gates, and every local image/download link resolves. Current
pages are `build/gtsio520-governor-r3/review.html` and
`build/gtsio520-tach-r1/review.html`; the compact source/measurement records
beside this document are the versioned checkpoint.
