# Closure checks and global constraints

An engine study states figures in several places: the bore and stroke in the part spec, the displacement the manual prints, the firing order in the layout, the viewer's motion code and the manual, the tooth counts of the gears and the speed ratios the manual lists, the rated power and the model's mass. When they disagree, the study is wrong somewhere, and a person reading the model rarely notices. The closure checks put those statements side by side and fail when they do not close. This is the kind of check that found the Langley oil cup weighing 2.4 kg against 0.1 kg in Manly's table.

The framework is data plus one runner. Each study has a `constraints.json` (shape in `cad_pipeline/schemas/constraints.schema.json`); `cad_pipeline/constraints.py` evaluates it using only the standard library, so CI, FreeCAD's Python and Blender's Python can all run it; `scripts/check_constraints.py` is the command line. The tests are `scripts/test_constraints.py`.

```powershell
python scripts/check_constraints.py --all                    # every cad-studies/*/constraints.json; exit 1 on a failure
python scripts/check_constraints.py --all --quiet           # only what is not passing
python scripts/check_constraints.py cad-studies/langley-manly-balzer-1903/constraints.json --volumes build/dev/out358/geometry.json
python scripts/check_constraints.py cad-studies/gtsio520-h-static/constraints.json --json build/constraints-gtsio.json
python scripts/test_constraints.py
```

## The four states

| State | Meaning | Fails the run |
|---|---|---|
| `pass` | The computed figure is within the stated tolerance of the published one. | no |
| `fail` | It is not, or an input the check must read from the repository (a file, a module, a source line it relied on) no longer resolves. | yes |
| `accepted` | It fails, and the check carries an `accepted` record with a reason. Reported every run. If the check later passes, the stale record fails the run so it is removed (the same ratchet as `interference-policy.json`). | no |
| `unknown` | It cannot be evaluated: the source states no figure, the model-side input is not in Git, or a check it `requires` did not pass. The reason is printed and nothing is invented. | no (`--strict-unknown` makes it fail) |

`unknown` is a legal answer, not a gap in the framework. A figure that could not be read from a source stays `unknown` with a note. A check marked `unknown` can still set `evaluate: true` to compute and show the model's figure without judging it.

A binding marked `optional` (a build output that Git does not hold) gives `unknown` when it is missing; any other binding that stops resolving gives `fail`, because a moved file or a changed source line is drift.

## What a file contains

