# Static cylinder milestone

This is the 839-part crankcase/damper/cylinder expansion, not the completed GTSIO-520-H engine. Source resemblance remains **needs another iteration**. Native CAD, STEP, Blender, PNG and GLB artifacts are local under `build/gtsio520-static-cylinders-r16`; no student asset or Drive release has been replaced.

The archived input includes explicit source-backed and estimated parameters. `rebuild.py` restores the exact archived inventory at its hash-bound research path before building the unchanged specification. Run it with the installed FreeCAD Python:

```powershell
& 'C:\Program Files\FreeCAD 1.1\bin\python.exe' cad-studies/gtsio520-h-static/cylinder-milestone/rebuild.py
& 'C:\Program Files\FreeCAD 1.1\bin\python.exe' cad_pipeline/verify.py --package build/gtsio520-cylinder-milestone/cad
```

The fixtures in `method-validation.json` document sequential/batched head-cut agreement, shared local geometry, edits/STEP solids and a boundary-preserving right-case tessellation refinement. The left counterpart retains its clean original mesh. `cad-validation.json` and `reopen-validation.json` bind the complete saved package. `exact-interference.json` covers independent development solids; `interference-audit.json` covers the actual final native-derived GLB. `saved-shape-checks.json` passed all 2,859 saved-native pairs with no overlap and the independent recipe agreement checks. The earlier failed agreement report is retained; `../cylinder-research.md` explains the direct-refinement and extrema-measurement corrections under unchanged limits. None establishes manufacturing contours, cam timing or full-engine completion.

`image-review.json` records original figures, locked camera plans, candidate geometry identity and explained mismatches. The exploded reference is inspected for individual construction and identities; the full-page illustration is not treated as a quantitative silhouette mask. Neutral source-comparison renders remain separate from the coloured component plates. `envelope-check.json` compares the current estimated width with the H nominal envelope while keeping missing height/length systems explicit.

The next work is source-led: improve asymmetric head fins, pressed covers and forged rocker sections; fit shaft retention and the cam/lifter/pushrod path; complete the quill/reduction/propeller support and rear accessories; then H induction/intercooler/turbo/exhaust, fuel, ignition, lubrication and baffles. Match one mechanically consistent static pose before animation. See `../valve-train-research.md`.
