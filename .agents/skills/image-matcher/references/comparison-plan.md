# Reproducible comparison and operation plan

Use a comparison per reference view/component. Record original source/page/figure/callout, image SHA-256, CAD or mesh SHA-256, selected part IDs, pose, camera/projection and visibility exclusions. Photographs of restorations and illustrations are not automatically manufacturing evidence. Keep source images untouched; overlays and crops are diagnostic derivatives.

The helper needs Python with NumPy and Pillow. It supports only a 2D similarity registration of an already comparable render: rotation, uniform scale and translation. Fit the 3D camera upstream. All coordinates are original image pixels, top-left origin; the helper subtracts the declared crop origin. A model render can supply pixel landmarks projected from its declared CAD datums rather than guessed by eye.

```json
{
  "reference": {
    "image": "source.png",
    "crop": [20, 40, 700, 500],
    "locator": "Manufacturer manual, Figure 12, PDF38, part 41",
    "landmarks": {"front_axis": [70, 90], "rear_axis": [620, 450], "middle_axis": [345, 266]}
  },
  "candidate": {
    "image": "cad-reference-view.png",
    "cad": "candidate.FCStd",
    "part_ids": ["Crankshaft"],
    "camera": "Recorded orthographic camera/pose in render-plan.json",
    "landmarks": {"front_axis": [105, 125], "rear_axis": [880, 625], "middle_axis": [485, 375]}
  },
  "fit_landmarks": ["front_axis", "rear_axis"],
  "check_landmarks": ["middle_axis"],
  "limitations": ["Illustration projection is approximate; do not interpret pixel residuals as machining tolerances."]
}
```

Paths resolve relative to the plan. Run:

```text
python scripts/compare_reference.py --plan comparison-plan.json --output comparison-output
```

`comparison.json` records transforms, hashes, fit residuals and **held-out** residuals. Fit residuals are not validation: two fitted points can always agree exactly while the rest of an object is wrong. `side-by-side.png` and `overlay.png` expose the registered comparison. A poor camera match or uncertain landmark is diagnosed before editing geometry.

For a subsequent candidate, set `lock_from` to the previous `comparison.json`. The helper reuses its transform and rejects changed reference/crop, candidate image coordinates or camera metadata. This prevents re-fitting the registration to hide a shape change. Images with transparency are composited over white for the diagnostic plate; raw input hashes are retained.

Optionally provide `reference.mask` and `candidate.mask` paths to separate filled binary masks (white object, black background). Prepare masks deliberately, preserving holes and excluding annotations, other objects and unsupported hidden regions. The helper records mask hashes and registration, checks their dimensions and computes silhouette IoU on the registered masks. It rejects empty masks; it never segments a full engineering drawing by thresholding all dark ink. Do not report an IoU improvement when the reference mask or view was changed between candidates. A metric on one view does not establish a 3D match.

The visual interpretation belongs in a separate findings record. Useful fields per finding:

- `id`, `part_id`, `reference_locator`, `reference_region_px`, `feature`, `state`.
- `observation`, `evidence_status` (documented, figure-supported, inferred or unresolved), `confidence` and `cause` (geometry, pose, camera, occlusion or ambiguous reference).
- `operation` (native feature/parameter), `dimension_provenance`, `expected_visual_effect`, `interface_checks`, `priority` and `disposition`.
- `before_artifact`, `after_artifact`, `result`, and remaining reference/measurement needed.

Use the output to decide what to build, not to decorate a report after building. High-priority missing visible construction remains a failed resemblance review even if the numerical registration is excellent. Cosmetic/material edits do not resolve missing holes, shoulders or mechanisms. For assembly edits, validate neighbours and moving envelopes before accepting the visual improvement.
