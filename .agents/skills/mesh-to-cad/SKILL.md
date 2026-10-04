---
name: mesh-to-cad
description: Inspect STL, OBJ, glTF or GLB engineering meshes, measure reviewed regions and reconstruct semantic editable CAD features with traceable scale and uncertainty.
---

Read `cad_pipeline/README.md`. Run `inspect_mesh.py` in Blender to preserve the source, apply node transforms and produce bounds, topology inventory, points and orthographic evidence. Imported glTF coordinates may violate nominal metre conventions; establish units from metadata and an independent dimension. Record one transform from imported coordinates to CAD mm.

Determine whether the mesh is a scan, triangulated CAD export or artistic model, whether it has named parts, and what is actually observable. Triangle-soup vertices can make raw boundary counts misleading; use the welded diagnostics and state the weld tolerance. Connected components are not mechanical part names. Do not invent internal geometry from the exterior scan.

Use engineering-research and finish its component/mechanism readiness review before the feature plan. Global mesh bounds can include hoses and installation hardware; calibrate independent exterior dimensions when available. Select explicit ROIs and use `fit_mesh.py` for circular cross-sections. Save bounds, axes, residuals and point count. The fit is algebraic, vertex-weighted and assumes a reviewed axis; it is not an automatic cylinder classifier. Reject narrow arcs, contamination or poor residuals. Fit repeated instances independently and compare pitch/radius consistency.

Build a new semantic specification, preserving measured/inferred status and measurement method for each parameter. Deliver a level-3 parametric candidate with meaningful primitives/sketches and Boolean features, not a mesh-facet wrapper. Label repair-only or mesh-derived solids explicitly if those outputs are requested. Validate source alignment separately from internal fit and historical fidelity.

Use `cad-studies/wright-1903/mesh-rois.json` and its fit record as the worked trial. Keep the original scan for overlay review and all reconstruction binaries ignored/local until the established Drive release workflow is run.
