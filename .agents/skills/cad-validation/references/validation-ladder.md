# Validation ladder for a mechanism model

Each rung answers a different question and fails differently. Report them separately; passing a lower rung says nothing about a higher one.
Rungs 1 to 5 can run on the fast evaluator's output while designing; the release repeats them on the saved CAD and the exported file.

| # | Question | How | Wright revision 2 |
|---|---|---|---|
| 1 | Is the specification sound and does the research cover it? | `spec.validate_spec`, `research_gate.py` | inventory 58 components, every callout dispositioned |
| 2 | Is every part one valid positive-volume solid, with parameters that regenerate? | `generate.py` (validates after the final recompute), `verify.py`, change a controlling parameter in a disposable reopened copy | 413 parts; saved shapes equal the report volumes to 1e-6 |
| 3 | Do the research-derived facts hold in the CAD? | `audit_wright_v2.py` (probe points computed from spec parameters, away from interfaces) | 109 checks |
| 4 | Does any part share space with another at the assembled pose? | `scripts/audit_assembly_interference.py` on the exported GLB, every pair whose bounds meet | 1,121 pairs, all touching only |
| 5 | Does any part share space while it moves, as a viewer will show it? | the same audit on the **baked clip, sampled between keys** | 133 poses, 0 overlaps; gear mesh at least 0.078 mm |
| 6 | Does the motion obey the physics and sources it claims? | tests that load the exported GLB (`test_wright_reconstruction.mjs`) | ratios 1:1/2:1/190:40, 101.6 mm stroke, 12 degree rod swing, 7.9375 mm lift inside the exhaust stroke, fixed axes do not drift |
| 7 | Do the files agree? | hashes: contract and audit name the GLB; report names the FCStd/STEP; spec hash matches | `package_animated.py` refuses a mismatch |
| 8 | Does the interchange survive? | STEP round trip: per-solid volume, bounds, topology; reviewed exception only with evidence | four valve boxes, documented exception |
| 9 | Does it look like the sources? | per-system figure overlays, dimension table with locators, silhouette comparison from identical cameras | the weakest rung: extend it |
| 10 | Does the viewer show it? | load in the app, open each clip and stage, check the tree and labels | done by eye and by `npm test` |

## Rules that came from mistakes

- **Audit the exported file between its keys.** A development audit that poses the exact motion cannot see what linear interpolation does
  to a part whose node origin is far from its axis (0.2 mm at 4.75 degrees per key on an axis 230 mm away) or to a follower that jumps
  between keys (a trip lever moving 3 mm per frame). `audit_motion.py` poses the exact motion and is for the loop; the export is audited
  at fractional frames before release. Keep clearance margin on followers (0.6 mm) and put origins on axes.
- **Scan a suspect pair finely.** `scripts/scan_assembly_pairs.py` poses the baked clip as a viewer does and intersects one pair at
  quarter-frame steps (seconds), or lists every pair at chosen fractions of a clip; do it before reasoning about a failure.
- **Test the checks.** Mutate the model or the check (a lever lowered by 0.02 rad, a ratio changed) and require each rung to fail. The
  trip-lever test is mutation-tested; an unmutated pass proves nothing.
- **Validate the state that is saved.** Recompute, then validate and mesh. A shape that is valid before a recompute and empty after is
  the failure that matters.
- **Do not hide conflicts in seats.** A seat that removes a lot of material (more than a few percent of a part) is a layout problem;
  record it in the research packaging record and fix the layout if the model allows.
- **Held poses count.** Exploded views and saved stages are poses a student can pause on. Check them (a few seconds per pose) even when
  the transit between them is a known exception, and say which exceptions exist.
- **Probe points belong to the spec.** A static check with hard-coded coordinates breaks when the layout moves; compute them from the
  parameters and keep them off interfaces and seats.
