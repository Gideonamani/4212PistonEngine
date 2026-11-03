# Merlin viewer load and redraw validation

The 1,110-part model exposed repeated full-scene draws during initial pose
preparation and individual control changes. The initial CI run failed the
Merlin loading check. A Chrome SwiftShader reproduction at 390 × 844 CSS pixels,
device pixel ratio 2, took 213.226 seconds to reach the ready UI.

The adapter now prepares its initial pose before adding the model to the scene.
That isolated change reduced the same measured ready time to 34.503 seconds.
Interactive redraw requests are then combined into one animation frame.
Animation flushes the current pose once per tick; image capture explicitly
flushes immediately, and disposal cancels pending draws.

The fixed renderer's flushed captures took 19.705 seconds at the initial pose
and 16.921 seconds at half-cycle, versus 33.801 and 32.516 seconds for the
previous repeated draws. These are software-renderer capture timings, not
hardware frame-rate guarantees. Both resulting RGB images match pixel-for-pixel
at 780 × 1688 pixels. Geometry, materials, display resolution and motion data
are unchanged: the decoded export SHA-256 remains
`2d04c603e9b895dbb64a2fe35b1d1b561cd54d18472c53dd1d0bca856b8e7ccf`.

Single-pass opaque overlays reduced draw calls but gave little latency benefit;
that trial was removed. A lower drawing resolution was also tested and removed.
The selected fix preserves the existing appearance.

The complete software-rendered Merlin interaction test passes on one worker
within its original four-minute budget. The two large-model checks receive a
dedicated single-worker CI phase. The runner's discovered case identities are
checked across both phases and all shards; all 696 configured cases remain
covered exactly once. Load, interaction, memory and engineering limits were not
changed. Runtime project skips continue to apply.

Keep local Playwright traces outside the watched application directory: their
HTML snapshots otherwise trigger Vite page reloads and invalidate the run.

Deferred redraws are enabled for animated studies only; the cylinder and other
adapters retain immediate redraws. A subsequent software-rendered regression
exposed picking before a queued frame updated the camera matrix. Picking now
updates that matrix explicitly. The existing model-tap check failed before
that correction and passed afterward; section controls are checked separately.

Method references, separate from engine evidence:

- [Three.js rendering on demand](https://threejs.org/manual/pages/rendering-on-demand.html)
- [Playwright test tags](https://playwright.dev/docs/test-annotations#tag-tests)

Versions: Three.js 0.186.1 and Playwright 1.63.0. Raw benchmarks, images and the
initial failed CI trace are retained with the MEDIS release evidence.
