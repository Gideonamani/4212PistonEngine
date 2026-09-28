import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LESSON_PACK_SCHEMA, MEDIA_MODES, MEDIA_STATUSES, validateLessonPack } from '../web/schema/content-schema.mjs';

const pack = JSON.parse(fs.readFileSync(new URL('../web/fundamentals-lessons.json', import.meta.url), 'utf8'));

assert.equal(pack.schema, LESSON_PACK_SCHEMA);
assert.match(pack.draftStatus, /UNREVIEWED/);
assert.deepEqual(pack.sources.map(source => source.tier), [1, 2, 3]);
assert.deepEqual(pack.lessons.map(lesson => lesson.sequenceNumber), [4, 5, 6, 7, 8]);
assert.deepEqual(pack.lessons.map(lesson => lesson.id), [
  'thermodynamic-cycles',
  'cylinder-arrangements',
  'ignition-methods',
  'cooling-methods',
  'aspiration-methods',
]);

for (const lesson of pack.lessons) {
  assert.equal(lesson.listed, true);
  assert.match(lesson.objective, /\S/);
  assert.match(lesson.completionCriteria, /\S/);
  assert.ok(lesson.steps.length >= 6);
  for (const step of lesson.steps) {
    assert.match(step.title, /\S/);
    assert.match(step.note, /\S/);
    assert.ok(step.sourceRefs?.length, `${lesson.id}/${step.title}: sourceRefs required`);
    assert.ok(MEDIA_MODES.includes(step.mediaPlan?.mode), `${lesson.id}/${step.title}: media mode`);
    assert.ok(MEDIA_STATUSES.includes(step.mediaPlan?.status), `${lesson.id}/${step.title}: media status`);
    assert.match(step.mediaPlan.rationale, /\S/);
  }
}

assert.equal(pack.checks.length, 10);
for (const lesson of pack.lessons) {
  assert.equal(pack.checks.filter(check => check.lessonId === lesson.id).length, 2);
}

assert.deepEqual(validateLessonPack(pack), []);
console.log('Fundamentals lesson pack is valid (lessons 4-8, 10 checks, sourced media plans)');

