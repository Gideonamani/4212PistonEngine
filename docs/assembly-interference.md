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
| Accessory drives | 83 | 16 | The published asset still contains all 16, and its ledger lists them. Thirteen are fixed in source and wait for a rebuilt model to be released: seven gear meshes, the screen plug, the tach shaft, the clutch spring grip and, in the focus clips, the splined oil/tach shaft. Three are open: the starter worm tunnel through the cover and its gasket, and the worm penetrating its wheel. |
| Accessory drives, rebuilt from source on 6 October (not released) | 83 | 3 | FreeCAD build, Blender export and this audit were run in a scratch folder, so the published model and local CAD files were untouched. Only the three open pairs overlap. All seven gear meshes keep at least 0.047 mm clearance, and no clip, including the six focus clips, reports another overlap. The involute teeth and solved phase fixed the meshes at the assembled pose, in the operating clip and in the starter clip, but not in the focus clips: those held every part outside the highlighted path still, so five more overlaps (crank gear with the cam, idler and starter gears, idler with the right magneto gear, and the cam cluster on the oil/tach shaft) remained until the rig turned linked parts together (see the layers above). |
| Reviewed cylinder | 61 | 13 | Not investigated: rocker shafts in their housings, rod bolts through the rod, spark plugs in the head, piston ring three against the pin plugs. Assembled pose only. |
| Hydraulic tappet | 8 | 4 | Not investigated; all under 0.2 mm thick. |
| Oil pump | 14 | 3 | The gear pair uses the same square-tooth generator and overlaps; the relief plunger/spring and adjuster do too. |
| Full engine, Wright 1903 | n/a | n/a | Not audited, see below. |

## What it does not cover

- The reviewed cylinder has no baked animation: the slider-crank and valve motion are driven in the viewer from
  `web/cylinder-saved-motions.json`. Only its assembled pose is audited. Sampling the saved motions is the next step.
- The exploded and reassembly clips are skipped by default. Their parts are nested, so transient overlaps are expected, and the
  explosion order is pedagogical. `--include-exploded` sweeps them.
- The full-engine export (1,595 parts) has about 2,700 overlapping neighbours at the assembled pose, mostly pieces of one rigid unit such
  as crank journal shoulders inside a main journal. The rule needs a rigid-group concept before it can be applied fairly. The Wright
  1903 export is a single mesh and has no part pairs to test.
- `AlternatorBody` has open seam edges in its exported tessellation, so an exact intersection cannot be built. It is waived with a reason
  and its seats are checked in CAD. The fix belongs in the export.
- This is geometric validity. Module, tooth counts, backlash and clearances are illustrative; none of it is manufacturer gear or fit data,
  and nothing here checks stress, lubrication or timing.
