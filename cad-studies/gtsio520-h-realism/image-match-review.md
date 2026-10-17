# Crankshaft image match: revision 2

8 October 2026. The first static core passed geometry checks while its crankshaft still used uniform capsule cheeks. The source-agreement review therefore had not passed. The user's visual feedback exposed the gap between those conclusions.

`image-matcher` is now a reusable skill (personal installation plus versioned project copy). Its first application compares the bare forging, Figure A-4-20 part 41, with a CAD-derived render. Construction A-3-1/2 PDF16-17 identifies the side blades; A-10-3 PDF70 identifies hardened bushings in the blades; Table 11 PDF117 locates the damper cheeks at 2,5,8. Figure A-4-30 PDF43 was inspected to distinguish the detached counterweight/bushing section from the bare shaft. Those weights, their bushings/pins and quill/gear assemblies are not silently fused into the forging.

Before/after images use a fixed 1000 px orthographic camera, fixed datum/pose and the same uniform 2D registration. Front/rear main centres establish alignment; the two intermediate centres are held out. Their maximum residual is approximately 16.4 px in both candidates; this exceeds the approximately 8 px interpreted-point placement uncertainty but is also affected by unknown/stylised source projection. This finding supports further dimensional calibration, not an unqualified change to the shared engine stations. The drawing includes overlapping leaders and detached parts, so no filled silhouette mask or similarity percentage is claimed.

The first operation cycle implements six integral blade profiles, twelve bare bushing seats and differentiated main/pin/middle-web outlines. The next review explains why this still missed the design: uniform extrusion copied the outline but left blade thickness and cheek face taper wrong. Revision 3 uses thinner centred blades and inclined native lofted web faces, retaining full-depth machined support lands. Critical diameters, throw, rod length and the six-module layout are retained. Profile margins, blade thickness/spacing, taper and host bores are inferred. The installed bushing's stated ID is not used as the host hole diameter.

The complete operation list is in `crankshaft-match-findings.json`. The visible-scope status is **needs another iteration**: real journal/cheek fillets, the interpretation of recessed/circular cheek features, accurate end details and axial station calibration remain open. Fillets also need compatible bearing/cap edge clearances; making them look smoother cannot justify introducing assembly overlaps. Static CAD validity and interference passes remain separate from this source-resemblance result.

Local review: `build/gtsio520-image-match/review.html`; design-reasoned native/core package: `build/gtsio520-realism-r3/`. Previous packages remain under `build/gtsio520-realism/` and `build/gtsio520-realism-r2/`. `design-learning.md` records assumptions, mechanisms, constraints and tests.

Rebuild the comparison after CAD generation:

```powershell
& $blenderExe --background --threads 2 --python-exit-code 1 --python cad_pipeline/render_match_view.py -- --geometry build/gtsio520-realism/cad/geometry.json --plan cad-studies/gtsio520-h-realism/crankshaft-render-plan.json --output build/gtsio520-image-match/before
python scripts/compare_gtsio_crankshaft.py --phase before --cad build/gtsio520-realism/cad/gtsio520-h-realism-core-v1.FCStd
& $blenderExe --background --threads 2 --python-exit-code 1 --python cad_pipeline/render_match_view.py -- --geometry build/gtsio520-realism-r2/cad/geometry.json --plan cad-studies/gtsio520-h-realism/crankshaft-render-plan.json --output build/gtsio520-image-match/after
python scripts/compare_gtsio_crankshaft.py --phase after --cad build/gtsio520-realism-r2/cad/gtsio520-h-realism-core-v2.FCStd
& $blenderExe --background --threads 2 --python-exit-code 1 --python cad_pipeline/render_match_view.py -- --geometry build/gtsio520-realism-r3/cad/geometry.json --plan cad-studies/gtsio520-h-realism/crankshaft-render-plan.json --output build/gtsio520-image-match/reasoned
python scripts/compare_gtsio_crankshaft.py --phase reasoned --cad build/gtsio520-realism-r3/cad/gtsio520-h-realism-core-v3.FCStd
python scripts/build_gtsio_match_review.py
```
