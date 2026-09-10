# Shared cylinder motion profile

## Valve motion integration in progress

`web/valve-kinematics.mjs` computes valve translation, rocker angle, rocker socket and the fixed-length pushrod follower endpoint in CAD world coordinates. It interpolates the solved rocker-angle table by lift and derives joint positions geometrically rather than interpolating both rod ends independently. It is not wired into the published viewer yet.

`scripts/test_valve_kinematics.mjs` compares socket and follower positions against all 58 recorded housing-candidate CAD poses, and checks rod closure at 701 lift positions per train. Those interpolated checks prove joint closure, not continuous solid clearance. The illustrative cycle uses sin-squared lift during ideal 180-degree intake/exhaust strokes, zero lift on the other strokes, and a closed 720-degree loop. This is not manufacturer cam timing or a gas/thermodynamic simulation.

`solve_valve_contact.py --spring-seat` repeats the native contact/interface audit against the latest spring-seat candidate, checks its source lineage and actual joint frames, and checkpoints an explicitly incomplete report during the run. `build_valve_motion.py` refuses to produce `data/valve-motion.json` until this contact audit and the source-matched spring audit are complete and pass. It deliberately excludes obsolete spring dimensions from the earlier joint-frame file. Asset binding, spring presentation, interpolated contact review and browser integration remain required before release.

Completed result: `data/spring-seat-contact.json` records all 58 poses with the listed clearance gate passed and zero joint-frame disagreement. `data/valve-motion.json` is generated against that candidate hash. Runtime socket/follower positions agree with all 58 new CAD poses within 1e-6 mm. This does not extend the sampled collision scope or approve manufacturer timing.

`data/motion-profile.json` is the first CAD-derived motion contract. Rebuild it with FreeCAD 1.1's Python and `scripts/export_motion_profile.py`. The exporter opens the master, reads its parameter annotations and placements, evaluates eight inspection poses in memory, and closes without saving. The profile records the source CAD SHA-256, 60 stable component IDs and their four motion groups.

Coordinates are millimetres in FreeCAD: the piston travels on X, the main shaft lies on Y, and increasing crank angle rotates around negative Y. Zero places the piston pin farthest from the main shaft. For crank radius r = stroke/2, rod length L and angle a:

```
crankpin = (r cos(a), 0, r sin(a))
reach = sqrt(L² - (r sin(a))²)
piston_pin = (r cos(a) + reach, 0, 0)
rod_rotation_about_Y = atan2(r sin(a), reach)
crank_rotation_about_Y = -a
```

Validation compares these positions to actual CAD group placements and transformed rod/crank joint points at 0, 35, 90, 180, 270, 360, 540 and 720 degrees. The tolerance is 0.000001 mm for arithmetic/placement agreement, not manufacturing accuracy or evidence of real-engine clearances.

Parameter evidence text is imported from the CAD spreadsheet unchanged. It is not a fresh manual audit. The existing 720-degree video profile uses ideal 180-degree strokes and 7 mm valve lift; both remain explicitly illustrative. Valve axes, rocker pivots, pushrod endpoints, installed spring dimensions and source timing still require extraction/review before synchronized valve-train animation.

## Browser integration gate

Initial checks passed: eight CAD poses have maximum joint error 2.88e-14 mm. `scripts/verify_web_bind_pose.py` verified all 60 IDs and the piston, rod and crank node transforms in the current GLB. `data/web-bind-pose.json` records the asset hash and a 36.000001-degree bind angle, consistent with frame 13 of the 720-degree/240-interval animation. Maximum translation disagreement is 2.17e-8 metres, within export precision. These checks do not verify every mesh vertex, valve motion or clearances.

The current GLB export selects frame 13 of a Blender animation and bakes world placements into separate objects. Do not assume this equals the CAD's 35-degree inspection pose. Verify actual GLB transforms against the source animation and record the asset hash and bind angle, or export a new version with explicit motion-group frames. Convert millimetres to metres and verify Blender-to-glTF axis conversion with known joint points. Keep the currently published static explorer working until those checks pass.

Section stencil meshes currently copy static world matrices. When motion is introduced, update their matrices alongside their source meshes so the filled cut faces remain attached. Check selection, isolation and section views at representative crank angles as part of the animation release.

The first web integration implements those stencil updates. Rebuild its compact profile with `python scripts/build_web_motion.py`; run `node --test scripts/test_kinematics.mjs` to compare browser arithmetic to recorded CAD joint positions. The viewer checks the asset hash, calculates each part's transform relative to its group's bind frame, and applies the current group transform. Playback pauses on scrubbing, isolation and tab hiding. Reset angle returns to the verified 36-degree bind pose. Closed valves and absent gas effects are explicitly labelled in the teaching UI.

Pages publication now runs the kinematics and transfer-recovery tests, rebuilds the compact motion profile, and rejects a difference from the committed profile before deployment. The bind report also records the CAD source hash; profile generation rejects a report verified against a different CAD source. This is an initial pipeline gate, not a substitute for exporting and inspecting a new GLB or proving the two controlled CAD changes required by M3.
