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
/** How a step's spotlight (focusParts) draws attention: colour the parts, x-ray the rest, or isolate the parts. Mirrors src/viewer/core/focus-style.mjs. */
export const FOCUS_MODES = Object.freeze(['highlight', 'xray', 'isolate']);
export const NODE_KINDS = Object.freeze(['group', 'component']);
export const MEDIA_MODES = Object.freeze(['none', 'source-image', 'native-html', 'existing-3d', 'web-media', 'imagegen']);
export const MEDIA_STATUSES = Object.freeze(['not-needed', 'available', 'planned', 'needs-review']);

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
 * @property {string} [title] - short (2-4 word) label for Learn's step rail; falls back to "Step N" when absent
 * @property {string} prompt
 * @property {string} [note]
 * @property {string} [modelId] - required when type === 'model-pose'; must be one of the owning lesson's `models`
 * @property {StepAction} [action] - animated model-pose steps use an angle/cycle-angle pose
 * @property {string} [viewPreset] - static reference model-pose steps use a named camera preset instead of an action
 * @property {string[]} [focusHotspots] - optional guided hotspot ids for a static reference view
 * @property {string[]} [focusParts] - model-pose only: component ids to spotlight; the rest of the model is de-emphasised
 * @property {'highlight'|'xray'|'isolate'} [focusMode] - model-pose only, needs focusParts: how the spotlight looks (default 'xray')
 * @property {string} [focusNodeId] - model-pose only: scopes Learn's viewer to one Explore ContentNode (component or group)
 * @property {string[]} [deepDiveLinks] - ids of related deep-dive lessons (lessons with listed: false)
 * @property {string} [url] - image / external-link / web-embed source
 * @property {string} [text] - text step body
 * @property {string[]} [sourceRefs] - ids from the owning pack's optional `sources` array
 * @property {{mode:'none'|'source-image'|'native-html'|'existing-3d'|'web-media'|'imagegen', status:'not-needed'|'available'|'planned'|'needs-review', rationale:string, assetBrief?:string}} [mediaPlan]
 */

