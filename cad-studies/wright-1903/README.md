# Wright engine: first reconstruction trial

The current study is [research revision 2](revision-2/research.md). This first trial is retained for comparison: its nominal dimensions and solidity checks did not establish adequate construction research or component completeness. Use revision 2's source inventory, variant decisions and bounded interface validation for further work.

Built 4 October 2026 from the repo's joined Smithsonian engine GLB and reviewed NASA/Smithsonian construction references. The native CAD contains **83 named solids and 298 features**, controlled by named parameters and native FreeCAD expressions. It is a mesh-guided teaching reconstruction with explicit estimated geometry, rather than an exact recovery of the original engine or of a lost CAD feature tree.

## Open the results

- FreeCAD: `../../build/wright-reconstruction/cad/wright-1903-reconstruction.FCStd`
- STEP: `../../build/wright-reconstruction/cad/wright-1903-reconstruction.step`
- Blender: `../../build/wright-reconstruction/presentation/wright-1903-reconstruction.blend`
- Gallery: `../../build/wright-reconstruction/presentation/index.html`
- Named 48-second identification video: `../../build/wright-reconstruction/presentation/component-tour.mp4`
- Component sheet: `../../build/wright-reconstruction/presentation/component-sheet.jpg`

The Blender file opens at the assembled pose. Timeline markers identify 15 component groups after the overview, in 72-frame segments at 24 fps. The exported video presents the same named component plates. These are inspection views; they do not simulate engine operation.

## Read the evidence and checks

- `research.md`: object identity, source claims, conflicting references and refinement gaps.
- `part-spec.json`: reusable parameters, provenance and feature plan.
- `mesh-rois.json`, `primitive-fits.json`, `mesh-analysis.json`: reviewed source measurements and topology diagnostics.
- `cad-validation.json`, `reopen-validation.json`: native/STEP solidity, identities and numerical volume round-trip results.
- `engineering-checks.json`: 59 selected bore/clearance/regeneration checks, including split rings following a changed bore.
- `blender-validation.json`: 83 part IDs, 16 named views and zero measured bounds error on GLB round trip.
- `archive-manifest.json`: the private archive identity and local SHA-256.

The six pipeline unit tests cover unsafe-expression rejection, evidence links, unknown dimensions, circle fitting and saved native parameter propagation. All seven skill entrypoints and both example/Wright JSON specs were validated. The existing student viewer was not modified or rebound to this candidate.

## Rebuild and refine

Use the commands in `../../cad_pipeline/README.md`. Newly discovered measurements belong in the spec builder/evidence first; regenerate CAD and then Blender. Counts and primitive axes are fixed by the feature plan; changing the part inventory or an axis requires rebuilding from the specification. FreeCAD is the dimensional geometry master.

Priorities for higher fidelity: select a consistent historical drawing set, independently calibrate the cropped scan, reconstruct casting ribs/bearing supports, then true cam/rocker interfaces, sprockets/chain, valve cages/spring wire, generator friction drive and the fluid routing. Historical accuracy remains unverified while these dimensions and interfaces are unresolved.

Native outputs remain ignored/local and are archived in the existing private Drive CAD folder. The JSON specifications, scripts, evidence, hashes and validation records are the Git deliverables.
