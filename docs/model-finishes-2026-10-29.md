# Model finishes: why some models rendered near-white (29 October 2026)

The cylinder and the GTSIO-520-H R10 rendered almost white in the viewers, so parts blurred together and the spotlight (X-ray, Highlight) and the
3D part quizzes had little contrast to work with. This record says what was wrong, model by model; what the viewer does about it now; and what
only a re-export of the model can fix, for the CAD repository (EngineReverseEngineering_MEDIS).

## What was wrong

**The viewer, for every model.** `src/viewer/core/runtime.ts` lit the scene with a room environment at full strength, a hemisphere light of 0.85
and three directional lights adding up to 3.85, through ACES at exposure 0.9. That delivers about twice what a surface's own colour asks for,
and ACES then rolls everything above the middle off towards white (and desaturates it). So any part whose colour was not already dark came out
pale, most of the light was ambient (which has no direction to model a form with), and on the light stage (`#d5dfe3`) a pale part had nothing
to stand out against.

**The files, for some models.** Where the file's own colours are the problem, the viewer cannot fix it without lying about the material. The
table is what the models contain (`scripts/audit_model_finish.mjs`) and how they drew before and after. "Bright" is the share of the model's
pixels with luminance above 0.8, "near-white" above 0.92, "chroma" the mean spread between the strongest and weakest channel (0 to 1); Explore
card, dark stage, 1100 x 760. Pixels within 24 levels of the stage colour count as stage, so on the light stage a part that merges into the
background is under-counted; the pictures are the better evidence there.

| Model | Where its colour comes from | What the file holds | Bright before > after | Near-white before > after | Chroma before > after |
|---|---|---|---|---|---|
| Operating cylinder | Code: `inspectionMaterial` in `cylinderAdapter.ts` (default `#9cabb8`, teal intake, copper exhaust) | All 61 materials are one off-white, `#e7e7e7`, metalness 0, roughness 0.5 | 0.19 > 0.00 | 0.00 > 0.00 | 0.15 > 0.19 |
| Whole engine (v5) | Code: the same kind of recolour in `fullEngineAdapter.ts` | 22 real material classes with coloured fades | 0.17 > 0.03 | 0.03 > 0.01 | 0.13 > 0.16 |
| R10 mechanism study | The file | 121 materials, every one a pale metal: luminance 0.46 to 0.95, metalness 0.78 to 0.96, roughness 0.12 to 0.36, no hue. Mean by triangle 0.80 | 0.28 > 0.01 | 0.04 > 0.00 | 0.07 > 0.30 |
| Wright reconstruction | The file | 11 materials; steel `#99a8b6` is 62% of the triangles | 0.20 > 0.00 | 0.00 > 0.00 | 0.08 > 0.09 |
| Langley reconstruction | The file | 7 materials; steel `#99a8b6` is 72% | 0.23 > 0.03 | 0.03 > 0.00 | 0.07 > 0.10 |
| Gnome Monosoupape | The file | 7 materials; steel `#c8d0d7`, metalness 0.92, roughness 0.18, is 87% | 0.07 > 0.01 | 0.01 > 0.01 | 0.06 > 0.06 |
| Hydraulic tappet | The file | Matte pastels (metalness 0, roughness 0.5): body `#cedade` (luminance 0.85), plunger `#89d4cd`, check valve `#e5c090`; the body encloses the rest | 0.97 > 0.00 | 0.23 > 0.00 | 0.03 > 0.46 |
| Oil pump | The file | Matte pastels: pump `#cedade`, relief `#e5c090` (82% of the triangles), gears `#a6c4d3` | 0.96 > 0.00 | 0.24 > 0.00 | 0.05 > 0.47 |
| Accessory drives | Code: a palette by group (`pathColors` in `animatedStudyAdapter.ts`) | Pale matte colours, recoloured by the palette | 0.00 > 0.00 | 0.00 > 0.00 | 0.29 > 0.30 |

Normals are not the cause in any file. The cylinder and the R10 keep their hard edges (normals lean 3.0 and 6.3 degrees from their face on
average, and no sampled corner leans more than 25). The other six export one normal per triangle (lean 0.0), which is plain flat shading and
reads smooth enough at 110 000 to 640 000 triangles.

Also found: the Look tab's "Colour treatment" (Inspection colours or Original CAD colours) was offered for every animated study, but only the
accessory drives had an inspection palette, so on the other six it did nothing; and choosing a treatment did not refresh the panel.

## What the viewer does now

- **One calibrated rig** (`src/viewer/core/lighting.mjs`, pinned by `scripts/test_lighting.mjs`): Khronos Neutral tone mapping, which leaves a
  colour below about 0.8 as the file or the adapter set it; a third of the room environment, a hemisphere light of 0.2, and a plain white key light of 1.4 (so a part is not tinted where it is lit)
  with a teal fill and a warm rim at about a third of it that tint only the shade, so a part has a bright side and a shaded side. Exposure 1.0 on the dark stage and 0.75 on the
  light one, where a part has to be darker than its pale background to stand out of it. The theme change sets the exposure.