/**
 * @typedef {Object} Lesson
 * @property {string} id
 * @property {string} title
 * @property {string} objective
 * @property {string[]} models - every model id referenced anywhere in this lesson's steps; [] for a general/theory lesson
 * @property {boolean} [listed] - default true; false marks a deep dive, reachable only via a step's deepDiveLinks
 * @property {number} [sequenceNumber] - lesson number in the authoritative cross-pack curriculum order
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
 * A pack is also a "track" in the Learn/Check gallery: one browsable unit with
 * its own name and description, shown before drilling into its lessons.
 * @typedef {Object} LessonPack
 * @property {string} schema
 * @property {string} privacy
 * @property {string} [id] - stable track id for gallery navigation; required in practice once a pack is added to lessons-manifest.json, optional in the type so ad hoc/test fixtures aren't forced to set it
 * @property {string} [title] - track name shown in the Learn/Check gallery
 * @property {string} [description] - one-line track summary shown in the gallery
 * @property {string} [draftStatus] - free-text draft/review marker shown as a gallery badge when present (e.g. "UNREVIEWED CONTENT DRAFT — ..."); absent means no special status to flag
 * @property {{id:string, tier:number, title:string, path?:string, url?:string, applicability?:string}[]} [sources] - pack-local evidence registry; tier follows the instructor's 1-6 source hierarchy
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
function validateStep(step, lessonModels, lessonIndex, stepIndex, knownSourceIds) {
  const errors = [];
  const where = `lessons[${lessonIndex}].steps[${stepIndex}]`;
  if (!STEP_TYPES.includes(step.type)) errors.push(`${where}: unknown step type '${step.type}'`);
  if (!step.prompt) errors.push(`${where}: missing prompt`);
  if (step.type === 'model-pose') {
    if (!step.modelId) errors.push(`${where}: model-pose step missing modelId`);
    else if (!lessonModels.includes(step.modelId)) errors.push(`${where}: modelId '${step.modelId}' is not declared in lesson.models`);
    const hasAction = step.action && ['angle', 'cycle-angle'].includes(step.action.type) && typeof step.action.value === 'number';
    const hasReferencePreset = typeof step.viewPreset === 'string' && step.viewPreset.trim().length > 0;
    const hasSavedMotion = typeof step.savedMotionId === 'string' && step.savedMotionId.trim().length > 0;
    if (!hasAction && !hasReferencePreset && !hasSavedMotion) errors.push(`${where}: model-pose step needs a valid action, saved motion or static viewPreset`);
    if (step.motionProgress !== undefined && (!hasSavedMotion || !Number.isFinite(step.motionProgress) || step.motionProgress < 0 || step.motionProgress > 100)) errors.push(`${where}: motionProgress needs a saved motion and a value from 0 to 100`);
    if (step.focusHotspots !== undefined && (!Array.isArray(step.focusHotspots) || step.focusHotspots.some(id => typeof id !== 'string' || !id))) {
      errors.push(`${where}: focusHotspots must be an array of non-empty ids`);
    }
    if (step.focusParts !== undefined && (!Array.isArray(step.focusParts) || step.focusParts.length === 0 || step.focusParts.some(id => typeof id !== 'string' || !id))) {
      errors.push(`${where}: focusParts must be a non-empty array of component ids`);
    }
    if (step.focusMode !== undefined) {
      if (!FOCUS_MODES.includes(step.focusMode)) errors.push(`${where}: focusMode must be one of ${FOCUS_MODES.join(', ')}`);
      else if (step.focusParts === undefined) errors.push(`${where}: focusMode needs focusParts, which it styles`);
    }
  }
  if (step.deepDiveLinks && !Array.isArray(step.deepDiveLinks)) errors.push(`${where}: deepDiveLinks must be an array of lesson ids`);
  if (step.sourceRefs !== undefined) {
    if (!Array.isArray(step.sourceRefs)) errors.push(`${where}: sourceRefs must be an array`);
    else for (const sourceId of step.sourceRefs) {
      if (!knownSourceIds.has(sourceId)) errors.push(`${where}: sourceRefs contains unknown source id '${sourceId}'`);
    }
  }
  if (step.mediaPlan !== undefined) {
    if (!step.mediaPlan || typeof step.mediaPlan !== 'object') errors.push(`${where}: mediaPlan must be an object`);
    else {
      if (!MEDIA_MODES.includes(step.mediaPlan.mode)) errors.push(`${where}: invalid mediaPlan.mode '${step.mediaPlan.mode}'`);
      if (!MEDIA_STATUSES.includes(step.mediaPlan.status)) errors.push(`${where}: invalid mediaPlan.status '${step.mediaPlan.status}'`);
      if (!step.mediaPlan.rationale) errors.push(`${where}: mediaPlan needs a rationale`);
    }
  }
  return errors;
}

const isThumbnailPath = (value) => typeof value === 'string' && /^\.\/thumbnails\/[\w-]+\.webp$/.test(value);

function validateLesson(lesson, lessonIndex, knownSourceIds) {
  const errors = [];
  const where = `lessons[${lessonIndex}]`;
  if (!lesson.id) errors.push(`${where}: missing id`);
  if (lesson.thumbnail !== undefined && !isThumbnailPath(lesson.thumbnail)) errors.push(`${where}: thumbnail must be a ./thumbnails/*.webp path`);
  if (lesson.sequenceNumber !== undefined && !(Number.isInteger(lesson.sequenceNumber) && lesson.sequenceNumber > 0)) errors.push(`${where}: sequenceNumber must be a positive integer`);
  if (!Array.isArray(lesson.models)) errors.push(`${where}: models must be an array (use [] for a general/theory lesson)`);
  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) errors.push(`${where}: steps must be a non-empty array`);
  for (const [stepIndex, step] of (lesson.steps || []).entries()) {
    errors.push(...validateStep(step, lesson.models || [], lessonIndex, stepIndex, knownSourceIds));
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
  if (pack.id !== undefined && typeof pack.id !== 'string') errors.push('id must be a string');
  if (pack.title !== undefined && typeof pack.title !== 'string') errors.push('title must be a string');
  if (pack.description !== undefined && typeof pack.description !== 'string') errors.push('description must be a string');
  if (pack.thumbnail !== undefined && !isThumbnailPath(pack.thumbnail)) errors.push('thumbnail must be a ./thumbnails/*.webp path');
  const knownSourceIds = new Set();
  if (pack.sources !== undefined) {
    if (!Array.isArray(pack.sources)) errors.push('sources must be an array');
    else for (const [index, source] of pack.sources.entries()) {
      const where = `sources[${index}]`;
      if (!source.id) errors.push(`${where}: missing id`);
      else if (knownSourceIds.has(source.id)) errors.push(`${where}: duplicate id '${source.id}'`);
      else knownSourceIds.add(source.id);
      if (!(Number.isInteger(source.tier) && source.tier >= 1 && source.tier <= 6)) errors.push(`${where}: tier must be an integer from 1 to 6`);
      if (!source.title) errors.push(`${where}: missing title`);
      if (!source.path && !source.url) errors.push(`${where}: provide path or url`);
    }
  }
  if (!Array.isArray(pack.lessons) || pack.lessons.length === 0) errors.push('lessons must be a non-empty array');
  const lessonIds = (pack.lessons || []).map(lesson => lesson.id);
  (pack.lessons || []).forEach((lesson, index) => errors.push(...validateLesson(lesson, index, knownSourceIds)));
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
