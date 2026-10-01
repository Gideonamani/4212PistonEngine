# Explore section faces and subassembly isolation

The reviewed-cylinder progress was already checkpointed and published at `3e3b2e5` before these fixes.

Section view now uses independent front/back stencil passes for each part and a cut face in that part's display colour. Winding counts preserve actual bores and cavities; overlapping parts do not share a stencil fill. Helpers follow the animation matrices and spring morph influences, and are excluded from model framing and picking. Ghosted lesson context remains transparent and does not receive an opaque cut face. Helpers are disabled when section view is off and their resources are released when changing models.

Choose a group in Parts, then use **Isolate subassembly**. This uses all group members regardless of the search filter or individual component selection, hides other geometry and frames the group. **Isolate part** and **Show all** remain available. Changing groups clears the previous individual selection. Both cylinder and full-engine viewers implement the shared controls.

Validation: TypeScript check, production build, all JavaScript tests, and published-engine/cylinder contract checks. New tests exercise cut-plane alignment/reversal, moving/morphing geometry, visibility, disposal, and a hollow extrusion whose wall fills while its bore remains open. These are geometry and renderer-configuration checks; they do not replace browser GPU visual review.

Phone review:
1. Open Explore and enable Inside > section view. Move the cut on X, Y and Z and reverse it. Solid cut regions should use the part colour; genuine bores should stay open.
2. Select Intake valve train, optionally search for tappet, then press Isolate subassembly. All intake group parts should remain visible, even those excluded by the search.
3. Play motion, change section position and switch colour treatment while isolated. Cut faces should follow the moving parts.
4. Press Show all, then isolate an individual part. Switch to the full engine and check its group isolation too.
