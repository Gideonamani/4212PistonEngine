# Incremental native histories and audit reuse

The integration initially spent substantial time re-executing unchanged case
histories after controller and identity metadata updates. That work did not
change the requested geometry. The revised extension keeps those histories
editable while avoiding execution caused solely by metadata changes.

## Conditions for retaining evaluated history

`preserve_native_prefixes.py` independently computes the dependency plan. It
retains whole unchanged recipes, or a strictly unchanged prefix before newly
appended operations. It checks the actual controller values against the
validated specification and rejects custom controller proxies. Placed,
dressed or shared-instance prefixes are ineligible for append reuse.

The extension also leaves unchanged controller properties and expressions
alone when their actual values match the current validated specification.
Changing a controlling dimension still invalidates its dependent geometry.

[FreeCAD 1.1.1 DocumentObject.h](https://raw.githubusercontent.com/FreeCAD/FreeCAD/1.1.1/src/App/DocumentObject.h)
documents `purgeTouched()` as clearing execution/touch flags. It does not
delete expressions or replace native history with a frozen BREP. The helper
only clears owned, dependency-verified evaluated history. It does not follow
external dependency lists into other parts.

`append_native_history.py` adds actual linked primitives and Booleans to the
existing group. Each new Boolean must recompute to a valid single solid. Before
moving identity metadata from the old tip, all owned geometric objects must be
fully evaluated. Clearing the metadata-induced flags after that operation
prevents executing the complete original case a second time. Dimensions,
expressions, placements and topology are untouched by that metadata step.

The small saved/reopened fixtures prove both new-feature and original-prefix
parameter edits against an independent direct construction, plus STEP re-read.
They also check that dependency changes, source hash changes and unsafe frame
changes reject reuse. The full engine still requires its own saved agreement,
interface, STEP and neighboring-pair gates.

## Direct development prefixes

`direct_prefix_cache.py` requires the exact old part-key filename and a BREP
digest supplied by a passed source record. It recomputes prefix/dependency
eligibility, appends independent Part operations and writes a new current cache.
A successful seed only accelerates development; it does not confer saved-native
acceptance or transfer an old intersection result to changed geometry.

## Intersection reuse

`static_pair_cache.py` retains the existing exact fingerprint policy. A pair can
reuse a result only when both actual saved geometry/placement fingerprints and
the audit software, tolerance policy and provenance match. New neighbors and
pairs touching changed shapes are tested again. A matching recipe, mass or
bounding box alone is insufficient. Final saved/direct agreement and current
pair enumeration remain mandatory.

## Checkpoint cost

When the last part lands exactly on a checkpoint boundary, the previous code
saved the same complete history twice before saving the final native package.
The final duplicate checkpoint is now skipped if no part or refresh followed
the boundary checkpoint. The final recompute, native save and STEP export
remain. A fixture with a one-part checkpoint interval verifies that the complete
checkpoint exists once and that final reopening and original-dimension edits
still work.

## Face gear trial

The `polar_pattern` primitive retains one live native master cutter and linked
rotated copies. Its small loft-pattern fixture passes reopening, a master-size
edit, independent construction and STEP. The face gear trial separately needs
rolling contact checks; the pattern fixture does not establish that a tooth
envelope is compatible.

The independently calculated face envelope retains positive sampled tooth
land. Refining 49 rolling poses to 97 changes sampled boundaries by less than
0.02 module in the tested band. This checks numerical sampling and obvious
tooth pointing only. Actual pair solids, pitch-cycle intersections, wrong-phase
negative control, native editing and installation remain separate gates.

The method blank now generates only seven slots around the possible contact
region. A fixed `step_degrees` option retains the full-ring tooth pitch while
skipping distant cutters. The opposite portion of the annular blank remains
unmachined and must never be presented as a complete engine gear. The native
partial-pattern fixture checks three open quadrants and one deliberately solid
quadrant. Full 360-degree patterns retain their previous default behavior.

A trial using only 25 flank levels differed from a refined envelope by up to
0.05414 module and undersized its cutter by up to 0.02637 module. That reduction
was rejected. The local method keeps 61 levels; the compute saving comes from
omitting distant slots that cannot participate in the local pitch test, rather
than reducing the tested contact profile's detail. Complete ring generation,
attachment and whole-engine installation remain required afterward.

## Checked native history transfer

FreeCAD1.1.1's `Document.copyObject(object, recursive, return_all)` can transfer
an independent native feature group, including a linked loft/polar pattern.
The implementation follows the official1.1.1 `DocumentPyImp.cpp` API. It does
not replace editable histories with frozen result shapes. Only identical part
descriptors and unchanged transitive controlling parameters are eligible.
Owned dependencies, actual source/destination controller values, software
version, saved package hashes, passed reopening/direct/STEP identities and
source checks are verified. Custom proxies, shared masters, dressups, placed
histories, unowned dependencies and name collisions are refused.

Recursive copying can create an extra parameter controller. Rebind its copied
expressions to the destination controller and remove that copied controller.
Verify actual geometry before clearing metadata flags. Some copied boundary
representations have different exact hashes; those construction cases require
valid original-solid differences in both directions within1e−5 mm³ and the
existing measured bounds policy. No pair-audit acceptance is transferred.

The cylinder/cut and linked-loft/pattern fixtures pass saved reopening,
destination edits after closing the source, independent construction and STEP.
A complete extension fixture also imports a checked subset through a manifest,
interrupts at a checkpoint, resumes, preserves graft provenance and edits the
destination controller. An actual alternator gear/hub transfer also passed a
module edit and STEP. All target assembly pair and export checks remain required.

## Controller propagation and scoped construction evidence

The alternator mounting-hole edit exposed a deferred-update defect: clearing
the shared controller's touched state could suppress changed existing feature
updates. Preserve unchanged histories, then explicitly touch owned geometry in
every nonretained existing history. The corrected fixture no longer manually
touches the changed feature, and the real mounting-shell/gasket edits pass.

Part construction can be reused after actual saved/direct agreement and native
reopening without claiming an unfinished assembly intersection audit passed.
The construction-only record binds the native archive, source specification,
package files, every source part agreement and the direct BREP digests. A
separate selection prevents a three-part donor from authorizing caches for
unbuilt parts or replacing unrelated target caches. Keep individual adoption
manifests and the full-source manifest distinct for later recipe-agreement reuse.

Small accepted donor studies use immutable specification and inventory
snapshots. Unrelated full-engine changes do not invalidate a donor, but changed
selected recipes or controlling dimensions do. Final target source binding,
reopening, independent agreement and current neighboring pairs remain required.
