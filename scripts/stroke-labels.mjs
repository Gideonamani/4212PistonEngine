import assert from 'node:assert/strict';

// Stroke labels must match the shared 720-degree teaching profile (see web/cycle-cues.mjs: floor(angle / 180)).
const STROKE_RANGES = { intake: [0, 180], compression: [180, 360], power: [360, 540], exhaust: [540, 720] };
export function assertStrokeLabelsMatch(steps, where) {
  for (const step of steps) {
    if (step.action?.type !== 'cycle-angle') continue;
    const label = Object.keys(STROKE_RANGES).find(name => step.title.toLowerCase().includes(name));
    if (!label) continue;
    const [low, high] = STROKE_RANGES[label];
    assert.ok(step.action.value >= low && step.action.value < high, `${where}/${step.title}: ${step.action.value} degrees is not in the ${label} stroke (${low}-${high})`);
  }
}
