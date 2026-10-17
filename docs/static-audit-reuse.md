# Reusing static CAD intersection evidence

`cad_pipeline/audit_gtsio_static.py` still enumerates every current pair whose saved, recomputed bounds meet. It now records each result and fingerprints both actual assembled solids. `--previous-pairs` accepts a fingerprint cache or a new audit report containing `pair_cache`. A pair is reused only when both fingerprints, ordered identities, policy, software/kernel versions and source-file provenance match. Any changed shape, placement, linked master, new neighbour or missing outcome gets a new `common(a,b).Volume` calculation. Removed parts cannot leave stale pairs in the current result. Cached failures remain failures until changed geometry is rechecked.

The fingerprint hashes a copied, cleaned BREP plus every assembled placement-matrix element at full float precision. This includes boundary geometry and tolerances, rather than only recipe, part ID, mass or bounds. Cleaning removes mesh data only from the fingerprint copy; original audited shapes are untouched. OCCT meshing can also change topology flags, so the conservative hash can miss reuse despite equal geometry. Such a miss performs another Boolean. We do not normalize flags, round geometry or certify approximate equivalence to increase the hit rate.

The policy retains the original `1e-5 mm3` native overlap limit, original broad phase and recomputed static pose. Source paths and SHA-256 values are verified before reuse; a content digest catches changed cache records. This is local provenance and corruption detection, not authentication of an arbitrary third-party audit. Retain the old native file and specification. Changed policy, fingerprint method or installed FreeCAD/OCCT version rejects the cache; run a fresh audit rather than overriding those checks.

## Existing completed audits

Older reports have full-pair counts but lack per-pair fingerprints. `index_saved_pair_audit.py` opens their hash-bound native file, recomputes and validates every saved solid, checks exact part identities and the complete neighbouring-pair count, then attaches fingerprints to the already completed pass. It retains the original auditor's `doc.Objects` order, including `common(a,b)` operand direction; specification order is not assumed to equal saved object order. It requires a complete valid native package, matching specification/native hashes, the original tolerance, no overlaps and no saved/direct agreement issues. A legacy pass records “at or below threshold”; it never invents exact zero intersection volumes. It does not repeat the expensive Boolean audit or establish a new geometric pass.

```powershell
$cadPython = 'C:\Program Files\FreeCAD 1.1\bin\python.exe'
& $cadPython cad_pipeline/index_saved_pair_audit.py --package build/gtsio520-drive-r4/cad --spec cad-studies/gtsio520-h-static/drive-development/part-spec.json --audit build/gtsio520-drive-r4/cad/saved-shape-checks.json --output build/gtsio520-drive-r4/cad/static-pair-cache.json
& $cadPython cad_pipeline/check_static_pair_reuse.py --cache build/gtsio520-drive-r4/cad/static-pair-cache.json --output build/gtsio520-drive-r4/cad/pair-reuse-checks.json
```

The warm check refuses to calculate any new Boolean: an unexpected miss fails the benchmark instead of launching a lengthy job. Its scope is unchanged-snapshot reuse, retaining the original completed audit.

## New or resumed audits

```powershell
& $cadPython -m cad_pipeline.audit_gtsio_static --package build/next/cad --spec build/next/part-spec.json --cache build/next/direct/brep-cache --previous-pairs build/gtsio520-drive-r4/cad/static-pair-cache.json --pair-checkpoint build/next/cad/pair-checkpoint.json --output build/next/cad/saved-shape-checks.json
```

The optional checkpoint atomically retains outcomes every 100 pairs and at completion. After interruption, pass it through `--previous-pairs`; every current neighbour is still enumerated, and missing or changed pairs are calculated. A partial checkpoint is reusable work, never a completed assembly pass. Reports separate total neighbours, reused pairs and newly tested pairs.

Saved/direct agreement and STEP checks remain separate. This cache covers one static native pose; it cannot replace exported-GLB validation or a baked animation audit between keys. Camera, caption or lighting edits with unchanged CAD/GLB hashes can retain existing engineering audits. A changed export or operating clip requires its applicable audit. Interface measurements can use the same dependency principle later, but are not automatically cached here.

`test_static_pair_cache.py` uses saved/reopened native boxes and a linked instance. It tests parameter/master edits, translation, rotation, new neighbours, removed parts, identical mass/bounds with different internal cuts, retained collision failures and repaired geometry, partial resume, legacy coverage, corrupt records, changed policies/software and altered source files. The engine benchmark and actual test results are retained in the drive study.

