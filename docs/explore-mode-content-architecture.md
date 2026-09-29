# Explore-mode content architecture

Status: proposed and evolving. Captures instructor discussion, 20 September 2026. Covers Explore's own content model — the model gallery and the group/component tree inside each model — as distinct from lesson/check content ([lesson-and-assessment-architecture.md](lesson-and-assessment-architecture.md)) and from CAD/geometry contracts ([engine-platform-architecture.md](engine-platform-architecture.md)).

## Relationship to the model registry

Explore's "which model am I looking at" concept and the lesson schema's model registry ([lesson-and-assessment-architecture.md](lesson-and-assessment-architecture.md), v3) are the same underlying registry, entered two different ways:

- **Explore** browses the registry directly — a gallery of separate model loads (engines, subsystems, assemblies), confirmed as the permanent shape rather than one continuous zoom from whole-engine down to one cylinder. Switching models in Explore is a full model load between entries in `src/data/models.json`.
- **Learn** references specific registry entries from inside a lesson step (`modelId` on a `model-pose` step).

Both consume the same adapter capabilities. Explore decides which panels to show from the `ViewerFeatures` returned by the loaded adapter, exactly as the lesson doc's "Explore-mode implication" note describes.

**Implementation status (29 Sep 2026):** the registry has three entries and three adapter types. Capability gating is live: the Wright static-reference adapter returns hotspots only, while the operating models return their component, motion, section and appearance features. The React viewer renders only the returned controls. Registry data lives in `src/data/models.json`; types and lookups live in `src/data/modelRegistry.ts`.

## Component/group hierarchy: arbitrary-depth tree

Confirmed: not a fixed two-level Group → Component structure. Groups can nest to whatever depth a given model's subassemblies actually need, so a group can itself contain child groups as well as components — e.g. a whole-engine model could have `Cylinder bank (left)` → `Cylinder 1` → `Valve train` → individual valve/rocker/pushrod components, however many levels that takes.

Proposed shape — one node type, not two:

```
Node {
  id: string            // stable, same identity discipline as today's component IDs
  label: string
  kind: "group" | "component"
  children?: Node[]     // present on "group" nodes, absent/empty on "component" leaves
  // component-only fields, present when kind === "component":
  function?: string
  material?: string
  evidenceStatus?: EvidenceStatus
  reviewStatus?: ReviewStatus
}
```

A single node type (rather than separate Group and Component types) is what makes isolate-by-group and isolate-by-component the same operation underneath — see below.

## Isolate: component or group, not multi-select

Confirmed: isolate targets exactly one node, and that node can be either a leaf (single component) or a branch (a group, isolating everything under it). Not arbitrary multi-select across unrelated components. This maps directly onto the unified node shape above — `isolate(nodeId)` behaves the same regardless of whether `nodeId` resolves to a group or a component; the only difference is how many meshes end up visible.

## Evidence status and review status: two separate fields

Confirmed as two distinct pieces of data per component, not one field shown two ways:

- **Evidence status** — how the geometry itself is known. Proposed values, grounded in the project's existing vocabulary (README's "Meaning of realistic" section, `data/evidence-examples.json`): `documented` (directly sourced from a manual/drawing), `cad-checked` (a selected/derived modelling value verified against CAD), `reconstructed` (contour or feature inferred, not directly sourced), `illustrative` (a teaching approximation, not an engineering claim).
- **Review status** — whether an instructor has actually checked this specific claim. Proposed values: `unreviewed`, `reviewed`, `disputed`.

A component's evidence status doesn't change when its review status changes, and vice versa — a `documented` claim can still be `unreviewed`, and a `reconstructed` claim can be `reviewed` and accepted as the best available approximation. Exact value sets to be cross-checked against `data/evidence-examples.json` when this becomes code, not just this doc.

## Section view: global for now

Confirmed as a deliberate simplification: the section cut applies to the whole assembly regardless of what's isolated, not scoped to the current isolation. The user explicitly flagged this as something to revisit later (e.g. a section that respects isolation bounds, or a group-scoped cut), so treat it as a starting default, not a permanent constraint on the schema — the node tree above doesn't need to prevent a future isolation-aware section, it just doesn't need to support one yet.

## Decisions log

- **20 Sep 2026** — Model gallery confirmed as separate model loads (engines/subsystems/assemblies), not one continuous zoom. Same registry Learn's `model-pose` steps reference.
- **20 Sep 2026** — Component hierarchy is an arbitrary-depth tree (groups may contain groups), not fixed at two levels. One node type covers both group and component.
- **20 Sep 2026** — Evidence status and review status are two independent fields per component.
- **20 Sep 2026** — Isolate targets one node, which may be a component or a group; not multi-select.
- **20 Sep 2026** — Section view stays global regardless of isolation state, as a simplicity default explicitly open to revision later.

## Open questions

- Exact `EvidenceStatus`/`ReviewStatus` value sets once cross-checked against `data/evidence-examples.json`. Cross-checked 21 Sep 2026 while implementing the schema: `data/evidence-examples.json` is a claims ledger for specific CAD dimensional decisions (per-claim, free-text `evidence_category`), not a per-component tag set, so it doesn't hand back a different enum — the proposed `documented`/`cad-checked`/`reconstructed`/`illustrative` values are what's implemented in `web/schema/content-schema.mjs`, still without a real per-component audit behind them (see below).
- Whether group nodes need their own evidence/review status (e.g. "this subassembly's mating interfaces are reconstructed") or only leaf components carry that data. Implemented per this doc's own Node sketch: component-only, for now.
- How deep nesting interacts with the existing six teaching groups (cylinder structure, piston/rings/pin, crank/connecting rod, intake valve train, exhaust valve train, spark plugs) — are those the top level of the tree for the cylinder model, or a separate flat filter that coexists with the deeper tree? Resolved pragmatically for the proof of concept: `web/component-tree.json` (built by `scripts/build_component_tree.mjs` from `web/components.json`) makes these six groups the tree's top level. The current cylinder adapter exposes the equivalent grouping in the React component picker; arbitrary-depth navigation remains future work.
- Still open: no component in `web/components.json` has a real per-component `evidenceStatus`/`reviewStatus` today (every part carries the same placeholder text), so `web/component-tree.json` leaves those fields unset rather than fabricating values — populating them needs an actual per-component evidence/review pass, not a schema decision.
- Resolved 29 Sep 2026: the Wright entry is the minimal reference model — sources, attribution, view presets and hotspots, using the `static-gltf` adapter with no operating controls.
