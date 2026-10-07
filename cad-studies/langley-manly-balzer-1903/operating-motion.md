# Langley / Manly-Balzer engine: motion dossier and packaging record

Reviewed 6 October 2026, before any CAD. Method: `.agents/skills/engineering-research/references/motion-and-packaging.md`. Source keys are those of `research.md`: **M1** is the 1911 Memoir (page numbers are printed pages), **A1** the 1971 Annals of Flight 6. Status is `documented` (a source states it), `derived` (computed from documented values), `measured` (read from a plate calibrated on a documented length; uncertainty stated) or `illustrative` (a teaching choice the sources do not give). Nothing here certifies valve timing, spring rates or dynamics.

## 1. Purpose

*The crank turns clockwise at one speed; five pistons slide in five radial cylinders firing 1-3-5-2-4; one crank pin carries a master rod and four link rods whose slippers slide on the master rod's sleeve; one double-lobed ring cam turns backwards at a quarter of crank speed and lifts all five exhaust valves through five punch rods; the inlet valves open by themselves; a second gear train turns the ignition cam and the distributor.* Nothing else needs to move. Not animated, each with a reason, in section 4.

## 2. Motion dossier

| # | Quantity | Driver | Value or law | Unit | Locator | Status | Notes and conflicts |
|---|---|---|---|---|---|---|---|
| 1 | Rated speed | | 950 (945-955) | rpm | M1 p. 249 | documented | Animation speed is the viewer's choice, not a claim |
| 2 | Crank rotation sense | | clockwise as viewed in Plate 82 | | M1 p. 248 | documented | The viewing side of Plate 82 relative to the port and starboard bed plates is not given; the model fixes it (research.md, cylinder numbering) |
| 3 | Stroke | crank | 139.7 (5.5 in); crank radius 69.85 | mm | A1 p. 156 | documented, derived | |
| 4 | Piston motion | crank, rod | slider-crank, identical for all five | | M1 pp. 237-239 | derived | Every rod axis passes through the crank-pin centre because a shoe is a bearing on a cylinder (the sleeve), so the rods behave as five independent slider-cranks on one pin. This is *not* true of a knuckle-pin master-and-link rod, where link strokes differ; do not model it as one |
| 5 | Connecting rod length (gudgeon-pin axis to crank-pin axis) | | not documented | mm | Plate 78 | measured (to do) | Two bounds, both computed in `scripts/test_langley_research.py`. Below: adjacent rods (72 degrees apart) come closer than 72 degrees by about 67.7 x (r/L) degrees at worst, so a shoe of width w needs r/L at most (72 - w)/67.7: for w = 55 degrees, L at least 278 mm; for w = 59 degrees ("slightly less than sixty"), L at least 363 mm. Above: the overall 37 in diameter (radius 470 mm) bounds r + L plus the piston and head above the pin, which is a few inches, so L is probably near 290 to 310 mm and the shoes nearer 55 than 60 degrees. The plate decides |
| 6 | Master-rod sleeve rotation | crank | turns with the master rod about the pin, swing of the master rod | deg | M1 p. 238 | derived | Steel sleeve and bronze lining are one rigid unit with the master rod |
| 7 | Link shoe slide on sleeve | rod angle | relative angle between a link rod and the master rod, peak about +/-asin(r/L) per rod | deg | M1 p. 238 | derived | "Slipping a very short distance over the circumference" |
| 8 | Free sleeve arc | | about 60 (one sixth) | deg | M1 p. 237 | documented | Check that shoe width plus swing never closes it |
| 9 | Cylinder positions | | 5 at 72 | deg | M1 p. 237 | documented | |
| 10 | Firing order | | 1-3-5-2-4, 144 degree intervals, 5 impulses per 720 | | M1 p. 245 | documented | Consecutive numbering in the direction of crank rotation is the only assignment that gives this order (derivation in section 5); the position of cylinder 1 is a modelling choice |
| 11 | Cycle | | four-stroke, 720 degrees | | M1 p. 245 | documented | |
| 12 | Cam speed and direction | crank | **-1/4** (one quarter speed, reverse) | | M1 p. 237 | documented | Closes with 2 lobes and the firing order (section 5) |
| 13 | Cam lobes | | 2, "double-pointed" | | M1 p. 237 | documented | Lobe profile, rise angle, dwell and lift not documented; the cam slant was reduced on 8 January 1902 after the push rods smashed (A1 p. 108): evidence the profile was changed, not what it became |
| 14 | Cam drive gearing | | pinion on crankshaft by the crank arm; gears on studs on the port drum; cam journalled on the port hub; net ratio 1:4 reversed | | M1 p. 237 | documented (ratio), illustrative (tooth counts) | A reversing 4:1 drive needs an internal-tooth or compound arrangement; tooth counts and the layout of Plate 79 are not documented and are read from the plate where legible, otherwise derived to give exactly 1:4 |
| 15 | Punch rods | cam | 5, radial, hardened-steel rollers on the cam, upper ends 0.397 (1/64 in) from the exhaust stems | mm | M1 p. 237 | documented | Rods slide in guides on the port drum (A1 p. 180: "valve lifter guides") |
| 16 | Exhaust valve lift | cam | not documented | mm | Plate 78 | illustrative | Travel visible in the section sets the model's value; labelled illustrative |
| 17 | Exhaust timing | cam phase | not documented | deg | | illustrative | Opens before BDC, closes near TDC; labelled illustrative everywhere it shows |
| 18 | Inlet valve | suction | automatic: opens against its spring when the piston descends, closes under pressure | | M1 p. 240; A1 p. 71 | documented (principle), illustrative (lift and timing) | One inlet and one exhaust valve per cylinder after Manly simplified Balzer's two-automatic-plus-one-mechanical arrangement (A1 p. 186); the principle of the automatic valve is described for the Balzer stage on A1 p. 71 |
| 19 | Valve springs | | free and compressed lengths, rate | | Plate 78 | measured (to do), illustrative | Spring length follows valve lift; exhaust spring carries the stem; rate unknown |
| 20 | Primary sparker cam | crank | **2.5x** crank speed, one lobe | | M1 p. 241 | documented (speed), derived (one lobe) | "Five times in each two revolutions"; spring-mounted pawl, wire contact |
| 21 | Distributor disc and brush | crank | **0.5x** crank speed over a five-section commutator | | M1 p. 241 | documented | Direction not documented; sections ordered 1-3-5-2-4 |
| 22 | Ignition gear train | crank | gear on a sleeve over the starboard drum hub, sleeve ends in a ring fixed to the crankshaft | | M1 p. 237; Plate 81 | documented (arrangement), measured (tooth counts to do) | Plate 81 shows a large spur gear, a pinion, the cam and a long spark-timing handle with a wing nut; their roles are interpreted, not captioned |
| 23 | Pump drive | crank | **3x** crank speed through bevel gears and a vertical shaft with a splined telescoping section | | M1 p. 241 | documented | The pump itself is outside the assembly; the bevel gear on the worm-wheel hub, the pinion and the shaft stub are inside |
| 24 | Starting worm | operator | worm slides on a splined tubular shaft, meshes with a worm wheel on the crankshaft, pawl holds it out of mesh | | M1 p. 244 | documented (principle) | Ratio and tooth counts not documented |
| 25 | Balance arms | crank | turn with the crankshaft | | M1 p. 247 | documented | Rigid with the coupling flanges |
| 26 | Torque pulses | | five per double revolution | | M1 p. 242 | documented | Not animated |

