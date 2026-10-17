# GTSIO-520-H realism revision: source review and first core

Reviewed 7 October 2026. Target: the project's **GTSIO-520-H**, following Continental X-30045A, March 1981 and its H chapter (June 1980). The workshop engine serial number, piston part number and later modifications have not been established. This is a detailed teaching reconstruction, with documented critical dimensions and explicit estimates, rather than a manufacturing replica.

## What the earlier builds taught us

Wright revision 2 separates source coverage from valid CAD, preserves 413 individual solids and builds motion from shared geometry. Langley preserves 358 parts, uses one frame and mechanism definition, and checks source shape and mass independently of solidity. The same principles apply here: FreeCAD owns geometry, one skeleton owns interfaces and phases, and exported geometry receives an exhaustive interference audit. More polygons or attractive materials would leave V5's inherited layout assumptions unresolved.

The V5 README, whole-engine contract and exporter were inspected. V5 is a Blender reconstruction with inherited V4 motion. Its contract explicitly leaves mounting datums, crank indexing, bearing maps and detailed whole-engine operation open. The reviewed single-cylinder revision is a useful separate module; it is not yet a validated six-cylinder installation. Its ring-gap orientations in `EngineSimulation/FreeCAD/v2/build_detail.py` are 0/120/240/60 degrees, whereas X-30045A A-11-3 prescribes alternating opposite positions for four rings. The new core uses the manual's arrangement.

## Sources actually studied

The supplied DigiMan reviewed PDF/DOCX were located, hashed and text-indexed alongside the original `Notes/gtsio520_series.pdf`. The conversion metadata binds the reviewed DOCX to the same original SHA-256. Its own notes say OCR corrections are selected, not a complete technical proofread. Original scanned tables/figures therefore govern ambiguous numerical rows.

Read in full for the selected core: A-3-1/A-3-2 (PDF16-17), A-11-2 through A-11-4 (PDF74-76), A-12-1 through A-12-4 (PDF77-80), Table 6 B-12 (PDF103), H specifications C-3-2/C-3-3 (PDF152-153). Inspected the complete A-4-17 cylinder/piston figure and key (PDF34), A-4-20 crankshaft figure and key (PDF38), B-2 longitudinal section (PDF97), Table 6 image (PDF103), Table 11 image/text (PDF117). Read cylinder machining dimensions A-4-23 PDF40, rod/bushing instructions A-4-29 PDF42, and the applicable B-1/B-2 limits rows PDF92-93. Also reviewed the crankcase figure/key (PDF35-36), stud figure/table (PDF115-116), fuel description (PDF19), and H-specific induction text/key (PDF157-161). These latter sources establish the integration backlog; **whole-engine research is not complete**. Fuel, turbo, oil and accessory figure coverage still needs its own inventory.

No IO-520 or TSIO-520 dimensional specification was substituted. The IO-520 deliverables remain useful contextual material only.

## Construction, assembly and paths

The crankshaft is a six-throw steel forging with nitrided journals/pins. Each connecting rod works on a separate pin; left cylinder mounting pads are farther forward. There are three opposed rod bays. The six firing events in the H order 1-4-5-2-3-6 are spaced by 120 crank degrees. A shaft-Z datum and odd +X/even -X bank assignment produce opposing pin phases in each bay; this is a derived teaching registration, not a surveyed orientation.

Gas load crosses the hollow aluminium piston crown, reinforced pin bosses, full-floating hollow steel pin with aluminium end plugs, split bronze little-end bushing, forged I-section rod, and two steel-backed lined bearing shells to the crankpin. Rod/cap bolt holes have real seats; nuts have through bores. Threads are omitted. Cotter locking hardware is deferred, so this is not a complete service assembly. Ring grooves have finite side and radial clearances; separate rings have real gaps. The four-ring choice follows production since 1975, but ring sections, axial stations and the adopted two compression/oil/scraper assignment remain estimates pending the applicable piston parts drawing.

Ring 1 shares its gap orientation with ring 3; rings 2 and 4 have the opposite orientation per A-11-3. Oil-ring drain apertures and piston drain holes are reconstructed construction features, not a calibrated oil-control design. The inherited oil-ring axial station intersected the full-length pin and was replaced with an explicitly estimated station below the pin, supported by the assembly packaging check. Skirt reliefs clear the stored core pose, but the full swept crank envelope and counterweight shapes/oscillation are deferred and their clearance cannot yet be claimed.

Assembly: seat bearing shells in rod and cap, close cap around crankpin, insert special bolts and slotted nuts; later add cotters. Place piston over the little end and center its pin. The paired plug/tube representation is one permanently assembled pin in reality, not removable service plugs. Install cylinder over lubricated and correctly gapped rings. Main-bearing inserts and case supports await the crankcase module. Source-described torque/fit data are research context; this candidate is not a maintenance instruction.

