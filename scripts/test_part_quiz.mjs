import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { learnerPartFor, parseLearnerParts } from '../src/data/learnerPartDetails.ts';
import { buildPartFacts } from '../src/components/check/partFacts.ts';
import { isAnswered, isCorrect, nodeIdsOf } from '../src/components/check/scoring.mjs';
import {
  BURIED_SHARE, MAX_KIND_COUNT, MIN_PART_SIZE, MIN_QUESTIONS, ROUND_SIZE,
  buildPartQuiz, buriedIds, cleanName, isAskable, kindOf, leadSentences, lowerFirst, partSizes, quizPool, quizSupply, seededRandom,
} from '../src/components/check/part-quiz.mjs';

// The 3D part quiz is made from each model's own part data. These tests read every model's real files, so a model added to the registry is
// held to the same promise as the rest: if it has parts to tap, it gets a quiz, and the quiz's questions all have a part to tap.

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const models = readJson('src/data/models.json');
const webPath = (url) => `web/${url.replace(/^\.\//, '').replace(/\?.*$/, '')}`;

/** The viewer's component list and groups for a model, built the way its adapter builds them (as test_model_click_questions.mjs does). */
function componentsFor(model) {
  const file = model.partDetailsUrl ? parseLearnerParts(readJson(webPath(model.partDetailsUrl))) : undefined;
  const learner = file && file.model === model.id ? file : undefined;
  if (model.adapter === 'animated-study') {
    const contract = readJson(webPath(model.contractUrl));
    const items = contract.parts.map((part) => {
      const details = learnerPartFor(learner, part.id);
      return { id: part.id, label: details?.label ?? part.label, group: part.group, groups: part.groups || [], description: details?.function.text ?? part.description, details };
    });
    const groups = (contract.groups || []).map((group) => ({ id: group.id, label: `${group.depth ? '– ' : ''}${group.label}`, depth: group.depth ?? 0, question: group.question }));
    return { items, groups };
  }
  if (model.adapter === 'operating-cylinder') {
    const items = readJson('web/components.json').parts.map((part) => {
      const details = learnerPartFor(learner, part.cad_stable_id);
      return { id: part.cad_stable_id, label: part.display_name || part.cad_stable_id, group: 'structure', description: part.function || '', details };
    });
    return { items, groups: [] };
  }
  if (model.adapter === 'full-engine') {
    const contract = readJson(webPath(model.contractUrl));
    return {
      items: contract.teaching_components.map((part) => ({ id: part.id, label: part.label, description: part.description, group: part.group })),
      groups: contract.inspection_groups.map((group) => ({ id: group.id, label: group.label })),
    };
  }
  return undefined;
}

const quizzable = models.filter((model) => componentsFor(model));
const SEEDS = Array.from({ length: 12 }, (_, index) => index + 1);

test('the registry has models to quiz on, and the static scan (no parts to tap) is not one of them', () => {
  assert.ok(quizzable.length >= 8, 'the quiz covers the engines and mechanisms that have parts');
  assert.ok(!quizzable.some((model) => model.adapter === 'static-gltf'));
});

test('every model with parts gets a quiz: enough different questions for a round, with no question written for it', () => {
  for (const model of quizzable) {
    const { items, groups } = componentsFor(model);
    const supply = quizSupply(buildPartFacts(items, groups));
    assert.ok(supply.enough, `${model.id}: only ${supply.total} questions can be made`);
    assert.ok(supply.templates.includes('name'), `${model.id}: a part name is all that is needed`);
  }
});

test('a round holds distinct questions, each with parts to tap that the model really has', () => {
  for (const model of quizzable) {
    const { items, groups } = componentsFor(model);
    const ids = new Set(items.map((item) => item.id));
    const groupIds = new Set(items.flatMap((item) => [item.group, ...(item.groups || [])]).concat(groups.map((group) => group.id)));
    const supply = quizSupply(buildPartFacts(items, groups));
    for (const seed of SEEDS) {
      const deck = buildPartQuiz(model.id, buildPartFacts(items, groups), { random: seededRandom(seed) });
      const where = `${model.id} seed ${seed}`;
      assert.equal(deck.length, Math.min(ROUND_SIZE, supply.total), `${where}: a full round, or every question the data supports`);
      assert.equal(new Set(deck.map((question) => question.id)).size, deck.length, `${where}: the same question twice`);
      for (const question of deck) {
        assert.equal(question.type, 'model-click');
        assert.equal(question.modelId, model.id);
        assert.ok(question.question.length > 8 && question.explanation.length > 8, `${where}: ${question.id} has words`);
        const accepted = [question.correctNodeId, ...(question.alsoAccept || [])];
        assert.equal(new Set(accepted).size, accepted.length, `${where}: ${question.id} repeats an accepted id`);
        for (const id of accepted) {
          assert.ok(ids.has(id), `${where}: '${id}' is not a part of ${model.id}`);
          // A tap answers with the part's id and its groups' ids, so a part id that is also a group id would make every part of that group right.
          assert.ok(!groupIds.has(id), `${where}: part id '${id}' is also a group id`);
        }
      }
    }
  }
});

