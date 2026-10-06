# Parts touch; they never overlap

Two parts in a teaching model may be in contact: a gasket on a face, a shaft in a bearing, a tooth flank against its partner. They may
not occupy the same space, at the assembled pose or while they move. A student who sees one gear's teeth pass through another's has been
shown something no real engine does.

## Why the old checks missed it

The accessory gears were square-ish teeth (tip `r+1.8`, root `r-1.8`) set exactly `r1+r2` apart, with no relationship between the tooth
phase of mating gears. Two things made that unfixable by nudging a phase: the flanks are not conjugate and there was no backlash, so even
the best possible phase still overlapped through the mesh cycle. And the FreeCAD verification only intersected a hand-picked list of 31
pairs, none of them a gear pair, so the overlap was never looked for.

## The layers

| Layer | What it guarantees | Where |
|---|---|---|
| Declare the train once | Positions, tooth counts and pitch radii are declared in one place; rates, modules and tooth phases are *derived*. The solver refuses mismatched modules, a wrong centre distance, gears in different planes or a loop. | `scripts/accessory_gears.py` |
| Build teeth that can mesh | Involute (20 degree) teeth with backlash (0.05 m) and tip clearance (0.25 m), and a driven-gear phase solved so a tooth meets a gap. The profile is polylines on the inside of the true curve, so it never has more material than the ideal tooth. | `scripts/gear_geometry.py` |
| Turn linked parts together | A focus clip animates one highlighted power path, and holding every other part still drives a path gear's teeth through a neighbour that is not on the path (the alternator path has the crank gear but not the cam, idler or starter gears). Gears that mesh with a turning gear, gears on its shaft and parts splined to it therefore turn with it, whichever side the path named. | `accessory_gears.turning_with()`, used by `scripts/rig_accessory_study.py` |
| Check in CAD, exhaustively | Every pair of solids whose bounds meet is intersected (not a short list), and every declared gear mesh must keep positive clearance. | `scripts/verify_accessory_sources.py` |
| Audit the exported file | The GLB students load is audited independently of FreeCAD and Blender: every neighbouring pair at the assembled pose and at sampled times through each baked clip, using the clip's own keys, so a pair that clears at rest but collides while turning is found. Declared gear meshes also report their minimum gap through the sweep. | `scripts/audit_assembly_interference.py` |
| Ratchet | Each model's `interference-policy.json` lists the overlaps its published asset still contains. A new overlap fails; a fixed one must be removed from the list; the goal is an empty list. CI reruns the audit. | `cad-studies/*/interference-policy.json`, `.github/workflows/pages.yml`, `scripts/test_interference_audit.mjs` |

The audit is itself tested against known answers (`scripts/test_assembly_audit.py`): conjugate gears must pass, and square teeth, a
wrong tooth phase and a gear 0.5 mm too close must each fail. The gear module is tested without any dependencies
(`scripts/test_gear_geometry.py`), including the same failure cases, a cross-check that the declaration reproduces the published
contract's rates and positions, and a check that for every power path no gear that meshes with a turning gear (or shares its shaft) is
held still. The rig needs Blender, so that test also checks that the rig takes its turning parts from `turning_with()`.

## What "touching" means in a mesh

The exported GLB is a tessellation of the CAD, so two faces that touch in CAD can overlap by a sliver of a hundredth of a millimetre on
a curved seat. The audit measures each overlap as a volume and as a thickness (`2V/S`, the thickness of the overlapping slab). A pair
is reported only if its volume exceeds `volume_tolerance_mm3` **and** its thickness exceeds `max_penetration_mm` (0.05 mm). A shaft
through a housing is millimetres thick; a gasket on a curved face is a sliver. The CAD-level check has no such allowance. The thresholds
are fixed in the policy files and a test refuses to let them be relaxed.

Gear clearance is measured as the minimum distance between the two meshes through the swept motion, and must stay at or above
`min_gear_clearance_mm` (0.02 mm). The solved phase centres each tooth in its gap, so the gap is about half the backlash on each flank;
a loaded drive flank would close it. That is contact without interference.

## Running it

```powershell
python -m pip install -r scripts/requirements-audit.txt
python scripts/audit_assembly_interference.py web/accessory-drives.glb.gz --contract web/accessory-drives-contract.json `
  --policy cad-studies/accessory-drives/interference-policy.json --output cad-studies/accessory-drives/interference-audit.json
