# CAD-derived spring compression

The spring-seat candidate now has a Blender shape key and GLB morph target for each of its four native coils. The local valve-motion preview drives these from the same 720-degree crank state as the rigid valve gear. The original master and published Drive model remain unchanged.

The native AdditiveHelix sweeps a circular profile around the valve axis. For a vertex at fractional turn t, compression changes its axial coordinate by minus lift times t; its radial coordinates and wire-profile offset remain unchanged. This changes pitch without scaling wire thickness. Handedness, pitch, wire radius, turn count and body frames are extracted from the candidate, not separately hand-maintained Blender values. The installed length, wire dimensions and illustrative 7 mm lift remain reconstructed study assumptions.

`export_spring_motion.py` checks this mapping against native FreeCAD solids at 0, 3.5 and 7 mm lift: 96 distributed reference vertices per spring per pose, 1,152 surface-distance checks total. Maximum observed disagreement is below 0.00001 mm. This is sampled agreement with the CAD study, not manufacturing accuracy, load/fatigue validation or proof of continuous assembly clearance. The separate native interface audit remains in `spring-seat-audit.json`.

Build the Blender package with `--spring-motion data/spring-motion.json`. The builder refuses an incomplete, failed or source/geometry-mismatched audit. It creates `ValveLift7mm` shape keys at zero initial weight, exports morph positions/normals and records the audit hash. The viewer updates morph weights; section-mask meshes share the source morph influences.

`verify_spring_morph.py --package build/pipeline-spring-seat` verifies every exported displacement against the CAD-derived mapping, including glTF axes and parent frames. All 419,368 spring vertices pass, maximum displacement error 1.63e-8 m. `verify_export_package.py --full-vertices` separately verifies all 60 components' undeformed mesh positions. The preview builder requires both reports to match the asset before enabling spring motion.

Browser observations: all 60 components loaded; isolated intake outer spring displayed at closed pose and shortened at approximately 85 degrees / 6.9 mm lift without visibly shrinking wire thickness. These observations do not constitute a physical-phone performance result or a complete section-mask test. The morph-enabled GLB is 35,023,520 bytes, SHA-256 `f1f54fa57ae1ccc1aa23a635674eeece7ee1c518db1e6fbd5b508ab09bb2da3c`. Mesh size/performance needs attention before release to the Samsung A16 target.

Next: grounded intake/exhaust and combustion cues, section/morph interaction checks, an optimized teaching asset, and versioned publication/rollback. Gas cues must be labelled as illustrative flow direction, without implying measured pressure, temperature or CFD.
