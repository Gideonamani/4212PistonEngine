import assert from 'node:assert/strict';
import {
  LESSON_PACK_SCHEMA,
  LESSON_REVIEW_STATUSES,
  MODEL_REGISTRY_SCHEMA,
  EXPLORE_CONTENT_TREE_SCHEMA,
  validateLessonPack,
  validateModelRegistry,
  validateContentTree,
  FOCUS_MODES,
} from '../web/schema/content-schema.mjs';

// A minimal valid pack exercising all five check-item question types, to
// prove the schema plans for them even though only multiple-choice has real
// content in web/m2-cylinder-lessons.json today.
const samplePack = {
  schema: LESSON_PACK_SCHEMA,
  privacy: 'no learner identity',
  lessons: [
    {
      id: 'lesson-a',
      title: 'Sample lesson',
      objective: 'Exercise every step and check type.',
      reviewStatus: 'unreviewed',
      models: ['cylinder'],
      steps: [
        { type: 'text', prompt: 'Read this.' },
        { type: 'model-pose', modelId: 'cylinder', prompt: 'Pose it.', action: { type: 'angle', value: 90 } },
      ],
    },
    { id: 'lesson-b', title: 'General theory', objective: 'No model needed.', reviewStatus: 'reviewed', reviewedOn: '2026-10-05', models: [], steps: [{ type: 'text', prompt: 'Read this too.' }] },
  ],
  checks: [
    { id: 'c1', lessonId: 'lesson-a', type: 'multiple-choice', question: 'q', answers: ['a', 'b'], correct: 0 },
    { id: 'c2', lessonId: 'lesson-a', type: 'model-click', question: 'q', modelId: 'cylinder', correctNodeId: 'CrankThrow', alsoAccept: ['crank'], view: { initialAngle: 90 } },
    { id: 'c3', lessonId: 'lesson-a', type: 'ordering', question: 'q', items: ['first', 'second'] },
    { id: 'c4', lessonId: 'lesson-a', type: 'matching', question: 'q', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }] },
    { id: 'c5', lessonId: 'lesson-a', type: 'numeric', question: 'q', unit: 'mm', correctValue: 5, tolerance: 0.1 },
  ],
};
assert.deepEqual(validateLessonPack(samplePack), []);
assert.deepEqual(validateLessonPack({
  ...samplePack,
  lessons: [{
    ...samplePack.lessons[0],
    models: ['wright-1903-engine'],
    steps: [{ type: 'model-pose', modelId: 'wright-1903-engine', prompt: 'Inspect it.', viewPreset: 'engine-overview', focusHotspots: ['magneto'] }],
  }],
  checks: [],
}), []);

// A general/theory lesson (models: []) is the natural empty case, not a
// special error state, per the v3 "Resolved" note.
assert.deepEqual(validateLessonPack({ ...samplePack, lessons: [samplePack.lessons[1]], checks: [] }), []);

// Negative cases: each should surface exactly the kind of mistake it makes.
assert.ok(validateLessonPack({ ...samplePack, schema: '4212.lesson-pack/v1' }).some(e => e.includes('schema')));
assert.ok(validateLessonPack({
  ...samplePack,
  lessons: [{ ...samplePack.lessons[0], steps: [{ type: 'model-pose', prompt: 'no modelId', action: { type: 'angle', value: 0 } }] }],
}).some(e => e.includes('modelId')));
assert.ok(validateLessonPack({
  ...samplePack,
  lessons: [{ ...samplePack.lessons[0], models: ['cylinder'], steps: [{ type: 'model-pose', modelId: 'wright-1903', prompt: 'wrong model', action: { type: 'angle', value: 0 } }] }],
}).some(e => e.includes("not declared")));
assert.ok(validateLessonPack({
  ...samplePack,
  lessons: [{ ...samplePack.lessons[0], steps: [{ type: 'model-pose', modelId: 'cylinder', prompt: 'no action or preset' }] }],
}).some(e => e.includes('action, saved motion or static viewPreset')));
assert.ok(validateLessonPack({ ...samplePack, checks: [{ id: 'x', lessonId: 'not-a-lesson', type: 'multiple-choice', question: 'q', answers: ['a', 'b'], correct: 0 }] }).some(e => e.includes('lessonId')));