## 3. Cause-and-effect chains the animation must show

1. **Load:** piston, hollow gudgeon pin, rod (master rod direct; link rod through its bronze shoe to the sleeve), sleeve and bronze lining, crank pin, crank arm, hollow shaft, two bronze main bushings, drums, bed plates.
2. **Exhaust valve:** crank pinion, reversing 4:1 gear train, double-lobed ring cam, five punch-rod rollers and rods, 1/64 in gap, exhaust stem, valve head off its seat, exhaust chamber, side outlet; spring returns the valve.
3. **Inlet valve:** piston descends, suction in the chamber, automatic valve opens against its spring, charge from the circular manifold branch passes through the removable cast-iron seat; the valve closes on compression.
4. **Ignition:** crankshaft, sleeve and gear train, primary sparker cam (2.5x) lifts its pawl and breaks the circuit five times per two revolutions, coil (outside the assembly), distributor brush (0.5x) on the five-section commutator, one plug.
5. **Pump:** crankshaft, bevel gears on the worm-wheel hub, vertical shaft at 3x, pump (outside).
6. **Start:** crank handle, ratchet, sliding worm drops into mesh when the button is pulled, worm wheel on the crankshaft; on the first explosion the wheel pushes the worm out and the pawl catches it.

## 4. Deliberately not animated

