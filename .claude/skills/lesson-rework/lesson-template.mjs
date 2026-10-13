// The shape of a lesson draft for scripts/lesson-rework/apply_lesson.mjs. Copy it to .local/lesson-rework/lessonN-content.mjs (Git ignores that
// folder) and fill it in. { keep: n, ...patch } reuses the lesson's ORIGINAL step n (0-based), so a draft can be applied only once.

const text = (title, prompt, note, sourceRefs, rationale = 'Words carry this step; a picture would add nothing the sentences do not say.') => ({
  type: 'text', title, prompt, note, sourceRefs, mediaPlan: { mode: 'none', status: 'not-needed', rationale },
});
const pose = (title, modelId, prompt, motion, note, sourceRefs, rationale, focusParts) => ({
  type: 'model-pose', title, modelId, prompt, ...motion, ...(focusParts ? { focusParts } : {}), note, sourceRefs,
  mediaPlan: { mode: 'existing-3d', status: 'available', rationale },
}); // motion: { action: { type: 'cycle-angle', value: 180 } } or { savedMotionId: 'exploded', motionProgress: 50 }
const image = (title, prompt, { url, alt, credit, license }, note, sourceRefs, rationale) => ({
  type: 'image', title, prompt, url, alt, credit, license, note, sourceRefs, mediaPlan: { mode: 'source-image', status: 'available', rationale },
});

export const LESSON_ID = 'practicals';           // the lesson's id inside its pack
export const EXPECTED_STEP_COUNT = 17;           // the step count BEFORE the rework: a second application then fails
export const COMPLETION_CRITERIA = 'One sentence that says what the learner can do at the end.';

// New entries for the pack's source registry. Existing ones can be changed with SOURCE_UPDATES = { 'source-id': { applicability: '...' } }.
export const SOURCES = [
  { id: 'example-manual', tier: 3, title: 'Example Engine Overhaul Manual', path: 'Notes/example.pdf', applicability: 'What it is the source for, and what it is not.' },
];

export const STEPS = [
  text('A step title of 40 characters or fewer',
    'The learner-facing text: 150 words or fewer, plain words, ending with a question or an action.',
    'Documented from Example Engine Overhaul Manual, PDF p. 12 (what that page says). Say which part is the lesson\'s own inference.',
    ['example-manual']),
  { keep: 3, title: 'A kept step with a new title' },
];

// Checks: the first answer of a multiple-choice question is the correct one (the app shuffles). Each has a hint and a rationale.
// Matching pairs must not already be in alphabetical order on the right-hand side. Ids are unique across the packs.
const mc = (id, question, hint, answers, rationale) => ({ id: `${LESSON_ID}-${id}`, lessonId: LESSON_ID, type: 'multiple-choice', question, hint, answers, correct: 0, rationale });
const ordering = (id, question, hint, items, rationale) => ({ id: `${LESSON_ID}-${id}`, lessonId: LESSON_ID, type: 'ordering', question, hint, items, rationale });
const matching = (id, question, hint, pairs, rationale) => ({ id: `${LESSON_ID}-${id}`, lessonId: LESSON_ID, type: 'matching', question, hint, pairs, rationale });
const numeric = (id, question, hint, unit, correctValue, rationale, tolerance = 0) => ({ id: `${LESSON_ID}-${id}`, lessonId: LESSON_ID, type: 'numeric', question, hint, unit, correctValue, tolerance, rationale });
const click = (id, question, hint, modelId, correctNodeId, rationale, alsoAccept) => ({ id: `${LESSON_ID}-${id}`, lessonId: LESSON_ID, type: 'model-click', question, hint, modelId, correctNodeId, ...(alsoAccept ? { alsoAccept } : {}), rationale });

export const CHECKS = [
  mc('example', 'Question?', 'A hint that points without giving the answer.', ['Right answer', 'Wrong one', 'Wrong two', 'Wrong three'], 'Why the right answer is right, with the source.'),
];
