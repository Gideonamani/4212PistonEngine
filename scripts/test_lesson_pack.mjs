import assert from 'node:assert/strict';
import fs from 'node:fs';
const pack = JSON.parse(fs.readFileSync(new URL('../web/m2-cylinder-lessons.json', import.meta.url), 'utf8'));
assert.equal(pack.schema, '4212.lesson-pack/v1');
assert.equal(pack.model_id, 'cylinder');
assert.ok(pack.privacy.includes('no learner identity'));
assert.equal(pack.lessons.length, 1);
for (const step of pack.lessons[0].steps) {
  assert.match(step.prompt, /\S/); assert.match(step.note, /\S/);
  assert.ok(['angle', 'cycle-angle'].includes(step.action.type));
  assert.ok(Number.isInteger(step.action.value) && step.action.value >= 0 && step.action.value <= 720);
}
assert.equal(pack.checks.length, 3);
for (const item of pack.checks) assert.ok(item.correct >= 0 && item.correct < item.answers.length && item.rationale);
console.log('M2 lesson pack is valid');
