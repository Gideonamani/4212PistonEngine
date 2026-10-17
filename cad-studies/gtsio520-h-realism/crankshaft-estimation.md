# Calculated estimates and the revision-4 crankshaft rebuild

8 October 2026. The user authorizes calculated estimates rather than deferring the crankshaft until every manufacturing dimension is available. This revision uses the source's construction and known diameters as anchors, then chooses explicit ratios and checks their geometric consequences. A calculated estimate remains an estimate: a selected coefficient is not a measured manufacturer value.

## Anchors and estimating rules

X-30045A Table 6, B-12/PDF103, gives main-journal diameter 2.6240-2.6250 in, crankpin diameter 2.2490-2.2500 in and damper-bushing ID 0.7540-0.7560 in. The selected midpoints are 66.6623, 57.1373 and 19.1770 mm. H stroke remains 101.6 mm. A-3-1/2 describes the machined steel forging, nitrided bearing surfaces, internal quill spline and projecting damper blades; A-10-3/PDF70 confirms hardened bushings in both blades and weights. A-4-20/PDF38 and A-4-30/PDF43 establish the visible features and fork/blade relationship.

`gtsio_crankshaft_estimates.py` owns the rules; `crankshaft-estimates.json` retains all formulae, selected values and rationale. Native `Parameters` stores the same dependencies. Small displayed values below are rounded for reading, not manufacturing tolerances.

| Feature | Calculated selection | Why it is bounded this way |
|---|---|---|
| Main land margin | 0.06 x main radius = **2.00 mm** | Selected forging allowance around the documented journal; sensitivity interval 4-8% |
| Pin land margin | 0.10 x pin radius = **2.86 mm** | Selected material around the pin; sensitivity interval 7-13% |
| Main root radius | 0.75 x main margin = **1.50 mm** | Fits inside the selected support land |
| Pin root radius | 0.60 x pin margin = **1.71 mm** | Fits inside the support margin and the estimated 2.2 mm liner wall |
| Blade thickness | 0.60 x cheek width = **8.40 mm**, centred in **14 mm** | Provides thinner support and space on both sides for the eventual fork; selected ratio interval 0.50-0.65 |
| Bushing wall / bare host bore | 0.08 x documented bushing ID = **1.53 mm** wall; host diameter **22.25 mm** | Separates known finished ID from estimated OD/host size; final press-fit remains unknown |
| Hole pitch / edge ligament | 2.1 x host diameter = **46.72 mm** pitch; 0.25 x host diameter = **5.56 mm** ligament | Blade width and tip derive from the bore envelope and retained wall rather than separate guesses |
| Blade envelope | **80.08 mm** wide; radial bore row **44.77 mm**; tip **61.46 mm** | Coupled to middle-web radius, host bore, pitch and selected ligament |
| Taper scale | 0.15 x cheek width = **2.10 mm** | Slight inclined faces, now placed wholly inside the nominal cheek stations |
| Liner edge relief | root radius - half rod side gap + 0.05 = **1.66 mm**, 45 degrees | Clears the added concave root blend while retaining an outer rim and central bearing land |
| Visible pin-end recess | radius 0.16 x pin diameter = **9.14 mm**; blind depth 0.25 x cheek width = **3.50 mm** | Conservative representation of circular features; preserves a closed floor and avoids inventing internal oil routes |

The ratio intervals are chosen sensitivity bounds, not statistical confidence or service limits. No load, fatigue, balance or torsional-damper tuning calculation is claimed. Damper hardware is still separate unfinished geometry. Initial main/pin/cheek axial widths remain 44/30/14 mm, approximately 0.66 main diameter, 0.525 pin diameter and 0.245 pin diameter; existing cylinder/bearing stations are retained until better axial calibration is available.

## Geometry rebuilt

The forging is regenerated with updated support/end profiles and blade geometry, twelve estimated blind pin-end recesses, twelve crankpin root blends and six main-journal root blends. The inclined web sections now start at zero inset at the far main-land extremity. Their expression uses the full projected span; no negative inset protrudes into a main-journal station. Full-depth circular lands preserve the journal/pin interfaces. The resulting per-face angle is about **0.70 degrees**, an explicit estimate rather than a traced manufacturing angle.

Adding fillets is an interface change. Both edges of each of the twelve split liners receive calculated conical relief; the actual rod/cap bore seats and source side-clearance midpoint remain intact. The central full-size pin land is about **26.57 mm** long between blends. This geometry is checked in the complete 103-part core, not only in a shaft-only render.

The visible circular features are implemented as twelve blind pockets on the exposed ends of the pin-support cheeks. Their purpose and hidden topology are uncertain. This is an authorized modelling approximation, with measured closed floors; it is not labelled a verified oil-drilling diagram or an authenticated hollow crankpin.

## Method adopted and learning

The existing Part::Fillet can store editable radius tuples, but an attempted expression on its complex `Edges` property did not propagate and made the feature invalid. The failed probe is retained locally. A **PartDesign Body linked through BaseFeature to the Part Boolean history**, followed by native PartDesign::Fillet, supports a scalar Radius expression. The saved fixture responds to both radius and upstream cylinder changes. The production forging uses that linked bridge and two radius-driven fillet features, with geometric circle selection and complete arc coverage checks at generation. It is not claimed to be a sketch-only PartDesign construction.

Derived controller expressions are checked for numerical consistency and dependency cycles. Native radius/taper/primitive controls respond inside the document; complete contour or station changes still regenerate from the authoritative spec because derived prism profiles are stored shapes. The primitive-history updater explicitly refuses these dressups and requires full regeneration.

The first land-volume probe incorrectly included the legitimate rear gear screw bores, reporting missing internal material. The corrected independent check measures a stated 0.25 mm outer annular band at each main-bearing land, preserving the original numerical tolerance. Root torus dimensions, full-size pin lands, bore/recess surfaces and closed floors are measured separately. Changing the main root radius in an unsaved reopened document tests actual native propagation, then restores the original expression and geometry.

## Review and remaining work

The locked comparison retains the same camera, crop, landmarks and uniform registration as R3. New features do not change the held-out axial datum residual; exact shaft length/stations, cheek proportions, quill spline dimensions/count, damper-fork fit and hidden drilling remain uncertain. Compare the source, R3 and R4 visibly, and use saved surface measurements to establish shallow curvature/taper that shading alone may conceal.

Native/STEP, source dimensions, regeneration, direct/native agreement, all bound-meeting CAD pairs and the actual static exported GLB have separate validation records. `crankshaft-checks.json` records the rebuilt feature measurements; `visible-feature-checks.json` records blade thickness and taper. No operating clip or whole-engine completion is inferred from these static checks. Original R3 files and records remain under `build/gtsio520-realism-r3/`; this candidate is under `build/gtsio520-realism-r4/`.
