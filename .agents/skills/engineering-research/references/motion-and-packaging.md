# Motion and packaging research

A parts inventory says what exists. A model that must *operate* also needs what drives what, by how much and when, and where each part
sits relative to its neighbours. The Wright revision-2 research had the inventory but not these, so its animation needed invented timing
and its layout hid conflicts that only the interference audit found (an ignition shaft and sleeve running through the first valve cage).
Gather both while reading the sources, before the feature plan.

## 1. Purpose

Write one sentence per mechanism: what a student should see move and why (for example: "the crank turns, the pistons slide, one cam turns
at half speed and lifts the exhaust valve"). Everything below is researched to that purpose; nothing else needs motion.

## 2. Motion dossier (one row per driven quantity)

| Quantity | Driver | Value or law | Unit | Locator | Status | Conflicts or notes |
|---|---|---|---|---|---|---|

- **Status** is one of `documented` (a source states it), `derived` (computed from documented values: a chain ratio from tooth counts, a
  rod swing from stroke and rod length), `illustrative` (a teaching choice because the sources do not give it). Never promote a value:
  an unresolved cam law, phase or firing order stays `illustrative` and is labelled so in the contract and the interface.
- Cover every transmission (ratio and direction), every converting mechanism (stroke, lift, angle), every follower (what surface it
  rides), every timing event (phase window, with the reference angle), every spring (free length, compressed length, what compresses it)
  and every part that is deliberately not animated, with the reason.
- Record conflicts between source sets with locators and say which one the model follows. Preserve both values.
- Check the table for self-consistency before design: pitch times tooth count against pitch radius, ratios against speeds, lift against
  lobe size, a stroke against crank throw. A table that does not close is a research gap, not a modelling detail.

## 3. Cause-and-effect chains

Write the chains the animation must show, driver to final effect, for example crank, chain, cam shaft, exhaust cam, rocker, valve and
spring; or crank, spur pair, ignition shaft, strip cam, trip lever, igniter lever, contact. Each link names the surface or joint that
transmits the motion. A link with no source is a gap to resolve or to label illustrative.

## 4. Packaging record

| Part or axis | Position (datum, units) | Must clear | Must meet | Locator | Status |
|---|---|---|---|---|---|

- Positions of every shaft axis and pivot in one coordinate frame, from the sources or derived, with the datum named.
- The envelope each moving part sweeps (a lever's arc, a sleeve's slide, a rod's swing) and the neighbours that envelope must clear. If
  two sources put two parts in the same space, record it now; do not leave it for the audit to find.
- Which parts sit in holes, grooves or pockets of others (these become seats) and which are rigid with each other (these become one
  rigid body). Fasteners and connectors are guests of the part they pass through, never hosts.

## 5. Output

Add the dossier and the packaging record to the research dossier, hash-linked to the inventory. The component inventory's mechanism paths
should name the dossier rows they depend on. The readiness review (research-readiness.md, items 8 and 9) is complete when every
driven quantity has a status, every conflict has a decision, and the packaging record has no unexplained shared space.