// Review status: every lesson says where it stands with the instructor; a reviewed one says when; the retired pack-level field is rejected.
assert.deepEqual([...LESSON_REVIEW_STATUSES], ['unreviewed', 'reviewed']);
const withLesson = (changes) => ({ ...samplePack, lessons: [{ ...samplePack.lessons[0], ...changes }], checks: [] });
assert.ok(validateLessonPack(withLesson({ reviewStatus: undefined })).some(e => e.includes('reviewStatus must be')));
assert.ok(validateLessonPack(withLesson({ reviewStatus: 'pending' })).some(e => e.includes('reviewStatus must be')));
assert.ok(validateLessonPack(withLesson({ reviewStatus: 'reviewed' })).some(e => e.includes('reviewedOn')));
assert.ok(validateLessonPack(withLesson({ reviewStatus: 'reviewed', reviewedOn: '5 Oct 2026' })).some(e => e.includes('reviewedOn')));
assert.ok(validateLessonPack(withLesson({ reviewStatus: 'unreviewed', reviewedOn: '2026-10-05' })).some(e => e.includes('reviewedOn only belongs')));
assert.deepEqual(validateLessonPack(withLesson({ reviewStatus: 'reviewed', reviewedOn: '2026-10-05' })), []);
assert.ok(validateLessonPack({ ...samplePack, draftStatus: 'UNREVIEWED' }).some(e => e.includes('draftStatus is retired')));

// Model registry: capability flags are required booleans.
const sampleRegistry = {
  schema: MODEL_REGISTRY_SCHEMA,
  models: [{ id: 'm', title: 't', kicker: 'k', description: 'd', adapter: 'a', supportsSection: true, supportsIsolation: true, supportsAnimateMechanism: false, hasTeachingComponents: false }],
};
assert.deepEqual(validateModelRegistry(sampleRegistry), []);
assert.ok(validateModelRegistry({ schema: MODEL_REGISTRY_SCHEMA, models: [{ id: 'm' }] }).length === 4);

// Content tree: arbitrary depth, one node type, isolate targets either kind.
const sampleTree = {
  schema: EXPLORE_CONTENT_TREE_SCHEMA,
  modelId: 'cylinder',
  root: {
    id: 'root', label: 'Root', kind: 'group',
    children: [
      { id: 'g1', label: 'Group 1', kind: 'group', children: [
        { id: 'g1a', label: 'Nested group', kind: 'group', children: [
          { id: 'c1', label: 'Leaf', kind: 'component', function: 'does a thing', evidenceStatus: 'documented', reviewStatus: 'reviewed' },
        ] },
      ] },
    ],
  },
};
assert.deepEqual(validateContentTree(sampleTree), []);
assert.ok(validateContentTree({ ...sampleTree, root: { id: 'g', label: 'g', kind: 'group', children: [] } }).some(e => e.includes('child')));
assert.ok(validateContentTree({ ...sampleTree, root: { id: 'c', label: 'c', kind: 'component', evidenceStatus: 'not-a-real-status' } }).some(e => e.includes('evidenceStatus')));

console.log('content-schema validators behave as specified');

const savedPack = structuredClone(samplePack);
savedPack.lessons[0].steps[1] = { type: 'model-pose', modelId: 'cylinder', prompt: 'Inspect the exploded pose.', savedMotionId: 'exploded', motionProgress: 50 };
assert.deepEqual(validateLessonPack(savedPack), []);
savedPack.lessons[0].steps[1].motionProgress = 101;
assert.ok(validateLessonPack(savedPack).some(error => error.includes('motionProgress')));

