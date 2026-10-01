# Reviewed cylinder in Explore and Lesson Steps

Release: `cylinder-reviewed-20261001`.

Both modes continue using the shared `cylinder` model definition and viewer adapter. The definition now selects the versioned Pages-hosted gzip GLB, the 61-part catalogue and the matching motion profile. The new fuel discharge nozzle is selectable in the intake group. Existing lesson focus IDs remain valid, so guided steps use the new model without a duplicate viewer or mechanism.

The web adapter derives lifter translation from the same follower solution as Blender. Valve/rocker/pushrod movement and spring morph targets retain the prior source-matched contact/spring audits. Their original source hashes are preserved, while the new CAD and Blender hashes are recorded separately. The central cue region is rechecked against the revised stationary head, barrel and nozzle. This preserves the distinction between current geometry and inherited sampled evidence.

The published mesh uses one-micrometre coordinate rounding and 0.0001 normal-component rounding before gzip packing. Native CAD is unchanged. CI decodes the actual checked-in transport, verifies both hashes, compares all 61 mesh bind bounds against CAD-derived bounds and checks native-derived spring target deformation. Timing remains the illustrative 720-degree ideal cycle with 7 mm maximum lift; the chamber is not calibrated to the published 7.5:1 ratio.

## Rebuild

1. Open the saved operating-cylinder Blender file with Blender background Python and run `scripts/export_reviewed_cylinder.py`.
2. Run `python scripts/bind_reviewed_cylinder.py` and `node scripts/build_component_tree.mjs`.
3. Run `scripts/check_reviewed_cue_region.py` with FreeCAD's Python and retain its source-bound release check.
4. Run `npm run lint`, `npm test`, `python scripts/test_cylinder_motion_profile.py` and `npm run build`, plus the existing Pages contract checks.

The export builder generates the CAD-derived bind-bound inventory from the revision's tessellation. Changing CAD requires exporting that tessellation again before building the web asset; do not copy older bounds. Original CAD and web release history remain available through the previous files and Git history.

## Phone review

Open the published site and choose **Explore**, then **Detailed operating cylinder**. Confirm the **61 components** badge; select **Fuel discharge nozzle**, isolate it, restore the assembly, scrub the cycle and use section view. Under **Learn**, open **Operating Cylinder Study** and advance through the model steps, checking that the same revised assembly stays loaded. A real Samsung Galaxy A16 interaction pass is still an instructor review item.