- **Group colours for a model with none of its own** (`src/viewer/core/inspection-colours.mjs`, `scripts/test_inspection_colours.mjs`): the
  animated studies without power paths colour each contract group with one of twelve mid-tone colours in Inspection mode, on a satin finish
  (metalness at most 0.3, roughness at least 0.5, so a tint is not lost in a mirror reflection). The R10 has 51 groups, so the colours repeat: the
  second round is darker, the third lighter, then the first again. The colours keep clear of the spotlight's teal Highlight and its violet X-ray ghost, show on both stages
  (at least 1.7:1 against the light one, 2.2:1 against the dark one), and are in `scripts/test_focus_style.mjs`'s part-colour list so the ghost
  is held apart from them as it is from the models' own colours.
- **`defaultAppearance`** in `src/data/models.json`: the three historical reconstructions (Wright, Langley, Gnome) open in `cad`, the colours of
  their materials, because steel, cast iron, bronze and copper carry meaning there and group colours would hide it; Look switches to group
  colours for a learner who wants them. The R10, the tappet, the pump and the accessory drives open in Inspection colours.
- **The Highlight context grey is neutral** (`SPOTLIGHT_PALETTE` in `focus-style.mjs`: `#dcdfe1` on the dark stage, `#cdd1d4` on the light one, were the
  blue-greys `#d7e0e6` and `#c3cfd6`). Tone mapping that keeps a colour keeps a blue-grey blue, and `e2e/spotlight-themes.spec.ts` reads that
  grey as "a light neutral grey" (spread under 12 levels, 25% of the picture with the head cut open); with the new lighting it measured 0.00 and 0.02.
  It measures 0.48 and 0.50 now. On the light stage the context grey is also a mid grey and no longer almost the stage's own colour, so it stands out
  of the background a little more.
- The colour treatment switch now redraws the model and the panel (`animatedStudyAdapter.ts`).
- `scripts/capture_model_thumbnail.js` uses the viewer's own exposure unless a capture names one.

`e2e/model-finish.spec.ts` opens the oil pump and fails if it is washed out on either stage again.

## What still needs a re-export

None of this is edited here; the models belong to the CAD repository. The viewer now draws a colour as authored, so the file's colours matter
more than they did. Rules for every export: base colours of large parts between luminance 0.35 and 0.70 (white only for what is really white, a
porcelain insulator); one material per group of parts, not one per class of metal; for a teaching colour, metalness at most 0.4 and roughness
at least 0.4 (a metalness above 0.8 shows the lit room, not the colour).

| Model (file) | Re-export | Why |
|---|---|---|
| Operating cylinder (`cylinder-reviewed-20261001.glb`) | Give each part the colour the viewer gives it in Inspection mode (`inspectionMaterial`): intake side and the fuel nozzle `#379e9b`; exhaust side `#bc7353`; seals and gaskets `#364451`; rings, bolts, nuts and the crank `#596d80`; spark insulators `#e2dbca`; piston and pins `#c2ced6`; the rest `#9cabb8`. Metalness 0.25, roughness 0.48. | The file's 61 materials are one `#e7e7e7`, so Original CAD colours is a white cylinder. Low priority: the default view does not use them. |
| R10 (`gtsio520-r10-static-opt1.glb.gz`, Drive `1Gx9nOjT...`) | Replace the 121 pale-metal materials with one material per contract group, or at least per system (rotating assembly, valve train, case and structure, fasteners, ignition, lubrication), mid-tone, with a different hue between neighbouring systems; metalness at most 0.4 except journals and pins. | By its own colours the engine is one silver (mean luminance 0.80, metalness above 0.78 throughout). The viewer's group colours stand in until then. Keep the normals as they are. |
| Wright, Langley (steel `#99a8b6`) | Optional: split the steel by assembly (case, rotating group, valve gear) into three or four tints of steel. | One material is 62% and 72% of the triangles, so neighbouring steel parts have the same colour. The materials themselves read well now. |
| Gnome (steel `#c8d0d7`, metalness 0.92) | Optional: metalness 0.6 to 0.7 and roughness 0.3 or more for the steel, and the same split by assembly. | A polished steel reflects the room, so the engine reads silver (chroma 0.06, no more after than before). |
| Hydraulic tappet, oil pump (`#cedade` bodies) | Mid-tone base colours for the body and pump (luminance 0.65 or less), distinct from the plunger, check valve, relief and gears. The group colours are a fair target. | The pastel body is luminance 0.85, so Original CAD colours is a pale slab on either stage. |
| Accessory drives, whole engine (v5) | Nothing. | The viewer recolours them and their materials are real. |

## Follow-ups this leaves

- The card pictures, banners and gallery tiles in `web/thumbnails` were rendered under the old lighting (several with an exposure of 0.3 to 0.5 to
  keep the pale models visible); re-capture them (`docs/card-thumbnails.md`) so a card matches what the viewer now shows.
- The R10 fills only about 4% of its Explore canvas: the camera frames the union of the motions' extremes, and the model is long and flat. A
  framing change is not a finish change, so it is left.
- The picture is judged by eye; if the instructor wants the dark stage brighter or the light stage darker, it is `EXPOSURE` in `lighting.mjs`.
