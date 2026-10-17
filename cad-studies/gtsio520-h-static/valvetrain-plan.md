# Valve-train reconstruction plan

Reviewed 2026-10-09 before generation. Target is the GTSIO-520-H static educational reconstruction. Governing local source: Continental X-30045A, `../Notes/gtsio520_series.pdf`, SHA-256 `c8e7828e978772a55a9271d7bf678cc464ac772987ce7c44cfa3af89c9c21a07`. R16 remains the validated cylinder milestone.

## Observed construction and dimension anchors

- A-3-1 PDF16: hardened forged rockers have bronze pivot bushes, hardened pushrod sockets and rocker faces. Pushrods are steel tubes with pressed-in, centre-drilled forged ball ends. Beaded steel housings retain washers, seals and a heavy spring; oil drains through the housings. Shaft screws retain the chrome-plated steel rocker shafts.
- A-3-2 PDF17 / A-4-19 PDF37: forged camshaft has four ground journals, nine lobes, a rear flange and four unequally spaced gear bolts. Its front journal has an oil-transfer groove. Gear train and governor gears remain the following drive-module scope; all seven A-4-19 identities remain explicitly accounted for.
- A-4-10 **PDF27** (the earlier PDF26 locator was wrong): eight physical identities, body, plunger spring, check-valve housing, check-valve spring, check-valve plate, plunger, socket, retaining ring. Keys 9-16 identify oil grooves, reservoirs and passage features, not eight extra loose components.
- Table6 PDF103: cam journal 1.2480-1.2490 in, midpoint **31.7119 mm**; case cam bore 1.2500-1.2510 in, midpoint **31.7627 mm**; tappet guide 1.0005-1.0015 in, midpoint **25.4254 mm**. PDF104: tappet body .9990-.9995 in, midpoint **25.38095 mm**. These give neutral diametral clearances .0508 and .04445 mm.
- New socket/retaining-ring variant, PDF17: shouldered socket and 1/8 in oil hole; older tapered socket and 1/16 in hole are not intermixed.
- A-4-17 PDF34 and A-4-36 PDF46: retainers, shaft screws/tab washers, two pushrod/housing assemblies per cylinder and .005-.035 in rocker side-clearance range. Reference inspection includes complete figure and legend.

## Design deductions and selected estimates

Three shared intake lobes and six individual exhaust lobes explain the nine documented lobes and the 360-crank-degree separation of opposing firing pairs. Exact manufacturer lobe assignment, profile and timing were not recovered. The shared station/clocking deduction remains labelled inferred.

The static pose will close a single load path: cam support plane > flat lifter face > hydraulic socket > constant-length spherical-ended pushrod > rocker cup > rotating rocker > curved rocker face > displaced valve/retainer/keys and compressed springs. Leaving all valves closed under differently phased cam noses is rejected.

Selected cam reconstruction: 19.5 mm base circle, 6 mm maximum follower rise, harmonic rise/return over +/-70 cam degrees about each estimated event centre, sampled convex support envelope. Intake/exhaust peak centres are provisionally 450/270 crank degrees after firing. **These are illustrative reconstruction coefficients, not manufacturer valve timing, ramp design, spring dynamics or a certified operating cam.** Static geometry must fit; animation remains deferred. A positive curvature radius and sufficient follower face are checked before creating the profile. The .5 cam rate is derived centrally from the declared timing pair; tooth counts are illustrative and do not imply manufactured gear geometry.

Body length 50 mm and socket 45 mm from the cam face are section-based estimates. Internal diameters and spring/check-valve sizes are estimates constrained by the source body OD and distinct oil spaces. Housings use a fixed case-to-head line and sufficiently large internal bore for the solved rod at this static pose. Case lifter bores, lateral bosses, housing seats and head lower-pocket seats derive from the same skeleton. Hidden case-gallery connections remain unverified; no arbitrary complete oil circuit is claimed.

The previous polygon rocker face cannot rock against a flat stem tip without intersection. A locally rounded contact pad and spherical pushrod cup will replace that approximation. Their radii are explicit estimates. Pivot bore and shaft datums remain anchored; the straight rod length determines rocker angle and the contact pad determines valve travel. Stock material and clearance are retained around each fitted seat.

## Modelling method and verification

Reuse tested FreeCAD 1.1.1 cylinders/cones/revolutions, compound rigid placement, mirrors, helix sweeps and Boolean policies. Cam outline uses a derived planar extrusion, then unions with its shaft/journals; it does not use radial distance as follower displacement. Spherical joints and rounded contact use native sphere/cylinder operations. Verify the pose against both original solids and exported GLB.

Primary method source: [METU OpenCourseWare, Cam Size Determination](https://ocw.metu.edu.tr/pluginfile.php/6886/mod_resource/content/1/ch8/8-4a.htm), inspected 2026-10-09. Its flat-follower treatment relates contact excursion to displacement derivative and requires positive cam curvature. This establishes the envelope method, not GTSIO timing. FreeCAD method documentation and the saved local fixtures remain in the pipeline records.

First test one cylinder, its head/deck, lifter, rod/housing and actual cam/journal neighbours. Inspect spherical/flat tangencies, oil/assembly spaces, solid validity, native edits/reopening and STEP. Expand to twelve routes/nine lobes and repeat all-bound-meeting exact and actual-export checks at unchanged tolerances. Compare the exposed parts with A-4-10/A-4-17/A-4-19/A-4-36. Do not accept source resemblance from a solid-count or interference pass.

### Retention interpretation corrected before features

The enlarged complete A-4-17 figure and A-12-7 PDF80 instructions distinguish inboard and outboard retainers next to the rocker arm. They set the stated side clearance and are fastened to internal rocker bosses. The previous wall-supported shaft interpretation is replaced by two fitted retainer collars, internal stock webs/bosses, screws, tab-washer envelopes and thin thrust washers. Shaft span is estimated at 36 mm so its ends remain inside the rocker box; through-holes in the outer box walls are removed. Collar/foot contour and screw sizes remain estimates. No unobserved annular retaining grooves were invented on the shaft. This is a construction correction, not a substituted IO-520 part.
