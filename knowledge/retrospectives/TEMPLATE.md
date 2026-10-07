# Retrospective: <study>, <date>

Copy this file to `YYYY-MM-DD-<study>.md` when a study finishes (or at a review, for a stretch of work). Keep it short. The point is the
last two sections: what to promote into the three stores, and what number changed.

## What was built

One paragraph: the object, the scope, the fidelity, and what was explicitly left out.

## Numbers

Add a row to `knowledge/metrics.csv` and say here what moved against the previous row (reuse ratio, late conflicts, rung 9 residual,
dimensions by status). Leave a cell blank when the record does not give it; do not estimate it.

## What went wrong, in the order we met it

For each: the symptom, the cause, the stage where it should have been caught (research gate, spec, build, audit, review), and the rule that
would have caught it.

## Promote

| Store | Item | Why it earns a place |
|---|---|---|
| Recipe | A part built a second time across studies, now generalised | |
| Part card | New family, variant or instance (every claim with evidence or a basis) | |
| Prior | A rule of thumb confirmed against a source (candidate to sourced), or retired | |
| Skill rule | A mistake turned into an instruction in `.agents/skills/` | |
| Pattern | A mechanism arrangement worth naming (`knowledge/patterns/`) | |

## Next study

What we would do first, and what we now expect to reuse.
