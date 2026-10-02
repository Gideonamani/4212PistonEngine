# Accessories & Drives — Lesson 8

This release adds an independent GTSIO-520-H accessory relationship study. Existing engine masters, cylinder geometry, hydraulic tappet and IO-520 permold pump remain separate assets. Git was clean at the start; no applicable AGENTS.md was found in the project or checked ancestor directories.

## Evidence and applicability

The byte-hashed source record and claim locators are in `accessory-reference-ledger.json`. The reviewed PDF is the DigiMan deliverable, not the earlier editable draft. Its H difference-data introduction (PDF 151, C-3-1) applies the basic procedures except stated differences, and specifically replaces the fuel/induction coverage. Figures A-4-8, A-4-11, A-4-13, A-4-15 and A-4-16 were visually inspected alongside their captions. The H drive tables (PDF 152–153) were checked against page images, including the rotation footnote.

The final curriculum plan identifies Lesson 8 as Accessories & Drives, absorbing ignition. The older **Day 8** Word plan is a practical/group-presentation/review day; its inspection and explanation outcomes inform the activities, but it does not define this lesson number. Existing parked ignition material was studied and the source-backed wiring figure reused without removing the parked lesson.

| Drive | Source path | H drive/crank ratio | Direction and boundary |
|---|---|---|---|
| Both magnetos | Crank → idler → drive gears → splined shafts | 1.5:1 | CW facing engine drive pad |
| Fuel pump | Crank → cam cluster → drive gear → coupling → pump | Unknown | Gear tooth choices and speed are illustrative; later H coupling differs from old pump |
| Oil / tach | Crank → cam → splined shaftgear → oil pump and tach bevel transfer | Tach 0.5:1 | Tach CW facing pad; do not present as a separately specified oil-pump ratio |
| Starter | Motor → worm → wheel → spring grips drum → shaftgear → crank | 32:1 | Starter drive CCW facing pad, during cranking; shaftgear stays engine-driven after release |
| Alternator | Referenced driven gear, hub and clutch; relocated output | 3:1 | CW facing pad; exact intervening H transfer not reconstructed |
| Optional vacuum | Upper-rear splined accessory interface; adapter transfer unresolved | 1.14:1 | CCW facing pad; same table value for deice/autopilot drives, installation dependent |
| Governor | Crank → cam → front bevel pair → governor | 0.809:1 | CW facing pad; front output relocated and bevel geometry omitted |
| Propeller (context only) | Front crank splines → quill → reduction gears | 0.667:1 | CW **looking forward**, not accessory-pad viewpoint; not included in accessory model |

Manufacturer evidence establishes relationships, named interfaces and endpoint ratios. FAA-H-8083-32B supplies the general accessory, ignition, fuel and governor teaching principles. No IO-520 configuration or numerical limit is substituted for GTSIO-520-H. The existing IO-520 permold pump remains labelled as its own comparison.

There are two source ambiguities worth preserving: A-4-8 calls items 10/11 scavenge gears while the narrative refers to item 11 as tach; A-4-16 resolves the tach bevel identities. A-3-2 mentions a generator drive pulley, whereas A-4-13 identifies a gear-driven alternator assembly. This release does not invent the intervening H alternator geometry from that generic pulley sentence.

## Editable sources and exchange

`cad-studies/accessory-drives/accessory-drives.FCStd` contains individually editable named solids grouped by subsystem, evidence/dimension properties and signed illustrative rates. `accessory-drives.step` supplies neutral solids. The CAD authoring recipe is `scripts/build_accessory_study.py`; dimensions are deliberately declared in the recipe, not asserted as measurements. This is not a fully constrained assembly or a manufacturer dimensional reconstruction.

The housing has actual wall thickness, an open internal chamber, bored shaft exits and fastener holes. Pump pockets, annular seals and open pads retain empty volumes. Cylinders, shafts, gears, splined-interface proxies and coupling envelopes are separate solids. The auxiliary inspection cover is a teaching device, not an identified manufacturer part. True spline profiles, bevel teeth, casting contours and toleranced fits are not reconstructed.

`accessory-drives.blend` contains CAD IDs, group materials, per-component action slots and muted named NLA tracks. Ten independent exportable actions cover normal operation, exploded overview, staged reassembly, six focused paths and spring-clutch starting. The Blender-to-glTF export bakes transforms, so the web consumes those exported clips rather than reimplementing gear kinematics. Millimetres become metres once; Blender Z-up becomes glTF Y-up. Main meshes rotate about their CAD pivots.

Normal operation is a two-crank-revolution sample. Motions do not loop automatically: noninteger endpoint ratios such as 1.14 and 0.809 do not close after two crank revolutions. Restart deliberately resets the sample. Starter contraction and the takeover timeline are illustrative; no torque, spring friction, oil pressure or engine-start physics is calculated.

Rebuild from the repository directory:

```powershell
& 'C:\Program Files\FreeCAD 1.1\bin\python.exe' scripts/build_accessory_study.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python scripts/rig_accessory_study.py
python scripts/publish_accessory_lesson.py
python scripts/publish_study_metadata.py
npm run lint
npm test
npm run build
```

Native and published asset hashes are recorded in `cad-studies/source-manifest.json`; the contract binds the decoded GLB hash. Regenerate the preview with the accessory preview script. Tool-specific paths can be adjusted when rebuilding elsewhere.

CAD sources and GLB exports are stored in the project's Google Drive folders. Git tracks code, lesson content, contracts, reference records and hashes. See `docs/drive-asset-manifest.json` for file identities and the private native-source archive, which retains the original relative paths. Download and extract that archive into the project to edit existing CAD sources; verify each file against the manifest before replacing a local copy. Existing local files have been preserved.

Run `python scripts/fetch_drive_assets.py` before asset-dependent tests on a fresh checkout. It downloads approved public web exports using the existing restricted browser key, checks their sizes and SHA-256 hashes, and restores ignored local copies. The production build removes these test copies from `dist`; students load model bytes through the existing Drive adapter. Published Git history is retained, so previously committed binaries remain in old revisions; the new accessory commit adds no CAD/GLB binaries.

## Teaching and viewer integration

Lesson 8 has 16 steps and eight knowledge checks: identification, power tracing, prediction, operation, interface inspection and explaining consequences. Existing dual-ignition wiring is reused; H 20° BTC is distinguished from illustrative cylinder poses. Three fault questions are explicitly hypothetical and do not claim a measured fault response.

The existing animated-study adapter owns pause/scrub, selection, isolation, clipping, appearance and disposal. Lesson Steps exposes the same controls for this model. Complete-path groups overlap intentionally so shared crank/cam parts are included with each accessory. Search filters never truncate group isolation. Path highlights and output rotation arrows follow moving parts, including exploded states; dashed lines identify conceptual connectivity, not physical shafts. Verified ratios and a 1000-crank-RPM example appear in a wrapping, scrollable panel for phones.

Section caps use the existing per-solid front/back winding stencil passes. They track animated and scaled geometry while preserving holes and chambers; cap colours follow each component material. Motion framing and cut ranges now include both assembled and exploded extremes, including reassembly's initially exploded pose.

## Limits of validation

CAD solid validity, source hashes, component identity, baked speed/direction, reverse poses, exported action inventory, paused selection/path isolation, section controls and regression suites are checked. Browser reviews and CI results are recorded in `accessory-validation.json` when completed. Physical Samsung Galaxy A16 testing, instructor moderation, measured geometry/fit, real accessory internals and current service-document effectivity remain outside the available evidence.
