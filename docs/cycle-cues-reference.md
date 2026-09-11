# Operating-cycle cue reference

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
