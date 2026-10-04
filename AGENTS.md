# Project storage and validation

- Engineering reconstruction skills live in `.agents/skills/`: `engineering-research`, `image-to-cad`, `text-to-cad`, `mesh-to-cad`, `cad-generation`, `cad-validation`, and `cad-to-blender`. For reconstruction work read the applicable skill and `cad_pipeline/README.md`. All three input routes converge on a provenance-bearing JSON specification; FreeCAD owns geometry, Blender owns presentation. See `cad-studies/wright-1903/` for the first mesh-led trial.
- For real-object reconstruction, finish source/figure review, component inventory, mechanism paths, variant/conflict decisions and research readiness before planning CAD features. Revision 2 in `cad-studies/wright-1903/revision-2/` replaces the shallow first-pass research as the current Wright study. Every source callout needs an explicit modelled, simplified, deferred or outside-scope disposition linked to generated part IDs. CAD validity and historical/manufacturing fidelity are separate conclusions.

- Keep editable FreeCAD/Blender/STEP sources and exported GLB models in the existing Google Drive project folders. Never commit CAD/model binaries to Git. Preserve local editable originals.
- Git stores viewer code, rebuild scripts, lesson JSON, contracts, source provenance, hashes and validation records. Record Drive identities in `docs/drive-asset-manifest.json`.
- Reuse the existing Drive API delivery and restricted standard browser key. Keep native CAD archives private; publish only teaching exports needed by the student viewer.
- Verify uploaded export size and SHA-256 through anonymous Drive API delivery before binding a new model. Do not replace an existing working Drive release while preparing a new one.
- Run `python scripts/fetch_drive_assets.py` to restore ignored test assets on a fresh checkout. Run `npm run lint`, `npm test` and `npm run build` for viewer changes, and `npm run e2e` for any change to what a student sees. Production builds must contain no CAD/GLB files.
- Label unsupported geometry and motions as illustrative. GTSIO-520-H claims need applicable manufacturer evidence; do not silently substitute an IO-520 configuration.
