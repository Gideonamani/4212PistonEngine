import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertStrokeLabelsMatch } from './stroke-labels.mjs';
import { LESSON_PACK_SCHEMA, MEDIA_MODES, MEDIA_STATUSES, validateLessonPack } from '../web/schema/content-schema.mjs';

const pack = JSON.parse(fs.readFileSync(new URL('../web/fundamentals-lessons.json', import.meta.url), 'utf8'));

assert.equal(pack.schema, LESSON_PACK_SCHEMA);
assert.match(pack.draftStatus, /UNREVIEWED/);
assert.deepEqual(pack.sources.map(source => source.tier), [1, 2, 3, 4, 5, 5, 3, 4, 5, 5]);
for (const source of pack.sources.filter(source => source.tier === 5)) {
  assert.match(source.applicability, /Licence: .*accessed \d+ \w+ 2026/, `${source.id}: tier 5 sources record licence and access date`);
  assert.match(source.url, /^https:\/\//);
}
// Ignition and aspiration are parked (unlisted) source drafts for lessons 8 and 11; only listed lessons carry a curriculum number.
const listed = pack.lessons.filter(lesson => lesson.listed !== false);
const parked = pack.lessons.filter(lesson => lesson.listed === false);
assert.deepEqual(listed.map(lesson => lesson.sequenceNumber), [4, 5, 6, 7]);
assert.deepEqual(listed.map(lesson => lesson.id), ['thermodynamic-cycles', 'classification', 'parts-construction', 'cooling-methods']);
assert.deepEqual(parked.map(lesson => lesson.id), ['two-stroke-cycle', 'rotary-cycle', 'ignition-methods', 'aspiration-methods']);
// Unlisted lessons are either deep dives (linked from a step's deepDiveLinks) or parked drafts waiting for a later lesson.
const linked = new Set(pack.lessons.flatMap(lesson => lesson.steps.flatMap(step => step.deepDiveLinks || [])));
for (const lesson of parked) {
  assert.equal(lesson.sequenceNumber, undefined);
  if (lesson.deepDiveOf) {
    assert.ok(linked.has(lesson.id), `${lesson.id}: deep dive is not linked from any step`);
    assert.ok(listed.some(parent => parent.id === lesson.deepDiveOf), `${lesson.id}: deepDiveOf must name a listed lesson`);
  } else {
    assert.match(lesson.parkedFor, /Lesson \d+/);
    assert.ok(!linked.has(lesson.id), `${lesson.id}: a parked draft must not be linked`);
  }
}
for (const id of linked) assert.ok(parked.some(lesson => lesson.id === id), `deepDiveLinks id '${id}' must name an unlisted lesson`);

for (const lesson of pack.lessons) {
  assertStrokeLabelsMatch(lesson.steps, lesson.id);
  const isListed = lesson.listed !== false;
  assert.match(lesson.objective, /\S/);
  assert.match(lesson.completionCriteria, /\S/);
  assert.ok(lesson.steps.length >= (isListed ? 6 : 3));
  for (const step of lesson.steps) {
    assert.match(step.title, /\S/);
    assert.match(step.note, /\S/);
    assert.ok(step.sourceRefs?.length, `${lesson.id}/${step.title}: sourceRefs required`);
    assert.ok(MEDIA_MODES.includes(step.mediaPlan?.mode), `${lesson.id}/${step.title}: media mode`);
    assert.ok(MEDIA_STATUSES.includes(step.mediaPlan?.status), `${lesson.id}/${step.title}: media status`);
    assert.match(step.mediaPlan.rationale, /\S/);
  }
}

assert.equal(pack.checks.length, 28);
const expectedChecks = { 'thermodynamic-cycles': 7, classification: 5, 'parts-construction': 8, 'two-stroke-cycle': 2, 'rotary-cycle': 1, 'ignition-methods': 1, 'cooling-methods': 2, 'aspiration-methods': 2 };
for (const lesson of pack.lessons) {
  assert.equal(pack.checks.filter(check => check.lessonId === lesson.id).length, expectedChecks[lesson.id], lesson.id);
}

assert.deepEqual(validateLessonPack(pack), []);
console.log('Fundamentals lesson pack is valid (lessons 4, 5, 6, 7 listed; ignition and aspiration parked; 28 checks; deep dives linked; sourced media plans)');

