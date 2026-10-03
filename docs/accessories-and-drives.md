# Accessories & Drives — Lesson 8

This release adds an independent GTSIO-520-H accessory teaching study. The shape-review revision replaces the initial schematic with 80 drawing-led engine/interface studies, explicitly labelled function markers and three grey teaching fixtures; see [the feature audit](accessory-shape-review.md). Existing engine masters, cylinder geometry, hydraulic tappet and IO-520 permold pump remain separate assets. The working tree was clean before the revision; applicable project AGENTS.md storage/validation instructions were read and local originals backed up.

## Evidence and applicability

The byte-hashed source record and claim locators are in `accessory-reference-ledger.json`. The reviewed PDF is the DigiMan deliverable, not the earlier editable draft. Its H difference-data introduction (PDF 151, C-3-1) applies the basic procedures except stated differences, and specifically replaces the fuel/induction coverage. Figures A-4-8, A-4-11, A-4-13, A-4-15 and A-4-16 were visually inspected alongside their captions. The H drive tables (PDF 152–153) were checked against page images, including the rotation footnote.

The final curriculum plan identifies Lesson 8 as Accessories & Drives, absorbing ignition. The older **Day 8** Word plan is a practical/group-presentation/review day; its inspection and explanation outcomes inform the activities, but it does not define this lesson number. Existing parked ignition material was studied and the source-backed wiring figure reused without removing the parked lesson.

| Drive | Source path | H drive/crank ratio | Direction and boundary |
|---|---|---|---|
| Both magnetos | Crank → idler → drive gears → splined shafts | 1.5:1 | CW facing engine drive pad |
| Fuel pump | Crank → cam cluster → drive gear → coupling → pump | Unknown | Gear tooth choices and speed are illustrative; later H coupling differs from old pump |
| Oil / tach | Crank → internal cam-gear spline → oil pump shaft → 90-degree tach bevel pair | Tach 0.5:1 | Tach CW facing pad; do not present as a separately specified oil-pump ratio |
| Starter | Motor → worm → wheel → spring grips drum → shaftgear → crank | 32:1 | Starter drive CCW facing pad, during cranking; shaftgear stays engine-driven after release |
| Alternator | Referenced driven gear → clutch → keyed hub → shaft; relocated module | 3:1 | CW facing pad; exact intervening H transfer not reconstructed |
| Optional vacuum | Upper-rear splined accessory interface; adapter transfer unresolved | 1.14:1 | CCW facing pad; same table value for deice/autopilot drives, installation dependent |
| Governor | Crank → cam → front bevel pair → governor | 0.809:1 | CW facing pad; front output relocated and bevel geometry omitted |
| Propeller (context only) | Front crank splines → quill → reduction gears | 0.667:1 | CW **looking forward**, not accessory-pad viewpoint; not included in accessory model |

Manufacturer evidence establishes relationships, named interfaces and endpoint ratios. FAA-H-8083-32B supplies the general accessory, ignition, fuel and governor teaching principles. No IO-520 configuration or numerical limit is substituted for GTSIO-520-H. The existing IO-520 permold pump remains labelled as its own comparison.

There are two source ambiguities worth preserving: A-4-8 calls items 10/11 scavenge gears while the narrative refers to item 11 as tach; A-4-16 resolves the tach bevel identities. A-3-2 mentions a generator drive pulley, whereas A-4-13 identifies a gear-driven alternator assembly. This release does not invent the intervening H alternator geometry from that generic pulley sentence.

## Editable sources and exchange

`cad-studies/accessory-drives/accessory-drives.FCStd` contains individually editable named solids grouped by subsystem, evidence/dimension properties and signed illustrative rates. `accessory-drives.step` supplies neutral solids. The CAD authoring recipe is `scripts/build_accessory_study.py`; dimensions are deliberately declared in the recipe, not asserted as measurements. This is not a fully constrained assembly or a manufacturer dimensional reconstruction.

The rear region is represented by cropped left/right crankcase halves, following A-4-18. The invented rectangular accessory box and inspection lid have been removed. Rounded bored adapters, gasket/bushing/seal interfaces, visible spline teeth, a hollow right-angle starter adapter, stepped oil/scavenge casing and front alternator parts follow the cited drawings. Reconstructed pump pockets, seals and pads retain empty volumes. Exact rear casting contour, thickness, spline profiles, bevel teeth and toleranced fits remain unverified. Magnetos, vacuum and governor bodies are visibly named function markers. A-3-3 mounts magnetos on the front of accessory pads; their function markers now seat there. The H photograph A-4-4 places the alternator toward the front; its assembly remains a separate relocated module on a labelled teaching stand. Similar stands support the optional vacuum and governor markers. Unknown transfers remain omitted. Tach uses the documented lateral bevel transfer, modelled as smooth pitch cones. See the connected-assembly revision in the feature audit for the mounting and shaft checks.

