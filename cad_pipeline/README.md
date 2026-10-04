# Engineering reconstruction pipeline

Images, text and meshes converge on a reviewed JSON feature specification. These are agent-guided interpretation routes: the software does not pretend to recover hidden features or arbitrary mechanical designs automatically. `engineering-research` grounds the identity, variant and construction first. The runnable backend creates expression-driven FreeCAD primitives and linked Boolean history, STEP solids, a validation report, and named Blender components. No additional package installation is required on this workstation.

## Skills

The seven repo skills are under `.agents/skills/`. Example requests:

- “Use $image-to-cad to reconstruct this dimensioned drawing; mark hidden details as estimates.”
- “Use $text-to-cad to make a 100 × 65 × 50 mm bearing housing with a 30 mm bore.”
- “Use $mesh-to-cad and $engineering-research to reconstruct this historical engine as editable major parts.”
- “Use $cad-to-blender to focus on and name each major component.”

Reload/open the repo in a new Codex chat if newly added skills have not been discovered. `AGENTS.md` routes reconstruction tasks to the same instructions.

## Commands (PowerShell, repo root)

```powershell
$cadPython = 'C:\Program Files\FreeCAD 1.1\bin\python.exe'
$blenderExe = 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe'
& $cadPython cad_pipeline/generate.py --spec cad_pipeline/examples/bearing-housing.json --output build/bearing-housing
& $cadPython cad_pipeline/verify.py --package build/bearing-housing
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/inspect_mesh.py -- --source web/wright-1903-engine.glb --output build/wright-reconstruction/source
& $cadPython cad_pipeline/fit_mesh.py --points build/wright-reconstruction/source/source-points.npz --roi cad-studies/wright-1903/mesh-rois.json --output build/wright-reconstruction/source/primitive-fits.json
& $cadPython cad_pipeline/wright_spec.py
& $cadPython cad_pipeline/generate.py --spec cad-studies/wright-1903/part-spec.json --output build/wright-reconstruction/cad
& $cadPython cad_pipeline/verify.py --package build/wright-reconstruction/cad
& $cadPython cad_pipeline/audit_wright.py --package build/wright-reconstruction/cad
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/present.py -- --package build/wright-reconstruction/cad --output build/wright-reconstruction/presentation
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/verify_blender.py -- --package build/wright-reconstruction/presentation
& $cadPython cad_pipeline/package_presentation.py --package build/wright-reconstruction/presentation
& $cadPython -m unittest discover -s cad_pipeline/tests -v
```

Paths are examples for this machine; use the corresponding installed runtimes elsewhere. `spec.py` uses only the standard library. Mesh inspection uses Blender's bundled NumPy; fitting uses FreeCAD's NumPy. Do not use a system Python lacking `FreeCAD` for generation/verification.

## Specification and fidelity

`schemas/part_spec.schema.json` describes the interchange contract; `spec.validate_spec` performs runtime semantic checks, including references and arithmetic. Each parameter has value, unit, provenance status, source references and rationale. Measured values also carry a method. Unknown values are null and cannot drive a feature. Derived arithmetic and estimated geometry are explicit. Every primitive dimension and origin can reference parameters; the native document retains those expressions and the source specification.

Supported generic features: box, cylinder, tube, cone, sphere, constrained polygon-sketch extrusion (`prism`) and linked helix/profile sweep (`helix`); additive/subtractive linked Booleans. Tubes generate linked outer/inner cylinders, allowing annular groove cuts. This is editable parametric CAD, with no custom Python proxy needed to reopen. It is not a full automatic feature recognizer or an all-purpose sketch solver. Extend the backend with further native features as required. The first Wright trial remains available, but the researched second revision adds casting sections/baffles, open cages, physical springs, separate rocker rollers, chain links, sliding ignition control and generator components. Tooth profiles, thread detail, spring rates and cam laws remain unverified manufacturing choices.

FreeCAD owns shape and mm units. Blender consumes hash-verified tessellation, converts to metres once, and owns materials/cameras/captions. `present.py` saves an assembly and keyed component tour plus isolated component plates. Its tour changes inspection visibility/cameras; it is not an engine-operation animation.

## Validation and storage

Checks cover spec integrity, valid single solids, saved native recomputation, STEP solid/volume round trips and actual parameter regeneration. Source fitting and historical fidelity have separate results. `cad-studies/wright-1903/research.md` records the evidence and unanswered questions. All outputs under `build/` are ignored. Keep source scripts/specs/reports in Git; native FCStd/Blender/STEP/GLB remain local and are archived through the existing Drive workflow when requested. Candidate models do not replace the working viewer release.

