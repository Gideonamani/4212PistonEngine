# Static timing and propeller drive milestone

The static construction milestone is accepted in `build/gtsio520-drive-r4`: 1,210 engineering parts and 4,760 native feature operations. Strict saved FreeCAD/STEP verification, independent saved/direct agreement and saved drive-interface checks pass. All 4,808 native neighbouring pairs and 4,473 final GLB neighbouring pairs pass with no overlap or waivers. The reopened Blender scene retains every engineering identity and scale. Eleven inspection plates and six saved source-comparison views have been visually inspected and hash-bound. The accepted valve-train package remains preserved in `build/gtsio520-valvetrain-r5`.

This module adds 82 parts: rear crank/cam gears and cam cluster, matching quill coupling and reduction pinion, integral propeller gear/shaft, bearing inserts, thrust washers/pins, oil-transfer sleeves/tube, oil seal and reinforcing/spring parts, quill retention, gear fasteners and front case hardware. Existing crankshaft, rear main inserts and split case histories are revised to supply the matching connections and support material.

Read research.md for the original figures, dimensional anchors, transcription conflict and selected D-family flange. Method-research.md records the FreeCAD technique and actual fixtures; design-learning.md records failed assumptions and transferable reasoning. The frozen specification and inventory bind this candidate. Do not copy its estimated counts, modules or case contours into another engine.

The final native-derived interface checks retain the original tolerances: 0.0635 mm diametral journal gaps, 0.254 mm propeller endplay, 0.2159 mm reduction endplay, supported bearing seats and a continuous open modeled oil-transfer route. See validation-summary.json and the individual final reports. The source review remains **needs another iteration**: case casting curvature, shaft/gear shoulder blends, spline detail and the seal spring are simplified. Full engine completion, operating animation and manufacturer accuracy remain unverified.

Rebuild from the repository root with FreeCAD's Python:

```powershell
& 'C:\Program Files\FreeCAD 1.1\bin\python.exe' cad-studies/gtsio520-h-static/drive-development/rebuild.py --output build/gtsio520-drive-rebuild/cad
```

An optional `--source-package build/gtsio520-valvetrain-r5/cad` extends the hash-verified base. Resume uses `--resume` only against intact compatible checkpoints. An investigated reused-history mismatch can be explicitly rebuilt with `--refresh PartID`; it never waives final tolerances. Preserve the accepted base and earlier failed prototypes.

Then run `cad_pipeline/verify.py`, `cad_pipeline.audit_gtsio_static` with the independently evaluated BREP cache, and `cad_pipeline.audit_gtsio_drive_interfaces`. Blender presentation, saved scene verification, the actual final GLB all-pair audit and image-matcher comparison follow. Keep heavy jobs sequential on this workstation. Derived sections remain outside engineering counts/exports. Native FCStd/STEP/Blender/GLB binaries stay local and ignored.

Exact native pair results can now be reused through saved-shape/placement fingerprints, with unchanged rules and verified source files. Every current neighbour is still enumerated; changed parts and newly adjacent pairs get fresh Booleans. Completed legacy passes can be indexed without repeating their intersections. Partial checkpoints retain completed work after interruption. See `docs/static-audit-reuse.md` and pair-reuse-checks.json for the method and measured engine result. This cache does not waive saved/direct, STEP, interface or exported animation checks.
