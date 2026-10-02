# Project storage and validation

- Keep editable FreeCAD/Blender/STEP sources and exported GLB models in the existing Google Drive project folders. Never commit CAD/model binaries to Git. Preserve local editable originals.
- Git stores viewer code, rebuild scripts, lesson JSON, contracts, source provenance, hashes and validation records. Record Drive identities in `docs/drive-asset-manifest.json`.
- Reuse the existing Drive API delivery and restricted standard browser key. Keep native CAD archives private; publish only teaching exports needed by the student viewer.
- Verify uploaded export size and SHA-256 through anonymous Drive API delivery before binding a new model. Do not replace an existing working Drive release while preparing a new one.
- Run `python scripts/fetch_drive_assets.py` to restore ignored test assets on a fresh checkout. Run `npm run lint`, `npm test` and `npm run build` for viewer changes. Production builds must contain no CAD/GLB files.
- Label unsupported geometry and motions as illustrative. GTSIO-520-H claims need applicable manufacturer evidence; do not silently substitute an IO-520 configuration.
