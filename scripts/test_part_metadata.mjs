import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { COMPONENT_METADATA, getComponentMetadata } from '../src/data/componentMetadata.ts';
import { learnerPartFor, learnerSearchText, loadLearnerParts, parseLearnerParts } from '../src/data/learnerPartDetails.ts';
import { R10_MODEL_ID, allStrings, loadContractPartIds, loadDefinitions, serialise, studentProjection } from './gtsio_part_details.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const registry = readJson('src/data/models.json');
const partsFile = readJson('web/gtsio520-r10-parts.json');

/** Part ids a contract (or the cylinder's component tree) offers to the part card. */
function contractIds(contract) {
  if (Array.isArray(contract.parts)) return contract.parts.map((part) => part.id);
  if (Array.isArray(contract.teaching_components)) return contract.teaching_components.map((part) => part.id);
  return [];
}
function treeIds(node, out = []) {
  if (node?.kind === 'component') out.push(node.id);
  for (const child of node?.children ?? []) treeIds(child, out);
  return out;
}

/** Every contract in web/ except the R10 one, plus the cylinder's component tree, with the model id the registry gives it. */
function otherModelData() {
  const contracts = readdirSync(new URL('../web/', import.meta.url)).filter((name) => name.endsWith('-contract.json'));
  const targets = contracts.map((name) => {
    const model = registry.find((entry) => entry.contractUrl?.replace(/^\.\//, '').replace(/\?.*$/, '') === name);
    return { name, modelId: model?.id ?? name.replace(/-contract\.json$/, ''), data: readJson(`web/${name}`) };
  });
  const tree = readJson('web/component-tree.json');
  targets.push({ name: 'component-tree.json', modelId: tree.modelId, data: tree, ids: treeIds(tree.root) });
  return targets.filter((target) => target.modelId !== R10_MODEL_ID).map((target) => ({ ...target, ids: target.ids ?? contractIds(target.data) }));
}

test('only the GTSIO-520-H whole engine has learner part details, and its file is the one this repository builds', () => {
  const withDetails = registry.filter((entry) => entry.partDetailsUrl);
  assert.deepEqual(withDetails.map((entry) => entry.id), [R10_MODEL_ID]);
  const doc = loadDefinitions();
  const text = serialise(studentProjection(doc, loadContractPartIds()));
  const token = createHash('sha256').update(text).digest('hex').slice(0, 12);
  assert.equal(withDetails[0].partDetailsUrl, `./gtsio520-r10-parts.json?v=${token}`, 'run: node scripts/build_gtsio_part_details.mjs');
  assert.equal(partsFile.model, R10_MODEL_ID);
});

test('the learner file names every part of the R10 contract, with a label no other part shares', () => {
  const ids = loadContractPartIds();
  assert.equal(ids.length, 1396);
  const labels = new Map();
  for (const id of ids) {
    const part = learnerPartFor(partsFile, id);
    assert.ok(part, `${id} has no learner details`);
    assert.ok(part.label.length > 2 && part.function.text.length > 10, `${id} has an empty label or function`);
    assert.ok(!labels.has(part.label), `${id} and ${labels.get(part.label)} are both labelled "${part.label}"`);
    labels.set(part.label, id);
  }
  assert.deepEqual(Object.keys(partsFile.parts).sort(), [...ids].sort(), 'the learner file lists parts the contract does not have');
});

test('a part is labelled by its title, what sets its kind apart, and which one it is', () => {
  const cases = [
    ['CamGearScrew1', 'Screw · camshaft gear · no. 1'],
    ['Crankshaft', 'Crankshaft'],
  ];
  for (const [id, label] of cases) assert.equal(learnerPartFor(partsFile, id)?.label, label, id);
  assert.equal(learnerPartFor(partsFile, 'NoSuchPart'), undefined);
  assert.equal(learnerPartFor(undefined, 'Crankshaft'), undefined);
  const cylinderPart = learnerPartFor(partsFile, 'ExhaustValve1');
  assert.ok(cylinderPart?.label.endsWith('cylinder 1'), `expected a cylinder-1 label, got ${cylinderPart?.label}`);
  assert.match(learnerSearchText(learnerPartFor(partsFile, 'HydraulicLifterBody1') ?? learnerPartFor(partsFile, Object.keys(partsFile.parts).find((id) => /Lifter/.test(id)))), /tappet/i);
});

test('a missing, broken or mis-scoped learner file is ignored, never half-used', async () => {
  const realFetch = globalThis.fetch;
  const respond = (body, ok = true) => async () => ({ ok, json: async () => body });
  try {
    globalThis.fetch = respond(partsFile);
    assert.ok(await loadLearnerParts('./x.json', R10_MODEL_ID), 'the file loads for its own model');
    assert.equal(await loadLearnerParts('./x.json', 'wright-1903-engine'), undefined, 'a file for another model is ignored');
    globalThis.fetch = respond({}, false);
    assert.equal(await loadLearnerParts('./x.json', R10_MODEL_ID), undefined, 'a failed request is not an error');
    globalThis.fetch = respond({ schema: 'something-else' });
    assert.equal(await loadLearnerParts('./x.json', R10_MODEL_ID), undefined, 'an unknown schema is ignored');
    globalThis.fetch = async () => {
      throw new TypeError('network down');
    };
    assert.equal(await loadLearnerParts('./x.json', R10_MODEL_ID), undefined, 'a network failure is not an error');
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = async () => {
      throw new DOMException('aborted', 'AbortError');
    };
    await assert.rejects(loadLearnerParts('./x.json', R10_MODEL_ID, controller.signal), 'an abort still aborts the viewer');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(parseLearnerParts(null), undefined);
  assert.equal(parseLearnerParts({ schema: 'gtsio520-r10-parts/1' }), undefined);
});

test('the general register gives every other model plain metadata with no part number or source', () => {
  const others = otherModelData();
  assert.ok(others.length >= 7, `Expected the other models' contracts to be covered, got ${others.map((target) => target.name).join(', ')}`);
  let checked = 0;
  for (const { name, ids } of others) {
    assert.ok(ids.length > 0, `${name} lists no part ids`);
    for (const id of ids) {
      const meta = getComponentMetadata(id);
      assert.ok(!('partNumber' in meta) && !('source' in meta), `${name}: ${id} carries a part number or source`);
      assert.ok(meta.function.length > 0 && meta.label.length > 0, `${name}: ${id} has no label or function`);
      checked++;
    }
  }
  assert.ok(checked > 800, `Expected to check every non-R10 part id, checked ${checked}`);
});

test('no GTSIO-520-H learner text appears in another model\'s data or in the general register', () => {
  const learnerText = new Set();
  for (const definition of Object.values(partsFile.definitions)) {
    for (const claim of [definition.function, definition.sits, definition.lookFor]) learnerText.add(claim.text);
  }
  assert.ok(learnerText.size > 400, 'expected the learner sentences to be collected');
  for (const { name, data } of otherModelData()) {
    for (const text of allStrings(data)) assert.ok(!learnerText.has(text), `${name} repeats GTSIO-520-H learner text: ${text}`);
  }
  for (const [id, meta] of Object.entries(COMPONENT_METADATA)) {
    for (const text of allStrings(meta)) assert.ok(!learnerText.has(text), `the general register entry ${id} repeats GTSIO-520-H learner text: ${text}`);
  }
});

test('the part card shows no part number or catalogue source, and says the text is a draft', () => {
  const card = readFileSync(new URL('../src/viewer/PartCard.tsx', import.meta.url), 'utf8');
  assert.ok(!/partNumber|data\.source|Part No\./.test(card), 'PartCard must not render part numbers or sources');
  assert.ok(/Draft text/.test(card), 'PartCard must mark unreviewed text as a draft');
  const metadata = readFileSync(new URL('../src/data/componentMetadata.ts', import.meta.url), 'utf8');
  assert.ok(!/partNumber|GTSIO_PART_ARCHETYPES|gtsioPartArchetypes/.test(metadata), 'the general register must not carry GTSIO part numbers or archetype rules');
});

test('the R10 contract carries none of the superseded part references', () => {
  const contract = readJson('web/gtsio520-r10-contract.json');
  assert.equal(contract.parts.length, 1396);
  assert.ok(!('part_reference_status' in contract), 'the engineering-only note belongs with the definitions, not the shipped contract');
  const superseded = ['display_label', 'part_number', 'material_spec', 'operating_conditions', 'source_locator'];
  for (const part of contract.parts) {
    for (const key of superseded) assert.ok(!(key in part), `${part.id} still has ${key}`);
    assert.ok(!/P\/N|X-30040A/.test(part.label || ''), `label of ${part.id} carries a part number: ${part.label}`);
  }
  assert.ok(!/X-30040A/.test(JSON.stringify(registry)), 'The model registry must not cite the IO-520 catalogue');
  assert.ok(contract.display && Number.isFinite(contract.display.rotation_x_deg), 'the display block (model orientation) must stay');
});
