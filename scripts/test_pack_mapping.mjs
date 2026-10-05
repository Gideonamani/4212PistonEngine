import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { mapQuestion, mapQuizModule, mapStep, mapTrack } from '../src/data/packMapping.ts';
import { ANSWERABLE_TYPES, isCorrect, matchingOptions } from '../src/components/check/scoring.mjs';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const registry = readJson('src/data/models.json');
const byId = Object.fromEntries(registry.map((model) => [model.id, model]));
const models = { has: (id) => Boolean(id && byId[id]), label: (id) => byId[id]?.label || id || registry[0].label };

const manifest = readJson('web/lessons-manifest.json');
const packs = manifest.packs.map((path) => readJson(`web/${path.replace(/^\.\//, '')}`));

// The fields the mapper copied one by one before it used a spread. Each must still reach the screens untouched.
const LEGACY_FIELDS = ['type', 'title', 'note', 'modelId', 'savedMotionId', 'motionProgress', 'viewPreset', 'focusHotspots', 'focusParts', 'deepDiveLinks', 'action', 'url', 'alt', 'credit', 'license', 'sourceUrl', 'sourceRefs', 'mediaPlan'];
const DERIVED = ['stepNumber', 'text', 'suggestedAnswer', 'has3DReference', 'referenceModel'];

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
  const lesson = (id, extra = {}) => ({ id, title: id, objective: id, reviewStatus: 'unreviewed', steps: [{ type: 'text', title: id, prompt: id, ...extra.step }], ...extra.lesson });
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
      { id: 'a', title: 'a', objective: 'a', reviewStatus: 'unreviewed', steps: [{ type: 'text', title: 'a', prompt: 'a', deepDiveLinks: ['dive'] }] },
      { id: 'dive', title: 'd', objective: 'd', reviewStatus: 'unreviewed', listed: false, steps: [{ type: 'text', title: 'd', prompt: 'd' }] },
      { id: 'parked', title: 'p', objective: 'p', listed: false, steps: [{ type: 'text', title: 'p', prompt: 'p' }] },
    ],
    checks: [check('c1', 'a'), check('c2', 'dive'), check('c3', 'parked')],
  };
  const quiz = mapQuizModule(pack);
  assert.deepEqual(quiz.questions.map((question) => question.id), ['c1', 'c2']);
  assert.equal(quiz.questionCount, 2);
  assert.equal(quiz.id, 'm2-cylinder-study-check');
  assert.equal(quiz.questions[0].correctIndex, 1);
  assert.equal(quiz.questions[0].explanation, 'because');
});

test('review status reaches the lesson card, and nothing about a card is guessed from its words', () => {
  const lesson = (id, reviewStatus, reviewedOn) => ({ id, title: 'Steam and Wright aircraft gauges', objective: 'inspect the borescope system', reviewStatus, reviewedOn, steps: [{ type: 'text', title: 'Steam', prompt: 'Muscle, labour and flight.' }] });
  const pack = {
    id: 'cylinder-pack', title: 'Cylinder system', description: 'd', checks: [{ id: 'c', lessonId: 'a', type: 'multiple-choice', question: 'q', answers: ['x', 'y'], correct: 0, rationale: 'r' }],
    lessons: [lesson('a', 'unreviewed'), lesson('b', 'reviewed', '2026-10-05')],
  };
  const track = mapTrack(pack, 0, models);
  assert.deepEqual(track.lessons.map((item) => [item.reviewStatus, item.reviewedOn]), [['unreviewed', undefined], ['reviewed', '2026-10-05']]);
  const quiz = mapQuizModule(pack);
  const guessed = ['imageType', 'category', 'badge'];
  for (const [name, object] of [['track', track], ['lesson', track.lessons[0]], ['step', track.lessons[0].steps[0]], ['quiz', quiz], ['question', quiz.questions[0]]]) {
    assert.deepEqual(guessed.filter((key) => key in object), [], `${name} must not carry a field guessed from words in the title`);
  }
});

