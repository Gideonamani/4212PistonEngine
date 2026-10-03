import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { mapQuizModule, mapStep, mapTrack } from '../src/data/packMapping.ts';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const registry = readJson('src/data/models.json');
const byId = Object.fromEntries(registry.map((model) => [model.id, model]));
const models = { has: (id) => Boolean(id && byId[id]), label: (id) => byId[id]?.label || id || registry[0].label };

const manifest = readJson('web/lessons-manifest.json');
const packs = manifest.packs.map((path) => readJson(`web/${path.replace(/^\.\//, '')}`));

// The fields the mapper copied one by one before it used a spread. Each must still reach the screens untouched.
const LEGACY_FIELDS = ['type', 'title', 'note', 'modelId', 'savedMotionId', 'motionProgress', 'viewPreset', 'focusHotspots', 'focusParts', 'deepDiveLinks', 'action', 'url', 'alt', 'credit', 'license', 'sourceUrl', 'sourceRefs', 'mediaPlan'];
const DERIVED = ['stepNumber', 'text', 'imageType', 'suggestedAnswer', 'has3DReference', 'referenceModel'];

test('every field of every shipped step reaches the mapped step', () => {
  let steps = 0;
  for (const pack of packs) {
    for (const lesson of pack.lessons) {
      lesson.steps.forEach((step, index) => {
        const mapped = mapStep(step, index, models);
        steps += 1;
        const where = `${pack.id}/${lesson.id}/${index + 1}`;
        for (const [key, value] of Object.entries(step)) {
          if (key === 'prompt') assert.equal(mapped.text, value, where);
          else assert.deepEqual(mapped[key], value, `${where}: ${key}`);
        }
        for (const field of LEGACY_FIELDS) assert.deepEqual(mapped[field], step[field], `${where}: legacy field ${field}`);
        const invented = Object.keys(mapped).filter((key) => !(key in step) && !DERIVED.includes(key));
        assert.deepEqual(invented, [], `${where}: unexpected fields`);
      });
    }
  }
  assert.ok(steps > 100, `expected the shipped lessons, saw ${steps} steps`);
});

test('derived step fields', () => {
  const pose = { type: 'model-pose', title: 'T', prompt: 'Look at the cylinder.', modelId: 'cylinder', note: 'n' };
  const mapped = mapStep(pose, 2, models);
  assert.equal(mapped.stepNumber, 3);
  assert.equal(mapped.text, 'Look at the cylinder.');
  assert.equal(mapped.suggestedAnswer, 'n');
  assert.equal(mapped.note, 'n');
  assert.equal(mapped.has3DReference, true);
  assert.equal(mapped.referenceModel, byId.cylinder.label);
  assert.equal(mapStep({ ...pose, modelId: 'no-such-model' }, 0, models).has3DReference, false);
  assert.equal(mapStep({ type: 'text', title: 'T', prompt: 'p', modelId: 'cylinder' }, 0, models).has3DReference, false, 'only model-pose steps get a reference');
  assert.equal('prompt' in mapped, false, 'the raw prompt is replaced by text');
});

test('a field added to a pack step passes through without touching the mapper', () => {
  const mapped = mapStep({ type: 'text', title: 'T', prompt: 'p', somethingNew: { a: 1 } }, 0, models);
  assert.deepEqual(mapped.somethingNew, { a: 1 });
});

test('courses list only listed lessons; unlisted lessons a step links to become deep dives', () => {
  const lesson = (id, extra = {}) => ({ id, title: id, objective: id, steps: [{ type: 'text', title: id, prompt: id, ...extra.step }], ...extra.lesson });
  const pack = {
    id: 'p', title: 'Pack', description: 'About engines', checks: [],
    lessons: [
      lesson('a', { step: { deepDiveLinks: ['dive'] } }),
      lesson('b', { lesson: { sequenceNumber: 7 } }),
      lesson('dive', { lesson: { listed: false } }),
      lesson('parked', { lesson: { listed: false } }),
    ],
  };
  const track = mapTrack(pack, 0, models);
  assert.deepEqual(track.lessons.map((item) => item.id), ['a', 'b']);
  assert.deepEqual(track.lessons.map((item) => item.lessonNumber), ['Lesson 01', 'Lesson 07']);
  assert.deepEqual(track.deepDives.map((item) => [item.id, item.lessonNumber, item.isDeepDive]), [['dive', 'Deep dive', true]]);
  assert.equal(track.lessonCount, 2);
  assert.equal(track.stepCountApprox, '2 steps');
  assert.equal(track.isCurrent, true);
  assert.equal(mapTrack(pack, 1, models).isCurrent, false);
});

test('checks of parked lessons are hidden, those of deep dives stay', () => {
  const check = (id, lessonId) => ({ id, lessonId, type: 'multiple-choice', question: 'q', answers: ['x', 'y'], correct: 1, rationale: 'because' });
  const pack = {
    id: 'm2-cylinder-study', title: 'Pack', description: 'd',
    lessons: [
      { id: 'a', title: 'a', objective: 'a', steps: [{ type: 'text', title: 'a', prompt: 'a', deepDiveLinks: ['dive'] }] },
      { id: 'dive', title: 'd', objective: 'd', listed: false, steps: [{ type: 'text', title: 'd', prompt: 'd' }] },
      { id: 'parked', title: 'p', objective: 'p', listed: false, steps: [{ type: 'text', title: 'p', prompt: 'p' }] },
    ],
    checks: [check('c1', 'a'), check('c2', 'dive'), check('c3', 'parked')],
  };
  const quiz = mapQuizModule(pack);
  assert.deepEqual(quiz.questions.map((question) => question.id), ['c1', 'c2']);
  assert.equal(quiz.questionCount, 2);
  assert.equal(quiz.id, 'm2-cylinder-study-check');
  assert.equal(quiz.badge, 'OPERATING CYCLE');
  assert.equal(quiz.questions[0].correctIndex, 1);
  assert.equal(quiz.questions[0].explanation, 'because');
});

test('the shipped packs produce the courses and checks the app lists', () => {
  const tracks = packs.map((pack, index) => mapTrack(pack, index, models));
  for (const [index, pack] of packs.entries()) {
    assert.equal(tracks[index].lessons.length, pack.lessons.filter((lesson) => lesson.listed !== false).length, pack.id);
    assert.equal(tracks[index].thumbnail, pack.thumbnail, pack.id);
    for (const [position, lesson] of tracks[index].lessons.entries()) assert.equal(lesson.steps.length, pack.lessons.filter((item) => item.listed !== false)[position].steps.length);
  }
  const questions = packs.filter((pack) => pack.checks?.length).map(mapQuizModule).reduce((sum, quiz) => sum + quiz.questionCount, 0);
  assert.ok(questions > 40, `expected the shipped checks, saw ${questions}`);
});