Water and gas flow; oil-cup feed; the starting worm (shown engaged and disengaged only as a held pose, if at all); torque fluctuation; the piston rings, which move with the piston; electrical sparks; the flywheels and propeller shafts (outside the assembly). The cam law, valve lift, timing and spring forces are illustrative, labelled as such in the contract.

## 5. Closure checks done before design

- **Displacement:** 5 x pi/4 x 127^2 x 139.7 mm^3 = 8.848 L (539.96 cu in); A1 prints 540.2 cu in. **Closes.**
- **Power from the test record:** 267 lb on a 13 in lever at 950 rpm gives 289.25 lb-ft and 52.3 hp; M1 prints 52.4. Brake mean effective pressure about 81 psi, in the range Manly expected (75-80 psi for the earlier engine, A1 p. 93). **Closes within 0.2 percent.**
- **Weight table:** the printed total 56,323 g does not equal its printed lines (56,258 g with the printed 5,005 g of rods); it equals them with 5,070 g. The flywheel and power-plant sums (63,503 g and 85,038 g) do close. **A 65 g misprint, recorded; the model's mass check uses the total.**
- **Cam, lobes and firing order:** with cylinder k at 72 k degrees in the direction of crank rotation and firing times 144 m degrees for m = 0..4, a firing order stepping +144 degrees round the ring is forced (0, 2, 4, 1, 3, i.e. 1-3-5-2-4 numbered 1..5). Exhaust events are 144 m + d crank degrees. A two-lobe cam at -theta/4 places a lobe at 72 k degrees (mod 180) at exactly those times: the required values 0, 144, 108, 72, 36 degrees (mod 180) equal -36 m (mod 180) for m = 0..4. A cam turning forward would give +36 m, which fails. **Reverse at 1/4 speed with two lobes is exactly what 1-3-5-2-4 requires; the independent sources agree.** Tested in `scripts/test_langley_research.py`.
- **Ignition:** 2.5x with one lobe is 5 breaks per 720 degrees, at 144 degree spacing, matching the firing interval; a 0.5x distributor visits each of five segments once per 720 degrees. **Closes.**
- **Shoe clearance:** rods at 72 degrees spacing with shoes of width w: the nearest approach of two adjacent rods is 72 degrees minus a swing of about 67.7 x (r/L) degrees (numerically: 61.9 degrees at r/L 0.15, 55.1 at 0.25, 51.7 at 0.30). Shoes "slightly less than 60 degrees" wide therefore need r/L below about 0.19 (L above 363 mm), which the 37 in envelope makes doubtful; shoes of about 55 degrees need only L of 278 mm. **Open: the shoe width and the rod length must be measured from Plate 78 together, and the claim "slightly less than sixty degrees" may be a round figure for the original (pure-slipper) design.**

## 6. Packaging record

