import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { cylinderPartGroup } from '../src/viewer/core/component-groups.mjs';

// A model-click question names a part of a 3D model by id. The ids come from each model's own data, so this reads that data and refuses a
// question whose right answer cannot be tapped (a typo, a part that was renamed, a model that has no pickable parts).

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const models = readJson('src/data/models.json');
const manifest = readJson('web/lessons-manifest.json');
const packs = manifest.packs.map((path) => readJson(`web/${path.replace(/^\.\//, '')}`));

/** The ids a learner's tap can answer to, for each model that has pickable components: the part ids and the group ids. */
function tappableIds(model) {
  const contract = (path) => readJson(`web/${path.replace(/^\.\//, '').replace(/\?.*$/, '')}`);
  if (model.adapter === 'operating-cylinder') {
    const parts = readJson('web/components.json').parts.map((part) => part.cad_stable_id);
    return new Set([...parts, ...parts.map(cylinderPartGroup)]);
  }
  if (model.adapter === 'full-engine') {
    const engine = contract(model.contractUrl);
    return new Set([...engine.teaching_components.flatMap((part) => [part.id, part.group]), ...engine.inspection_groups.map((group) => group.id)]);
  }
  if (model.adapter === 'animated-study') {
    const study = contract(model.contractUrl);
    return new Set([...study.parts.flatMap((part) => [part.id, part.group]), ...(study.powerPaths || []).map((path) => `path:${path.id}`)]);
  }
  return new Set();
}

const clicks = packs.flatMap((pack) => (pack.checks || []).filter((check) => check.type === 'model-click').map((check) => ({ pack, check })));

test('every model-click question names a model with pickable parts, and parts and groups that exist on it', () => {
  for (const { pack, check } of clicks) {
    const where = `${pack.id}/${check.id}`;
    const model = models.find((candidate) => candidate.id === check.modelId);
    assert.ok(model, `${where}: unknown model ${check.modelId}`);
    const ids = tappableIds(model);
    assert.ok(ids.size > 0, `${where}: ${check.modelId} has no pickable parts`);
    for (const id of [check.correctNodeId, ...(check.alsoAccept || [])]) assert.ok(ids.has(id), `${where}: '${id}' is not a part or group of ${check.modelId}`);
  }
});

test('the part ids the packs rely on are read from real data (the cylinder has its parts and six groups)', () => {
  const cylinder = tappableIds(models.find((model) => model.id === 'cylinder'));
  for (const id of ['PistonBody', 'IntakeValve', 'ExhaustValve', 'UpperSparkPlug', 'CrankThrow', 'piston', 'intake', 'exhaust', 'ignition', 'structure', 'crank']) assert.ok(cylinder.has(id), id);
  const drives = tappableIds(models.find((model) => model.id === 'accessory-drives'));
  for (const id of ['AlternatorBody', 'alternator', 'starter', 'magneto-left', 'magneto-right', 'oil-tach']) assert.ok(drives.has(id), id);
});
