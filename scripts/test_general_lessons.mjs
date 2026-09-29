import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LESSON_PACK_SCHEMA, STEP_TYPES, CHECK_TYPES, validateLessonPack } from '../web/schema/content-schema.mjs';

const pack = JSON.parse(fs.readFileSync(new URL('../web/history-lessons.json', import.meta.url), 'utf8'));
assert.equal(pack.schema, LESSON_PACK_SCHEMA);
assert.ok(pack.privacy.includes('no learner identity'));
assert.ok(pack.draftStatus && /UNREVIEWED/.test(pack.draftStatus), 'pack must carry an unreviewed-draft flag until instructor review');

assert.equal(pack.lessons.length, 3);
const [mechanical, aircraft, terminologies] = pack.lessons;
assert.equal(mechanical.id, 'history-mechanical-engines');
assert.equal(mechanical.sequenceNumber, 1);
assert.deepEqual(mechanical.models, []);
assert.equal(aircraft.id, 'history-aircraft-engines');
assert.equal(aircraft.sequenceNumber, 2);
assert.deepEqual(aircraft.models, ['wright-1903-engine']);
assert.equal(terminologies.id, 'terminologies');
assert.equal(terminologies.sequenceNumber, 3);
assert.deepEqual(terminologies.models, ['cylinder']);

for (const lesson of pack.lessons) {
  assert.equal(lesson.listed, true);
  assert.match(lesson.objective, /\S/);
  assert.match(lesson.completionCriteria, /\S/);
  assert.ok(lesson.steps.length > 0);
  for (const step of lesson.steps) {
    assert.ok(STEP_TYPES.includes(step.type));
    assert.match(step.title, /\S/, `${lesson.id}: every step should carry a short rail title`);
    assert.match(step.prompt, /\S/);
    assert.match(step.note, /\S/, `${lesson.id}: every step should carry a sourcing note (documented vs general/illustrative)`);
  }
}

// The Wright model-pose step is the worked example of a static reference model:
// a named camera view and guided hotspots replace the fake crank-angle action.
const modelPoseStep = aircraft.steps.find(step => step.type === 'model-pose');
assert.ok(modelPoseStep);
assert.equal(modelPoseStep.modelId, 'wright-1903-engine');
assert.equal(modelPoseStep.viewPreset, 'engine-overview');
assert.deepEqual(modelPoseStep.focusHotspots, ['magneto', 'valve', 'crankcase']);
assert.equal(modelPoseStep.action, undefined);

assert.equal(pack.checks.length, 8);
for (const item of pack.checks) {
  assert.ok(CHECK_TYPES.includes(item.type));
  assert.ok(pack.lessons.some(lesson => lesson.id === item.lessonId));
  assert.match(item.rationale, /\S/);
}

assert.deepEqual(validateLessonPack(pack), []);
console.log('General/history lesson pack is valid (3 lessons, 8 checks)');