test('a tap on a part the question accepts is right, and a tap on one it does not is wrong', () => {
  for (const model of quizzable) {
    const { items, groups } = componentsFor(model);
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const question of buildPartQuiz(model.id, buildPartFacts(items, groups), { random: seededRandom(3) })) {
      const accepted = new Set([question.correctNodeId, ...(question.alsoAccept || [])]);
      const right = nodeIdsOf(byId.get(question.correctNodeId));
      assert.ok(isAnswered(question, right) && isCorrect(question, right), `${model.id}: ${question.id}`);
      const wrong = items.find((item) => !accepted.has(item.id));
      if (wrong) assert.equal(isCorrect(question, nodeIdsOf(wrong)), false, `${model.id}: ${question.id} accepts everything`);
    }
  }
});

test('a job question never gives the part away, and says what the part does', () => {
  let jobs = 0;
  for (const model of quizzable) {
    const { items, groups } = componentsFor(model);
    for (const seed of SEEDS) {
      for (const question of buildPartQuiz(model.id, buildPartFacts(items, groups), { random: seededRandom(seed) })) {
        if (question.generated.template !== 'job') continue;
        jobs += 1;
        assert.ok(!question.question.toLowerCase().includes(question.generated.answer.toLowerCase()), `${model.id}: "${question.question}" names ${question.generated.answer}`);
        assert.match(question.question, /^Tap (a|the) part (that|described as)/);
      }
    }
  }
  assert.ok(jobs > 0, 'the models with learner part details ask what a part does');
});

test('only a model with learner part details asks what a part does, and only one with systems asks about a system', () => {
  const templates = (model) => quizSupply(buildPartFacts(componentsFor(model).items, componentsFor(model).groups)).templates;
  assert.ok(templates(models.find((model) => model.id === 'gtsio520-h-r10-mechanism-study')).includes('job'));
  assert.ok(!templates(models.find((model) => model.id === 'oil-pump')).includes('job'), 'the oil pump has no learner details');
  assert.ok(templates(models.find((model) => model.id === 'gnome-monosoupape-1913')).includes('system'), 'the Gnome contract names its systems');
});

test('the same seed makes the same round, and a different seed a different one', () => {
  const model = models.find((candidate) => candidate.id === 'gtsio520-h-r10-mechanism-study');
  const { items, groups } = componentsFor(model);
  const facts = buildPartFacts(items, groups);
  const ids = (seed) => buildPartQuiz(model.id, facts, { random: seededRandom(seed) }).map((question) => question.id);
  assert.deepEqual(ids(5), ids(5));
  assert.notDeepEqual(ids(5), ids(6));
});

// ---- the rules on their own ----

test('names are tidied for a question: which-one numbers go, names that contain numbers stay', () => {
  assert.equal(cleanName('Piston 5 ring'), 'Piston ring');
  assert.equal(cleanName('Mounting bolt 3'), 'Mounting bolt');
  assert.equal(cleanName('Flywheel spoke 10, port'), 'Flywheel spoke, port');
  assert.equal(cleanName('Cylinder 4 · Barrel, head and ignition'), 'Cylinder (barrel, head and ignition)');
  assert.equal(cleanName('IO-520 crankcase'), 'IO-520 crankcase');
  assert.equal(cleanName('6-cylinder block'), '6-cylinder block');
  assert.equal(kindOf({ name: 'Piston 1 ring' }), kindOf({ name: 'Piston 6 ring' }), 'six pistons’ rings are one kind');
  assert.equal(lowerFirst('Connecting rod'), 'connecting rod');
  assert.equal(lowerFirst('IO-520 crankcase'), 'IO-520 crankcase');
  assert.equal(lowerFirst('V5 case half'), 'V5 case half');
});

