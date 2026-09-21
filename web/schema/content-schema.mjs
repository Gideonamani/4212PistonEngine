// Canonical JSON schema/type definitions for the 4212PistonEngine lesson,
// model-registry and Explore-mode content model.
//
// Implements the decisions in docs/lesson-and-assessment-architecture.md
// (lesson pack v3, model registry v2, check-item question types) and
// docs/explore-mode-content-architecture.md (the arbitrary-depth
// component/group node tree). See both docs' "Decisions log" sections for
// the rationale behind each shape below.
//
// This module is additive on top of the schema versions the live viewer and
// training runtime already read (web/viewer.js, web/training-modes.mjs,
// web/model-router.mjs): those consume `models.json`'s flat fields and
// `m2-cylinder-lessons.json`'s `lessons[0].steps[].action` /
// `checks[].answers|correct` directly, by field name, regardless of schema
// version. The fields defined here sit alongside those, per the lesson
// doc's "evolving v1 rather than replacing it" principle, so migrating a
// pack or registry to the versions below does not require touching the
// runtime that renders it.

export const LESSON_PACK_SCHEMA = '4212.lesson-pack/v3';
export const MODEL_REGISTRY_SCHEMA = '4212.training-model-registry/v2';
export const EXPLORE_CONTENT_TREE_SCHEMA = '4212.explore-content-tree/v1';

export const STEP_TYPES = Object.freeze(['model-pose', 'image', 'text', 'external-link', 'web-embed']);
export const CHECK_TYPES = Object.freeze(['multiple-choice', 'model-click', 'ordering', 'matching', 'numeric']);
export const NODE_KINDS = Object.freeze(['group', 'component']);

// Proposed in docs/explore-mode-content-architecture.md, grounded in the
// project's existing evidence vocabulary (README "Meaning of realistic",
// data/evidence-examples.json). Flagged there as an open question pending a
// full per-component audit; treated here as the schema's value set since no
// audit has produced a different one yet. See EvidenceStatus/ReviewStatus
// note in docs/lesson-and-assessment-architecture.md open questions.
export const EVIDENCE_STATUSES = Object.freeze(['documented', 'cad-checked', 'reconstructed', 'illustrative']);
export const REVIEW_STATUSES = Object.freeze(['unreviewed', 'reviewed', 'disputed']);

export const MODEL_CAPABILITY_FLAGS = Object.freeze([
  'supportsSection',
  'supportsIsolation',
  'supportsAnimateMechanism',
  'hasTeachingComponents',
]);

/**
 * @typedef {Object} ModelRegistryEntry
 * @property {string} id
 * @property {string} label
 * @property {string} adapter
 * @property {string} title
 * @property {string} kicker
 * @property {string} description
 * @property {boolean} supportsSection
 * @property {boolean} supportsIsolation
 * @property {boolean} supportsAnimateMechanism
 * @property {boolean} hasTeachingComponents
 * @property {string} [asset_url]
 * @property {string} [asset_fallback_url]
 * @property {string} [component_catalogue_url] - flat catalogue (legacy shape, still read by web/viewer.js)
 * @property {string} [component_tree_url] - arbitrary-depth ContentNode tree for this model, additive alongside component_catalogue_url
 * @property {string} [motion_profile_url]
 * @property {string} [lesson_url]
 * @property {string} [contract_url] - full engine-contract adapters (e.g. gtsio520-h-v5-teaching-engine)
 */

/**
 * @typedef {Object} ModelRegistry
 * @property {string} schema
 * @property {ModelRegistryEntry[]} models
 */

/**
 * A model-pose step's action payload. Unchanged from lesson-pack v1.
 * @typedef {Object} StepAction
 * @property {'angle'|'cycle-angle'} type
 * @property {number} value
 */

/**
 * @typedef {Object} Step
 * @property {'model-pose'|'image'|'text'|'external-link'|'web-embed'} type
 * @property {string} prompt
 * @property {string} [note]
 * @property {string} [modelId] - required when type === 'model-pose'; must be one of the owning lesson's `models`
 * @property {StepAction} [action] - required when type === 'model-pose' (today's angle/cycle-angle pose)
 * @property {string} [focusNodeId] - model-pose only: scopes Learn's viewer to one Explore ContentNode (component or group)
 * @property {string[]} [deepDiveLinks] - ids of related deep-dive lessons (lessons with listed: false)
 * @property {string} [url] - image / external-link / web-embed source
 * @property {string} [text] - text step body
 */

