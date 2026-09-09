# From a manual to a modelled and animated teaching module

This is a proposed repeatable procedure, not a claim that a manual contains every manufacturing dimension or operating parameter needed for a full digital replica.

| Step | Work | Output / exit check |
|---|---|---|
| 1. Establish applicability | Record title, publisher, document number, revision, model/serial applicability, supplements and local file hash. | Source register identifies exactly which engine configuration is being represented. |
| 2. Map the manual | Read contents, descriptions, exploded views, legends, limits, lubrication diagrams and operational data. Render and inspect relevant figures. | Page/figure index and subsystem inventory. |
| 3. Build the component tree | Identify assemblies, part families, repeated instances and alternate configurations. Separate an illustration item number from a manufacturer part number. | Candidate bill of materials with stable IDs and explicit unknowns. |
| 4. Extract claims | Record each dimension, range, tolerance, count, material, function, interface and timing claim with its units and source location. | Evidence ledger; no unreferenced numerical claims silently promoted to facts. |
| 5. Reconcile evidence | Compare figure and text, check revisions and variants, distinguish nominal size from finished fits and service limits. Inspect ambiguous typography visually. | Contradictions and missing data become review items. |
| 6. Define model scope | Select learning outcomes and required fidelity. Identify which features affect fits/operation and which are cosmetic. | Modelling and animation backlog with priorities. |
| 7. Define interfaces | Specify module origins, mating planes, shaft/valve axes, bolt patterns, gear ratios, cylinder stations and fluid ports. | Interface register that permits independent modules to assemble. |
| 8. Model in CAD | Use constrained geometry and shared parameters. Attach evidence to dimensions and document reconstructed contours. | Recomputable native CAD; component IDs and datums retained. |
| 9. Check geometry | Test units, counts, solid validity, dimensional values, critical clearances and selected poses. | Checks state both what passed and what remains unchecked. |
| 10. Define operation | Record rotating/sliding joints, phase relationships, speeds and valve/ignition events. Separate actual profiles from illustrative ones. | Versioned operation profile with assumptions and references. |
| 11. Author in Blender | Refresh geometry; apply materials and rigs using exported axes. Create inspection and teaching views. | Animation/camera review; no silent dimensional remodeling in Blender. |
| 12. Export and verify | Bake supported animation, export GLB and metadata, test IDs/scales/axes/poses in the browser. | Student interactions and source labels survive the export. |
| 13. Integrate and release | Check module connections against the cumulative engine. Publish a coherent asset/catalogue revision. | Release manifest, review notes and next refinement tasks. |

AI extraction is a draft. Verify critical numbers against the actual page image, particularly tolerances, angles, decimal points and similar-looking rows. A diagram can establish flow order without proving the precise shape or drilling route of a passage.

## Evidence categories

- **Documented:** explicitly stated value or construction fact, with applicable source.
- **Derived:** calculated from documented inputs, with formula and units.
- **Measured:** obtained from an identified physical sample or calibrated measurement method.
- **Reconstructed:** estimated shape/placement needed to complete the teaching model.
- **Illustrative:** chosen to communicate a concept, not claimed to reproduce measured physical behaviour.
- **Unresolved:** missing, conflicting or ambiguous evidence.

Track validation separately, for example: solid-valid, dimension-checked, selected-clearance-checked, kinematics-checked, or not checked. Avoid a single confidence percentage that hides these distinctions.

## Minimum claim record

Record the claim ID, applicable engine/variant, component IDs, property, source value/range and units, adopted model value, selection/derivation rule, document/page/figure/table, evidence category, reviewer/date, uncertainty and dependent modules.

For example, the documented finished bore range of 5.251–5.253 inches and our selected midpoint of 5.252 inches are two related facts. The midpoint converts to 133.4008 mm; it must not be presented as the only value printed in the manual. Likewise, the current 7 mm animation lift belongs to an illustrative operation profile, not the manual's dimensional specification.

When a source changes, identify all claims that cite it, then rebuild/review the affected parameters, geometry, rigs, explanatory text and lessons. Keep the previous release available until the updated set passes its checks.
