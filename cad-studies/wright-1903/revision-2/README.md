# Wright engine: research revision 2

The revised study follows the surviving rebuilt horizontal engine and the Science Museum construction lineage discussed by Hobbs. Read [research.md](research.md) for the complete source review and design decisions. Nominal original bore/stroke, valve diameter/lift and liner wall are retained; manufacturing dimensions and operating dynamics remain unverified.

The research inventory accounts for all 47 Figure 5 callouts plus 11 supplemental records: 55 simplified, one deferred and two outside the cropped assembly. Every generated engineering part has a source-to-CAD mapping. The oil-pump drive is deferred because the narrative and figure key conflict and the chosen-lineage drive drawing is unavailable. The model explicitly excludes later-engine additions and external airframe service equipment.

Compared with the first trial, the native model includes a sloping cast body with ribs and baffles, short liners and shared head joints, pinned rings, built-up bronze-ended rods, split bearings, open four-leg valve cages, helical springs, two-cheek rockers with two rollers, 6/12 sprockets with separate chain links, sliding spark control, chamber contacts/busbar and a generator friction drive. Approximate tooth profiles, chain chord spacing, springs and cam shapes remain static teaching geometry.

## Local deliverables

Open `build/wright-reconstruction-v2/review.html` from the repository root for the dossier, complete inventory, validation and source-comparison links. The gallery at `build/wright-reconstruction-v2/presentation/index.html` contains named overview, subsystem, detailed mechanism and native-derived cylinder-section plates, plus a chaptered video.

- Editable FreeCAD: `build/wright-reconstruction-v2/cad/wright-research-revision-2.FCStd`
- STEP: `build/wright-reconstruction-v2/cad/wright-research-revision-2.step`
- Editable Blender tour: `build/wright-reconstruction-v2/presentation/wright-research-revision-2.blend`
- Engineering GLB: `build/wright-reconstruction-v2/presentation/wright-research-revision-2.glb`

The CAD-derived section copies are presentation-only; they do not enter the engineering STEP/GLB or engineering part count. Timeline markers identify each view. Visibility and camera changes constitute an inspection tour, not an operating simulation.

The revised engineering model contains **413 named solids and 1,251 native feature operations**. All 107 bounded static assembly checks passed. Eleven pipeline tests passed, including saved native sketch/spring regeneration, stable CAD bounds and rejection of stale/expanded/distorted STEP exception evidence. The original default-box comparison discrepancy is retained in `metadata-differences.json`; the corrected metadata uses analytical bounds independent of cached triangulation.

The STEP round trip is accepted with a documented numerical mass-property exception for four ported valve boxes. Their maximum volume difference is about 0.019%; the original 0.01% per-solid check remains recorded as failed. Optimal bounds and face/vertex counts agree; bidirectional vertex/face-centroid boundary samples differ by less than 1.4e-11 mm. The 0.02% exception is bound to these saved files and does not prove continuous surface equivalence. Read [validation-history.md](validation-history.md) for evidence and limits.

## Evidence and validation

`source-manifest.json` records source URLs and local original-file hashes. `inventory.json` records roles, interfaces, source locators, decisions and part IDs. `part-spec.json` is the reproducible native feature plan; `research-readiness.json` and `coverage-plan.json` account for its scope. Final `cad-validation.json`, `reopen-validation.json`, `engineering-checks.json`, `blender-validation.json` and `gallery-manifest.json` record the generated candidate checks.

Static checks cover saved solids/STEP, documented nominal dimensions, selected clearances, valve travel, rocker contacts, gas/coolant/oil-jet openings, friction-wheel contact and parameter propagation. Four exterior mesh ROI offsets/residuals are reported at an inferred scale; global scan agreement is not established. Chain operation, exact cam law/phases, complete pump/service-line continuity, strength and manufacturing fits remain unverified.

Use the revision-2 commands in `cad_pipeline/README.md`. Native binaries remain local and in the existing private Drive archive; `docs/drive-asset-manifest.json` records the archive identity. The first-pass archive and working student release are retained.
