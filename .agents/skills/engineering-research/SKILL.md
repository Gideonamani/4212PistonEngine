---
name: engineering-research
description: Research the identity, variant, dimensions, construction and mechanisms of an engineering object before reconstructing it from images, text or mesh. Produce a claim-level evidence dossier and resolve conflicting references.
---

Establish the requested object, fidelity, variant and date before creating reconstruction geometry. Determine whether each photograph, drawing or scan depicts an original, restoration, replica or teaching illustration. A museum scan establishes exterior shape of the scanned object, not undocumented internal dimensions.

Research manufacturer manuals, museum archives, patents, engineering drawings and specialist monographs. Follow useful references beyond the first search result. Inspect figures where geometry matters; record printed page and PDF page separately. Check primary sources for essential dimensions, materials, mechanism arrangement and variant differences. Preserve conflicts rather than averaging incompatible values. Spend effort on unresolved facts that change the CAD feature plan.

Write a dossier alongside the spec with source URL/path, title, author/organization, revision/date, access date, locator, applicable variant, claim, confidence, and modelling consequence. Hash local source files. Separate documented claims from measurements and engineering assumptions. Unknown dimensions remain null until an explicitly labelled modelling estimate is chosen. Record the next source/measurement needed for each important gap.

Read the relevant technical exposition in full, including figure keys, cross-sections, parts photographs, appendices and discussion of conflicting sources. Follow references that can change geometry. Counting search results or collecting summaries is not a completion criterion. Do not begin with a familiar-looking assembly and add citations afterwards.

Before design, write a reviewed component inventory and mechanism plan. Every applicable exploded-view callout or parts-list item needs a disposition: modelled, simplified, deferred or outside the selected assembly. Include small parts that define operation: bearings/caps, seals, springs, followers, drives, adjusters, fasteners and galleries. Explain load, motion, air/fuel, exhaust, coolant, oil and electrical paths, with interfaces, assembly order, controls and manufacturing construction.

Use [references/research-readiness.md](references/research-readiness.md) for assembly reconstruction. Finish the review of identity, dimensional calibration, figure inspection, coverage, mechanisms, conflicts and high-impact unknowns before making the feature plan. The review can authorize a scoped teaching reconstruction while manufacturing dimensions remain unresolved; it cannot establish exact historical accuracy. Reopen research when source comparison or interface checks contradict the plan.

Use `cad_pipeline/spec.py` and its schema for the shared representation. The revised example is `cad-studies/wright-1903/revision-2/research.md`, with machine-readable inventory and a checked research gate. The first trial is retained as a record of an insufficient research pass.
