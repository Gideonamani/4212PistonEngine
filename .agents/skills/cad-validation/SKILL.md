---
name: cad-validation
description: Verify reconstructed CAD solidity, dimensions, regeneration, assembly interfaces, export round trips and source agreement, keeping geometric validity separate from engineering fidelity.
---

Read `cad_pipeline/README.md`. Use independent measurements of the saved FCStd and STEP. Check single-solid positive-volume parts, part IDs, units, parameter expressions, bounding dimensions and feature-specific bores/holes. Change a controlling parameter in a disposable reopened model to test regeneration. Use `verify.py` for the repo backend's reopen/STEP checks.

Intersect every pair of parts whose bounds meet, at the assembled pose and through each motion: a hand-picked list of collision pairs is how meshing gears went unchecked. Touching is acceptable, overlap is not, and a pair that clears at rest can still collide while turning, so sweep the baked animation. Gears need conjugate (involute) flanks, positive backlash and a solved tooth phase; derive rates, modules and phases from one declaration (`scripts/accessory_gears.py`, `scripts/gear_geometry.py`) and audit exported models with `scripts/audit_assembly_interference.py` (see `docs/assembly-interference.md`). Parts that are fused into one rigid body may overlap; separate parts may not.

Check the actual interfaces required by the spec: journal/bearing fits, piston/cylinder clearance, rod-pin centers, mounting faces, valve travel or wall thickness. Pairwise intersections alone are insufficient: intentional gasket contact differs from unintended solid overlap. Compare source and candidate in their recorded coordinate frame; report residuals, excluded regions and incomplete geometry. Do not label a global match from a few fitted dimensions.

Reports must distinguish geometry passed, source agreement tested, unresolved interfaces and historical/manufacturer fidelity. A successful Boolean or attractive render is not evidence of fit, function, stress capacity or manufacturing readiness. Iterate relevant failed checks and repeat them after repair. Preserve substantive failures and the scope of checks in the delivered record.

When saved/exported mass properties differ, investigate geometry and numerical integration before changing acceptance limits. A reviewed numerical exception must preserve the original failure, name affected parts and thresholds, bind evidence to saved-file hashes, and disclose the scope of boundary sampling. The optional STEP exception in this backend is explicit and does not certify continuous surface equivalence or historical accuracy.

Validate against the research inventory and mechanism plan, not only the features already implemented. Inspect flow openings, bearing/assembly access, valve seat/lift, rocker contacts, spring clearances and drive connections where applicable. Trace the actual path across part boundaries. Record approximated chain spacing, tooth profiles or cam phases as unverified for operation even when every part is a valid solid. Compare CAD sections and subsystem plates back to reviewed source figures. Derived presentation sections must retain source IDs and stay outside engineering part counts/exports.
