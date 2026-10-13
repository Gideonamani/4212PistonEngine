import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertStrokeLabelsMatch } from './stroke-labels.mjs';
import { LESSON_PACK_SCHEMA, MEDIA_MODES, MEDIA_STATUSES, validateLessonPack } from '../web/schema/content-schema.mjs';

const pack = JSON.parse(fs.readFileSync(new URL('../web/fundamentals-lessons.json', import.meta.url), 'utf8'));

assert.equal(pack.schema, LESSON_PACK_SCHEMA);
assert.equal(pack.draftStatus, undefined, 'draftStatus is retired: review state lives on each lesson');
assert.ok(pack.lessons.every(lesson => lesson.reviewStatus === 'unreviewed'), 'every lesson waits for instructor review');
// The first ten sources are the original registry; each reworked lesson has since added its own at the end.
assert.deepEqual(pack.sources.slice(0, 10).map(source => source.tier), [1, 2, 3, 4, 5, 5, 3, 4, 5, 5]);
assert.ok(pack.sources.every(source => Number.isInteger(source.tier) && source.tier >= 1 && source.tier <= 6), 'every source has a tier from 1 to 6');
assert.equal(new Set(pack.sources.map(source => source.id)).size, pack.sources.length, 'source ids are unique');
for (const source of pack.sources.filter(source => source.tier === 5)) {
  assert.match(source.applicability, /Licence: .*accessed \d+ \w+ 2026/, `${source.id}: tier 5 sources record licence and access date`);
  assert.match(source.url, /^https:\/\//);
}
// The parked ignition and aspiration drafts were folded into lessons 9, 10 and 11 and retired; the unlisted lessons left are the two deep dives. Only listed lessons carry a curriculum number.
const listed = pack.lessons.filter(lesson => lesson.listed !== false);
const parked = pack.lessons.filter(lesson => lesson.listed === false);
assert.deepEqual(listed.map(lesson => lesson.sequenceNumber), [4, 5, 6, 7]);
assert.deepEqual(listed.map(lesson => lesson.id), ['thermodynamic-cycles', 'classification', 'cooling-methods', 'parts-construction']);
assert.deepEqual(parked.map(lesson => lesson.id), ['two-stroke-cycle', 'rotary-cycle']);
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

// Lessons 4 to 7 were reworked against their outcomes (docs/lesson-coverage-audit-2026-10-12.md), which is why they have many more checks.
const expectedChecks = { 'thermodynamic-cycles': 17, classification: 14, 'parts-construction': 18, 'two-stroke-cycle': 2, 'rotary-cycle': 1, 'cooling-methods': 11 };
assert.equal(pack.checks.length, Object.values(expectedChecks).reduce((sum, count) => sum + count, 0));
for (const lesson of pack.lessons) {
  assert.equal(pack.checks.filter(check => check.lessonId === lesson.id).length, expectedChecks[lesson.id], lesson.id);
}

assert.deepEqual(validateLessonPack(pack), []);
console.log('Fundamentals lesson pack is valid (lessons 4, 5, 6, 7 listed; two deep dives; 63 checks; deep dives linked; sourced media plans)');