## Research-led Wright revision 2

Read `cad-studies/wright-1903/revision-2/research.md` before generating this candidate. The target is the surviving rebuilt horizontal engine following the Science Museum construction lineage; it is not an authenticated manufacturing reconstruction of the original 1903 engine. The source inventory covers all 47 keyed Figure 5 items and 11 supplemental records. One pump-drive item is deliberately deferred and two airframe-service items are outside this cropped assembly. All generated parts map to the reviewed inventory. Research readiness means sufficient understanding for the stated static scope; the gate cannot judge source interpretation by itself.

```powershell
py -3.14 -m cad_pipeline.wright_research
py -3.14 -m cad_pipeline.wright_v2
py -3.14 -m cad_pipeline.research_gate --inventory cad-studies/wright-1903/revision-2/inventory.json --spec cad-studies/wright-1903/revision-2/part-spec.json
& $cadPython cad_pipeline/generate.py --spec cad-studies/wright-1903/revision-2/part-spec.json --output build/wright-reconstruction-v2/cad
& $cadPython cad_pipeline/verify.py --package build/wright-reconstruction-v2/cad
& $cadPython cad_pipeline/audit_wright_v2.py --package build/wright-reconstruction-v2/cad
& $cadPython cad_pipeline/add_sections.py --package build/wright-reconstruction-v2/cad
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/present.py -- --package build/wright-reconstruction-v2/cad --output build/wright-reconstruction-v2/presentation
& $blenderExe --background --python-exit-code 1 --python cad_pipeline/verify_blender.py -- --package build/wright-reconstruction-v2/presentation
& $cadPython cad_pipeline/package_presentation.py --package build/wright-reconstruction-v2/presentation
```

Source acquisition is recorded by URL, inspected locators and local hashes; the builder does not fetch or pretend to reread sources. The final study includes bounded interface checks and limited four-region mesh correspondence, with estimated scale and residuals. Static chain chord spacing, dynamic timing and the disputed oil-drive route remain unverified. Native-derived section copies are hidden presentation objects, excluded from the engineering STEP/GLB and part count.

For development, `generate.py --only PartID ...` writes a subset marked incomplete. Release validation rejects it. `update_native.py --package ... --spec ...` supports reviewed basic-feature edits and appended features with identical parameters/part IDs; unsupported reorder/deletion/rich-feature edits require regeneration. It must be followed by the saved-geometry checks. `export_saved.py --native ...` recovers a failed tessellation/report export from a complete saved native build, streaming through a temporary file. Never run writers against the same package concurrently.

CAD metadata uses `Shape.optimalBoundingBox(False, False)` so bounds do not depend on OCC's optional cached triangulation or tolerance expansion. Legacy metadata can be normalized with `refresh_metadata.py --package ...`; it verifies unchanged native hashes and volumes and does not edit geometry. `verify.py` checks native/report identity, volume and deterministic bounds before STEP checks. Presentation section copies are derived snapshots with source links; regenerate them after an engineering change.

The revision-2 STEP has a documented mass-property exception for four ported valve boxes. The original 0.01% per-solid volume limit failed at about 0.019%, although bounds and face/vertex counts agree and bidirectional sampled boundaries differ by less than 1.4e-11 mm. `inspect_step_difference.py --package ...` records this evidence. The optional verifier flag requires a reviewed policy, matching native/STEP hashes, exact failing-part coverage, volume error at most 0.02%, and bounds/sampled boundary error at most 1e-6 mm. The aggregate limit stays 1e-5. It records `strict_solid_volume_check_passed: false` and the exception; it does not turn the original failure into a strict pass. New geometry needs new evidence and review. See the study's `validation-history.md`. To verify the delivered saved candidate, run `verify.py --package build/wright-reconstruction-v2/cad --step-boundary-exception cad-studies/wright-1903/revision-2/step-exception-policy.json`. A fresh build first uses strict verification and needs a newly reviewed policy if that check fails; the delivered policy cannot apply to different file hashes.

After visual inspection and round-trip checks, use `py -3.14 cad_pipeline/build_review.py --study cad-studies/wright-1903/revision-2 --package build/wright-reconstruction-v2`, then `py -3.14 cad_pipeline/package_reconstruction.py --study cad-studies/wright-1903/revision-2 --package build/wright-reconstruction-v2 --name wright-research-revision-2-20261004.zip`. The review builder needs Python-Markdown; the archive preserves repo-relative paths and excludes probes/backups/caches.