python scripts/test_gear_geometry.py
python scripts/test_assembly_audit.py
```

After any change to a model: rebuild, export, run the audit, fix what it names or add a justified ledger entry, and commit the new
`interference-audit.json` with the model's hash. The audit exits non-zero on a new overlap, a gear mesh under its minimum gap, a stale
ledger entry, or a part it could not check and that is not waived with a reason.

To add a gear to the accessory train, declare it in `GEARS` and `MESHES` in `scripts/accessory_gears.py`; the builder, the contract and
the checks follow. Do not type positions, rates or tooth phases into the builder.

## State on 5 and 6 October 2026

| Model | Parts | Overlapping pairs | Notes |
|---|---|---|---|
| Accessory drives | 83 | 0 | Rebuilt from source on 6 October, audited and bound as the published model; the ledger is empty. No pair overlaps at the assembled pose (184 neighbouring pairs, all touching only) or in any of the eight audited clips, and all seven gear meshes keep at least 0.047 mm clearance. The earlier model had 16 overlaps and fixing them took three separate things. Involute teeth and a solved phase fixed the gear meshes at rest and in the operating and starter clips, with the screen plug, tach shaft and clutch spring grip fixed in the geometry. The focus clips needed the rig to turn linked parts together (see the layers above), because they had held every part outside the highlighted path still: five more overlaps, namely the crank gear with the cam, idler and starter gears, the idler with the right magneto gear, and the cam cluster on the oil/tach shaft. The last three needed the geometry changed: the adapter wall now rises to the worm tunnel's crest so the gasket and cover seat on it, and the worm axis is derived 0.3 mm off the wheel's tooth tips (`worm_axis_y()`). A true worm mesh needs a throated wheel, so the worm sits just clear of the teeth rather than meshing. `AlternatorBody` is still waived: its exported tessellation has open seam edges, so its seats are checked in CAD only. |
| Reviewed cylinder | 61 | 13 | Not investigated: rocker shafts in their housings, rod bolts through the rod, spark plugs in the head, piston ring three against the pin plugs. Assembled pose only. |
| Hydraulic tappet | 8 | 4 | Not investigated; all under 0.2 mm thick. |
| Oil pump | 14 | 3 | The gear pair uses the same square-tooth generator and overlaps; the relief plunger/spring and adjuster do too. |
| Wright revision-2 reconstruction | 413 | 0 | Clean: rest pose 1,121 neighbouring pairs, all touching only; the illustrative operating clip is clean at 133 poses and the exhaust-to-ignition spur pair keeps at least 0.078 mm. The exploded clip is skipped (see below). |
| Wright 1903 Smithsonian scan | n/a | n/a | One mesh: no part pairs to test. |

## The Wright revision-2 reconstruction

The 413-part Wright engine started with hundreds of overlapping pairs, nearly all one part passing through another where the layout had
simply placed them. It was made clean in four moves, each stored as data or derived, none typed into the generator:

- **Seats.** Where a part passes through or rests in another, the stationary host is cut with the guest's outline grown by 0.15 mm, so the two
  touch with that clearance (`cad-studies/wright-1903/revision-2/seats.json`, `cad_pipeline/wright_seats.py`). Fasteners, springs, hoses and leads
  are always guests. Two different moving bodies have no host: that is a mechanism fault and is fixed in the layout.
- **Rigid bodies.** `cad_pipeline/wright_bodies.py` says which parts move together (78 bodies, 125 static parts); parts of one body may share
  material and the audit skips their pairs.
- **Swept envelopes.** A part turning about a fixed axis is cleared through its whole revolution by its stepped silhouette (a gear disc, then its
  narrow sleeve), not one cylinder around all of it. The sleeve of the sliding ignition gear still notches the first exhaust valve cage by about 4 percent;
  that is a recorded layout conflict, not a pass.
- **Derived geometry.** The chain comes from its arc pitch (38 links, exactly 2:1) and the spur pair from its centre distance and tooth count, so every
  roller sits in its pocket and the teeth have positive backlash.

The motion is illustrative and defined once in `cad_pipeline/wright_motion.py` (`cad-studies/wright-1903/revision-2/operating-motion.md`). The audit that
matters is the one of the **exported file's baked clip sampled between its keys**: development audits that pose the exact motion at 30-degree steps passed
a model whose baked clip had six overlaps (a friction wheel drifting 0.2 mm between keys because its node origin was 230 mm from its axis, a cam
follower touching its cam by the nose only, two springs swinging into a valve box). The fixes are in `docs/wright-reconstruction-lessons.md`.

**Exploded view exception.** `Systems exploded view` is skipped by default like the accessory exploded clips: it moves systems along straight lines in three
stages, so parts pass through neighbours in transit (pistons and rods through the crankcase, liners through the valve boxes) and the held poses at the end of
stages 2 and 3 leave 14 and 18 overlapping pairs (`python scripts/scan_assembly_pairs.py <glb> --clip "Systems exploded view" --fractions 0.3333 0.6667 1`).
A removal-order planner that uses the audit as its oracle is the open step.

## What it does not cover

- The reviewed cylinder has no baked animation: the slider-crank and valve motion are driven in the viewer from
  `web/cylinder-saved-motions.json`. Only its assembled pose is audited. Sampling the saved motions is the next step.
- The exploded and reassembly clips are skipped by default. Their parts are nested, so transient overlaps are expected, and the
  explosion order is pedagogical. `--include-exploded` sweeps them.
- The full-engine export (1,595 parts) has about 2,700 overlapping neighbours at the assembled pose, mostly pieces of one rigid unit such
  as crank journal shoulders inside a main journal. The rule needs a rigid-group concept before it can be applied fairly. The Smithsonian
  Wright scan is a single mesh and has no part pairs to test.
- `AlternatorBody` has open seam edges in its exported tessellation, so an exact intersection cannot be built. It is waived with a reason
  and its seats are checked in CAD. The fix belongs in the export.
- This is geometric validity. Module, tooth counts, backlash and clearances are illustrative; none of it is manufacturer gear or fit data,
  and nothing here checks stress, lubrication or timing.
