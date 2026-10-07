# Builder overlap audit: Wright and Langley (Phase B, task 1)

Done on 8 October 2026 for `docs/ai-mechanical-engineer.md` (Phase B). The question: how much do the two engine builders share, and
what should be extracted first into the geometry grammar and recipes? Method: read the builder code and the committed `part-spec.json`
of both studies, compare every function structurally, and size the five part families (piston, connecting rod, valve, cam, gear) in each.
The measurements come from `scripts/audit_builder_overlap.py`; run it again after an extraction to see the numbers move. The audit
changed no builder code.

## The short answer

The Wright and Langley builders share nothing that either of them wrote. Neither imports the other. What they have in common is
`spec.py`, `research_gate.py`, `scripts/gear_geometry.py` and a feature vocabulary (box, cylinder, tube, cone, sphere, prism, helix,
revolve, each added or cut). Everything else is copied, in three layers:

1. **Plumbing** (copied almost verbatim): 14 function pairs are 95 to 100 percent structurally identical, 8 of them with identical
   source. This is about 180 lines on the Wright side. It is the cheapest overlap to remove and it is not geometry.
2. **Feature helpers**: four separate dialects of `cy`/`tube`/`bx`/`prism` constructors (16 helpers), and 42 more hand-written feature
   dictionaries in seven files.
3. **The five part families**: 154 Wright parts (489 features, 29 percent of its features) and 122 Langley parts (263 features, 33
   percent). They overlap partly: gears almost completely, pistons and valves in their pieces, cams in concept, connecting rods only in
   the little end.

Four findings change how Phase B should be built, in section 5. The most useful single fact: **both builders regenerate their
committed `part-spec.json` byte for byte**, so every extraction can be checked against a golden file.

## 1. What is shared today

| Shared by both | Not shared |
|---|---|
| `cad_pipeline/spec.py` (validation, `evaluate`) | Any helper that builds a feature or a part |
| `cad_pipeline/research_gate.py` | The rigid-body rule table loader (copied, section 2) |
| `scripts/gear_geometry.py` (involute profile, mesh phase) | Matrix and track helpers of the motion and Blender rig (copied) |
| The feature vocabulary, read by the generators | The part builders themselves |

Neither family imports the other. The Wright modules import nothing from the repo that the Langley modules do not also import,
apart from their own family.

## 2. Layer 1: plumbing copied between the families

Structural similarity is the ratio of the two function bodies as sequences of syntax nodes, ignoring names. "Identical" means the same
source apart from docstrings.

| Wright | Langley | Lines | Similarity |
|---|---|---|---|
| `rig_wright.main`, `tracks`, `write_tracks`, `blender_matrix` | same names in `rig_langley` | 102, 19, 16, 4 | 0.96, 0.95, identical, identical |
| `wright_motion.mul`, `translate`, `scale_z`, `apply` | same names in `langley_motion` | 2, 4, 4, 3 | identical |
| `wright_motion.rotate_x` | `langley_motion.rotate_x` | 5 | 0.98 |
| `wright_motion.wrap` | `langley_cam.wrap` | 2 | identical |
| `wright_explode.amount` | `langley_explode.amount` | 3 | identical |
| `wright_contract.operating_stages` | `langley_contract.operating_stages` | 8 | 1.00 (names differ) |
| `wright_bodies.body` (and its rule-table loader) | `langley_bodies.body` | 7 | 0.96 |

Two of these deserve a name. The **rule table with a first-match loader** appears in `wright_bodies`, `langley_bodies`, `wright_explode`
and `langley_explode`: a list of regular expressions over part ids, and a loop that returns the first match. The data differs, the code
does not. And the **matrix and track helpers** of the motion definitions and the Blender rigs are the same code twice, which also
affects pillar 4 (the motion definition is supposed to be written once).

## 3. Layer 2: the feature helpers

