---
name: text-to-cad
description: Turn mechanical descriptions, functional requirements and supplied dimensions into a traceable feature specification, editable FreeCAD model and STEP export.
---

Read `cad_pipeline/README.md`. Translate stated dimensions and constraints into parameters with `status: specified` and a source record containing the user's request. Resolve units, coordinate frame, part vs assembly, feature direction and required fit. Use engineering-research before feature planning when the description refers to a real object or variant. Establish construction and mechanism paths, inventory components and record conflicts/gaps before turning prose into solids.

Choose editable features and declare every unsupported dimension as inferred; unknown values are null and cannot drive geometry. Continue with stated reasonable assumptions when the requested teaching/concept model permits them. Ask only when missing information prevents a meaningful candidate.

Author a shared JSON spec, validate with `cad_pipeline/spec.py`, and execute the FreeCAD generator. Use `cad_pipeline/examples/bearing-housing.json` as a runnable example, not a default design. Verify bores, holes and regenerated dimensions through CAD measurements. Return native CAD, STEP and the evidence/spec, then use cad-to-blender when presentation is requested.

If the part or assembly must move, state the motion as requirements (driver, ratio, stroke or lift, range, phase) and record each as specified, derived or illustrative, then validate and animate it with cad-validation's ladder and mechanism-animation.
