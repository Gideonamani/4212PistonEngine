---
name: lesson-interactive
description: Build a small native interactive for a lesson step (a gear explorer, an energy walk-through, a calculator) with its calculation in a tested pure module, a small React component, and a browser test that includes the accessibility and touch-target checks. Use when a concept is better explored than described and the 3D models cannot show it.
---

Build one only when the learner needs to change a quantity and watch the result (teeth and speed, density and altitude); otherwise a step with words or a picture is cheaper and easier to review. The existing ones are the pattern: `src/components/gearPair.mjs` and `GearPairExplorer` in `AccessoryArtifacts.tsx`, `energyChain.mjs` and `EnergyChainWalk` in `PowerArtifacts.tsx`, `airDensity.mjs` and `AirDensityExplorer` in `PerformanceArtifacts.tsx`.

## Steps

1. **Write the claim first.** One sentence on what the learner should see change, and the source the numbers come from. Anything schematic is labelled as schematic in the component and in the step note.
2. **Pure module** `src/components/<name>.mjs`: every calculation and every constant, no React, doc comments in plain words. Test it in `scripts/test_<name>.mjs` with `node --test`: known values from the source, edge cases, and the invariants (for gears: the tooth interleave at every angle, with and without the idler). Break the function on purpose once to see the test fail.
3. **Component** in the matching `*Artifacts.tsx`: controls are real buttons, sliders and groups with accessible names (`aria-pressed` for a chosen option); the result is also written as a text line, not only drawn or coloured; the SVG has `role="img"` and an `aria-label` that describes the current state; targets are at least 44 px (`min-h-11 min-w-11`, `h-11` on a slider, as in `GearPairExplorer`); nothing scrolls sideways at 320 px; reuse the slate and teal classes the others use, which the light and dark themes remap in `src/index.css`.
4. **Register it.** Add its id to `src/components/lessonArtifactIds.ts` and map it in `src/components/LessonArtifacts.tsx` (`if (id === '<id>') return <Component />;`); a test fails if the two disagree. In the lesson pack, add a step with `type: 'web-embed'` and `url: 'artifact:<id>'` (copy a neighbouring one) and say in the step's note where the numbers come from.
5. **Browser test** in `e2e/lesson-interactives.spec.ts`: open the step by its hash (`#/learn/<pack>/<lesson>/step/<n>`, 1-based), drive the controls, assert the text results, call `expectNoHorizontalOverflow(page)` and `expectAccessibleAndTouchable(page, '<name>')`, and `problems.assertNone()`. The generic "every native interactive is accessible and touchable" test already visits every `artifact:` step on the phone-320 and tablet-768 projects.
6. **Run** `npm run lint`, the unit test, then Playwright for `lesson-interactives` on `phone-360` and `tablet-768` with `--workers=1`, in the background. Look at it with a screenshot (`scripts/lesson-rework/shot.mjs` takes a hash; write a short Playwright script for a state that needs clicks) before you call it done.

Keep the step position of an interactive fixed once a browser test refers to it; the lesson-rework skill lists them.