Frame (modelling): origin on the crankshaft axis at the mid-plane of the cylinders; X along the crankshaft toward the starboard drum (the ignition side; the cam side is port, -X); Z up, Y completing a right-handed frame; cylinder 1 at +Z at the assembled pose; crank rotation positive about +X (from +Y toward +Z), which is clockwise seen from the port side. Cylinder k is at 72 (k-1) degrees from +Z in the direction of crank rotation. Positions marked "to do" are measured from the plates in the modelling step and recorded in `measurements.json` with the plate, the half, the scale used and the spread.

| Part or axis | Position | Must clear | Must meet | Locator | Status |
|---|---|---|---|---|---|
| Crankshaft axis | origin | | two bronze bushings in the drum hubs | Plate 78 | measured (to do) |
| Crank-pin axis | 69.85 mm from the shaft axis, rotating | all five rods and the crank arm's sweep | master sleeve bore | M1 p. 237 | derived |
| Cylinder axes | radial, 72 degrees apart, through the crank axis | each other; the drum rings; the manifold ring | flange on the drum rings | Plates 78, 79 | documented spacing |
| Gudgeon-pin axis | slider-crank from L (to do) | cylinder wall; crank arm at BDC | bosses in the piston | Plate 78 | measured (to do) |
| Master-rod sleeve | on the crank pin; axial centre about the cylinder plane | the four link shoes; the crank arm; both drum bores | bronze lining; cone nuts at both ends | Plate 78 | measured (to do) |
| Link-shoe arcs | on the sleeve, just under 60 degrees each | each other (see closure check) | sleeve surface; cone nuts | M1 p. 237 | documented |
| Exhaust and inlet valve axes | parallel to the cylinder axis, offset to the side of the combustion chamber, exhaust below inlet on the same axis | the manifold ring; the jacket; the plug | seats in the chamber | Plate 78 | measured (to do) |
| Punch-rod axes | radial, one under each exhaust stem, outside the port drum face | the port bed plate; the starting worm; the cam gear train | roller on the cam ring; 1/64 in below the exhaust stem | Plates 78, 79 | measured (to do) |
| Ring cam | journalled on the port hub, coaxial with the shaft | the port bed plate web ("space provided between bed plate and head", M1 p. 237); the gear train studs | five rollers | Plate 78 | measured (to do) |
| Ignition sleeve and gears | on the starboard hub, coaxial | the starboard bed plate web | primary sparker pawl; distributor | Plate 81 | measured (to do) |
| Inlet manifold ring | around the engine near the cylinder heads, cut in three places with flanges | cylinders, jackets, plugs, punch rods | five branch tubes into the inlet seats | M1 p. 240 | documented (arrangement) |
| Water manifolds | starboard ring (inlet) and port ring (outlet) | cylinders, balance arms, gears | jacket stubs on each cylinder | M1 p. 240; Plate 78 | documented (arrangement) |
| Exhaust chamber and side outlet | below the exhaust seat, outlet away from the port main bearing | the port drum, the main bearing | exhaust seat | M1 p. 240 | documented |
| Balance arms | bolted between the crankshaft and transmission-shaft coupling flanges, 30 degree braces | each drum, bed plate | flanges | M1 p. 247 | documented |
| Overall envelope | 37 in diameter, 19 in wide | | | A1 p. 156 | documented; a check on the cylinder-tip circle |

Sits in a hole or pocket (these become seats): liner in shell; plug in its dome boss; inlet seat in the chamber with its nut; exhaust seat and guide; bushings in the drum hubs, in the rod heads and in the master sleeve; gudgeon pins in the piston bosses; rings in grooves; shoes on the sleeve; springs on stems; punch rods in their guides. Fasteners and connectors are guests of the part they pass through, never hosts. Rigid bodies: the crank assembly (shaft, pin, plug, coupling flanges, balance arms, worm wheel and bevel gear, the pinion and the ignition ring); each piston with its rings and pin; the master rod with its sleeve and lining; each link rod with its shoe; each cylinder with liner, chamber, jacket, seats, plug and oil cup; each valve with its collar; each punch rod (the roller turns); the ring cam; the gears; the sparker cam; the distributor disc.