/**
 * @typedef {Object} Lesson
 * @property {string} id
 * @property {string} title
 * @property {string} objective
 * @property {string[]} models - every model id referenced anywhere in this lesson's steps; [] for a general/theory lesson
 * @property {boolean} [listed] - default true; false marks a deep dive, reachable only via a step's deepDiveLinks
 * @property {number} [scheduledDay] - non-ordering classroom-scheduling hint carried over from the day-based report
 * @property {string} [completionCriteria] - narrative completion evidence, separate from any checks this lesson owns
 * @property {Step[]} steps
 */

/**
 * @typedef {Object} CheckItem
 * @property {string} id
 * @property {string} lessonId - the owning lesson's id
 * @property {'multiple-choice'|'model-click'|'ordering'|'matching'|'numeric'} type
 * @property {string} question
 * @property {string} [hint]
 * @property {string} [rationale]
 * @property {string[]} [answers] - multiple-choice (also covers true/false as the two-option case)
 * @property {number} [correct] - multiple-choice: index into answers
 * @property {string} [modelId] - model-click
 * @property {string} [correctNodeId] - model-click: id of the correct ContentNode
 * @property {string[]} [items] - ordering: already in correct order; UI shuffles for display
 * @property {{left: string, right: string}[]} [pairs] - matching
 * @property {string} [unit] - numeric
 * @property {number} [correctValue] - numeric
 * @property {number} [tolerance] - numeric
 */

/**
 * @typedef {Object} LessonPack
 * @property {string} schema
 * @property {string} privacy
 * @property {Lesson[]} lessons
 * @property {CheckItem[]} checks
 */

/**
 * One node type for both groups and components (arbitrary-depth tree).
 * @typedef {Object} ContentNode
 * @property {string} id - stable, same identity discipline as today's component ids
 * @property {string} label
 * @property {'group'|'component'} kind
 * @property {ContentNode[]} [children] - present on group nodes, absent/empty on component leaves
 * @property {string} [function] - component-only
 * @property {string} [material] - component-only
 * @property {'documented'|'cad-checked'|'reconstructed'|'illustrative'} [evidenceStatus] - component-only
 * @property {'unreviewed'|'reviewed'|'disputed'} [reviewStatus] - component-only
 */

/**
 * @typedef {Object} ContentTree
 * @property {string} schema
 * @property {string} modelId
 * @property {ContentNode} root
 */

// --- Structural validators -------------------------------------------------
// Return an array of human-readable issue strings; empty means valid.
// Deliberately dependency-free (no ajv/zod) to match this repo's plain
// ESM/no-build-step style; scripts/test_*.mjs assert against these directly.

export function validateModelRegistry(registry) {
  const errors = [];
  if (registry.schema !== MODEL_REGISTRY_SCHEMA) errors.push(`schema must be ${MODEL_REGISTRY_SCHEMA}, got ${registry.schema}`);
  if (!Array.isArray(registry.models) || registry.models.length === 0) errors.push('models must be a non-empty array');
  for (const model of registry.models || []) {
    if (!model.id) { errors.push('a model is missing id'); continue; }
    for (const flag of MODEL_CAPABILITY_FLAGS) {
      if (typeof model[flag] !== 'boolean') errors.push(`${model.id}: ${flag} must be a boolean capability flag`);
    }
  }
  return errors;
}

function validateStep(step, lessonModels, lessonIndex, stepIndex) {
  const errors = [];
  const where = `lessons[${lessonIndex}].steps[${stepIndex}]`;
  if (!STEP_TYPES.includes(step.type)) errors.push(`${where}: unknown step type '${step.type}'`);
  if (!step.prompt) errors.push(`${where}: missing prompt`);
  if (step.type === 'model-pose') {
    if (!step.modelId) errors.push(`${where}: model-pose step missing modelId`);
    else if (!lessonModels.includes(step.modelId)) errors.push(`${where}: modelId '${step.modelId}' is not declared in lesson.models`);
    if (!step.action || !['angle', 'cycle-angle'].includes(step.action.type) || typeof step.action.value !== 'number') {
      errors.push(`${where}: model-pose step missing a valid action ({type: 'angle'|'cycle-angle', value})`);
    }
  }
  if (step.deepDiveLinks && !Array.isArray(step.deepDiveLinks)) errors.push(`${where}: deepDiveLinks must be an array of lesson ids`);
  return errors;
}

function validateLesson(lesson, lessonIndex) {
  const errors = [];
  const where = `lessons[${lessonIndex}]`;
  if (!lesson.id) errors.push(`${where}: missing id`);
  if (!Array.isArray(lesson.models)) errors.push(`${where}: models must be an array (use [] for a general/theory lesson)`);
  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) errors.push(`${where}: steps must be a non-empty array`);
  for (const [stepIndex, step] of (lesson.steps || []).entries()) {
    errors.push(...validateStep(step, lesson.models || [], lessonIndex, stepIndex));
  }
  return errors;
}

