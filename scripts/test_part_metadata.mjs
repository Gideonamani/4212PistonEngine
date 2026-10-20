import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { getGenericPartInfo } from '../src/data/genericPartInfo.ts';
import { learnerPartFor, learnerSearchText, loadLearnerParts, parseLearnerParts } from '../src/data/learnerPartDetails.ts';
import { CYLINDER_MODEL_ID, R10_MODEL_ID, allStrings, instanceDocFor, loadStore, modelPartIds, outPathFor, projectModel, projectedModels, serialise } from './part_store.mjs';

// What a learner reads on the part card, from the app's side: the learner file the store projects for the GTSIO-520-H whole engine and the
// operating cylinder, and the general fallback every other model still has (src/data/genericPartInfo.ts). The store itself is tested in
// test_part_store.mjs and test_knowledge_store.py.

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const registry = readJson('src/data/models.json');
const loaded = loadStore();
const r10File = readJson('web/gtsio520-r10-parts.json');
const cylinderFile = readJson('web/cylinder-parts.json');

/** The models that have no learner part details yet and so still show the general fallback. A model leaves this list when it is given definitions in the store. */
const STILL_ON_THE_FALLBACK = ['accessory-drives', 'gtsio520-h-v5-teaching-engine', 'hydraulic-tappet', 'langley-manly-balzer-1903', 'oil-pump', 'wright-1903-engine', 'wright-1903-reconstruction'];

/** Part ids a contract (or the cylinder's component tree) offers to the part card. */
function contractIds(contract) {
  if (Array.isArray(contract.parts)) return contract.parts.map((part) => part.id);
  if (Array.isArray(contract.teaching_components)) return contract.teaching_components.map((part) => part.id);
  return [];
}