Known conflicts to resolve in measurement, not in the audit: a manifold ring must clear five jackets and still be assembled in the frame (the source itself says it was cut in three places for that reason); the exhaust punch rod sits outside the port drum face and the cam ring sits in the gap between drum and bed plate (so the gap is a documented dimension, M1 p. 237); the water manifolds, the manifold ring and the balance arms share the volume near the heads and the couplings.

## 7. Operating motion as built (7 October 2026)

One source for the geometry and the motion: `cad_pipeline/langley_cam.py` (cycle timing and the ring cam), `langley_motion.py` (a transform per part and crank angle), `langley_bodies.py` (which parts move together), `langley_explode.py` (the systems exploded view). `scripts/test_langley_motion.py` checks it (23 tests: rest pose, kinematic closure, stroke, firing order, ratios, exhaust and inlet timing, brush and sparker phase, continuity between one-degree keys, exploded rules).

| Quantity | Value as built | Status |
|---|---|---|
| Rest pose, theta = 0 | cylinder 1 at top dead centre at the end of its exhaust stroke; its exhaust valve is closing (1.4 mm), cylinder 3's is 7.2 mm open, the other three are shut; every inlet valve is shut | derived from the timing choices below |
| Power top dead centre of cylinders 1, 3, 5, 2, 4 | 360, 504, 648, 72 and 216 degrees (144 degrees apart, each a real top dead centre of that cylinder) | derived from the documented firing order |
| Exhaust timing | peak lift 270 degrees after power top dead centre, valve open about 206 degrees, starting some 20 degrees before bottom dead centre | illustrative |
| Cam phase | lobe centres at 157.5 and 337.5 degrees at theta = 0 (cylinder 1's lobe passes at theta = 630); the cam turns -1/4 | derived from the exhaust timing and the documented ratio |
| Cam lobe | raised cosine, half width 28 cam degrees (112 crank degrees), rise 12.4 mm over a 60 mm base circle; the punch-rod roller (8 mm radius) rides the polygon outline with 0.1 mm clearance, found by exact contact | illustrative |
| Exhaust valve | rises with the rod after the documented 0.397 mm gap is taken up; maximum lift 12.0 mm; the spring is compressed between the guide boss and the collar | illustrative lift, documented gap |
| Inlet valve | opens by suction: raised cosine, 6 mm, within 50 degrees of the middle of the intake stroke; the spring is compressed between the chamber and the cap | documented principle, illustrative window and lift |
| Cam train | pinion 24 on the crankshaft, large gear 48 with its coaxial small gear 18, idler 20, tooth ring 36 on the cam: three external meshes, net exactly -1/4 | documented ratio, derived teeth |
| Ignition | pinion 30 on the sleeve turns the 60-tooth gear (-0.5x, with the distributor disc and brush) which turns the 12-tooth sparker pinion and cam (+2.5x) | documented ratios, derived teeth |
| Spark | 20 degrees before power top dead centre; the brush reaches each segment at its spark; the sparker cam's lobe crest is under its axle at every spark and presses the pawl down about 6 mm, the pawl spring stretching with it | illustrative advance, derived phases |
| Rods | all five axes pass through the crank-pin centre, so the five strokes are identical; the link shoes slide on the master sleeve as the relative angle between a link rod and the master rod changes by up to about 28 degrees | documented, derived |
| Not animated | worm and its shaft, worm wheel teeth against the worm (the thread is omitted), the pump bevel pair and shaft (axisymmetric as drawn), pipes, drums, bed plates | held poses or invisible rotations |

The audit of this motion over two turns found two collisions at 30 degree steps (the master rod's root flare against two link shoes at their closest approach, and a cam lobe tip against the idler stud); both were removed by changing the design, not a threshold (the flare is narrower; the idler has 20 teeth so its stud stands outside the lobe sweep). The re-run at 15 degree steps over 720 degrees (48 poses, 1,486-1,541 neighbouring pairs each) is clean. The exported file's baked clip is audited separately, between its keys.
