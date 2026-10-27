# ADR 002: version the motion interface, and agree a release envelope with MEDIS

Status: part accepted, part proposed. The website half below is built (27 October 2026, issue 106). The envelope that MEDIS would write is a **proposal**: nothing in it binds MEDIS until its owner agrees, and no contract carries it yet.

## Why

The MEDIS audits (interference sweeps, the review sampler, `check_gtsio_review.mjs`) read poses by importing `src/viewer/core/animated-study-motion.mjs` from this repository, through the `src` junction in the MEDIS checkout. So an audit result is a statement about two things: an exported model, and this file's idea of where each part is at each crank angle. The registry and the adapter already pin the first (the decoded file's SHA-256 must equal the contract's `asset_sha256`, and the part list must match). Nothing pinned the second: a change to the motion could leave every hash the same and quietly make an old audit describe a motion it was never run against.

Nothing here changes what a student sees, and nothing here upgrades any release. The R10 contract keeps `release_allowed: false` and its draft/illustrative scope. The checks below can say "this is not the motion that was audited"; none of them can say "this is verified".

## Built on the website (this repository)

1. **A motion interface version.** `MOTION_API_VERSION` (semantic version, `1.0.0`) and `describeMotionApi()` in `animated-study-motion.mjs` state the entry point, the units (crank angle in degrees over 0 to 720, translation in metres, the glTF frame, CAD millimetres for the parameters), the body names and the mirror flag. A major bump means audits made against the earlier major no longer describe this motion. A refactor that leaves every matrix as it was does not bump it.
2. **A fingerprint of what the motion does.** `src/viewer/core/motion-fingerprint.mjs` evaluates all 77 bodies the interface names, at 25 crank angles (every 30 degrees, 0 to 720), with and without the mirror, rounds each matrix to a nanometre and hashes the lot. The committed value is `src/viewer/core/motion-fingerprint.json`; `node scripts/write_motion_fingerprint.mjs` regenerates it. `scripts/test_motion_fingerprint.mjs` fails, in `npm test` and so in CI, when the poses change and the fixture does not, and says what to do. A 0.1 % scale on the piston translation was run against it and failed the test; reverting restored it (recorded in the pull request).
3. **A compatibility check at the consumer.** `src/viewer/core/motion-compatibility.mjs` `checkStudyContract(contract)` runs in the animated-study adapter before the asset is trusted. It accepts the schema `4212.animated-study/v1` and contracts that declare no schema (every release made before this record); rejects a newer `4212.animated-study/vN` with a message that tells the student to reload, and any other schema as unreadable; and, when a contract declares `motion_api`, requires the same major and a minor and patch no newer than this build's. A contract that declares nothing is returned with `motionApi: null` and is never described as audited against any motion version.

What this does not do: the fingerprint is computed in Node (it uses `node:crypto`) and is checked in CI, not in the browser. At run time only the version string is compared. The fingerprint does not know which MEDIS audits depend on the motion; that is the proposal below.

## Proposed: the release envelope MEDIS would write (for MEDIS to accept, amend or refuse)

An optional block added to a contract by the MEDIS release tool, never hand-edited here (`Do not hand-edit generated contracts to manufacture a passing certificate`):

```json
"motion_api": "1.0.0",
"audit": {
  "schema": "4212.release-envelope/v1",
  "asset_sha256": "<the file's hash, equal to the contract's own>",
  "motion_fingerprint": "<sha256 from motion-fingerprint.json at the audited website commit>",
  "website_commit": "<full SHA the audit imported the motion from>",
  "medis_commit": "<full SHA of the tools and specifications>",
  "coverage": { "rest": "swept | rest_only | skipped | not_run", "cycle": "...", "explode": "...", "teardown": "..." },
  "passed": true,
  "clean": false,
  "source_fidelity": "illustrative | reconstructed | manufacturer",
  "release_allowed": false
}
```

Rules for the facts, so they stay separate and none implies another:

- `coverage` is stated per kind of motion. A rest-only record says `rest_only` for the cycle and the teardown; it never implies they were swept. A skipped kind is `skipped`, a kind never run is `not_run`.
- `passed` (the checks that ran succeeded), `clean` (no overlap or defect was found in what was covered), `source_fidelity` (what the geometry rests on) and `release_allowed` (the owner's decision) are four facts. The site reads none of them as another.
- `audit.asset_sha256` must equal `asset_sha256`; `audit.motion_fingerprint` must equal the committed fingerprint, or the audit is stale.

What the website would then do, once the envelope exists and is agreed (not built yet, because the shape is not agreed):

- A CI test over the shipped contracts: an `audit` block whose `motion_fingerprint` or `asset_sha256` differs from the committed values fails with "this audit was run against another motion; rerun the MEDIS check named in the contract". A contract with no `audit` block stays legacy and passes, unchanged.
- A contract whose `coverage` is not `swept` for a motion cannot be described, in notes, labels or lesson text, as cleared for that motion.

## Proposed: how a dependent audit is requested and reported

1. When a pull request changes `motion-fingerprint.json`, the test failure already forces the author to regenerate it. The pull request description then must name the MEDIS audits to rerun (the list is the contracts that carry `audit.motion_fingerprint` equal to the old value). No automatic cross-repository run is proposed: MEDIS needs its own pinned checkout first.
2. MEDIS pins the website commit it audits against (a file in the MEDIS repository, bumped deliberately) and runs from that pin, not from whichever worktree the junction points at. This is MEDIS work. It is what makes "a reproducible pinned revision pair" possible: one website commit and one MEDIS commit, both recorded in the envelope.
3. A rerun result is reported by MEDIS publishing a refreshed contract or envelope through its normal release tool, never by editing a contract here.

## Legacy releases

Every release on the site today has no `audit` block and no `motion_api`. They stay as they are: shown with the scope text and evidence labels they already carry, `release_allowed` untouched, and described as illustrative or unverified where they were. The check treats "declares nothing" as legacy and does not warn a student about it. Nothing is removed, and nothing is upgraded by passing the check.

## Reproducible pair for the first agreed envelope

To be filled by MEDIS when it takes the first measurement: the website commit, the MEDIS commit, the toolchain versions (Blender, FreeCAD, Python) and the fingerprint. Until then the only pinned pair is this repository's own: the fingerprint file is the record of what the motion did at the commit that holds it.

## Questions for MEDIS

1. Does the envelope above carry the facts MEDIS already holds? Which of `coverage`, `passed`, `clean`, `source_fidelity` does it already record, under which names?
2. Can the sampler import `MOTION_API_VERSION` and `motionFingerprint()` and write both into its records, so that its own output says which motion it ran?
3. Who rejects a mismatch first: the MEDIS release tool before it publishes, or this repository's CI after? (Proposed: both, with MEDIS first.)
4. Should minor versions of `motion_api` be allowed to differ in the direction the website now allows (audited older minor is accepted)? It is accepted today on the reading that a minor adds bodies and leaves old poses alone; MEDIS can overrule that.
