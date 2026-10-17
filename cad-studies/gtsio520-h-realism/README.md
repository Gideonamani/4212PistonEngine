# GTSIO-520-H realism revision

Started 7 October 2026 on branch `feat/gtsio520-realism`, in the new `4212PistonEngine-gtsio520-realism` worktree. The target is the existing H model, using the supplied DigiMan manuals. This revision begins with a source-led static rotating core, then builds the engine outward around its interfaces.

## Current candidate: calculated-estimate crankshaft revision 4

103 named CAD solids and 658 native feature operations: a six-throw crankshaft with four main journals, six hollow tapered pistons, 24 gapped rings, six floating hollow pins with permanent aluminium plugs, six I-section rods with separate caps, twelve lined bearing shells, split bronze little-end bushings, rod bolts and slotted nuts. Source-backed critical dimensions and derived firing registration are distinct from estimated axial stations, contours and small-part sections. Dampers and cotters are deferred; this is not a complete operating or service assembly.

Revision 4 rebuilds the forging with eighteen native root blends, twelve closed estimated recesses, calculated blade/bore envelopes, contained inclined webs and matching liner edge relief. See `crankshaft-estimation.md` and `crankshaft-estimates.json` for the calculations and limits. See `design-learning.md` for the assumptions, deductions, tests and transferable lessons, and `crankshaft-match-findings.json` for remaining operations. Prior packages are retained under `build/gtsio520-realism/`, `build/gtsio520-realism-r2/` and `build/gtsio520-realism-r3/`.

Local review: `build/gtsio520-realism-r4/review.html`. Native files are under `build/gtsio520-realism-r4/cad/`; Blender, static GLB and named inspection plates are under `build/gtsio520-realism-r4/presentation/`. Generated binaries remain ignored. The working student model is unchanged.

| Record | Purpose |
|---|---|
| `research.md`, `source-manifest.json` | Sources actually studied, hashes, variant decisions, critical dimensions and accuracy boundaries |
| `implementation-research.md`, `*-method-validation.json` | FreeCAD/Blender method sources, versions, alternatives and measured prototype results |
| `inventory.json`, `research-readiness.json` | All 93 callouts from A-4-17/A-4-20 accounted; bounded core readiness only |
| `operating-motion.md` | One datum, derived phase/slider relationships, packaging, and explicit missing mechanisms |
| `part-spec.json` | Reproducible source-linked native feature plan |
| `validation-history.md` | Initial 42-pair interference failure and its geometry repairs |
| `acceptance.json` and validation JSON files | Hash-bound final results; no dynamics or manufacturing certification |
| `interference-policy.json`, `interference-audit.json` | Empty overlap ledger and exhaustive static exported-file audit |

## Rebuild

Run commands from this worktree. FreeCAD uses its bundled Python, Blender uses its bundled exporter. `prepare_gtsio_research.py` needs PyMuPDF and python-docx in the system Python and keeps its text snapshots ignored. Source paths can be supplied explicitly; no manual files are redistributed.

```powershell
python scripts/prepare_gtsio_research.py --deliverables 'C:\Users\user\KeonGeraldo\CodeProjects\DigiMan\work\deliverables' --original '..\Notes\gtsio520_series.pdf'
python -m cad_pipeline.gtsio_research
python -m cad_pipeline.gtsio_core
python scripts/test_gtsio_core.py
$cadPython = 'C:\Program Files\FreeCAD 1.1\bin\python.exe'
$blenderExe = 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe'
& $cadPython cad_pipeline/fast_build.py --spec cad-studies/gtsio520-h-realism/part-spec.json --output build/gtsio520-realism-r4/dev --jobs 2
& $cadPython cad_pipeline/generate.py --spec cad-studies/gtsio520-h-realism/part-spec.json --output build/gtsio520-realism-r4/cad --batch-runs 6
& $cadPython cad_pipeline/verify.py --package build/gtsio520-realism-r4/cad
& $cadPython cad_pipeline/audit_gtsio_crankshaft.py --package build/gtsio520-realism-r4/cad
& $cadPython cad_pipeline/audit_gtsio_visible_features.py --package build/gtsio520-realism-r4/cad
& $cadPython cad_pipeline/audit_gtsio_core.py --package build/gtsio520-realism-r4/cad --development build/gtsio520-realism-r4/dev/geometry.json
& $blenderExe --background --threads 2 --python-exit-code 1 --python cad_pipeline/present.py -- --package build/gtsio520-realism-r4/cad --output build/gtsio520-realism-r4/presentation --engine workbench
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/verify_blender.py -- --package build/gtsio520-realism-r4/presentation
```

The installed FreeCAD runtime ignores `PYTHONPATH`. For the GLB audit, install the repo's pinned requirements into ignored `.local/audit-deps`, then explicitly add that folder to `sys.path`:

```powershell
& $cadPython -m pip install --target .local/audit-deps -r scripts/requirements-audit.txt
& $cadPython -c "import sys,runpy;sys.path.insert(0,'.local/audit-deps');sys.argv=['scripts/audit_assembly_interference.py','build/gtsio520-realism-r4/presentation/gtsio520-h-realism-core-v4.glb','--rest-only','--policy','cad-studies/gtsio520-h-realism/interference-policy.json','--output','cad-studies/gtsio520-h-realism/interference-audit.json'];runpy.run_path(sys.argv[0],run_name='__main__')"
python scripts/build_gtsio_review.py
```

`gtsio_layout.py` owns the skeleton. Full derived contour/station changes require regeneration from the spec; basic linked features retain native expressions. The saved-CAD audit mutates the pin OD in memory, checks actual regenerated geometry, restores it and never saves that temporary mutation.

On this host the sandboxed Workbench renderer crashed; the final seven inspection plates were rendered successfully outside the sandbox. A CPU Cycles preview also ran but its inherited bright lighting flattened the material differences, so neutral Workbench shading was selected for the reviewed candidate.

## Integration order

1. Refine remaining source-match work (exact axial calibration, shaft ends/quill and hidden drilling), damper weights/bushings/pins, and the full swept rotating envelope. Estimated root fillets and blind recesses are implemented in R4.
2. Build split crankcase castings, real main-bearing seats, mounting decks and oil sump around this frame; calibrate axial stations against applicable drawings/measurements.
3. Add quill/reduction/propeller interfaces and declared conjugate gears.
4. Integrate the reviewed cylinder definition, replacing its inherited provisional packaging where source checks contradict it; complete the nine-lobe cam, lifter, pushrod, rocker and valve closure.
5. Add H-specific induction/intercooler/turbo, exhaust, dual ignition, continuous fuel injection and oil/scavenge systems with figure-level inventories.
6. Validate source resemblance, all static and swept interfaces, baked operating/exploded clips and viewer behavior; only then bind and release a new student model through the existing Drive route.

The private Drive archive and student release remain separate later delivery steps. Native local originals are retained. No new upload or release identity is claimed in `docs/drive-asset-manifest.json`.