test('every shipped lesson says where it stands with the instructor', () => {
  for (const pack of packs) {
    assert.equal('draftStatus' in pack, false, `${pack.id}: draftStatus is retired`);
    for (const lesson of pack.lessons) assert.ok(['unreviewed', 'reviewed'].includes(lesson.reviewStatus), `${pack.id}/${lesson.id}: reviewStatus`);
  }
  const mapped = packs.flatMap((pack, index) => mapTrack(pack, index, models).lessons);
  assert.ok(mapped.length >= 10 && mapped.every((lesson) => lesson.reviewStatus), 'the mapped lessons keep their review status');
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

const base = { id: 'q', lessonId: 'l', question: 'Which?', hint: 'Think.', rationale: 'Because.' };

test('every check type reaches the screen with its own fields and the same marking the pack intends', () => {
  const choice = mapQuestion({ ...base, type: 'multiple-choice', answers: ['x', 'y'], correct: 1 });
  assert.deepEqual([choice.type, choice.options, choice.correctIndex, choice.explanation, choice.hint], ['multiple-choice', ['x', 'y'], 1, 'Because.', 'Think.']);
  const ordering = mapQuestion({ ...base, type: 'ordering', items: ['a', 'b', 'c'] });
  assert.deepEqual([ordering.type, ordering.items], ['ordering', ['a', 'b', 'c']]);
  const pairs = [{ left: 'Magneto', right: 'Spark' }, { left: 'Oil pump', right: 'Lubrication' }];
  const matching = mapQuestion({ ...base, type: 'matching', pairs });
  assert.deepEqual([matching.type, matching.pairs], ['matching', pairs]);
  assert.equal(isCorrect(matching, ['Spark', 'Lubrication']), true);
  const numeric = mapQuestion({ ...base, type: 'numeric', unit: 'hp', correctValue: 170, tolerance: 1 });
  assert.deepEqual([numeric.type, numeric.unit, numeric.correctValue, numeric.tolerance], ['numeric', 'hp', 170, 1]);
  assert.equal(isCorrect(numeric, '170.5'), true);
  assert.equal(mapQuestion({ ...base, type: 'numeric', unit: 'hp', correctValue: 170 }).tolerance, 0, 'no tolerance means exact');
});

test('a model-click check keeps its model, its right node and its alternatives, and a type the screen cannot show is refused', () => {
  const click = mapQuestion({ ...base, type: 'model-click', modelId: 'cylinder', correctNodeId: 'PistonBody', alsoAccept: ['FloatingPin'], view: { initialAngle: 90 } });
  assert.deepEqual([click.type, click.modelId, click.correctNodeId, click.alsoAccept, click.view], ['model-click', 'cylinder', 'PistonBody', ['FloatingPin'], { initialAngle: 90 }]);
  assert.equal(isCorrect(click, ['FloatingPin', 'piston']), true);
  assert.equal(isCorrect(click, ['IntakeValve', 'intake']), false);
  assert.throws(() => mapQuestion({ ...base, type: 'drag-and-drop', modelId: 'cylinder' }), /cannot show a 'drag-and-drop' question/);
});

test('every shipped check is one the screen can show, and no matching question gives its answer away by order', () => {
  for (const pack of packs) {
    for (const check of pack.checks || []) {
      assert.ok(ANSWERABLE_TYPES.includes(check.type), `${pack.id}/${check.id}: the Check screen cannot show '${check.type}' questions yet`);
      if (check.type === 'matching') {
        const rights = check.pairs.map((pair) => pair.right);
        assert.notDeepEqual(matchingOptions(check), rights, `${pack.id}/${check.id}: the matches are already alphabetical in the pack, so each row's answer sits at its own position in the list`);
      }
    }
  }
});

test('every listed lesson owns at least one check, and every check belongs to a lesson of its pack', () => {
  for (const pack of packs) {
    const lessonIds = new Set(pack.lessons.map((lesson) => lesson.id));
    for (const check of pack.checks || []) assert.ok(lessonIds.has(check.lessonId), `${pack.id}/${check.id}: lessonId '${check.lessonId}' is not a lesson of this pack`);
    for (const lesson of pack.lessons.filter((item) => item.listed !== false)) {
      assert.ok((pack.checks || []).some((check) => check.lessonId === lesson.id), `${pack.id}/${lesson.id}: a listed lesson needs checks for the Check tab`);
    }
  }
});
