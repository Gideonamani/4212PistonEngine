# GTSIO implementation research and adoption

8 October 2026. Extend the study loop to **understand the design -> research how to model/present it -> test the method -> build -> compare -> explain -> retain learning**. Method sources below describe software techniques; X-30045A remains the source for this engine's construction. A crankshaft tutorial cannot establish GTSIO-520-H dimensions, throw arrangement or damper geometry.

## Versions and source access

Locally tested: FreeCAD **1.1.1**, commit `0108fd4b4850cc46e625b60e53cea7a7bbe69f8d`; Blender **5.0.1**, bundled glTF exporter **5.0.21**. Both method validation records include actual runtime versions and artifact hashes.

The live FreeCAD wiki returned an access-denied page, so the official documentation repository was used. That repository is archived; its guidance is corroborated by installed-version probes rather than assumed current. Its Loft Technical Details page explicitly describes FreeCAD 0.15/OCC 6.7 and was used only for the concept of section correspondence. Direct Blender 5.0 glTF manual retrieval failed; official versioned exporter/baking source and the installed addon were inspected instead. Search-returned Workbench 5.0 documentation was readable, although direct page retrieval failed. These access limits do not prevent local testing.

| Primary source / content actually inspected | Relevant method | Applicability and decision |
|---|---|---|
| [FreeCAD Part Loft](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Part_Loft.md), [Additive Loft](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/PartDesign_AdditiveLoft.md) | Solid section lofts, ruled/smooth choice and section order | Keep the existing linked Part loft for the six inclined webs. Corresponding section nodes express actual varying thickness; a uniform extrusion cannot do so. PartDesign is an alternative for a body/sketch workflow, not a required migration. |
| [Loft technical details](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Part_Loft_Technical_Details.md) | Edge/vertex correspondence | Old-version conceptual reference only. The local taper regression establishes current propagation and volume behaviour. |
| [FreeCAD facebinder loft tutorial](https://blog.freecad.org/2026/09/21/tutorial-lofting-between-parts-with-facebinders/), Jo Hinchliffe, 21 Sep 2026; article text inspected | Lofting between existing linked faces | Candidate when existing faces are the intended sections. Our explicit skeleton sections already define the inclined web, so changing to face references adds no demonstrated benefit here. This alternative has not been locally prototyped. |
| [Crankshaft/master-sketch lesson](https://www.youtube.com/watch?v=76cJ2erODzg), MangoJelly Solutions, 8 Dec 2021; creator's description inspected, video unavailable | Shared master sketch, datum planes, revolve, pad/pocket | Supports investigating a single geometric skeleton. Our `gtsio_layout.py` already serves that role across CAD and motion. The description is not a reviewed feature-by-feature reconstruction or a reason to adopt its old assembly addon. |
| [Part Revolve](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Part_Revolve.md) | Closed half-section around a declared axis | Locally tested for stepped coaxial shoulder geometry. Useful candidate for shaft ends/annular relief; the offset six-throw forging is not one surface of revolution. |
| [Part Fillet](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Part_Fillet.md), [PartDesign Fillet](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/PartDesign_Fillet.md) | Selected edge blends, adjacent-face/radius limits and reference sensitivity | Locally tested on one concave shoulder. Select the intended root geometrically, after the supporting shape is established; protect bearing/rod contact lands and retain dimensional provenance. No blanket all-edge smoothing. |
| [Part Refine Shape](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Part_RefineShape.md), [datum planes](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/PartDesign_Plane.md) | Optional edge cleanup; controlled sketch references | Consider refinement only when its result is valid. Keep R3's tested unrefined loft/land unions: refinement previously produced a null solid. Datums should derive from the skeleton rather than opportunistic changing faces. |
| [glTF exporter, Blender 5.0 branch](https://github.com/KhronosGroup/glTF-Blender-IO/blob/blender-v5.0-release/addons/io_scene_gltf2/__init__.py), installed addon source | Animation mode, action/track merging and sampling | Existing rigs use shared slotted actions with `ACTIONS`, default `ACTION` merge, and per-object NLA references. The fixture makes these settings explicit and checks two exported clips. `NLA_TRACKS` is a different sampling/grouping choice. |
| [Blender 5.0 baking implementation](https://github.com/blender/blender/blob/blender-v5.0-release/scripts/modules/bpy_extras/anim_utils.py), installed Bake Action operator | Evaluated transforms through visual keying | Locally tested on a constrained copy. Keep the master constraints editable; clearing constraints on a baked delivery copy is a separate step. Current engine rigs already bake their shared analytic motion directly and need no constraint conversion. |
| [Workbench introduction](https://docs.blender.org/manual/en/5.0/render/workbench/introduction.html), [options](https://docs.blender.org/manual/en/5.0/render/workbench/options.html); search-returned text inspected | Fast inspection shading, cavity/ridge/valley visibility; no shader-node rendering | Keep neutral Workbench for reference review. Record actual shading/color settings; cavity can clarify existing shape but is not geometry evidence. Cycles/EEVEE presentation and browser lighting need their own review. |

Access date for all web sources: 8 October 2026. No example engine geometry or third-party model was imported.

## Native modelling probes: locally tested, not adopted engine dimensions

`cad_pipeline/probe_freecad_methods.py` creates a linked polygon half-section, native `Part::Revolution` and native `Part::Fillet`. Fixture radii and lengths are arbitrary test inputs. A unique circular edge is resolved by radius, centre and axis each time the source changes; its index is a transient handle, not a persistent identity.

The Langley pipeline already supports a `revolve` specification feature, rebuilt as a derived `Part::Feature` solid. This probe investigates the additional value of a linked native Revolution whose source profile responds inside the reopened document. Reuse the established profile method where regeneration from the spec suffices; consider the linked feature when in-document parameter editing is required. The probe does not replace that working implementation.

The file saves/reopens with source links and expressions intact. Changing the small journal radius from 6 to 7 mm changes the unfilleted volume from **9676.105373** to **10901.326508 mm3**, matching the analytical stepped-cylinder volumes. Changing the concave root fillet from 1 to 1.5 mm changes the edited shoulder volume from **10911.066375** to **10923.580043 mm3**. Bounds remain recorded; each result is a valid single solid. Restoring the original controls restores the original volume. The two-solid STEP round trip reports **zero relative volume error** in this fixture.

The existing native loft regression also passes: changing its taper from 2 to 4 mm changes volume from 2600 to 2400 mm3 after reopening, with direct-kernel agreement. Earlier failures remain useful: indexed polygon-node expressions did not propagate, and refining the actual forging's loft/land union failed. Whole-node-list expressions and the checked unrefined Boolean result are the adopted local remedies; neither is assumed universal.

**Next crankshaft trial:** source-review each intended shoulder/root and its adjacent mating surfaces, choose a documented radius or label an estimate, prototype the actual neighbourhood, then extend the authoritative feature plan and both evaluators. Rebuild and repeat saved geometry, STEP, image comparison and complete assembly/export interference checks. A successful simple shoulder is not evidence that all 620 operations can be filleted safely, and it does not complete CR03.

## Animation and rendering probes

`cad_pipeline/probe_blender_methods.py` imports only the hash-verified CAD fixture, converts mm to metres once, and reuses the Wright track writer. Two shared slotted actions save/reopen and export as exactly **two clips**, each affecting both identified fixture objects. The GLB checker reads actual binary accessors, checks linear key interpolation, zero start/one-second duration, Z-to-Y conversion, translations and pivot-based rotations. Maximum component error against the fixture motion is **1.35196e-7**. These are method checks, not a swept engine-motion audit.

A separate Copy Rotation fixture is visually baked onto a duplicate. The constrained master retains its constraint; the baked copy has none. Saved/reopened separation passes, and **97 quarter-frame samples** compare evaluated matrices with maximum element error **1.28523e-6**, below the fixture's 2e-5 limit. This demonstrates a copy/bake technique if future rigs need constraints; the current analytic engine rigs remain the preferred shared motion path.

The neutral renderer now records Blender version, studio/cavity settings, material color, color management, world/background/film state and image hash, and can save an editable diagnostic scene. Explicit optional view settings permit a calibrated future comparison without silently changing existing defaults. The method fixture is rendered separately with Standard/None, exposure 0 and gamma 1; it is a software-method illustration, not a manufacturer reference match. The root blend is visibly present. Pixel inspection found an RGBA background of `(0,0,0,0)`: the empty-world render is transparent despite a white viewport setting. Record actual alpha/compositing; the existing matcher composites transparent input over white. R3's existing comparison stays on its original calibration. Inspect geometry/section views for shallow taper and fillets, then tune presentation lights/materials separately.

## Reproduce and retain

Run from the worktree with the installed runtimes:

```powershell
$cadPython = 'C:\Program Files\FreeCAD 1.1\bin\python.exe'
$blenderExe = 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe'
& $cadPython cad_pipeline/probe_freecad_methods.py
& $cadPython -m unittest cad_pipeline.tests.test_loft -v
& $blenderExe --background --threads 2 --python-exit-code 1 --python cad_pipeline/probe_blender_methods.py
& $blenderExe --background --threads 2 --python-exit-code 1 --python cad_pipeline/render_match_view.py -- --geometry build/gtsio-method-research/freecad/fixture-geometry.json --plan cad-studies/gtsio520-h-realism/method-render-plan.json --output build/gtsio-method-research/render --save-scene
```

Hash-bound results are retained in `freecad-method-validation.json`, `blender-method-validation.json` and `method-render-validation.json`. Editable FCStd/STEP/blend/GLB/PNG fixtures remain ignored under `build/gtsio-method-research/`. The Workbench render uses the previously established outside-sandbox route on this host.

The reusable lesson is to research an existing method, test its actual native/export behaviour, adopt it only for the demonstrated scope, and retain why it succeeds or fails. Exact GTSIO fillet radii, cheek proportions, counterweight fits and axial calibration remain unresolved in the design study. Method validation does not change the R3 engine acceptance or release status.

## Subsequent adoption in revision 4

The user's authorization to make calculated estimates leads to the actual crankshaft rebuild in `crankshaft-estimation.md`. A further probe establishes a Body/BaseFeature link from the Part result to native PartDesign::Fillet, retaining a scalar Radius expression; the earlier Part::Fillet complex-Edges expression fails. The new backend and saved regression test adopt the linked method. Actual R4 root surfaces, radius regeneration, closed recesses, preserved lands, mating liner relief and full static assembly/export checks provide adoption evidence beyond the original simple fixture. Manufacturer radii and hidden drilling remain unverified.