// A step's spotlight style: a known mode, and only together with the parts it styles.
const withStep = (step) => ({ ...samplePack, lessons: [{ ...samplePack.lessons[0], steps: [samplePack.lessons[0].steps[0], { ...samplePack.lessons[0].steps[1], ...step }] }, samplePack.lessons[1]] });
for (const mode of FOCUS_MODES) assert.deepEqual(validateLessonPack(withStep({ focusParts: ['CrankThrow'], focusMode: mode })), [], `focusMode ${mode} is valid`);
assert.deepEqual(validateLessonPack(withStep({ focusParts: ['CrankThrow'] })), [], 'focusMode is optional');
assert.match(validateLessonPack(withStep({ focusParts: ['CrankThrow'], focusMode: 'ghost' })).join('\n'), /focusMode must be one of highlight, xray, isolate/);
assert.match(validateLessonPack(withStep({ focusMode: 'isolate' })).join('\n'), /focusMode needs focusParts/);

// Check questions: each type's own rules, so a mistake in a pack is caught here and not by a student.
const withCheck = (check) => ({ ...samplePack, checks: [{ id: 'x', lessonId: 'lesson-a', question: 'q', ...check }] });
const errorsFor = (check) => validateLessonPack(withCheck(check)).join('\n');
assert.deepEqual(validateLessonPack(withCheck({ type: 'numeric', unit: 'hp', correctValue: 170 })), [], 'tolerance is optional');
assert.match(errorsFor({ type: 'numeric', unit: 'hp', correctValue: 170, tolerance: -1 }), /tolerance must be a number of 0 or more/);
assert.match(errorsFor({ type: 'numeric', unit: 'hp', correctValue: 170, tolerance: 'a bit' }), /tolerance/);
assert.match(errorsFor({ type: 'numeric', unit: '  ', correctValue: 170 }), /numeric needs a unit/);
assert.match(errorsFor({ type: 'numeric', unit: 'hp', correctValue: '170' }), /finite correctValue/);
assert.match(errorsFor({ type: 'numeric', unit: 'hp', correctValue: Number.NaN }), /finite correctValue/);
assert.deepEqual(validateLessonPack(withCheck({ type: 'model-click', modelId: 'cylinder', correctNodeId: 'PistonBody' })), [], 'alsoAccept and view are optional');
assert.match(errorsFor({ type: 'model-click', correctNodeId: 'PistonBody' }), /model-click needs modelId/);
assert.match(errorsFor({ type: 'model-click', modelId: 'cylinder' }), /model-click needs correctNodeId/);
assert.match(errorsFor({ type: 'model-click', modelId: 'cylinder', correctNodeId: 'PistonBody', alsoAccept: 'FloatingPin' }), /alsoAccept must be an array of ids/);
assert.match(errorsFor({ type: 'model-click', modelId: 'cylinder', correctNodeId: 'PistonBody', alsoAccept: ['PistonBody'] }), /alsoAccept must not repeat an id/);
assert.match(errorsFor({ type: 'model-click', modelId: 'cylinder', correctNodeId: 'PistonBody', view: { initialAngle: 'ninety' } }), /view.initialAngle must be a number/);
assert.match(errorsFor({ type: 'matching', pairs: [{ left: 'a', right: 'b' }] }), /matching needs >= 2/);
assert.match(errorsFor({ type: 'matching', pairs: [{ left: 'a', right: 'b' }, { left: 'a', right: 'c' }] }), /must each be unique/);
assert.match(errorsFor({ type: 'matching', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'b' }] }), /must each be unique/);
assert.match(errorsFor({ type: 'ordering', items: ['same', 'same'] }), /ordering items must all differ/);
assert.match(errorsFor({ type: 'multiple-choice', answers: ['same', 'same'], correct: 0 }), /answers must all differ/);
assert.match(validateLessonPack({ ...samplePack, checks: [{ ...samplePack.checks[0] }, { ...samplePack.checks[0] }] }).join('\n'), /duplicate id 'c1'/);
assert.match(errorsFor({ type: 'multiple-choice', answers: ['a', 'b'], correct: 0, question: ' ' }), /missing question/);
