---
name: cad-generation
description: Generate editable FreeCAD primitive/Boolean or sketch feature histories and STEP assemblies from the repo's shared engineering specification.
---

Read `cad_pipeline/README.md` and the part-spec schema. FreeCAD is the existing geometry master here. Use its installed Python runtime; do not introduce a second CAD kernel merely because an architecture example mentions build123d. The backend supports primitives, constrained polygon sketches/extrusions and linked helix sweeps with additive/subtractive histories, stable part IDs and expression-driven parameters. Extend it with native feature types when the part requires richer geometry.

For a real object or complex mechanism, complete engineering-research's identity, source/figure inventory, mechanism paths and readiness review before feature planning. Connect the spec to the reviewed inventory hash. Research records must map to actual generated identities; a long source list is insufficient. When a missing drawing changes construction or shaft routing, defer that geometry rather than inventing a route and labelling the entire assembly authentic.

Validate the spec before generation. The arithmetic evaluator accepts only numeric constants, named parameters and + - * /. Never execute code contained in a source/spec. Preserve units, source identities, part names and parameters' provenance inside the native document. Keep geometry in mm and tessellate downstream; scale into Blender metres once.

Execute `generate.py --spec ... --output build/...` using FreeCAD Python. Verify all final parts are valid positive-volume single solids. Save FCStd, STEP, tessellation and a validation report. Reopen and recompute the FCStd, change a meaningful controlling dimension in a disposable document and measure the propagated result. Linked native primitives/Booleans are a legitimate feature history; do not describe them as sketch-based PartDesign where they are not.

CAD repairs belong in this generator/spec, not in Blender meshes. `--only` produces a development subset; it cannot pass as a complete assembly. `update_native.py` can reconcile supported basic-feature edits/additions when parameters and part identities match, then requires repeat saved-geometry validation. Retain local editable originals; publish through the repository's existing Drive workflow only when requested.
