# Explore section faces and subassembly isolation

The reviewed-cylinder progress was already checkpointed and published at `3e3b2e5` before these fixes.

Section view now uses independent front/back stencil passes for each part and a cut face in that part's display colour. Winding counts preserve actual bores and cavities; overlapping parts do not share a stencil fill. Helpers follow the animation matrices and spring morph influences, and are excluded from model framing and picking. Ghosted lesson context remains transparent and does not receive an opaque cut face. Helpers are disabled when section view is off and their resources are released when changing models.

Choose a part, or a group, in Parts, then open the **Spotlight** tab and choose **Isolate** (or Highlight, or X-ray). A selected part is the target; with none selected the target is every member of the chosen group, regardless of the search filter. Isolate hides other geometry and frames the target; the spotlight then follows each part the learner selects next, and tapping the style in force again switches it off. **Show all** in Parts clears everything. Changing groups clears the previous individual selection. The cylinder, full-engine and animated-study viewers all implement `features.focus.set`, the call behind the Spotlight tab. (This replaced the earlier **Isolate part** and **Isolate subassembly** buttons.)

Validation: TypeScript check, production build, all JavaScript tests, and published-engine/cylinder contract checks. New tests exercise cut-plane alignment/reversal, moving/morphing geometry, visibility, disposal, and a hollow extrusion whose wall fills while its bore remains open. These are geometry and renderer-configuration checks; they do not replace browser GPU visual review.

Phone review:
1. Open Explore and enable Section > Cross section. Move the cut on X, Y and Z and reverse it. Solid cut regions should use the part colour; genuine bores should stay open.
2. Select Intake valve train, optionally search for tappet, then open Spotlight and press Isolate. All intake group parts should remain visible, even those excluded by the search.
3. Play motion, change section position and switch colour treatment while isolated. Cut faces should follow the moving parts.
4. Press Show all, then select an individual part and isolate it from Spotlight. Switch to the full engine and check its group isolation too.
