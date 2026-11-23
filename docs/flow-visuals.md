# Airflow, oil-flow and torque-flow visuals

The Explore viewer can draw live flow on top of a model: intake and exhaust air for each cylinder of a multi-cylinder engine, oil in a hydraulic tappet or gear pump, and torque through an accessory gear train. All of it is an illustrative teaching overlay, not CFD or manufacturer data, and it says so in the panel.

The drawing code names no engine and no part. What it needs to know about a model is data, so a new engine is a data change plus a test run, not new drawing code.

## Multi-cylinder engines (the cycle overlay)

Add an entry to `src/viewer/engineering/engine-declarations.mjs`, keyed by the model id. It states only what cannot be read from the model: the label, the firing order and where that order comes from (`firingOrderBasis`), cylinder 1's Otto angle at the motion's 0 %, the cylinder ids, name templates for each cylinder's parts, the crankshaft part, and which parts turn see-through. A contract may instead carry a `cycleOverlay` block, which wins.

Then run `npm test`. `scripts/test_multi_cylinder_cycle.mjs` checks every part id against the published contract, and `scripts/test_bore_geometry.mjs` reads the real part positions out of the model file (when it is on the machine) and checks that every cylinder's overlay hangs from the valve end, pointing away from the crankshaft.

Which way a bore points is decided in `src/viewer/engineering/bore-geometry.mjs`: from the valves, head or plug first, then the piston's long side and the crankshaft, with a declared `boreAxisHint` as an override. The old rule, "away from the middle of the engine", was only right for opposed and radial engines. It drew the Wright's cylinder 1 and the Merlin's 6A and 6B overlays under the piston.

## Hydraulic tappet, oil pump, accessory drives (the mechanism flow)

`src/viewer/engineering/mechanism-flow.mjs` holds one entry per study: its `kind` (the drawing it uses), the part ids for that kind's roles, and what turns see-through. A second model of the same kind is one more entry (or a `mechanismFlow` block in its contract) with its own part ids.

- The tappet's oil figures are keyed by the contract's own stage names, so the amber banner and the stage button beside it always name the same stage. `scripts/test_mechanism_flow.mjs` fails if a contract stage has no figures.
- The accessory drive reads the contract's `powerPaths`. `src/viewer/engineering/drive-train-flow.mjs` points every edge away from where torque enters: the crankshaft gear while the engine runs, the starter motor while it is being started. In normal running the starter path is idle, because the starter does not drive the engine then. `scripts/test_drive_train_flow.mjs` checks the result against the contract's gear meshes (driver and driven), so a ribbon cannot run against the gears it is drawn over.

## Things to remember

- A guess at a firing order is a claim. Record where each order comes from, and keep the overlay labelled illustrative. GTSIO-520-H needs applicable manufacturer evidence; the IO-520 order (1-6-3-2-5-4) is a different engine's.
- Models are not in Git. Geometry tests skip, with a message, when a model file is not present; `python scripts/fetch_drive_assets.py` restores them.