function validateCheckItem(check, lessonIds, index) {
  const errors = [];
  const where = `checks[${index}]`;
  if (!CHECK_TYPES.includes(check.type)) errors.push(`${where}: unknown check type '${check.type}'`);
  if (!check.lessonId || !lessonIds.includes(check.lessonId)) errors.push(`${where}: lessonId must reference a lesson owned by this pack`);
  switch (check.type) {
    case 'multiple-choice':
      if (!Array.isArray(check.answers) || check.answers.length < 2) errors.push(`${where}: multiple-choice needs >= 2 answers`);
      if (!(Number.isInteger(check.correct) && check.correct >= 0 && check.correct < (check.answers || []).length)) {
        errors.push(`${where}: correct must index into answers`);
      }
      break;
    case 'model-click':
      if (!check.modelId) errors.push(`${where}: model-click needs modelId`);
      if (!check.correctNodeId) errors.push(`${where}: model-click needs correctNodeId`);
      break;
    case 'ordering':
      if (!Array.isArray(check.items) || check.items.length < 2) errors.push(`${where}: ordering needs >= 2 items`);
      break;
    case 'matching':
      if (!Array.isArray(check.pairs) || check.pairs.length < 1 || check.pairs.some(pair => !pair.left || !pair.right)) {
        errors.push(`${where}: matching needs >= 1 {left, right} pair`);
      }
      break;
    case 'numeric':
      if (!check.unit) errors.push(`${where}: numeric needs a unit`);
      if (typeof check.correctValue !== 'number') errors.push(`${where}: numeric needs correctValue`);
      break;
    default:
      break;
  }
  return errors;
}

export function validateLessonPack(pack) {
  const errors = [];
  if (pack.schema !== LESSON_PACK_SCHEMA) errors.push(`schema must be ${LESSON_PACK_SCHEMA}, got ${pack.schema}`);
  if (!Array.isArray(pack.lessons) || pack.lessons.length === 0) errors.push('lessons must be a non-empty array');
  const lessonIds = (pack.lessons || []).map(lesson => lesson.id);
  (pack.lessons || []).forEach((lesson, index) => errors.push(...validateLesson(lesson, index)));
  (pack.checks || []).forEach((check, index) => errors.push(...validateCheckItem(check, lessonIds, index)));
  return errors;
}

export function validateContentNode(node, path = 'root') {
  const errors = [];
  if (!node || typeof node !== 'object') return [`${path}: not an object`];
  if (!node.id) errors.push(`${path}: missing id`);
  if (!node.label) errors.push(`${path}: missing label`);
  if (!NODE_KINDS.includes(node.kind)) errors.push(`${path}: kind must be 'group' or 'component'`);
  if (node.kind === 'group') {
    if (!Array.isArray(node.children) || node.children.length === 0) errors.push(`${path}: group node must have >= 1 child`);
    for (const [index, child] of (node.children || []).entries()) {
      errors.push(...validateContentNode(child, `${path}/${node.id ?? index}`));
    }
  } else if (node.kind === 'component') {
    if (Array.isArray(node.children) && node.children.length > 0) errors.push(`${path}: component node must not have children`);
    if (node.evidenceStatus !== undefined && !EVIDENCE_STATUSES.includes(node.evidenceStatus)) errors.push(`${path}: invalid evidenceStatus '${node.evidenceStatus}'`);
    if (node.reviewStatus !== undefined && !REVIEW_STATUSES.includes(node.reviewStatus)) errors.push(`${path}: invalid reviewStatus '${node.reviewStatus}'`);
  }
  return errors;
}

export function validateContentTree(tree) {
  const errors = [];
  if (tree.schema !== EXPLORE_CONTENT_TREE_SCHEMA) errors.push(`schema must be ${EXPLORE_CONTENT_TREE_SCHEMA}, got ${tree.schema}`);
  if (!tree.modelId) errors.push('modelId is required');
  errors.push(...validateContentNode(tree.root));
  return errors;
}

/** Collects the ids of every component (leaf) node under `node`, depth-first. */
export function collectComponentIds(node, accumulator = []) {
  if (node.kind === 'component') accumulator.push(node.id);
  for (const child of node.children || []) collectComponentIds(child, accumulator);
  return accumulator;
}

/** Finds a node by id anywhere in the tree, or undefined. */
export function findNodeById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return undefined;
}
