# Rocker housing clearance correction

The preceding pushrod candidate cleared the rod/tube and rod/socket pairs, but its rocker still intersected the reconstructed housing. This correction derives a matching oval housing, gasket and cover envelope from the moving rocker instead of retaining the original provisional outline.

`scripts/build_housing_candidate.py` reads the hash-verified pushrod candidate and its 58 recorded contact poses. In each housing's local frame, the oval cavity has a 22 mm transverse radius and two semicircle centres at ±h along the profile's long axis. For a sampled rocker point `(x,y,z)`, the required half-spacing is:

```
h >= abs(z) - sqrt(22² - y²)
```

The script rejects a point outside the transverse radius. It tessellates the native rocker at 0.05 mm tolerance, takes the largest required half-spacing over the recorded poses, adds a reconstructed 1 mm allowance, and rounds upward to 0.5 mm. This estimates a contour; the subsequent native-solid collision audit remains the deciding check.

| Quantity | Intake | Exhaust |
|---|---|---|
| Required sampled half-spacing | 20.8804 mm | 20.8806 mm |
| Selected half-spacing | 22 mm | 22 mm |
| Previous provisional half-spacing | 16 mm | 16 mm |

The same half-spacing updates all six native oval profiles per train: housing outer/cavity, gasket outer/inner and cover outer/inside. Radial dimensions, wall thicknesses, shaft position, rocker motion, valve dimensions and pushrod datums are preserved. All 60 bodies remain valid single solids and the sketches remain fully constrained.

The manual figures identify the rocker-box arrangement but do not establish this contour or allowance. These dimensions remain derived/reconstructed teaching-model geometry, not Continental production dimensions. Records are in `data/housing-candidate.json`; the isolated CAD is generated under `build/housing-clearance/`.

Reproduce the motion audit with `scripts/solve_valve_contact.py --housing`. It verifies the inherited pushrod/socket frames against the candidate, checks the same moving solid pairs and writes `data/housing-candidate-contact.json`. It also exports an intake mechanism review mesh at illustrative 7 mm lift; `scripts/render_valve_review.py` renders it in Blender with translucent housing and tube. This review render is not a release GLB or a claim of complete valve-train validation.

## Audit results

All 58 sampled poses pass the listed solid-pair clearance gate: valve/rocker, rocker/housing, pushrod/tube and pushrod/rocker have zero intersection volume. Minimum rocker/housing distances are 2.7423 mm intake and 2.6499 mm exhaust; minimum pushrod/tube distances remain 0.3420 and 0.2871 mm. Inherited joint frames match the candidate exactly within recorded numerical precision. This does not establish continuous clearance or validate unlisted part pairs.

The native spring audit in `data/spring-envelope-audit.json` fails its separate envelope gate. At the illustrative 7 mm lift, the existing 35 mm reconstructed spring envelope reduces to 28 mm, and the outer spring pitch is 4 mm, equal to its wire diameter. A valid kernel solid does not establish useful inter-coil clearance. The next isolated candidate revises the spring seat/envelope and must check head, guide, retainer and concentric-spring interfaces. No candidate has been promoted to the dimensional master or released GLB.
