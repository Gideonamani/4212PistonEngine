# Valve-train motion preparation

The reproducible extraction in `scripts/export_valve_frames.py` reads native FreeCAD features without saving the master. Its output, `data/valve-frames.json`, records the CAD hash, valve axes and closed origins, rocker shaft centre/axis, pushrod ball centres, rocker socket centres, and spring seat/envelope measurements.

## Checks completed

Both pushrod upper-ball centres coincide with their rocker socket centres within 0.000001 mm. Observed errors are 1.66e-13 mm intake and 2.84e-14 mm exhaust. This is consistency of reconstructed static geometry, not manufacturing accuracy. Extracted pushrod centre distances are 367.5527 mm intake and 366.3302 mm exhaust; these remain reconstructed model values.

The shaft pivot comes from the native shaft sketch's circle centre and half its pad length. Spring seat/envelope measurements come from the wire-profile circle and helix height. This avoids copying the old animation's fixed world coordinates.

## Manual evidence reviewed

Source: workspace `Notes/gtsio520_series.pdf`, printed A-3-1, PDF page 16 (one-based), visually checked. Sections 3-1c and 3-1d describe rocker shafts/bushings, hardened pushrod sockets, ball-ended hollow pushrods, retainers secured by keys, oil carried through pushrods to rockers, and oil returning through the housings. These support component identity and functional relationships. They do not specify a 7 mm lift curve or 22 mm effective rocker lever.

The existing CAD annotations separately mark installed spring dimensions and lever/contact geometry as reconstructed. Exhaust inclination remains provisional in the existing reference register. This review does not resolve that ambiguous marking.

Additional visual review: PDF page 46 (printed A-4-26), Figure A-4-36, and PDF page 80 (printed A-12-4), assembly instruction 12-7j. The 0.005–0.035 inch figure annotation is **side clearance between retainers and rocker arms**. It must not be used as valve-tip lash, pad radius or a permitted operating contact gap. The instruction says to centre the rocker arm on the valve stem. Figure A-4-34 on page 46 also shows the concentric spring installation; the reconstructed coil dimensions remain unverified.

## Before enabling valve-train motion

### Legacy motion audit results

`scripts/audit_valve_contacts.py` evaluates the actual CAD solids at 0, 3.5 and 7 mm lift using the old video's `-asin(lift/22)` rocker rotation. Results are recorded in `data/valve-contact-audit.json` against the master hash.

| Lift | Intake rocker/valve gap | Exhaust rocker/valve gap |
|---|---|---|
| 0 mm | 0.2244 mm | 0.1736 mm |
| 3.5 mm | 0.3581 mm | 0.3073 mm |
| 7 mm | 0.7701 mm | 0.7193 mm |

The sampled valve/guide and rocker/housing pairs have zero intersection volume. Minimum guide gaps are approximately 0.024765 mm intake and 0.047625 mm exhaust; those are geometric minimum distances, not diametral clearances. Housing gaps remain above 2.6 mm in the sampled poses. These sparse checks do not establish clearance throughout motion or for every neighbouring part.

**The legacy valve-train motion fails the maintained-contact requirement.** Even the closed pose has a gap in this reconstructed rocker envelope. Correct/reconstruct the contact face on an isolated CAD copy, then solve rocker angle from contact instead of relying on the illustrative 22 mm lever. Validate pushrod/socket closure, spring envelope and intermediate clearances before promoting new CAD/GLB assets. The live model is preserved while this correction is developed.

1. Establish the rocker-to-valve contact point and effective lever from the CAD contact surfaces; resolve gaps/interference rather than simply rotating around the correct pivot.
2. Check springs at minimum length for coil interference; an axial scaling effect is only illustrative deformation.
3. Preserve pushrod length and ball/socket alignment throughout the proposed motion, and check housing clearances.
4. Separate a clearly labelled illustrative teaching profile from manufacturer timing/lift. Review applicable manual timing before claiming realistic operating events.

### Existing-envelope contact solution

`scripts/solve_valve_contact.py` solves first contact by bracketing and bisection against actual CAD solids at 29 lift samples per valve (0–7 mm, 0.25 mm increments). `data/valve-contact-solution.json` records all 58 poses, contact points, rocker/housing checks and a constant-length pushrod endpoint construction. The master is never saved.

| Quantity | Intake | Exhaust |
|---|---|---|
| Closed-valve contact angle relative to current CAD rocker | -0.585854° | -0.452972° |
| Contact angle at illustrative 7 mm lift | -21.128945° | -20.955310° |
| Minimum sampled rocker/housing gap | 2.8516 mm | 2.6636 mm |

All sampled valve/rocker and rocker/housing intersection volumes are zero. The solver approaches contact from the separated side with approximately 0.000001 mm residual gap; this is numerical tolerance, not manufacturing precision. Constructed pushrod centre distances agree within 5.7e-14 mm, assuming the lower ball travels along the model's world-X follower line. That assumption still needs a lifter/interface review, and does not establish pushrod-to-housing clearance.

These results show that a contact-derived angle can remove the old animation's growing gap. They do **not** validate the existing sharp contact edge as a realistic rocker pad. A rounded contact-face candidate, its contact migration, pushrod clearances and spring envelope remain under review. The closed-position angle changes also require corresponding pushrod placement changes before publishing an assembly.

The current website continues to animate the verified slider-crank only. These joint frames and contact solutions are preparation for synchronized valve motion, not a claim that it has been implemented or validated.

### Rounded-contact candidate: rejected for promotion

`scripts/build_rocker_candidate.py` creates `build/rocker-contact/GTSIO520_Rocker_Candidate.FCStd` with native PartDesign fillets on the two contact edges. It matches each edge geometrically, preserves body IDs, checks each rocker is one valid solid, and verifies that the master hash has not changed. The 2 mm fillet radius is explicitly reconstructed. `data/rocker-candidate.json` records the candidate hash and feature names; the generated CAD stays outside Git.

Run `scripts/solve_valve_contact.py --candidate` with FreeCAD Python to reproduce `data/rocker-candidate-contact.json`. The same 58-pose sweep now checks the constant-length pushrods against their housing tubes and moving rockers as well as valve contact and rocker/housing clearance.

| Candidate result | Intake | Exhaust |
|---|---|---|
| Closed-valve contact angle | -1.767972° | -1.620609° |
| Contact angle at illustrative 7 mm lift | -24.692047° | -24.495514° |
| Minimum sampled rocker/housing gap | 2.9165 mm | 2.7393 mm |
| First sampled lift with pushrod/tube interference | 5.00 mm | 4.75 mm |
| Maximum pushrod/tube intersection | 330.6732 mm³ | 338.5203 mm³ |
| Maximum pushrod/rocker intersection | 59.7253 mm³ | 59.4329 mm³ |

Valve/rocker contact remains within the numerical tolerance, with zero sampled intersection volume; rocker/housing checks also have zero intersection. However, pushrod/socket-entry interference already exists at the corrected closed pose and tube interference appears at higher lift. The candidate therefore **fails the sampled clearance gate** and is not a release asset.

Next: review the reconstructed follower line, rocker socket trajectory and fixed tube datums as one mechanism, then revise the native CAD interfaces on the isolated candidate. Do not enlarge tubes or shorten pushrods merely to hide the collision. Recheck the closed assembly, contact migration, full lift samples, socket entries and spring envelope before exporting to Blender. The live master and GLB retain their previously verified configuration.
