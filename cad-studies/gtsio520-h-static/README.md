# GTSIO-520-H detailed static rebuild

User decision: complete the detailed static engine before animating it. This study extends the R4 crankshaft/core; R4 remains archived and its default layout is unchanged. The current complete **foundation package** is `build/gtsio520-static`: 395 native solids, 1,327 feature operations, six forked third-order dampers, split crankcase, main inserts, decks/fasteners and open sump. It is not a completed engine.

The foundation passed saved FreeCAD/STEP verification, 1,157 exact saved-shape neighbouring pairs without overlap, the documented damper contacts/end gaps, native/direct agreement, Blender/GLB identity/scale round trips and the actual exported-file audit (1,147 neighbouring pairs, zero detected overlaps, no waivers). See foundation-validation.json and interference-audit.json. All tests retain their original tolerances. The new study does not replace the student viewer or an existing Drive release.

The cylinder milestone is archived in `cylinder-milestone/`; local artifacts are under `build/gtsio520-static-cylinders-r16`. It specifies 839 parts including the foundation, steel barrels/flanges/fins, integral aluminium heads/rocker boxes, inclined valves and seat inserts, guides, nested opposite-hand springs, split keepers, hollow stamped covers, five attaching sets per cover, spark-plug interfaces and crowned pin-plug ends. The complete FreeCAD/STEP package passed strict reopening and volume checks with no exception. Both direct-development exact checks and the native-derived exported GLB passed without overlaps or waivers. The saved-native all-pair check is tracked separately in the milestone validation record.

The next accepted static milestone is retained in `valvetrain-development/`, with local artifacts under `build/gtsio520-valvetrain-r5`: 1,128 saved engineering solids and 4,337 native feature operations. It adds the four-journal nine-lobe camshaft, twelve eight-piece hydraulic lifters, hollow ball-ended rods, beaded housings, seals/seating springs, rounded rocker pads/cups and internal shaft retention. Strict FreeCAD/STEP reopening, saved/direct agreement, 4,249 exact native neighbouring pairs, the actual final GLB's 4,191 neighbouring pairs, and Blender identity/scale checks pass without overlaps or waivers. Eleven component views and four source-comparison views are inspected and hash-bound.

These are current static modules, not a finished engine or a source-resemblance acceptance. The source comparison remains **needs another iteration**: head fin packets, cover contours, forged rocker shaping and lifter axial proportions need refinement. Substantive failed prototypes remain in their earlier records and build directories. Both milestone folders provide frozen inputs and rebuild entry points. The original R4 default remains unchanged.

Research and learning records:

- foundation-research.md: original/source anchors, calculated fit choices, axial recalibration and substantive failures.
- foundation-image-review.md: feature-presence comparison; source resemblance needs further iteration.
- cylinder-research.md: reviewed construction, manufacturing anchors, estimates, native-method adoption, fit repairs and orientation corrections.
- cylinder-milestone/: exact inputs, fixture/check records, locked source comparison, envelope sanity check and rebuild entry point.
- valve-train-research.md: sourced cam/lifter/retention identities and design closure for the valve-train reconstruction.
- valvetrain-development/: frozen input, engineering deductions, failed hypotheses, method fixtures, final native/export validation, inspected source comparison and rebuild entry point.
- foundation-spec.json / foundation-inventory.json: unchanged saved-package inputs preserved before expansion.

The next accepted static milestone is `drive-development/`, with local artifacts in `build/gtsio520-drive-r4`: 1,210 solids and 4,760 native feature operations. It adds 82 parts for the rear timing gears/cluster, quill, reduction pinion, integral propeller gear/shaft, bearings/thrust retention, oil-transfer route, seal and front case hardware. Strict native/STEP, saved/direct, all 4,808 exact native neighbours, saved support/fit/oil-path probes, Blender and all 4,473 final GLB neighbours pass. Eleven plates and six comparison scenes are inspected. Casting/shaft contours and source resemblance still need another iteration. Completed exact-pair evidence now supports conservative per-pair reuse and restart checkpoints; see `docs/static-audit-reuse.md`.

Remaining static work includes rear accessory gears, pump, starter, alternator, magnetos and governor; H induction/intercooler/turbo/exhaust; fuel/air-pressure lines, ignition leads and lubrication connections; cooling baffles and minor source-backed fasteners. Every added module needs source inventory, design interpretation, interface checks and post-build source comparison. Exact manufacturing contours, spring/damper tuning, loaded spherical-seat contact, hydraulic behaviour, hidden passages and OEM cam timing are not established by these static checks. Animation follows detailed static completion.

Native CAD/Blender/STEP/GLB artifacts remain local and ignored. Git holds specifications, rebuild code, evidence and validation records.
