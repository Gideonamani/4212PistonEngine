# Valve-train motion preparation

The reproducible extraction in `scripts/export_valve_frames.py` reads native FreeCAD features without saving the master. Its output, `data/valve-frames.json`, records the CAD hash, valve axes and closed origins, rocker shaft centre/axis, pushrod ball centres, rocker socket centres, and spring seat/envelope measurements.

## Checks completed

Both pushrod upper-ball centres coincide with their rocker socket centres within 0.000001 mm. Observed errors are 1.66e-13 mm intake and 2.84e-14 mm exhaust. This is consistency of reconstructed static geometry, not manufacturing accuracy. Extracted pushrod centre distances are 367.5527 mm intake and 366.3302 mm exhaust; these remain reconstructed model values.

The shaft pivot comes from the native shaft sketch's circle centre and half its pad length. Spring seat/envelope measurements come from the wire-profile circle and helix height. This avoids copying the old animation's fixed world coordinates.

## Manual evidence reviewed

Source: workspace `Notes/gtsio520_series.pdf`, printed A-3-1, PDF page 16 (one-based), visually checked. Sections 3-1c and 3-1d describe rocker shafts/bushings, hardened pushrod sockets, ball-ended hollow pushrods, retainers secured by keys, oil carried through pushrods to rockers, and oil returning through the housings. These support component identity and functional relationships. They do not specify a 7 mm lift curve or 22 mm effective rocker lever.

The existing CAD annotations separately mark installed spring dimensions and lever/contact geometry as reconstructed. Exhaust inclination remains provisional in the existing reference register. This review does not resolve that ambiguous marking.

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

The current website continues to animate the verified slider-crank only. These joint frames are preparation for synchronized valve motion, not a claim that it has been implemented or validated.
