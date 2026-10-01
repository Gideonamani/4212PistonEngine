import assert from 'node:assert/strict';
import {
  LESSON_PACK_SCHEMA,
  MODEL_REGISTRY_SCHEMA,
  EXPLORE_CONTENT_TREE_SCHEMA,
  validateLessonPack,
  validateModelRegistry,
  validateContentTree,
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
      models: ['cylinder'],
      steps: [
        { type: 'text', prompt: 'Read this.' },
        { type: 'model-pose', modelId: 'cylinder', prompt: 'Pose it.', action: { type: 'angle', value: 90 } },
      ],
    },
    { id: 'lesson-b', title: 'General theory', objective: 'No model needed.', models: [], steps: [{ type: 'text', prompt: 'Read this too.' }] },
  ],
  checks: [
    { id: 'c1', lessonId: 'lesson-a', type: 'multiple-choice', question: 'q', answers: ['a', 'b'], correct: 0 },
    { id: 'c2', lessonId: 'lesson-a', type: 'model-click', question: 'q', modelId: 'cylinder', correctNodeId: 'CrankThrow' },
    { id: 'c3', lessonId: 'lesson-a', type: 'ordering', question: 'q', items: ['first', 'second'] },
    { id: 'c4', lessonId: 'lesson-a', type: 'matching', question: 'q', pairs: [{ left: 'a', right: 'b' }] },
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