/** Every contract in web/ except the R10 one, with the model id the registry gives it: the data of the models on the fallback. */
function fallbackModelData() {
  const contracts = readdirSync(new URL('../web/', import.meta.url)).filter((name) => name.endsWith('-contract.json'));
  return contracts
    .map((name) => {
      const model = registry.find((entry) => entry.contractUrl?.replace(/^\.\//, '').replace(/\?.*$/, '') === name);
      const data = readJson(`web/${name}`);
      return { name, modelId: model?.id ?? name.replace(/-contract\.json$/, ''), data, ids: contractIds(data) };
    })
    .filter((target) => target.modelId !== R10_MODEL_ID);
}

test('only the GTSIO-520-H whole engine and the operating cylinder have learner part details, and their files are the ones this repository builds', () => {
  const withDetails = registry.filter((entry) => entry.partDetailsUrl).map((entry) => entry.id);
  assert.deepEqual(withDetails.sort(), [CYLINDER_MODEL_ID, R10_MODEL_ID].sort());
  const projected = projectedModels(loaded);
  assert.deepEqual(projected.map((doc) => doc.model).sort(), withDetails);
  for (const doc of projected) {
    const entry = registry.find((model) => model.id === doc.model);
    const text = serialise(projectModel(loaded, doc.model));
    const token = createHash('sha256').update(text).digest('hex').slice(0, 12);
    assert.equal(entry.partDetailsUrl, `${doc.projection.registryUrl}?v=${token}`, `${doc.model}: run: node scripts/build_part_details.mjs`);
    assert.equal(JSON.parse(readFileSync(outPathFor(doc), 'utf8')).model, doc.model);
  }
});

test('the learner file names every part of the R10 contract, with a label no other part shares', () => {
  const ids = modelPartIds(instanceDocFor(loaded, R10_MODEL_ID));
  assert.equal(ids.length, 1396);
  const labels = new Map();
  for (const id of ids) {
    const part = learnerPartFor(r10File, id);
    assert.ok(part, `${id} has no learner details`);
    assert.ok(part.label.length > 2 && part.function.text.length > 10, `${id} has an empty label or function`);
    assert.ok(!labels.has(part.label), `${id} and ${labels.get(part.label)} are both labelled "${part.label}"`);
    labels.set(part.label, id);
  }
  assert.deepEqual(Object.keys(r10File.parts).sort(), [...ids].sort(), 'the learner file lists parts the contract does not have');
});

test('the learner file names every part of the operating cylinder, with a label no other part shares', () => {
  const catalogue = readJson('web/components.json');
  const ids = catalogue.parts.map((part) => part.cad_stable_id);
  assert.equal(ids.length, 61);
  assert.deepEqual(modelPartIds(instanceDocFor(loaded, CYLINDER_MODEL_ID)).sort(), [...ids].sort());
  const labels = new Map();
  for (const id of ids) {
    const part = learnerPartFor(cylinderFile, id);
    assert.ok(part, `${id} has no learner details`);
    assert.ok(part.label.length > 2 && part.function.text.length > 10 && part.madeOf.text.length > 2, `${id} has an empty label, function or material`);
    assert.ok(!labels.has(part.label), `${id} and ${labels.get(part.label)} are both labelled "${part.label}"`);
    labels.set(part.label, id);
    assert.equal(part.review, 'draft', `${id}: the cylinder text is a draft until the instructor reviews it`);
  }
  assert.deepEqual(Object.keys(cylinderFile.parts).sort(), [...ids].sort());
});

test('a part is labelled by its title, what sets its kind apart, and which one it is', () => {
  const cases = [
    [r10File, 'CamGearScrew1', 'Screw · camshaft gear · no. 1'],
    [r10File, 'Crankshaft', 'Crankshaft'],
    [cylinderFile, 'PistonRing1', 'Compression ring · top groove'],
  ];
  for (const [file, id, label] of cases) assert.equal(learnerPartFor(file, id)?.label, label, id);
  assert.equal(learnerPartFor(r10File, 'NoSuchPart'), undefined);
  assert.equal(learnerPartFor(undefined, 'Crankshaft'), undefined);
  const cylinderPart = learnerPartFor(r10File, 'ExhaustValve1');
  assert.ok(cylinderPart?.label.endsWith('cylinder 1'), `expected a cylinder-1 label, got ${cylinderPart?.label}`);
  assert.match(learnerSearchText(learnerPartFor(r10File, 'HydraulicLifterBody1') ?? learnerPartFor(r10File, Object.keys(r10File.parts).find((id) => /Lifter/.test(id)))), /tappet/i);
});

test('a part with wording of its own reads it, and a part without reads its definition', () => {
  // The file the cylinder ships has no per-part wording left (each kind's parts say the same), so the rule is tested on a copy that has some.
  const file = structuredClone(cylinderFile);
  const [definitionId] = file.parts.PistonRing1;
  const own = { text: 'a different cast iron', status: 'inferred', basis: 'a test' };
  file.overrides = { PistonRing1: { madeOf: own, sits: { text: 'in the first groove', status: 'derived', source: 'a test' }, system: 'gas', review: 'reviewed' } };
  const ring = learnerPartFor(file, 'PistonRing1');
  assert.equal(ring.madeOf.text, 'a different cast iron');
  assert.equal(ring.sits.text, 'in the first groove');
  assert.equal(ring.system.id, 'gas');
  assert.equal(ring.review, 'reviewed');
  assert.equal(ring.function.text, file.definitions[definitionId].function.text, 'the ring keeps its definition\'s function');
  const other = learnerPartFor(file, 'PistonRing2');
  assert.equal(other.madeOf.text, file.definitions[definitionId].madeOf.text, 'a part without wording of its own reads its definition');
  assert.equal(other.review, 'draft');
  assert.ok(learnerSearchText(ring).length > 0);
  // The shipped file reads the same way, with no overrides at all.
  assert.equal(learnerPartFor(cylinderFile, 'PistonRing1').madeOf.text, cylinderFile.definitions[definitionId].madeOf.text);
});

test('a missing, broken or mis-scoped learner file is ignored, never half-used', async () => {
  const realFetch = globalThis.fetch;
  const respond = (body, ok = true) => async () => ({ ok, json: async () => body });
  try {
    globalThis.fetch = respond(r10File);
    assert.ok(await loadLearnerParts('./x.json', R10_MODEL_ID), 'the file loads for its own model');
    assert.equal(await loadLearnerParts('./x.json', 'wright-1903-engine'), undefined, 'a file for another model is ignored');
    globalThis.fetch = respond(cylinderFile);
    assert.ok(await loadLearnerParts('./x.json', CYLINDER_MODEL_ID), 'the cylinder file loads for the cylinder');
    assert.equal(await loadLearnerParts('./x.json', R10_MODEL_ID), undefined, 'the cylinder file is not read as the R10 one');
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

test('the models still on the general fallback are the ones listed here, and the fallback makes no claim about a part', () => {
  const noDetails = registry.filter((entry) => !entry.partDetailsUrl).map((entry) => entry.id).sort();
  assert.deepEqual(noDetails, STILL_ON_THE_FALLBACK, 'a model gained or lost learner part details: update STILL_ON_THE_FALLBACK');
  const others = fallbackModelData();
  assert.ok(others.length >= 6, `Expected the other models' contracts to be covered, got ${others.map((target) => target.name).join(', ')}`);
  let checked = 0;
  for (const { name, ids } of others) {
    assert.ok(ids.length > 0, `${name} lists no part ids`);
    for (const id of ids) {
      const info = getGenericPartInfo(id);
      assert.deepEqual(Object.keys(info).sort(), ['function', 'id', 'label', 'material', 'system', 'systemColor'], `${name}: ${id} carries more than the general fields`);
      assert.equal(info.function, getGenericPartInfo('anything-else').function, `${name}: ${id} has a function line of its own, which the fallback must not`);
      assert.equal(info.material, getGenericPartInfo('anything-else').material, `${name}: ${id} has a material line of its own, which the fallback must not`);
      assert.ok(info.label.length > 0, `${name}: ${id} has no label`);
      checked++;
    }
  }
  assert.ok(checked > 800, `Expected to check every non-R10 part id, checked ${checked}`);
  // What a model passes in is shown as given.
  const given = getGenericPartInfo('PistonRing1', 'Top compression ring', 'Seals the gas.');
  assert.equal(given.label, 'Top compression ring');
  assert.equal(given.function, 'Seals the gas.');
});

test('the retired hand-written register is gone: no part value is read from a table without a status', () => {
  const generic = readFileSync(new URL('../src/data/genericPartInfo.ts', import.meta.url), 'utf8');
  assert.ok(!/COMPONENT_METADATA|getComponentMetadata|partNumber|operatingConditions|\bkN\b|°C/.test(generic), 'genericPartInfo.ts must hold no per-part table, number or condition');
  assert.ok(!/['"][A-Z][A-Za-z0-9]+['"]\s*:\s*\{/.test(generic), 'genericPartInfo.ts must hold no id-keyed entries');
  const src = [];
  const walk = (dir) => {
    for (const entry of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
      else if (/\.(ts|tsx)$/.test(entry.name)) src.push(`${dir}/${entry.name}`);
    }
  };
  walk('src');
  walk('e2e');
  for (const file of src) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!/componentMetadata|getComponentMetadata|COMPONENT_METADATA/.test(text), `${file} still reads the retired register`);
  }
  // Every value the retired table held is accounted for in the store, with the fate it was given.
  const retired = loaded.definitions.flatMap((d) => d.engineering.legacyValues ?? []);
  assert.equal(retired.length, 56, '28 parts x material and operating conditions');
  assert.equal(new Set(retired.map((item) => `${item.part}.${item.field}`)).size, 56);
  for (const item of retired) {
    assert.ok(['specified', 'derived', 'inferred', 'illustrative', 'unsourced'].includes(item.status), `${item.part}.${item.field} has no status`);
    assert.ok(item.status === 'unsourced' ? item.disposition === 'dropped' : item.source || item.basis, `${item.part}.${item.field}: kept without a source`);
  }
});

test('no GTSIO-520-H or cylinder learner text appears in another model\'s data', () => {
  const learnerText = new Set();
  for (const file of [r10File, cylinderFile]) {
    for (const definition of Object.values(file.definitions)) {
      for (const claim of [definition.function, definition.sits, definition.lookFor]) learnerText.add(claim.text);
    }
    for (const own of Object.values(file.overrides ?? {})) for (const claim of Object.values(own)) if (typeof claim === 'object') learnerText.add(claim.text);
  }
  // A sentence, not a word like "steel" that any model's data may say.
  for (const text of [...learnerText]) if (text.split(/\s+/).length < 5) learnerText.delete(text);
  assert.ok(learnerText.size > 400, 'expected the learner sentences to be collected');
  for (const { name, data } of fallbackModelData()) {
    for (const text of allStrings(data)) assert.ok(!learnerText.has(text), `${name} repeats learner text: ${text}`);
  }
});

test('the part card shows no part number or catalogue source, and says the text is a draft', () => {
  const card = readFileSync(new URL('../src/viewer/PartCard.tsx', import.meta.url), 'utf8');
  assert.ok(!/partNumber|data\.source|Part No\./.test(card), 'PartCard must not render part numbers or sources');
  assert.ok(/Draft text/.test(card), 'PartCard must mark unreviewed text as a draft');
  assert.ok(!/Connected components|onSelectPart/.test(card), 'PartCard must not offer the retired Operating and Connected components lists');
  const adapter = readFileSync(new URL('../src/viewer/adapters/cylinderAdapter.ts', import.meta.url), 'utf8');
  assert.ok(/partDetailsUrl/.test(adapter) && /loadLearnerParts/.test(adapter), 'the cylinder adapter must read the learner part details');
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
