# Langley / Manly-Balzer 1903: build and audit notes

Status (7 October 2026): the 358-part specification builds natively (787 features, 13 minutes with `--batch-runs 6`) as 358 single valid solids, `verify.py` passes under a reviewed STEP exception for three parts (`step-exception-policy.json`), and the **exported file's interference audit is clean**: 1,492 neighbouring pairs at rest, 133 poses of the baked operating clip, 0 overlaps, five gear meshes with at least 0.043 mm of clearance. Operating motion, exploded view, rig, contract and the Explore card are done; the Drive release binds a file id once the user has shared the file.

## How to rebuild

```
python -m cad_pipeline.langley_v1 --out build/dev/langley-spec.json                 # 358 parts, IDs equal to inventory.json
"C:/Program Files/FreeCAD 1.1/bin/python.exe" cad_pipeline/fast_build.py --spec build/dev/langley-spec.json --output build/dev/out --jobs 2
build/audit-venv/Scripts/python.exe cad_pipeline/geometry_to_glb.py build/dev/out/geometry.json build/dev/out/model.glb
build/audit-venv/Scripts/python.exe scripts/audit_assembly_interference.py build/dev/out/model.glb --rest-only --output build/dev/out/audit-rest.json
python scripts/langley_mass_check.py build/dev/out/geometry.json
```

`fast_build.py` is the development evaluator (plain Part booleans); the editable native document comes from `generate.py --batch-runs 6` and is the release path. Run one build at a time: each uses several FreeCAD workers and the machine runs out of memory.

## Mass against Manly's weight table (M1 p. 250)

The table is a shape test that does not depend on a drawing. The model is 63.5 kg against 56.3 kg for lines W01-W13 (+13 percent); items the table does not list (bed-plate webs, coupling flanges, transmission stubs, starter, pump drive) are 14.2 kg more and are reported separately in `mass-check.json`.

| Line | Model g | Table g | Ratio | Remark |
|---|---:|---:|---:|---|
| W01 crank shaft | 6,208 | 5,225 | 1.19 | bore 36 mm (top of the measured 27-36 mm), webs 24 mm |
| W02 connecting rods | 7,366 | 5,070 | 1.45 | **unresolved**: the drawn sleeve (8.3 mm wall), shoes, cone and jam nuts alone are 3.7 kg; either the table leaves the sleeve hardware out of this line or the sleeve is lighter than the plate bands suggest |
| W03 pistons | 8,162 | 8,260 | 0.99 | |
| W04 cylinders | 26,216 | 23,524 | 1.11 | |
| W05 port drum, cam, gears, punch rods | 6,418 | 5,225 | 1.23 | gears and cam ring webbed to get here |
| W06 starboard drum | 3,015 | 3,440 | 0.88 | |
| W07 spark plugs | 548 | 450 | 1.22 | |
| W08, W09 water pipes | 515, 349 | 450, 360 | 1.14, 0.97 | wall 0.3 mm |
| W10 inlet manifold | 1,799 | 1,700 | 1.06 | wall 0.24 mm |
| W11 sparkers and wires | 896 | 512 | 1.75 | the 60-tooth gear alone is about 0.4 kg even webbed to 2 mm |
| W12 + W13 balance arms and braces | 2,055 | 2,107 | 0.98 | arm 8.5 mm |
| W14, W15 flywheels | 3,955, 3,243 | 3,946, 3,234 | 1.00 | rim thickness solved (4.65 mm starboard, 3.15 mm port) |

## What the first audits found and how it was settled

Fixed in the geometry (no threshold was relaxed):

- **A half-turn rotation bug.** FreeCAD turns local Z onto exactly -Z about the Y axis; `langley_frame.z_to` assumed X. Boxes in the balance-arm frames (rotated 180 degrees at the rest pose) were mirrored in X and offset in Y. Corrected, with the roll recomputed.
- Crank webs reached 98 mm while the drum head plates start at 96 mm: webs now 24 mm thick (70-94 mm).
- Cam-ring lobes were drawn at 90 and 270 degrees instead of 0 and 180: the polygon is written directly in (Y, Z).
- The cam-train gears 'small gear' and 'cam ring' overlapped (centre distance 108 mm against tip radii 39 + 75 mm): tooth counts changed from 24/48/24/24/48 to **24/48/18/12/36** (net still exactly -1/4 with three external meshes).
- Starter rebuilt: the worm now lies on a horizontal tubular shaft along -Y tangent under the worm wheel, with a bore for the shaft and two brackets whose arms reach the bed-plate web; the pump bevel gear and pinion moved clear of the worm.
- Bed-plate webs have their tips cut off (port at 450 mm, starboard at 348 mm) so the inlet gas ring and the water inlet ring pass them; the starboard web has holes for its bolts.
- Jacket dome profile crossed itself (sphere through the wall top and apex height now); jacket ring moved under the jacket; liner 0.1 mm inside the shell; flange seat 0.25 mm larger than the shell; flywheel spoke holes lengthened and spoke ends stop 0.4 mm short of the rim; piston boss no longer pokes through the skirt; thin-wall tessellation for shells, jackets, liners and pistons finer than every clearance.
- Many parts lightened where the weight table demanded it and the plates are silent: manifold and pipe walls, oil cups (a thin channel), gears and cam ring (web and rim), punch rods, plug sheaths, rod little ends and bushings, crank webs, port hub.

## Open before release

- Overlay checks of the drums and crank on Plate 78B and of the end elevation on Plate 79 are not done.
- W02, W11 and W05 stay above the table; see the remarks above.
