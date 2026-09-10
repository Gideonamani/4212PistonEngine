# Pushrod layout correction study

The first rounded-rocker candidate maintained valve contact but collided with the fixed pushrod tubes and socket entries. This study treats the reconstructed rocker socket, follower line, rod and fixed tube as one mechanism. It does not establish Continental manufacturing dimensions.

## Geometric screening

`scripts/study_pushrod_layout.py` uses the CAD-derived rocker angles in `data/rocker-candidate-contact.json` and records its input hashes in `data/pushrod-layout-study.json`. It varies the socket's axial offset from the rocker shaft while preserving its 20 mm radial lever and the existing lower follower line. For each layout:

1. Calculate the socket position at the contact-corrected closed pose.
2. Derive the rigid pushrod length from the two closed joint centres.
3. Align the fixed tube to those closed joint centres.
4. At each recorded lift, solve the lower ball position on the existing world-X follower line while preserving rod length.
5. Intersect the rod centreline with both fixed tube-end planes. Bound the rod's oblique circular cross-section and compare it to the existing 5.6 mm tube bore radius.

The upper ball's sweep depends on the socket position relative to the rocker shaft. With the original 9 mm offset, simply realigning the closed tube still produces negative screening margins. A shared 3.5 mm offset leaves positive margins in this limited study:

| Screening quantity | Intake | Exhaust |
|---|---|---|
| Original 9 mm offset, minimum margin | -1.3772 mm | -1.4109 mm |
| Proposed shared 3.5 mm offset, minimum margin | 0.3420 mm | 0.2871 mm |
| Derived closed-joint rod length | 362.8463 mm | 361.6000 mm |

These small margins require a solid audit. They are not tolerance-stack allowances, manufacturing clearances or a reason to accept the design without further checks. The calculation covers the rod cylinder between tube-end planes, not its balls, seals, socket entries or other adjacent components. It uses 29 CAD contact poses per train and an illustrative 7 mm maximum lift. Actual cam/lifter geometry remains unresolved.

## Native CAD candidate

`scripts/build_pushrod_candidate.py` starts from the isolated rounded-rocker candidate. It changes the constrained arm-web dimensions and socket position, moves the rocker to its contact-corrected closed angle, and regenerates rod length, tube/seal alignment and existing head/cover passages from the same joint datums. A native subtractive cone supplies angular entry at the socket; its dimensions remain reconstructed. The script validates that all 60 bodies remain single valid solids before saving to `build/pushrod-layout/`.

This candidate must pass contact, pushrod/socket and tube collision checks, followed by neighbouring-part and spring review, before it can be promoted. Export its own joint frames and audit those frames; do not apply the previous candidate's closed pose twice. The original dimensional master and released GLB remain unchanged during this study.

## Solid audit result

The saved candidate has 60 single valid solids, 60 unique stable IDs and 284 fully constrained sketches. Its extracted upper pushrod balls match socket centres within 2.1e-13 mm. These are numerical/model-consistency results, not manufacturing precision.

`scripts/solve_valve_contact.py --layout` evaluates the candidate using its own closed-pose frames. `data/pushrod-candidate-contact.json` records 58 sampled poses and **fails the overall sampled clearance gate**:

| Check | Intake | Exhaust |
|---|---|---|
| Minimum pushrod/tube solid distance | 0.3420 mm | 0.2871 mm |
| Maximum pushrod/tube intersection | 0 mm³ | 0 mm³ |
| Maximum pushrod/rocker intersection | 0 mm³ | 0 mm³ |
| Maximum valve/rocker intersection | 0 mm³ | 0 mm³ |
| Maximum rocker/housing intersection | 10.8110 mm³ | 11.6335 mm³ |

Contact residuals remain approximately 0.000001 mm. The line-based screening correctly predicted the tube margins, and the angular socket entry clears the moving rods. However, moving the rocker web/socket and regenerating the passages exposes a rocker-to-housing clash. The first sampled interference occurs at 0.5 mm intake lift and 0.25 mm exhaust lift. This is a remaining native housing/rocker swept-envelope issue, not a browser rendering defect.

The separate closed-assembly audit, `scripts/audit_candidate_interfaces.py`, passes all 20 listed pairs: relocated tube passages through the head/housing/cover/gasket, tube/seal interfaces, rocker/shaft fits and selected rod passages. Results are in `data/pushrod-candidate-interfaces.json`. This static result does not override the dynamic housing failure.

Next: locate the intersecting rocker/housing regions, review the reconstructed casting cavity and web envelope together, and repeat the full sampled audit after correction. Maintain separate evidence for unchanged manufacturer dimensions and revised reconstructed contours. Do not promote this candidate or mark valve-train motion complete.

## Spring reference prepared for the next audit

`data/valve-spring-reference.json` transcribes the visually checked spring-test table on PDF page 95, printed B-4 (March 1981), with separate new-part ranges and serviceable limits. The listed inner/outer test lengths are not installation dimensions. In particular, the current reconstructed 35 mm installed envelope would reduce to 28 mm at the illustrative 7 mm lift; neither that installed length nor that operating minimum follows from this table. Coil geometry, solid height, installed length and valve lift still need a consistent review before spring animation can claim realistic deformation.
