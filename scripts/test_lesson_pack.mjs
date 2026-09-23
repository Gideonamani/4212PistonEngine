import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LESSON_PACK_SCHEMA, validateLessonPack } from '../web/schema/content-schema.mjs';

const pack = JSON.parse(fs.readFileSync(new URL('../web/m2-cylinder-lessons.json', import.meta.url), 'utf8'));
assert.equal(pack.schema, LESSON_PACK_SCHEMA);
assert.ok(pack.privacy.includes('no learner identity'));
assert.equal(pack.lessons.length, 1);
const lesson = pack.lessons[0];
assert.deepEqual(lesson.models, ['cylinder']);
assert.equal(lesson.listed, true);
for (const step of lesson.steps) {
  assert.equal(step.type, 'model-pose');
  assert.equal(step.modelId, 'cylinder');
  assert.match(step.title, /\S/); assert.match(step.prompt, /\S/); assert.match(step.note, /\S/);
  assert.ok(['angle', 'cycle-angle'].includes(step.action.type));
  assert.ok(Number.isInteger(step.action.value) && step.action.value >= 0 && step.action.value <= 720);
}
assert.equal(pack.checks.length, 5);
for (const item of pack.checks) {
  assert.equal(item.lessonId, lesson.id);
  assert.equal(item.type, 'multiple-choice');
  assert.ok(item.correct >= 0 && item.correct < item.answers.length && item.rationale && item.hint);
}

assert.deepEqual(validateLessonPack(pack), []);
console.log('M2 lesson pack is valid');