- `sources`: the documents the published figures come from (title, path or hash, pages). `repo` is always available for a model-side locator.
- `bindings`: named values read from the repository, each with a `locator` (the file and line or the field it is read from). Three kinds: `json` (a path such as `a/b[name=x]/c`), `regex` (a pattern over a JavaScript or Python file, so the viewer's motion code can be read without running it) and `python` (import a module, read an attribute, optionally call it with `args` or over a `foreach` list; this is how the gear solvers in `scripts/accessory_gears.py` are read, so no ratio is typed into a check).
- `checks`: each has an `id`, a `kind`, a `title`, a `source` locator (source, page and item, how it was verified) and a tolerance (`abs` in the figure's unit, `rel` as a fraction; the larger applies) unless it is `unknown`. A check may list `requires` (check ids that must pass first) and `anchors` (source lines a typed literal was read from; if one stops matching, the check fails rather than quietly checking a stale number).

Expressions use a small safe evaluator: arithmetic, comparisons and a short list of functions (`sqrt`, trigonometry, `mean`, `col`, `flat`, `shift`, `maxdiff`, `allclose`, `sign`). No attributes, imports or comprehensions.

## Check kinds

| Kind | What it closes |
|---|---|
| `compare` | One model figure against one published figure, within a tolerance, in compatible units. |
| `displacement` | Cylinders x pi/4 x bore^2 x stroke against the stated displacement. |
| `power` | PLANK: hp = P L A N K / 33000 with N = rpm / (strokes / 2). Given a pressure it checks the stated power; with `solve: pressure` it reports the pressure the stated power implies and compares it with an expected band. |
| `ratio` | A drive's speed ratio, from the model's gear solver, against the published ratio and its direction (with or against the crank). Camshaft at half crank speed is one of these. |
| `formula` | Any relation over bindings, for example a cam at a quarter of crank speed giving one valve event per 720 degrees. |
| `sequence` | An ordered list in the model (a firing order read from code) against the published order. |
| `firing-intervals` | Events at even intervals (720 / cylinders for a four-stroke) and in the published order. Takes `phase_order` for a model that lists the order separately from the phases. |
| `tdc` | From each cylinder's crank pin and bank direction, the crank angle at which it reaches top centre must equal the angle at which the firing order has it fire. This ties the order, the pin angles, the bank sides and the rotation direction together. |
| `numbering` | Cylinders are numbered from the stated end and odd numbers are on the stated side, derived from the model's coordinates and a declared frame. |
| `rotation` | The model's crank direction against the direction implied by a published rotation through a chain of gear links (rigid or external mesh). |
| `mass` | Part volume x density summed by group, against a published weight per group (or an upper bound). Volumes come from the build output (`--volumes`) or from a recorded run (`mass-check.json`). |

## Adding a study

1. Create `cad-studies/<study>/constraints.json` with `"schema": "constraints/1"`.
2. List the sources, with a page or figure for every published figure. Read it from the page image if the text is OCR.
3. Bind what the model states, reading it from the code or data that builds the model. Do not type a model figure into a check.
4. Add the checks. A figure you cannot read is `unknown` with the reason.
5. Run `python scripts/check_constraints.py cad-studies/<study>/constraints.json`; add a test to `scripts/test_constraints.py` that pins the states that matter (the tests already pin GTSIO's `unknown` set and its accepted numbering record).

`--all` picks the file up automatically and the CI checks job runs it.

## The Langley study

`cad-studies/langley-manly-balzer-1903/constraints.json` runs displacement (540.2 cubic inches printed against 539.96 from five cylinders of 5 in bore and 5.5 in stroke), the PLANK pressure (80.9 psi implied by 52.4 hp at 950 rpm against Manly's 75 to 85), the ring cam at a quarter of crank speed in reverse, the firing order 1-3-5-2-4 and its 144-degree intervals, and Manly's fifteen-line weight table. `scripts/langley_mass_check.py` now reads the weight lines from that file and is a thin wrapper over the runner; `scripts/test_constraints.py` freezes the old script's lines, density table and arithmetic and proves the wrapper gives the same figures for the same volumes. The five mass lines over 15 percent (W01, W02, W05, W07, W11) are `accepted` with their reasons from `build-notes.md` and a ratchet that fails if a line gets worse.

## The GTSIO-520-H study

`cad-studies/gtsio520-h-static/constraints.json` reads every figure from the user's own copy of the GTSIO-520 Series Overhaul Manual (X-30045A) on 19 October 2026, from the page images and not only the OCR text. The IO-520 manual is a related engine and is not used as evidence.

It passes the displacement (520 cubic inches from 5.25 in bore, 4.00 in stroke, six cylinders), the propeller reduction (2275 propeller rpm through 0.667:1 is 3410.8 engine rpm, inside the printed 3375 to 3425 band), the camshaft at half crank speed, the printed ratios of the propeller, magneto, governor, tachometer and alternator drives (computed from the tooth counts declared in `scripts/accessory_gears.py`), the spec's bore, stroke and rod length, and the firing order and intervals in the Python layout and in the viewer's motion code.

**The R10 motion against the manual (the worked first check).**

- **Firing order and top centre: consistent.** Both the Python layout and `src/viewer/core/animated-study-motion.mjs` use 1-4-5-2-3-6 with a 120-degree step, and each cylinder reaches top centre, from its crank pin and bank angle, at the crank angle where the order has it fire. The crank pins of the spec equal the pins of the motion, and crankpin k sits at cylinder k's station.
- **Numbering from the rear: consistent.**
- **Bank side: fixed on 20 October 2026.** The manual (section 1-7 and Figure A-4-1) puts Nos. 1, 3 and 5 on the right looking forward from the accessory end, and the user saw the alternator on the wrong side. The frozen CAD build had the odd cylinders toward +X, which in a right-handed frame with +Z forward and +Y up is the left side, so the R10 export is now the reflection x -> -x of that build (`cad_pipeline/gtsio_layout.py` `EXPORT_MIRROR_X`, [r10-handedness.md](r10-handedness.md)). The check `numbering-bank-side` passes with its `accepted` record removed (a stale record fails CI), and two new checks prove the pads: relative to the banks (alternator on the odd-cylinder side, governor and left magneto on the even side) and absolute (alternator and right magneto at -X, governor and left magneto at +X). The firing order is unchanged by a reflection, so the closure above still holds: `motion-pins-match-spec-crank` compares the spec's crank pins (the CAD frame) with the motion's after reflecting them (`maxsum`), and `tdc-vs-crank-pins` reads the motion's own pins.
- **Absolute crank direction: derived, not stated.** The manual does not state the crankshaft rotation. The propeller line ("Clockwise looking forward", through one external gear mesh) makes the crank counterclockwise looking forward, which the reflected model now does (the pin angle falls as the crank angle rises). `crank-rotation-direction` passes against that derivation. The pad-rotation labels cannot confirm it: they come in two self-consistent sets that differ only in a viewpoint the sources do not define (`pad-rotation-labels-need-a-viewpoint`, `unknown`). The -H operator's handbook X-30129 (not held), or turning the propeller of a real engine by hand and watching the magneto drive coupling from behind (it should turn counterclockwise), settles it. The sides of the starter, the fuel-pump drive and the tachometer pad follow the reflection only (`pad-sides-inferred-from-the-mirror`, `unknown`, figures shown).

Still `unknown` with a reason: the power check (the manual states no mean effective pressure; 375 hp at 3400 rpm implies 168.1 psi, which is reported and not judged), the vacuum pump drive (the model's 32/20 pair is declared an estimate, never a ratio claim), the starter drive (the worm and motor stages are not declared), and the compression ratio (the chamber volume is not in Git).

**What the mass-by-group check could not use.** The manual publishes one weight, the standard engine dry weight, and no group weights, so a group comparison has nothing to compare with. The R10 per-part volumes are build output (the geometry output of a CAD run), not committed, so even the one published total is `unknown` in CI. Run with `--volumes` on a machine that has the build to get an upper-bound check (the modelled parts should weigh no more than the published weight of the complete engine with its accessories). The group check stays `unknown` until a source with a breakdown is found, such as measured parts.