## Recipe agreement and interrupted workflows

Ordinary saved/direct checks can now be reused when the recomputed native BREP
fingerprint matches the previous measured result and the direct BREP's actual
SHA-256 matches its recorded input. Legacy reports need the existing verified
cache-adoption manifest to supply that direct hash. A new report records each
direct hash and a digest of its agreement records. The previous pair cache's
software, native/spec source identities and seal are validated first. Missing
certificates, changed inputs, failed results and mass/bounds outliers trigger
fresh checks. The intersection stage independently fingerprints its actual
operands again after recipe checks; it never accepts a caller-supplied stale
fingerprint map. This serialization cost preserves the conservative reuse gate
while avoiding the far larger cost of repeated exact intersection Booleans.

The trimmed-cylinder starter shell exposed a numerical mass-integration
outlier: fresh native/direct constructions had unequal reported masses but
zero bidirectional material differences. For an outlier the audit retains the
raw mass, checks both original-solid Boolean differences are valid and at most
`1e-5 mm3`, and still requires bounds within `1e-5 mm`. The raw mass screening
limit remains `1e-6`. A real `0.008 mm3` cavity and `0.01 mm` translation both
fail its regression fixture. This fallback tests geometric material agreement;
it does not certify either raw mass as a precise engineering mass.

Checkpoint replacement uses bounded retries for transient Windows file locks.
Permanent failure preserves the earlier complete snapshot. Recipe comparisons
are written before the pair stage so a later I/O error leaves that diagnostic
evidence available. The workflow's `--resume-exact` option can retain already
passed reopen/STEP and interface gates only when their status, package file
hashes and native/spec provenance still match. It does not skip new or failed
engineering gates.

See `cad-studies/gtsio520-h-static/accessory-development/crossaxis-progress.md`
and its shell fixture reports for the actual diagnosis and measurements.

## Small source-stock and drive studies

`saved_native_stock.py` extracts one identity-placement saved BREP tip from a
native archive after verifying its native hash, raw specification-file hash,
embedded normalized specification and passed part agreement. This avoids
loading an entire engine document merely to inspect a small support region.
It rejects ambiguous identities, changed sources and unsupported placements;
eight mutation/roundtrip/schema gates passed. Extraction is frozen source stock,
not acceptance of subsequently modified geometry or a new editable base history.

The governor support study retains R4's original case history separately and
adds parametric native stock/cuts to its frozen BREP. New parts and added stock
are checked against every bound-meeting development neighbor. These local
fit checks do not transfer all old native-engine intersections to a new
complete-engine pass. For final integration, use the conservative original
operand fingerprints and all current neighbors described above.

The shaft's revised output end lies outside the bevel contact region. R2
verified that region against the earlier native shaftgear and verified the
earlier native/report identities before retaining the24-position result.
Axisymmetric journal/collar/output envelopes independently clear the new
support at every shaft angle. This separates unchanged tooth geometry from
new bearing interfaces without claiming clearance from one static picture.

For the tach pin refinement, only three part recipes changed. The direct
preflight rebuilt those three and retained39 unchanged per-part caches.
Static fit gates run before the required final saved-native pitch sweep;
the sweep need not be repeated in both evaluators after that refinement.
All required native, STEP and exported-file gates still apply. Changing
caption colors while retaining the exact GLB hash reused the governor's
seven-pair mesh audit; no geometry threshold or waiver changed.

The R3 governor source correction reuses the unchanged native driver and key
histories only after the parent native/specification hashes and dependency
plan match. It rebuilds the changed shaftgear and stock/cuts. Its reused bevel
region is the complete original-AABB intersection support, not an arbitrary
wide box containing a changed noncontact shoulder. This avoids repeating a
validated tooth sweep while still checking all new bearing/shoulder geometry.

`check_drive_source_bindings.py` closes the local review gates against current
native/specification/check hashes and all frozen source parts used by the
governor/tach context checks. Accepted direct-BREP hashes are reused exactly.
For legacy agreement records without that hash, a fresh audit-bound native tip
is compared with the direct stock and the measured result is recorded. This
small source check does not repeat the86 tach pairs, the24-pose native sweep
or the5091 accepted R4 pairs. Review generation validates the resulting file
bindings again, so changing a bound file invalidates that review gate.