## Dimension hierarchy

| Quantity | Source and selected value | Status |
|---|---|---|
| Nominal bore / stroke | H C-3-2 PDF152: 5.250 / 4.000 in, 133.35 / 101.6 mm | documented |
| Rod center distance | Table 6 PDF103: 6.623-6.627 in; midpoint 168.275 mm | documented range; selected midpoint |
| Main / crankpin diameter | Table 6: 2.6240-2.6250 / 2.2490-2.2500 in; midpoints | documented ranges; selected midpoints |
| Pin OD / piston bore / bushing bore | Table 6: 1.1243-1.1245 / 1.1246-1.1250 / 1.1267-1.1269 in | documented ranges; selected midpoints |
| Pin assembly length | Table 6: 5.2050-5.2200 in; midpoint 132.3975 mm | documented range; selected midpoint |
| Piston top / below first groove / skirt bottom | Table 6: 5.2020-5.2068 / 5.2140-5.2160 / 5.2394-5.2404 in | documented ranges; selected midpoints |
| Fitted bore | A-4-23/B limits: 5.251-5.253 in; inherited midpoint 133.4008 mm | source-backed cylinder target, not an included barrel |
| Ring widths/stations, crown, bosses, I-section, fasteners, axial bay pitch | explicitly estimated in `part-spec.json` | illustrative geometry |

## Conflicts and decisions

1. The exploded piston figure depicts five rings but annotates four-ring production. Choose four consistently, without claiming a piston part number. Keep five-ring callouts accounted as deferred/superseded choices.
2. V5's layout is not a manufacturing datum. Adopt the longitudinal B-2 section's four supports/three bays, derive opposed pin phases from the H firing order, and declare all axial spacings estimated. Do not carry the old mesh stations forward as documented dimensions.
3. Table 6 includes several cylinder-guide rows and corrupt-looking unrelated transfer-sleeve values. Transcribe only the visually verified rows needed here; leave unrelated anomalies unresolved.
4. Counterweights are oscillating dampers, not fixed decorative blocks. Revision 2 adds the visible integral blades and bare bushing seats with estimated dimensions following the image review. Defer weights, bushings/pins and accurate blade dimensions until their drawings and swept envelopes are resolved. No invented oscillation clip is exported.

The 8 October image-match review also inspected A-4-30 PDF43 and A-10-3 PDF70 to establish blade/bushing construction, and compares the native forging against A-4-20 in a locked view. See `image-match-review.md` and `crankshaft-match-findings.json`: the source-resemblance status still requires another iteration even when geometric and interference checks pass.

The subsequent design review corrects two assumptions rather than only the outline: the counterweight fork implies a thinner centred blade; the throw-supporting cheek faces are slightly tapered while machined lands retain the nominal support stations. Revision 3 chooses inferred 8 mm blades in 14 mm middle cheeks and native inclined web sections with full-depth contact lands. `design-learning.md` separates observation, deduction, estimate, test and remaining uncertainty; it does not claim verified fork fit or stress capacity.

## Scoped readiness decision

Revision 4 proceeds with user-authorized calculated estimates anchored to the documented diameters and bushing ID. It adds eighteen native root blends with mating liner relief, contained tapered web sections and twelve explicitly assumed blind pin-end recesses. `crankshaft-estimation.md` separates anchors, selected coefficients, formulae, source-supported construction and unverified hidden topology. Saved curve/land/void measurements and complete static CAD/export audits test the chosen geometry; they do not establish the manufacturer's radii or drilling map. Axial station estimates and deferred damper/shaft-end work remain explicit.

The sources support a **static rotating-core candidate**: one six-throw forging, six piston/rod modules, bearings and main mechanical fasteners. The full 42-callout crank figure and 51-callout cylinder figure receive dispositions in `inventory.json`; deferred items are not counted as built. The research gate permits this bounded scope only. Case, cylinders/valve gear, reduction/quill system, counterweights, accessories, fuel/ignition/induction/exhaust/oil systems and operation remain further work.

Checks before accepting this candidate: saved single solids, STEP round trip, actual saved critical diameters and rod centers, prescribed alternating ring gaps, real journal/rod/pin seats, parameter regeneration, exact intersections for all bound-meeting part pairs and exported-GLB audit. Source resemblance is qualitative; no calibrated silhouette residual or workshop measurement is available. Compression volume, strength, thermal fits and dynamics are not established. Any operating clip needs a new motion dossier and between-key audit.
