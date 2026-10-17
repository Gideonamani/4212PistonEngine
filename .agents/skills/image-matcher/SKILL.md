---
name: image-matcher
description: Study an engineered object's reference images and drawings, reason about its design and construction, compare its reconstruction, and turn explained mismatches into CAD operations and reusable learning. Use before feature planning and after reconstruction or shape revisions; distinguish observed facts, engineering deductions and dimensional estimates.
---

# Image matcher

Close the loop: **study the reference, understand the design, make explicit deductions, research and test suitable modelling methods, model, compare, explain the mismatch, and retain the learning**. Deliver a visible comparison and an actionable operation list, then re-check the changed object when edits are authorized. A valid solid or recognisable assembly is not a resemblance pass.

## Understand the design before choosing features

For engineered objects, explain what the relevant features do: load/motion paths, mating and assembly relationships, clearances, materials/manufacture and service access. Use sections and construction text to interpret the image rather than merely trace its outline. Read [references/design-reasoning.md](references/design-reasoning.md) when those relationships need inference.

Separate **observed construction**, **engineering deduction**, **modelling estimate** and **unresolved question**. Turn deductions into testable relationships: a guide blade fits inside a counterweight fork with clearance and is thinner than the cheek; a forged web can taper while machined bearing lands retain their dimensions. Choose geometry that expresses those relationships in 3D. A silhouette match cannot reveal a uniform extrusion incorrectly replacing a tapered face. Do not promote a plausible explanation into a documented dimension or claim of strength.

## Research how to express the design

For an unfamiliar shape, difficult operation or repeated failure, research existing modelling approaches before committing the feature plan. Use official FreeCAD documentation and original demonstrations to compare suitable features; research Blender animation/export/render methods when those outputs are involved. Record the source, software version, relevant technique, alternatives and why it suits this design. Software tutorials establish methods, not this object's dimensions or construction. Read [references/implementation-research.md](references/implementation-research.md) for method selection and practical adoption checks.

Test a difficult method in a small disposable native model: save/reopen, change its controlling parameter, measure the result and check the intended export. Reuse a tested method when its geometry and version still apply; reopen research when comparison, regeneration or export contradicts it. Retain successful methods and failure conditions alongside the design learning so later projects benefit without inheriting arbitrary dimensions.

## Establish a fair comparison

- Identify the object, variant/revision and reference lineage. Record source locator and file hash, candidate CAD/mesh hash, selected part IDs, and pose. Inspect the original figure, legend and relevant construction text; do not interpret a cropped shape without its context.
- Compare the same component and assembly state. In an exploded drawing, isolate the intended component; neighbouring loose parts and callout leaders are not its contour. Distinguish exterior, section, hidden-line and schematic views. An obscured region is unverified.
- Render the candidate from a comparable camera/projection, with a neutral readable surface and an edge or silhouette view when useful. Match camera and object pose before changing geometry. Use orthogonal views for orthogonal drawings; fit a 3D camera for perspective photographs. A stylised perspective illustration may support feature presence better than dimensions.
- Register with stable physical landmarks such as journal axes, mounting faces or hole centres. Keep some independently identifiable landmarks out of the fit when possible. Record the camera, crop, uniform scale, translation and rotation. Do not stretch, mirror, shear or locally warp the model to improve a score. Lock the comparison view for before/after review; deliberate camera corrections get a new recorded calibration.

## Diagnose the differences

Inspect major proportions and topology first, then contours, shoulders/fillets, bosses/ribs, holes/recesses, fasteners and small detail. Check negative space and occlusion as well as the outer silhouette. Classify each visible feature as present, missing, wrong shape, wrong position, uncertain or not visible. A deferred mechanism may still explain why an assembly looks wrong; keep that gap visible.

For each discrepancy, name the reference region/locator, candidate part ID, observed mismatch, confidence, likely cause, design interpretation and proposed **native** operation or parameter change. Explain **why the modelling choice failed**: wrong assembly assumption, lost section thickness/taper, inappropriate primitive, wrong datum/pose, or insufficient evidence. State the expected visual/functional change and the affected interfaces. Separate source-supported construction from estimated dimensions. Do not infer an invisible bore, exact spline count, fillet radius or wall thickness from shading alone.

Use quantitative evidence only where the inputs support it. Landmark residuals can check registration or held-out proportions. Silhouette IoU/contour distance requires explicitly prepared object masks with annotations, backgrounds and unrelated components excluded. SSIM or a full-page pixel score cannot certify a CAD match. Report camera uncertainty, ambiguous feature interpretation, excluded regions and untested views; there is no universal authenticity percentage.

## Iterate and conclude

Prioritise missing mechanism-defining features and wrong proportions over surface polish. If authorized to improve the model, edit its authoritative CAD specification/master, rebuild and compare in the locked view. Re-run the relevant solid, dimensional, interface, export and motion checks; a visually closer model may introduce a collision. Keep the previous comparison and substantive failures.

Retain a short learning record: original assumption, source observation, revised explanation, geometry/constraint changed, actual test/comparison result, remaining uncertainty, and the transferable lesson. Carry the reasoning pattern forward; do not copy this object's estimated dimensions into another design. Reopen the interpretation when the rebuilt model still disagrees with the source.

Conclude with one of: **needs another iteration**, **accepted for the reviewed visible scope**, or **needs better reference evidence**. Explain the remaining work. A visible-scope acceptance does not establish hidden geometry, manufacturing dimensions, strength or operation. Stop dependent edits when an unresolved reference conflict changes the arrangement; continue independent fixes.

Read [references/comparison-plan.md](references/comparison-plan.md) when setting up reproducible registration, masks or machine-readable findings. The optional [scripts/compare_reference.py](scripts/compare_reference.py) creates registered overlays, held-out landmark residuals and mask IoU from an explicit plan. It does not choose the 3D camera or interpret the engineering features. Use the existing CAD renderer and validation tools in the project; do not make a second geometry master in an image editor.