| Module | Helpers | Values it takes | Placement |
|---|---|---|---|
| `wright_v2` (nested in `make_spec`) | `cy`, `tube`, `bx`, `xz`, `he`, `bolt`, `par`, `add` | numbers or expression strings such as `'bore/2+liner_wall'` | global coordinates, explicit origin and axis; `bx` has no axis or roll |
| `wright_spec` (first trial, retired) | `cyl`, `box`, `ring`, `param`, `add` | numbers | global; `param` and `add` are 0.97 and 0.93 similar to `wright_v2`'s |
| `langley_v1` | `cy`, `tube`, `cone`, `bx`, `prism`, `rev`, `helix`, `about_x`; `Spec.par`, `Spec.add` | numbers only, rounded to 6 places | local frame placed by `Frame` (rotation about X, with roll bookkeeping) |
| `langley_drive` | `x_cyl`, `x_tube`, `x_prism`, `lighten`, `gear_points` | numbers | features along X, written in (Y, Z) |

Hand-written `dict(primitive=...)` features outside these helpers, by file: `langley_drive` 15, `wright_v2` 9, `langley_v1` 7,
`wright_spec` 4, `langley_flywheel` 3, `langley_pipes` 3, `wright_seats` 1, 42 in all. Each is a place where a grammar operation would
replace hand-assembled keys.

`wright_spec.py` is the retained first trial (the pipeline README keeps its command as a record of an insufficient research pass). It
is the oldest copy and is not worth touching.

## 4. Layer 3: the five part families

Sizes are from the committed specs. Code locations are where each study builds the family.

| Family | Wright: parts, features, code | Langley: parts, features, code | What they share | What differs |
|---|---|---|---|---|
| Gear | 4, 35: `wright_v2.py:235-245` (`spur`) | 9, 27: `langley_drive.py:17-38, 56-87, 139-156` | Both call `gear_geometry.profile` with the same arguments (`flank_points=5, tip_points=1, root_points=1`) and solve mesh phase with `mesh_phase`; both extrude the outline as a prism and cut a bore | The plane (XZ against X-axis in YZ); Langley adds hubs, axles and lightening pockets |
| Piston | 36, 100: `wright_v2.py:123-132` | 40, 115: `langley_crank.py:80-112` | Pin boss is a cylinder of radius 16 in both; ring grooves are cut tubes; the pin bore is a cut cylinder at pin radius plus a small clearance; outer radius comes from bore less clearance | Body: a cylinder minus a hollow skirt (Wright, expressions) against one revolved domed profile (Langley, computed points). 3 rings against 4. Langley adds two ribs and retaining-screw holes; Wright adds ring pegs and setscrew seats. Solid pin against hollow pin |
| Valve | 48, 136: `wright_v2.py:158-175` | 40, 40: `langley_cylinder.py:78-91` | Head diameter and stem radius drive the shape; the spring is a helix in both | Wright: separate head, stem, cage, retainer, spring, washer (cone seat). Langley: head and stem as one revolved profile, plus separate seat, nut, cap, collar |
| Cam | 22, 38: `wright_v2.py:177-189` | 12, 39: `langley_cam.py`, `langley_drive.py:88-99` | The concept: a lobe is a base circle, a rise, a half width and a phase | Wright draws a lobe as two circles (a base circle and an offset nose circle). Langley builds a real profile polygon from a bump law and extrudes it |
| Connecting rod | 44, 180: `wright_v2.py:133-148` | 21, 42: `langley_crank.py:36-78` | Only the little end (tube, neck, bore) and the idea of a shaft along an axis | Three-piece tube with bronze ends, against a master rod with an integral sleeve half, link rods, slipper shoes and nuts. Different architecture |

Wright's two timing sprockets (202 features, 12 percent of its model) are the largest single block that has no Langley counterpart;
they do not qualify for extraction yet, because a recipe is lifted out only when a part appears twice.

## 5. Findings that change the Phase B design

1. **Expression strings must survive.** 778 of Wright's 1,682 features (46 percent) carry expression strings that name 25 of its 34
   parameters; Langley has none. Both backends read values through `spec.evaluate`, so either style is valid input, but a recipe that
   emitted only numbers would silently remove the property the Wright model is built to have: change a parameter in the reopened
   FreeCAD document and the shape follows. Recipes must accept a number or an expression string for every dimension and compose
   strings when an operand is a string. This needs a small arithmetic helper that returns a float when both operands are numeric and a
   string otherwise.
2. **Write in a local frame, place afterwards.** Langley already works this way (a part in its own frame, placed by `Frame`); Wright
   writes in global coordinates. A recipe should return features in its own frame and let the caller place them, with `Frame` or a
   plain offset.
