# Langley / Manly-Balzer 1903 radial: what we built and what we learnt (7 October 2026)

The 1903 Langley engine was added to Explore as the contemporary rival of the Wright engine: a five-cylinder water-cooled radial, modelled part by part from the
1911 Memoir drawings (Plates 78-81) and the 1971 *Annals of Flight* 6, with an illustrative operating cycle and a systems exploded view. This note records the
run: what was delivered, what the sources contradicted, what broke, and what the next engine should start from. The research is in
`cad-studies/langley-manly-balzer-1903/` (`research.md`, `operating-motion.md`, `build-notes.md`); this note is the record of the build, dated, and is not updated.

## What was delivered

| Item | Result |
|---|---|
| Scope (the user's choices) | Engine proper (every item of Manly's weight table W01-W15) plus the two flywheels and short transmission-shaft stubs; end product an Explore card; reference the 1911 Memoir drawings, with no claim about the museum object. |
| Model | 358 separate parts, 787 native features, 45 research components (39 of them with parts) in 12 systems; native FreeCAD build (`generate.py --batch-runs 6`) in 13 minutes. 189 parts move in the operating clip. |
| Clips | "Operating mechanism (illustrative)", 721 keys (one per crank degree, two crank turns); "Systems exploded view", 241 keys in three stages. |
| Interference | Rest pose and every pose of the baked clip: 0 overlaps (1,492 neighbouring pairs at rest, 133 clip poses); five gear meshes keep at least 0.043 mm. The ledger is empty. The exploded clip is not swept (its parts are separated by design). |
| Mass against Manly's weight table | +13 percent over lines W01-W13 (63.5 kg against 56.3 kg). Flywheels, pistons, cylinders, balance arms and pipes close within 14 percent; the rod line (+45 percent) and the ignition line (+75 percent) do not, and `build-notes.md` says why. |
| Checks | `scripts/test_langley_research.py` (13), `scripts/test_langley_motion.py` (23), `scripts/test_langley_reconstruction.mjs` (9, on the released file), the registry test. |
| Documented exception | `verify.py` fails the original 0.01 percent per-solid STEP volume check on three parts (the third bent-tube ring segment and the two flywheel hubs, 0.011-0.012 percent) while bounds, topology counts and sampled boundaries agree to 6e-10 mm; accepted under a bounded, reviewed policy (`step-exception-policy.json`) that awaits instructor review, exactly as for the Wright valve boxes. |

## What the sources contradicted

The commissioning brief was checked against the primary sources before any CAD (`research.md`, "Corrections to the commissioning brief"): the plates are 78-81, not
18-35; the cylinders are steel with a cast-iron liner shrunk in and sheet-steel jackets, not spun and brazed copper; the rod arrangement is a master rod with four
slipper-shoe link rods on its sleeve, not an articulated master rod; the 124 lb figure is the engine proper from the weight table, and the table's lines sum to 65 g
less than its printed total (a misprint). The Smithsonian repository sits behind a bot check that was not bypassed; the user supplied the PDF.

## What went wrong, in the order we met it

1. **A rotation convention hid in FreeCAD.** `Rotation(Z, -Z)` is a half turn about Y; the frame helper assumed X. Boxes in the balance-arm frames (turned 180 degrees at
   the rest pose) were built mirrored and offset, which looked like four different overlaps. Found by printing the part bounds, fixed once in `langley_frame.z_to`.
2. **The audit was the design review.** The first full audit listed 135 overlapping pairs. Almost all were real layout errors, not noise: crank webs reaching into the
   drum head plates, a worm cutting through the crankshaft, two gears of one plane overlapping (centre distance 108 mm against tip radii 39 + 75 mm), a manifold ring
   passing through a bed-plate web, a jacket dome profile that crossed itself. The rule from the Wright run held: every fix changed the design, none a threshold.
3. **A mass check is a shape test the plates cannot give.** Manly's weight table caught an oil cup modelled as a solid ring (2.4 kg against 0.1), a 14 mm cam sleeve,
   solid 7 kg-class gears and an over-thick crankshaft before anyone looked at them. It does not catch a wrong dimension that the table does not weigh.
4. **Booleans.** Same-part features that only touch split into solids once rotated (make them overlap); coincident cylindrical surfaces in a union or cut fail (use one
   revolve profile, offset radii by at least 0.04 mm); a tangent cylinder-to-torus junction fails (make the branch smaller); 24 sequential cuts take minutes where one
   multi-tool cut takes seconds (`fast_build` now batches runs of six); the mesh must be finer than every clearance (the piston-to-liner gap is 0.0635 mm, so those parts
   are tessellated at 0.02 mm).
5. **The motion exposed what the rest pose could not.** The 30-degree audit found three overlaps that no rest pose shows (the master rod's root flare against two shoes at
   their closest approach, a cam-lobe tip against the idler stud, a cam lobe drawn 90 degrees from where the timing put it). The cam phase is now derived from the timing
   choice instead of typed, the punch-rod roller rides the cam polygon by exact contact, and the idler has 20 teeth so its stud stands outside the lobe sweep.
6. **The machine.** One build at a time: each uses several FreeCAD workers and the machine has 8 GB. The development evaluator caches by the hash of the part and *all*
   parameters, so any parameter change rebuilds every part.

## What the next engine should start from

- Write the timing and the cam in one module that the geometry and the motion both import (`langley_cam.py`), and derive every phase from the stated timing.
- Audit the motion at 15-degree steps on the development geometry before baking, then audit the exported file between its keys.
- Keep the mass check next to the dossier from the start; give every undrawn wall a documented source (the weight table) rather than a round number.
- Check the half-turn case of any frame helper against the CAD kernel before trusting boxes in rotated frames.

## Open

- The exported file is large (about 42 MB decoded, 12 MB gzipped) because the clearances need fine tessellation; valve springs and pistons dominate.
- The rod and ignition mass lines (W02, W11) stay above the table; the sleeve hardware of the rods is the likely cause.
- Overlays of the drums and crank on Plate 78B and of the end elevation on Plate 79 are not done; the crank and the drum geometry rest on measurements from Plate 78A.
- The STEP exception awaits instructor review. The Drive release needs the user's sharing step.
