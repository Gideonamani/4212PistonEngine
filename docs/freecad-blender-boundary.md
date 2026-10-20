# Where FreeCAD stops and Blender starts

FreeCAD owns geometry. Blender owns presentation. The one-line rule in `AGENTS.md` left a middle open (blends, chamfers, small features), so this guide names three zones, says which
zone a part or feature is in by its fidelity class ([fidelity-classes.md](fidelity-classes.md)), and describes the check that enforces the line.

## The three zones

| Zone | What belongs there | Who may change it |
|---|---|---|
| FreeCAD only | Every vertex of every audited solid: shape, size, position. Anything classed `engineering`, and anything with an interference audit, a mass check or a STEP gate. | The part spec, then regenerate and re-run the gates. |
| Blender only | Normals and creases (smoothing by angle), material assignment and finish, per-part brightness variation, lighting and camera, animation sampling (the keys on a node's transform), labels, and overlay meshes: separate objects that are not part of an audited solid. | The Blender stages (`cad_pipeline/look.py`, `present.py`, `review_gtsio_r10.py`, the `rig_*.py` files). |
| The contested middle | Blends, chamfers, edge breaks, casting texture, small features. | See the options below. |

The contested middle has three options, cheapest first:

- **(a) Blender softening from normals.** Smooth shading by angle makes an edge read as rounded with no geometry change, so there is nothing to audit.
- **(b) FreeCAD dressups** on `cosmetic` features, where a saved and reopened fixture passes. The spec supports circular-edge fillets (`dressups`); the R10 foundation uses two.
- **(c) A display skin in Blender,** kept within a measured deviation of the audited solid. The exported mesh then differs from the audited one, so the audit must run on the exported
  file (the rule already requires that), and the drift check below needs a stated bound for the class.

**Release 1 uses (a) only.** Blender touches normals, materials, lighting and labels, and no geometry. Whether casting exteriors need (b) or (c) is decided after the casting spike
(plan item B8); until that decision, nothing in the contested middle is done in Blender.

## How the class decides who may edit what

| Class | FreeCAD | Blender, release 1 | If the class later gets a skin or dressup |
|---|---|---|---|
| `engineering` | Spec edit, regenerate, re-run every gate it depends on. | Normals and finish only. Bound: float32 rounding (0.001 mm). | Never. An engineering surface is not skinned. |
| `visual-structure` | Spec edit and regenerate; may deviate from the source only inside a stated envelope that contains every interface. | Normals and finish only. Same bound. | Only with a stated envelope and a resemblance check. |
| `cosmetic` | May change without re-running the engineering gates, if an envelope check proves no interface or clearance moved. | Normals and finish only. Same bound. | A display skin (c) is allowed here first. Set `--class-bound cosmetic=<mm>` in the release record, audit the exported file, and record the measured deviation. |

A part that moves, meshes or sits in the interference ledger is bound to a gate, so it stays `engineering` whatever an override says.

## Enforcement: the geometry drift check

`scripts/check_geometry_drift.py` compares the frozen tessellation of a study (the geometry file a build writes, in millimetres in the CAD frame) with the GLB that Blender exported, part by part:

```powershell
python scripts/check_geometry_drift.py build/<study>/development/geometry.json build/<study>/<export>.glb `
  --classes cad-studies/<study>/fidelity-classes.json --output build/<study>/geometry-drift.json
```

It maps each exported vertex back through the node's rest transform and the Z-up to Y-up change of Blender's glTF exporter, and fails any part for which, beyond the bound
(0.001 mm by default):

- an exported vertex has no frozen vertex that close, or a frozen vertex has no exported one (a vertex moved, a skin or subdivision added vertices, a decimation removed them);
- the triangle count changed;
- the signed volume differs by more than the surface area times the bound (a reconnected or flipped triangle changes the volume even when every vertex is kept).

A mesh in the export with no part in the geometry file also fails, unless `--allow-extra REGEX` names it as an overlay. A compressed or quantised file is refused, because quantisation moves
vertices by design: run the check on Blender's export, before `scripts/optimize_model.mjs`, which has its own measured error bounds.

The existing file check (`scripts/check_gtsio_review.mjs`) measures only each part's bounding box, a few hundredths of a micron at rest for R10 (the plan records 0.000052 mm). This
check keeps that approach, one bound and one number per part, but compares every vertex, so a change inside the bounding box is seen too.

Where it has been run (19 October 2026):

- Wright revision 2, the Blender export of the same run as its geometry file (413 parts, 13 MB of geometry, 18.9 MB GLB): **passed**, largest vertex error 0.000023 mm, 39 to 95 seconds
  (the machine was shared), peak memory 269 MB.
- The same geometry file against the later published Wright GLB: **failed** (triangle counts differ, 2,036 against 3,940 for one piston), as it should, because that file came from a
  different run. A pair must come from one run.
- R10: **not run.** Its geometry file (91 MB) is in a build folder that is not on this machine. Scaling the Wright figures by size, expect roughly 1.2 GB of memory and several minutes
  (an estimate, not a measurement), so do not run it beside an audit or a Blender job. Run it once on the R10 export before any release that changes the look.

`scripts/test_geometry_drift.py` is the CI test. It builds a three-part fixture in the test itself (no binary is stored), writes it the way Blender writes a GLB (Y up, metres, float32,
split vertices, a pivot carried by the node), and checks that a faithful export passes and that a vertex moved by 10 microns, a subdivided triangle, a decimated part, a reconnected quad,
a missing part, an unnamed overlay, a compressed file and a wrong axes mapping each fail, and that a cosmetic class bound admits what an engineering bound refuses.

## What the Blender stages do today

The stages that build the studies' GLBs (`present.py`, `review_gtsio_r10.py`, `rig_animated_study.py` (behind the entry points `rig_gtsio_review.py`, `rig_langley.py` and `rig_wright.py`), `look.py`) create each mesh from the frozen vertices
(`from_pydata`, millimetres to metres, minus the part's pivot in the rigs). The only mesh edit is `look.py`'s smoothing by angle, which sets edge sharpness and per-face smooth flags and
moves no vertex; `rig_animated_study.py` re-bases mesh data (for R10, when it bakes) to the part's pivot, a rigid move that the node transform undoes. The drift check turns that from a reading of the scripts into a
tested fact on each export.

## What it does not check

Materials, lighting, camera, the keys of an animation, and normals are Blender's own and are not compared. Motion is audited separately (the baked-clip audit in
[assembly-interference.md](assembly-interference.md)). A fidelity class sets the bound; it does not change what the interference audit, the mass check or the STEP round trip require.