test('long descriptions are cut to their first sentences, without the citation', () => {
  assert.equal(leadSentences('Carries engine loads. Mounts the engine. Routes oil. Source: P1 p. 306.', 2), 'Carries engine loads. Mounts the engine.');
  assert.equal(leadSentences('One short sentence'), 'One short sentence');
});

test('sizes are shares of the whole model, and a part inside another part’s box is buried', () => {
  const boxes = [
    { id: 'case', min: [0, 0, 0], max: [10, 10, 10] },
    { id: 'piston', min: [4, 4, 4], max: [6, 6, 6] },
    { id: 'ring', min: [4.5, 4.5, 4.5], max: [5.5, 5.5, 5.5] },
    { id: 'strap', min: [9, 0, 0], max: [12, 1, 1] },
  ];
  assert.deepEqual([...buriedIds(boxes)].sort(), ['piston', 'ring'], 'the strap pokes out of the case, so it can be seen');
  const sizes = partSizes(boxes);
  assert.ok(sizes.get('case') > sizes.get('piston') && sizes.get('piston') > sizes.get('ring'));
  assert.ok(sizes.get('case') <= 1 && sizes.get('case') > 0.5);
});

test('hardware and parts too small to tap are not asked about', () => {
  assert.equal(isAskable({ id: 'a', name: 'Rocker cover screw' }), false);
  assert.equal(isAskable({ id: 'b', name: 'Lock washer' }), false);
  assert.equal(isAskable({ id: 'c', name: 'Piston', size: MIN_PART_SIZE / 2 }), false, 'too small to be a fair tap');
  assert.equal(isAskable({ id: 'd', name: 'Piston', size: MIN_PART_SIZE * 2 }), true);
  assert.equal(isAskable({ id: 'e', name: 'Piston' }), true, 'unmeasured parts are asked about');
  assert.equal(isAskable({ id: 'f', name: 'Cylinder base stud kit / washer pack' }), false, 'a slash name is a list, not a part');
  const many = Array.from({ length: MAX_KIND_COUNT + 1 }, (_, index) => ({ id: `s${index}`, name: 'Rocker arm' }));
  assert.equal(quizPool(many).kinds.length, 0, 'a kind with dozens of parts is hardware');
});

test('a round keeps a share of its questions for parts that have to be uncovered', () => {
  const facts = Array.from({ length: 40 }, (_, index) => ({ id: `p${index}`, name: `Part number ${String.fromCharCode(97 + (index % 26))}${index}`, buried: index % 2 === 0, size: 0.1 }));
  for (const seed of SEEDS) {
    const deck = buildPartQuiz('toy', facts, { random: seededRandom(seed) });
    const buried = deck.filter((question) => question.generated.buried).length;
    assert.ok(buried >= Math.ceil(ROUND_SIZE * BURIED_SHARE), `seed ${seed}: ${buried} of ${deck.length} need uncovering`);
    for (const question of deck.filter((candidate) => candidate.generated.buried)) assert.match(question.hint, /Hide the parts around it/);
  }
});

test('parts of one kind, or with one job, are all right answers', () => {
  const facts = [
    { id: 'rod1', name: 'Connecting rod 1', does: 'Carries the push to the crank.' },
    { id: 'rod2', name: 'Connecting rod 2', does: 'Carries the push to the crank.' },
    { id: 'link', name: 'Drag link', does: 'Carries the push to the crank.' },
    { id: 'crank', name: 'Crankshaft', does: 'Turns the push into rotation.' },
    { id: 'case', name: 'Crankcase', does: 'Holds the crankshaft.' },
  ];
  const deck = buildPartQuiz('toy', facts, { count: 5, random: seededRandom(1) });
  const name = deck.find((question) => question.id === 'toy:name:connecting-rod');
  const job = deck.find((question) => question.generated.template === 'job' && question.question.includes('carries the push'));
  if (name) assert.deepEqual(new Set([name.correctNodeId, ...name.alsoAccept]), new Set(['rod1', 'rod2']));
  assert.ok(job, 'the shared job is asked');
  assert.deepEqual(new Set([job.correctNodeId, ...job.alsoAccept]), new Set(['rod1', 'rod2', 'link']), 'anything that does the job counts');
});

test('a model with too little to ask about has no quiz', () => {
  assert.equal(quizSupply([{ id: 'a', name: 'Piston' }, { id: 'b', name: 'Crankshaft' }]).enough, false);
  assert.ok(MIN_QUESTIONS >= 3);
});