3. **The vocabulary is interpreted in four places.** The list of primitives is spelled out in `spec.py:50` (validation),
   `generate.py:167-169` (native build), `fast_build.py:34-51` (development evaluator) and `wright_seats.py:70-88` (seat growth).
   Adding a primitive means editing all four. So the grammar should compose the eight existing primitives first, and a single
   declared primitive table should come before any new primitive.
4. **`wright_v2.make_spec` is not a pure function.** Besides returning the spec it rewrites `inventory.json`, `coverage-plan.json`,
   `research-readiness.json`, `chain-layout.json` and `part-spec.json` in the study folder. Running it in a scratch copy reproduced all
   five files byte for byte, so it is idempotent, but it can not be used as a test without a temporary copy of the study. Separate
   building from writing before refactoring it.
5. **Golden files exist for both builders.** `python -m cad_pipeline.langley_v1 --out X` reproduced `part-spec.json` byte for byte
   (616,926 bytes), and `python -m cad_pipeline.wright_v2` reproduced all five Wright files in a scratch copy. Any extraction must
   either leave these identical or be a declared geometry change that reruns the interference audit (`AGENTS.md`) and, for Langley,
   the mass check.

## 6. Recommended order

| Step | What | Why this position | Risk | Check |
|---|---|---|---|---|
| 0 | A golden-file test for both specs (Langley directly; Wright in a temporary copy, or after making `make_spec` pure) and one declared primitive table | Every later step is verified by it | Low | `part-spec.json` byte-identical |
| 1 | `spur_gear` recipe: involute outline, plane, bore, optional lightening pockets | Both studies already call the same shared module; 13 parts, 62 features; needs no expressions | Lowest | golden files; `scripts/test_gear_geometry.py` |
| 2 | `piston` recipe: ring grooves, pin boss, pin bore, optional ribs and screw holes, body as either a cylinder-with-skirt or a revolved profile | 76 parts, 215 features; the first recipe that must carry expressions, so it proves the helper from finding 1 | Medium | golden files |
| 3 | `poppet_valve` (fused or split head and stem) and `coil_spring` | 88 parts, 176 features; both studies build the same helix | Medium | golden files |
| 4 | `rod_shaft` and `little_end` sub-recipes only | The rod architectures differ, so extract only what is shared; a whole `connecting_rod` recipe would be forced | Low | golden files |
| 5 | `cam_lobe` profile from base radius, rise, half width and phase | Decision needed: if Wright adopts Langley's real profile its geometry changes and the audits rerun | Higher | audits, if adopted |
| in parallel | Plumbing: one rule-table matcher, one kinematics module (matrix helpers), one rig driver (`rig_wright` and `rig_langley` are 96 percent the same) | Not geometry, cheap, and it removes 14 of the 43 similar pairs; measure with the script | Low | the audit script; the existing rig and motion tests |

Do the plumbing before or beside step 1, because the first three recipes will be easier to review in files that are not drowning in
copies. Switch Langley to the recipes first (pure builder, numbers only), then Wright.

## 7. What the audit did not cover

- The third builder lineage: the IO-520 and GTSIO-520 cylinder and accessory builders (`EngineSimulation/`, `scripts/build_*`), and
  the unmerged `feat/gtsio520-realism` work. They may overlap with the five families too.
- The two backends against each other (`generate.py` and `fast_build.py` both interpret the vocabulary).
- Meaning. Similarity is structural: `wright_motion.rotate_y` scores 0.87 against `langley_motion.rotate_x`, which is a coincidence of
  shape and not a duplicate. Read each pair before extracting it.

## 8. Reproduce

```
python scripts/audit_builder_overlap.py            # about 30 seconds, standard library only
python scripts/audit_builder_overlap.py --json out.json
```

The determinism check, in a scratch copy so nothing in the repository is rewritten: copy `cad_pipeline/`, `scripts/gear_geometry.py`,
`cad-studies/wright-1903/` and `cad-studies/langley-manly-balzer-1903/*.json`, run `python -m cad_pipeline.langley_v1 --out regen.json`
and `python -m cad_pipeline.wright_v2`, and compare the outputs with the committed files.
