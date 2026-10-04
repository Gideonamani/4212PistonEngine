---
name: cad-to-blender
description: Create named component-focused Blender scenes, rendered identification plates and GLB presentation exports from validated FreeCAD geometry.
---

Read `cad_pipeline/README.md`. Load the hash-verified geometry package produced by FreeCAD. Keep stable IDs, component group, names, materials and evidence as custom properties. Divide CAD mm by 1000 once; preserve XYZ and let glTF export handle Y-up. Do not remodel engineering geometry inside Blender.

Run `present.py` to build the named assembly, save an editable blend, export GLB and render the overview and each major group. Keep isolated components visible and large, with readable component names and scope captions. For a part tour, use the saved camera/visibility keyframes; presentation motion is distinct from mechanism motion.

Inspect rendered overview and representative internals, plus the identification contact sheet. Reopen the blend and verify object IDs, finite bounds, scale and saved scene/frame state. Export part identities in GLB extras and verify exported dimensions. If animating operation, obtain the real mechanism/timing data or label it illustrative; the generic camera tour provides no operational simulation.

For researched assemblies, add focused mechanism views and a section derived from the native CAD when it clarifies the source construction. Keep section copies explicitly presentation-only with original part IDs; exclude them from engineering STEP/GLB. Compare representative plates with source cutaways/parts photographs and show uncertainty in the gallery. Render quality cannot establish historical or dimensional accuracy.

Native CAD/Blender/STEP/GLB files remain ignored/local under repo storage policy. Do not bind a candidate into the existing student viewer before its release validation and upload verification.
