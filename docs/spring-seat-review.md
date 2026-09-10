# Spring-seat candidate review

The separate candidate passes the sampled native-solid audit in `data/spring-seat-audit.json`: 12 valid spring solids across 0, 3.5 and 7 mm lift, and zero intersecting volume for all 36 listed spring/head/guide/retainer interfaces. This is not a load, fatigue or complete valve-train certification.

The reconstructed installed spring length is 45 mm, compressed to 38 mm at the illustrative 7 mm lift. At full lift the outer axial pitch gap is 1.667 mm and the inner gap is 3.067 mm. The manual's spring test lengths are load-test conditions, not evidence for this installed length or the reconstructed wire/turn dimensions. See `data/valve-spring-reference.json` for the source transcription.

Moving the seat to station 65 mm initially caused spring/head interference. The revised head uses two native PartDesign Boolean cuts with cylindrical construction tools, radius 18.5 mm and depth 53 mm, aligned to the valve axes. The guide support below the seat floor remains. The 60 model part IDs remain intact; the two construction bodies carry `ConstructionOnly=True` and are excluded from model exports.

Sketch pockets and direct subtractive primitives produced invalid head shapes in this study; the failure and diagnosis reports are retained. Separate additive-cylinder tool bodies followed by native Boolean Cut operations produced valid single-solid geometry. No general kernel cause is claimed.

Candidate: `build/spring-seat/GTSIO520_Spring_Seat_Candidate.FCStd`, SHA-256 `050ff5444c8115abfeaf2bcb34e9a7b6b1bab07ab604f7aa3e16aa6c91bbb2de`. The original dimensional master and published Drive asset are unchanged. Next gates are complete mechanism integration, visual inspection, and a versioned release with rollback before promotion.