`accessory-drives.blend` contains CAD IDs, group materials, per-component action slots and muted named NLA tracks. Ten independent exportable actions cover normal operation, exploded overview, staged reassembly, six focused paths and spring-clutch starting. The Blender-to-glTF export bakes transforms, so the web consumes those exported clips rather than reimplementing gear kinematics. Millimetres become metres once; Blender Z-up becomes glTF Y-up. Main meshes rotate about their CAD pivots. Quaternion keys preserve every sampled turn; the direct-curve export is shifted to zero seconds so pause, scrub and reverse poses share the native action interval. Compression streams the file to limit authoring memory.

Normal operation is a two-crank-revolution sample. Motions do not loop automatically: noninteger endpoint ratios such as 1.14 and 0.809 do not close after two crank revolutions. Restart deliberately resets the sample. Starter contraction and the takeover timeline are illustrative; no torque, spring friction, oil pressure or engine-start physics is calculated.

Rebuild from the repository directory:

```powershell
& 'C:\Program Files\FreeCAD 1.1\bin\python.exe' scripts/build_accessory_study.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python-exit-code 1 --python scripts/rig_accessory_study.py
python scripts/publish_accessory_lesson.py
python scripts/publish_study_metadata.py
npm run lint
npm test
npm run build
```

Native and published asset hashes are recorded in `cad-studies/source-manifest.json`; the contract binds the decoded GLB hash. Regenerate the preview with the accessory preview script. Tool-specific paths can be adjusted when rebuilding elsewhere.

CAD sources and GLB exports are stored in the project's Google Drive folders. Git tracks code, lesson content, contracts, reference records and hashes. See `docs/drive-asset-manifest.json` for file identities and the private native-source archive, which retains the original relative paths. Download and extract that archive into the project to edit existing CAD sources; verify each file against the manifest before replacing a local copy. Existing local files have been preserved.

For the drawing-led accessory revision, use the newer `accessory_native_archive` entry, which contains the revised FreeCAD, Blender and STEP files. The original `native_archive` is retained for the other studies and the earlier accessory source. Extract the newer accessory archive after the original when restoring a complete workspace. Archive and individual native-file SHA-256 values are local delivery checksums; Drive permissions, byte count and authenticated raw-file readback were verified. The web export was additionally downloaded anonymously and its SHA-256 compared byte for byte before binding.

Run `python scripts/fetch_drive_assets.py` before asset-dependent tests on a fresh checkout. It downloads approved public web exports using the existing restricted browser key, checks their sizes and SHA-256 hashes, and restores ignored local copies. The production build removes these test copies from `dist`; students load model bytes through the existing Drive adapter. Published Git history is retained, so previously committed binaries remain in old revisions; the new accessory commit adds no CAD/GLB binaries.

## Teaching and viewer integration

Lesson 8 has 16 steps and eight knowledge checks: identification, power tracing, prediction, operation, interface inspection and explaining consequences. Existing dual-ignition wiring is reused; H 20° BTC is distinguished from illustrative cylinder poses. Three fault questions are explicitly hypothetical and do not claim a measured fault response.

The existing animated-study adapter owns pause/scrub, selection, isolation, clipping, appearance and disposal. Lesson Steps exposes the same controls for this model. Complete-path groups overlap intentionally so shared crank/cam parts are included with each accessory. Search filters never truncate group isolation. Path highlights and output rotation arrows follow moving parts, including exploded states; dashed lines identify conceptual connectivity, not physical shafts. Verified ratios and a 1000-crank-RPM example appear in a wrapping, scrollable panel for phones. A visible notice names the alternator, optional vacuum and governor as separate relocated displays with omitted engine connections; it disappears when none of those modules is visible.

Section caps use the existing per-solid front/back winding stencil passes. They track animated and scaled geometry while preserving holes and chambers; cap colours follow each component material. Motion framing and cut ranges now include both assembled and exploded extremes, including reassembly's initially exploded pose.

## Limits of validation

CAD solid validity, source hashes, component identity, baked speed/direction, reverse poses, exported action inventory, paused selection/path isolation, section controls and regression suites are checked. Browser reviews and CI results are recorded in `accessory-validation.json` when completed. Physical Samsung Galaxy A16 testing, instructor moderation, measured geometry/fit, real accessory internals and current service-document effectivity remain outside the available evidence.
