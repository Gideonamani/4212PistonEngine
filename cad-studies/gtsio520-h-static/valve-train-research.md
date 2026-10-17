# Valve-train design review before reconstruction

Reviewed 2026-10-08. Manufacturer evidence is Continental X-30045A, original `../Notes/gtsio520_series.pdf`, SHA-256 `c8e7828e978772a55a9271d7bf678cc464ac772987ce7c44cfa3af89c9c21a07`. This is a feature plan; these additional components are not yet built.

## Observed construction

A-3-1, PDF16 describes a forged steel camshaft with **four journals and nine lobes**, hardened and ground. Four unequally spaced rear-flange bolts establish the gear's timing relationship; the cluster gear drives the fuel pump. A-4-19, PDF37 shows seven assembly identities: governor driven bevel gear, governor drive bevel gear, Woodruff key, hex-head screw, cam cluster gear, camshaft gear and camshaft. Gear teeth, axes, rates and phases must enter the shared declaration in `scripts/accessory_gears.py` before CAD features are generated.

A-4-17, PDF34 distinguishes rocker shaft, shaft retainer, screw and tab washer; hollow pushrod assembly, housing, housing spring, washers, O-ring and packing; retaining ring and hydraulic lifter body. The shaft-support circles visible on a head are functional bearing/retention interfaces, not extra holes to copy into a cover. A-4-36, PDF46 shows the lever reaching downward to its pushrod cup. A-4-10, PDF26 and the hydraulic-lifter construction text govern its internal interpretation.

## Deductions and calculated estimates

The H firing order `1-4-5-2-3-6` places opposing pairs 1/2, 3/4 and 5/6 360 crank degrees apart. A shared intake lobe can act on opposed followers 180 cam degrees apart. Three shared intake lobes plus six individual exhaust lobes explains the documented total of nine; the assignment remains a reconstruction deduction, not a recovered lobe drawing.

The existing estimated skeleton keeps intake valves facing their paired cylinders. Reversing this longitudinal clocking made the straight housings cross; the corrected clocking avoids that. The current 12 straight centre lines clear the barrel/fin envelope and one another in the packaging tests. Their endpoints and lengths remain estimates. The cam axis at Y=-126 mm and follower sockets at X=+/-48 mm come from this layout, not manufacturer measurements.

The case still needs actual lifter guide bores and housing seats. A line that clears the barrel can still pass through case material. At the head, the housing must enter the lower rocker pocket through a fitted seat; its sphere-ended rod must meet the rocker cup. Add those interfaces from the common skeleton, rather than cutting unrelated holes around a final render.

## Required closure before feature acceptance

1. Inspect the original lifter section and applicable table-of-limits rows; distinguish body, plunger, spring, check valve, retaining ring and oil passage.
2. Establish one cam/valve pose. A timed camshaft cannot be combined arbitrarily with twelve closed valves. Derive followers, rods, rockers, valve displacement and spring compression from the same pose. Record estimated cam law and lever ratios separately from manufacturer timing.
3. Retain the four line-bored cam journal interfaces; ground journal diameters and source running clearances govern the shaft, not a visual guess.
4. Fit shaft retainers, housing seals and attachment hardware; check service/assembly access and all exact pairs.
5. Save/reopen and export the static assembly, then compare the exposed valve train with A-4-17/A-4-36. Animation follows static completion and a separate motion audit.

The current cylinder milestone does not establish cam timing, rod length, spring constants, oil routing or operation.
