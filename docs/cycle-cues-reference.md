# Operating-cycle cue reference

Current status (11 September 2026): the completed whole-region audit is bound into `cycle-cues-profile.json`; the cues are enabled and browser-checked in the spring-seat preview. See [verification results](cycle-preview-verification.md). The pending implementation notes below are historical; instructor review and explicit spark-plug location markers remain open.

Reference: local `Notes/gtsio520_series.pdf`, SHA-256 `c8e7828e978772a55a9271d7bf678cc464ac772987ce7c44cfa3af89c9c21a07`. The selected study remains GTSIO-520-H; check variant differences before extending system details.

PDF page 18, printed A-3-3, section 3-2(c), describes induction air travelling from the turbocharger through the air throttle/manifold/intake tubes to the cylinder intake ports. Section 3-2(d) describes the magnetos supplying the upper and lower spark plugs. PDF page 19, printed A-3-4, section 3-2(e)(1) and (3), describes continuous-flow injection into the intake valve port, with a discharge nozzle outside each intake valve. Page 19 was visually inspected for this review.

Consequences for the first cylinder lesson:

- Describe the incoming cylinder charge as fuel mixed with air. Fuel reacts with oxygen during combustion; do not label air alone as the substance being burnt.
- Do not depict fuel as direct injection into the combustion chamber or as a timed injector pulse. The manual describes continuous port injection; the fuel subsystem geometry is a later module.
- Show both spark-plug locations as ignition sources, with an explicit illustrative timing label. Ideal 180-degree stroke boundaries and 7 mm lift are the existing teaching profile, not verified cam or ignition settings.
- Use distinct incoming-charge and exhaust colours with a legend. Colour does not encode measured pressure, temperature, concentration or velocity.
- Anchor intake/exhaust arrows to the actual CAD cross-port frames. These casting passages are themselves reconstructed, as stated in the head's evidence annotation. Verify passage landmarks from the current candidate before implementing internal tracer paths.
- Keep chamber cues synchronized to the current crank angle, including paused scrubbing and loop closure. A visible arrow indicates direction; it is not CFD.

Pending: extract current port and chamber landmarks, implement and inspect the cue geometry, verify closed-valve flow gating, and obtain instructor review of the cycle explanation. This source note does not mark M2 complete.

Implementation in progress: `export_cycle_landmarks.py` extracts current cross-port frames and screens a conservative central chamber display region against head, barrel and translated valve solids at 25 crank angles. Its sampled point clearance is not a continuous flow/volume validation. The running extraction must complete before its output is enabled in the local preview.

`cycle-cues.mjs` supplies deterministic stroke explanations and valve-gated flow visibility. Automated checks cover loop closure and absence of port-flow cues while the corresponding valve is closed. `cycle-visuals.mjs` adds port-axis arrows/tracers and a central charge point cloud, with colours for intake, compression, power and exhaust. The particle region intentionally does not represent total chamber volume or measured quantities. Browser appearance and spatial checks remain pending. No cue profile is published.
