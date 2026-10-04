---
name: image-to-cad
description: Interpret photographs, diagrams and dimensioned drawings of mechanical components into an evidence-bearing specification and editable FreeCAD geometry. Use for engineering reconstruction, not artistic image-to-mesh generation.
---

Read the repo `AGENTS.md` and `cad_pipeline/README.md`. Inventory views, visible dimensions, scale reference, projection and hidden surfaces. Use engineering-research before feature planning for real-object reconstruction or uncertain construction. Review sections, figure keys and assembly relationships; an exterior photograph alone does not establish hidden mechanisms. Rectify a drawing only when its projection supports doing so. A photograph cannot establish unobserved dimensions or resolve scale without a reference.

Produce the shared spec with `input_mode: image`. Store each reference image path/hash and each dimension's provenance. Dimensioned callouts override apparent pixel proportions. Keep measured pixel ratios separate from perspective-dependent estimates. Name datums, symmetry axes, bores, mating faces and repeated features before choosing the operations. Use orthographic silhouette comparisons only with equivalent camera, axis, scale and crop.

Run the generation and validation commands in `cad_pipeline/README.md`. Deliver FCStd, STEP, source/spec/evidence and previews with unresolved geometry clearly marked. For geometry beyond the generic primitive backend, extend the FreeCAD generator with sketches/Pad/Pocket/Revolution features and test regeneration; do not silently replace the parametric deliverable with a faceted solid. Never turn an undimensioned illustration into a claimed manufacturing drawing.
