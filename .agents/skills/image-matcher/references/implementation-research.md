# Research a method, then prove it fits

The design study decides **what the feature is and why it exists**. Implementation research decides **how to represent and preserve it in the installed tools**. Research an unfamiliar construction, a new feature family, a changed software version, or a failure that the established method cannot explain. A routine use of an already tested method does not need a fresh literature search.

## Find and choose an approach

Prefer the tool project's documentation, versioned source/API and original authors' demonstrations. Search for the specific geometry and operation, not only the object name: a crankshaft may need varying-thickness webs, revolved shoulders, offset throws, root blends and separate damper hardware. Follow relevant examples to their actual feature history or explanation. Record whether a video was inspected, only its description was available, or an example file was actually reopened. An attractive thumbnail is not method evidence.

Check installed versions against the source's version. An old tutorial can suggest a sound construction while its property names, topology behaviour or export defaults are obsolete. If official documentation is inaccessible, use an accessible official repository or installed API/source and label the limitation; do not claim the inaccessible page was studied.

Compare plausible alternatives before choosing:

| Design requirement | Methods to investigate | Decision to verify |
|---|---|---|
| Constant-depth outline | Constrained sketch + Pad/Extrude | One section and depth really describe the feature |
| Shaft shoulder or annular groove | Revolve of a closed half-section; cylinders + Boolean | Profile, rotation axis, diameter and axial stations remain editable |
| Varying section/thickness or inclined cheek face | Ruled/smooth loft; constrained sections on datums; linked faces | Section correspondence, actual face slopes, support lands and regeneration |
| Curved passage, tube or spring | Sweep/Pipe/helix | Path, section orientation and crossings express the intended construction |
| Root blend or edge relief | Selected native Fillet/Chamfer; profile-based transition | Adjacent material and bearing/contact surfaces survive; radius has provenance |

These are candidates, not universal recipes. Select Part or PartDesign to fit the existing authority/history and needed links. A new workbench, plugin or dependency is justified by a concrete capability gap, not merely by a tutorial using it. Retain one geometry master.

## Prove adoption on a small example

Use a disposable fixture for the difficult region, preferably with the same neighbouring topology as the real part. Check native feature type/links, valid solids, saved/reopened recomputation, a meaningful parameter edit, and measured surfaces/interfaces. Test STEP or mesh export when that is part of delivery. Passing a simple shoulder fillet does not prove every fillet on a complex forging will succeed.

Resolve an edge by its geometric role where possible (axis, radius, station, neighbouring faces). Treat its returned index as a temporary tool handle, and resolve it again after upstream changes. Reject ambiguous selection. Do not equate a stored expression with parameter propagation; measure the rebuilt shape. Optional refinement/healing needs its own result and cannot replace solid/interface checks. Keep substantive failed probes and their conditions.

When a reconstruction permits calculated estimates, distinguish known anchors from selected coefficients. Derive related sizes from mating envelopes, remaining material and clearance, retain formulae and sensitivity bounds, then test the actual saved geometry. Numerical precision in the formula is not source accuracy. An authorized visible-feature approximation can proceed while its exact dimensions remain uncertain; hidden routes/purpose must retain their stated limitation.

For a live scalar fillet radius in a Part-based history, the GTSIO FreeCAD 1.1.1 trial uses a PartDesign Body whose BaseFeature links to the Boolean result, then native PartDesign::Fillet with a Radius expression. Check the link, saved/reopened radius and upstream shape edits before adopting this bridge. An attempted expression on Part::Fillet's complex Edges property did not propagate and became invalid in that trial. Preserve the distinction between a linked Part input with PartDesign dressups and a sketch-based PartDesign body. Large topology changes still need geometric reselection and regeneration.

## Blender methods depend on the intended output

For operation, preserve the mechanism's shared motion definition and physical pivots. If constraints/drivers are introduced, inspect their evaluated transforms; test visual baking on a copy while preserving the editable master. Select glTF animation and merge modes explicitly for the installed exporter, and verify clip names, target nodes, units, transforms and interpolation in the exported file. Action slots, NLA tracks and merge defaults vary with version; matching track names alone is not a portable clip contract. A local preview of a constraint is not proof that its exported animation exists.

For resemblance review, record and lock the camera/projection, pose, visibility, neutral shading, cavity/edge settings and color management. Check actual geometry as well as the lit image; highlights and cavity shading can suggest detail that is not modelled. Use a separate lighting/material study for presentation rendering. Inspect the intended viewer export too: Blender studio/world/area lighting and viewport effects are not automatically reproduced in a browser.

## Retain a useful method record

Keep the question, primary source URL/locator and access date, source/installed versions, inspected content, alternatives, chosen feature/settings, prototype artifact, actual measured result, failures and remaining limitation. Identify the status as candidate, locally tested or adopted for a stated scope. Promote the non-obvious lesson into the relevant skill only after testing it; keep object-specific dimensions and results in the project study. Reopen the method decision when new evidence disagrees.

### Tested reconstruction lessons

- A native Boolean and a direct Boolean can both report valid solids while disagreeing. Trace intermediate feature results, not just the final volume. In the FreeCAD 1.1.1 cylinder trial, cutters ending on a revolution seam produced different topology; extending the internal tools past that seam restored saved/native/direct/STEP agreement. Preserve external mating datums, test the correction locally, and re-check the whole assembly. Do not generalise a particular overlap distance into an engine dimension.
- Repeated identical castings can share a linked **local** native solid with independent assembly placements and stable IDs. Verify identical recipes and mirror planes before sharing, then test parameter propagation, saving/reopening and all exported solids. Reusing an already placed assembly tip would compound its transform.
- A valid CAD boundary can tessellate with a T-junction on a seam. CAD topology refinement can be tested for meshing while retaining the original native history. Check both solid differences, bounds and volume before accepting it. Apply it to the diagnosed part; a neighbouring part may not pass the same preservation test. Re-run the actual exported-file audit without a waiver.
- Before changing an apparent hole, verify the rendered part selection. Omitting fitted shafts from a closed-assembly render exposed their support bores and created a false comparison mismatch. Include the physical components visible in the intended state and keep source comparison separate from assembly validity.
- Independent evaluators must apply the native operation policy, including Boolean refinement; an omitted step can change reported curved-solid mass. Optimised bounds can also vary between equivalent analytic/location representations. Preserve the raw measurements and original solids, diagnose with both Boolean differences, and compare extrema in the same measurement representation under the original limit. A representation conversion used for extrema is not a new CAD master or an excuse to widen acceptance thresholds.
