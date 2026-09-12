# Operating-cylinder preview verification — 11 September 2026

## Particle correction following visual review

The initial square, fixed chamber cloud and exterior-only tracers have been replaced. Soft circular sprites now have a fixed 1.8 mm illustrative diameter, swirl deterministically with crank angle, and stop on pause. Their full radius stays clear of the moving piston crown and within the central display envelope. Depth testing prevents solid parts from being drawn behind particles that they should hide. `View gas inside` selects a Y section and frames the working chamber/ports for inspection.

Intake/exhaust streams run between the external mouth, inner cross-port, a valve-edge waypoint and chamber; exhaust follows the opposite direction. The builder derives valve radius from the candidate mesh and uses the existing source-linked valve frames. Opacity fades with opening lift and each stream disappears when its valve closes. These are explicitly schematic connections, not solid-clearance-audited internal fluid trajectories; the earlier chamber-volume audit must not be read as validating the new port paths.

Ten numerical tests pass, including chamber sprite bounds at every integer crank angle and port-stream crown clearance. The updated browser regression passed 14,497 checks, including actual loaded piston bounds, transparent sprite corners, depth testing, moving charge geometry and the earlier spring/section/playback checks. Earlier overlay descriptions and the 2,825-check count below describe the superseded first version.

Final visual inspection in the focused section/fullscreen view confirmed separate round cyan particles and an intake connection at 90 degrees, blue chamber particles with no open-port stream during compression, and the grey exhaust connection at 630 degrees. Particle size includes the perspective field-of-view correction so its screen projection agrees with the bounded world diameter. Paths and chamber positions vary with crank angle; pause/scrub preserve a deterministic state. Small embedded views can require fullscreen or zoom to distinguish individual particles.

The existing cycle-cue implementation has been integrated and checked with the spring-seat package. Intake and exhaust arrows follow the extracted CAD port axes and are gated by valve lift. Charge colour and explanation follow the shared crank angle, including paused scrubbing. Orange glow illustrates combustion; the central point cloud is not total chamber volume. Cues deliberately draw through solids and are not clipped by Section view; the on-page explanation now states this explicitly.

The preview builder additionally checks the region-audit file hash against the cue profile, alongside the existing candidate source and spring-morph checks. No production model was promoted during this work.

## Reproduction

From the repository directory:

```powershell
python scripts/prepare_package_preview.py --package build/pipeline-spring-seat --valves
node --test scripts/test_cycle_cues.mjs scripts/test_kinematics.mjs scripts/test_valve_kinematics.mjs scripts/test_transfer.mjs
python -m http.server 8765 --bind 127.0.0.1 --directory build/pipeline-spring-seat/preview
```

Open `http://127.0.0.1:8765/?control=local&verify=cycle`. Verification runs only with local-control mode and this explicit query. Normal preview: `http://127.0.0.1:8765/?control=local`.

## Results

- Eight Node tests passed: CAD joint agreement, cycle closure, valve gating, and transfer behaviour.
- Browser reported PASS for 2,825 assertions against the loaded GLB and actual viewer section masks. Four springs, X/Y/Z sections, both cut sides, and 0/90/180/270/360/450/540/630/719.99/720-degree poses were checked.
- For every spring, the two stencil meshes share the live morph weights; world transforms and three deformed vertex samples match the rendered source. Each tested pose renders without a reported WebGL error.
- The full mechanism transform/morph snapshot agrees at 0 and 720 degrees. Playback crosses the boundary, and pausing freezes the pose. Scrubbing pauses motion and refreshes the explanation.
- Initial verification exposed sensitivity to first-frame timing. Elapsed animation time is now clamped to zero before applying the existing maximum step, preventing a negative initial step; the rerun passed.
- Visual inspection showed the cyan intake overlay in the assembled view. An isolated intake outer spring, cut across Y at 50%, showed filled cut faces at both 0-degree/zero-lift and 90-degree/7 mm-lift poses, with pitch changing while the wire section remained consistent.

This is desktop browser and sampled rendering evidence. It is not continuous solid-clearance certification, a physical-phone performance measurement, manufacturer valve/ignition timing, or an instructor-approved lesson. No spark-plug ignition-location markers are claimed by this implementation. The roughly 35 MB candidate still needs optimization/device review before production promotion.
