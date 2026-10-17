# Reason from the design, then test the interpretation

Scale the depth to the object and ambiguity. A fully dimensioned simple part may need only a few sentences; an engine mechanism needs its mating sections and motion/load paths understood before geometry choices.

Ask what the pictured features are doing. Which surfaces carry bearing loads or locate parts? Which belong to a forging, a machined seat or separate hardware? What must slide, turn, straddle, seat or clear? How can the assembly be installed and serviced? A section often resolves these questions better than a more attractive exterior photograph.

Keep four levels distinct:

| Level | Example | Consequence |
|---|---|---|
| Observed / documented | Section shows a forked counterweight around a central blade; text describes oscillation on pins | Preserve separate parts and that mating topology |
| Engineering deduction | Fork slot must accommodate blade plus axial clearance; blade is thinner than the load-bearing cheek | Record inequalities and interface checks |
| Modelling estimate | Choose an 8 mm blade in a 14 mm estimated cheek | Label the number inferred; actual slot dimensions remain unknown |
| Unresolved | Exact slot width, pin/bushing clearance, taper angle or fillet radius absent | Obtain dimensions or retain an explicitly limited teaching approximation |

A deduction can be strongly supported without establishing an exact size. Do not label assumed tolerances as manufacturer values or claim load capacity from appearance.

Use a hypothesis record when an interpretation drives geometry:

- **Observation / locator:** what the image, section or text actually shows.
- **Interpretation / rationale:** mechanical purpose, manufacturing/assembly explanation and alternatives.
- **Expected relationship:** dimensions, relative thickness, permitted motion or mating topology.
- **Geometry consequence:** native feature, datums and parameters; why this primitive expresses the design.
- **Test:** actual saved geometry, interface clearance, regeneration, motion or comparable-view evidence that could falsify the interpretation.
- **Result / learning:** what changed, whether the test supported it, what still disagrees and what evidence is needed next.

For crank cheeks, a uniform extrusion may reproduce a 2D outline while losing inclined axial faces. A ruled loft between tilted sections can express varying thickness; full-depth support/contact lands preserve pin/journal connections and rod side clearance. Verify those interfaces rather than smoothing the whole forging indiscriminately. This is a geometric/assembly hypothesis, not a strength analysis or a claim that every crankshaft uses the same taper.

After comparison, explain the discrepancy's cause, not only its location. If a surface still looks wrong, determine whether the evidence was misread, the selected CAD operation could not express it, the camera obscures it or a required dimension remains unknown. Preserve failed hypotheses and the source that corrected them. The reusable lesson is the reasoning process and constraint, not an unverified numerical template.
