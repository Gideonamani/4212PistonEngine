# Research readiness for reconstruction

Choose depth according to fidelity and complexity. For a historical engine, a source-led component and mechanism review precedes the feature plan.

1. **Identity:** Name the target configuration and source lineage. Distinguish original, rebuilt and replica evidence. State which conflicting account governs each affected subsystem.
2. **Understanding:** Explain operation and construction. Trace load, motion, air/fuel, exhaust, coolant, lubricant and electrical paths. Identify controls and physical interfaces.
3. **Evidence:** Read applicable technical chapters and inspect full-resolution figures, section views, legends and appendices. Seek original records/drawings where later summaries conflict. Record unavailable evidence and attempted access without claiming inspection.
4. **Coverage:** Map applicable parts lists/figure callouts into an inventory. Include mechanism-defining small parts. Each item has locators, function, interfaces, planned geometry and a reasoned disposition. Omission is not resolved by recognizability of the main parts.
5. **Dimensions:** Distinguish documented values, calibrated measurements, drawing-ratio estimates and engineering choices. Record units, datums, transforms, uncertainty and tolerances. An illustrative cross-section supports construction more strongly than manufacturing dimensions. Global bounds containing hoses/accessories cannot calibrate an engine body.
6. **Decision:** Record why evidence supports the deliverable, resolved high-impact issues and remaining gaps. Stop dependent modelling when an unresolved issue changes fundamental arrangement; independent work can continue. Neither a fixed duration nor a source count substitutes for this review.
7. **Validation:** Define source-shape, coverage, dimensional, interface and regeneration checks before generation. Compare the result against the same figures and measured regions. Report validation categories separately.
8. **Motion:** For anything that must operate in the model, complete the motion dossier in [motion-and-packaging.md](motion-and-packaging.md): drivers, ratios, strokes, lifts, phases and followers, each marked documented, derived or illustrative with a locator. Record source conflicts and the decision. Unresolved timing stays illustrative and is labelled.
9. **Packaging:** Record shaft and pivot positions in one frame, the envelope each moving part sweeps, what must clear and what sits in a hole, groove or pocket. Two sources placing parts in the same space are resolved here, not by the interference audit.

`cad_pipeline/research_gate.py` checks inventory references, explicit decisions, mechanism paths and their mapping to parts. It catches missing bookkeeping; the agent still has to read sources and exercise engineering judgement. Passing is not a certificate of authenticity.
