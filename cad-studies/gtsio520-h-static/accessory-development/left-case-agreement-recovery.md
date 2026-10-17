# Left-case agreement and the R3 continuation

R2 completed all 5,715 saved-native neighboring intersections with zero
overlaps: 3,261 were measured and 2,454 exact previous outcomes were reused.
Reopening, STEP and all 31 fitted-interface checks had passed. Overall native
validation nevertheless stopped because one of the 1,440 part-construction
comparisons, CrankcaseLeft, failed. All other part comparisons passed.

Its raw relative volume difference was 1.08199e-6, just above the unchanged
1e-6 shortcut. The required original-solid difference returned a valid
0.000285714 mm³ four-face solid, above the unchanged 1e-5 mm³ material gate.
The reverse difference was empty. This was not an assembly collision or an
invalid input solid. The diagnostic reads the actual saved archive member;
its fingerprint matches the recomputed native shape in the completed audit.
The source native, direct BREP and failed report are hash bound and preserved.

The difference occupies X -0.025 to -0.024, Y40 to45, Z590 to590.1 mm: a
1 micrometre strip at the core/front parting transition near the transfer-inlet
boss. The earlier bearing-web repair trims the core through Z590.1. The older
front extension deliberately uses a different estimated parting datum, offset
1 micrometre into the model assembly gap to avoid a tessellation T-junction.
Both are reconstruction choices, not OEM dimensions or gasket thicknesses.

A first finish-cut trial restored geometric agreement but extended the core
trim through Z590.2. It was rejected because it crosses the intentionally
different front datum. The adopted candidate repeats only the last 0.2 mm of
the original core parting cut, Z589.9 to590.1, after the later operations. Its
X datum remains `-case_split_gap/2`; its upper datum stays unchanged. It gives
valid original-solid differences of zero in both directions. The original
bounds error remains 3.13043e-6 mm. Raw volume integration remains an outlier
and is retained; it is not excused by widening either tolerance.

`systems-left-case-diagnosis.json`, `systems-left-case-core-trim-checks.json`
and `systems-left-case-wide-trim-rejected.json` retain the actual observations
and both trials. The original input fingerprints remain unchanged. The source
audit summary is `systems-r2-native-audit-summary.json`; the complete sealed
pair cache remains in the preserved R2 package.

The correction is a separate candidate at `build/gtsio520-systems-r3`, model
`gtsio520-h-static-systems-v3`. `prepare_systems_r3.py` adopts only the 1,439
individually passed source constructions and appends the tested direct cut to
the independent left-case prefix. A scoped construction certificate explicitly
excludes the failed left-case agreement and does not certify the source engine.
The unchanged face study and its native/edit/STEP/pitch evidence are preserved.
No parameter values change; no unrelated global cache invalidation is needed.

The native stage retains the complete source histories and appends one linked
box cut to the left case. The normal saved/direct, STEP, interfaces, current
native neighbors, bearing support, galleries, renders and exported GLB gates
still run. Previous pair outcomes are eligible only when their actual native
fingerprints and policy/software seals match; the edited case's neighbors are
checked again. The failed source package is never overwritten or relabelled as
passed. R3 remains a candidate until its complete workflow passes.

The finite continuation command, from the existing worktree, is:

```powershell
$env:PYTHONPATH=(Resolve-Path scripts).Path
& 'C:\Python314\python.exe' -u -m cad_pipeline.run_systems_r2 --root build/gtsio520-systems-r3 --base build/gtsio520-systems-r2 --repair-base
```

Check `build/gtsio520-systems-r3/integration-workflow.json` before starting any
job; do not duplicate the running queue. Repair preparation has a one-hour
deadline and the remaining stages retain finite deadlines and checkpointing.

Transferable lesson: keep cast-stock boundaries and machined datum finishing
distinct, including where a later extension deliberately uses a different
modelling datum. A wider cutter can make two evaluators agree while changing
an intended interface. Preserve substantive failures and reject that shortcut;
finish the intended region and revalidate the actual saved assembly.
