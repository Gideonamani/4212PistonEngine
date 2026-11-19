import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { layerAt, layerLabel, pullApartMotion } from '../src/components/check/pull-apart.mjs';
import { PULL_APART_HINT, buildPartQuiz, seededRandom } from '../src/components/check/part-quiz.mjs';

const models = JSON.parse(fs.readFileSync(new URL('../src/data/models.json', import.meta.url), 'utf8'));
const list = Array.isArray(models) ? models : models.models;
const web = (url) => new URL(`../web/${url.replace(/^\.\//, '').split('?')[0]}`, import.meta.url);

// The saved motions each model's viewer offers, as the adapters list them: the cylinder builds its own ids, a study takes its contract's.
function savedItems(model) {
  if (model.contractUrl) return JSON.parse(fs.readFileSync(web(model.contractUrl), 'utf8')).motions;
  if (model.savedMotionsUrl) {
    const profile = JSON.parse(fs.readFileSync(web(model.savedMotionsUrl), 'utf8'));
    return [{ id: 'operating', label: 'Operating cycle', stages: [] }, { id: 'exploded', label: 'Exploded overview', stages: profile.stages },
      { id: 'reassembly', label: 'Reassembly overview', stages: profile.stages }, ...(profile.motions ?? [])];
  }
  return [];
}

test('every model that says it has an exploded view can be pulled apart in a quiz, and no other can', () => {
  for (const model of list) {
    const exploded = (model.capabilities ?? []).some((capability) => capability.kind === 'exploded');
    const apart = pullApartMotion(savedItems(model));
    assert.equal(Boolean(apart), exploded, `${model.id}: exploded view ${exploded}, pull-apart ${apart?.id}`);
    if (!apart) continue;
    assert.doesNotMatch(apart.id, /reassembl|collapse|removal/i, `${model.id} must pull apart, not put back together`);
    assert.equal(apart.stops[0], 0, `${model.id} starts assembled`);
    assert.equal(apart.stops.at(-1), 100, `${model.id} ends fully apart`);
    assert.ok(apart.stops.length >= 3, `${model.id} has at least two layers: ${apart.stops}`);
    assert.deepEqual(apart.stops, [...apart.stops].sort((a, b) => a - b));
  }
});

test('the cylinder pulls apart in its five stages: four layers', () => {
  const cylinder = list.find((model) => model.id === 'cylinder');
  assert.deepEqual(pullApartMotion(savedItems(cylinder)), { id: 'exploded', stops: [0, 25, 50, 75, 100] });
});

test('a motion with no stages of its own still pulls apart, and nothing pulls apart a model with no exploded view', () => {
  assert.deepEqual(pullApartMotion([{ id: 'Exploded overview', stages: [] }]), { id: 'Exploded overview', stops: [0, 100] });
  assert.equal(pullApartMotion([{ id: 'Operating mechanism', stages: [] }, { id: 'Reassembly overview', stages: [] }]), undefined);
  assert.equal(pullApartMotion(undefined), undefined);
});

test('the slider reads the nearest layer and never names a stage', () => {
  const stops = [0, 33.333, 66.667, 100];
  assert.equal(layerAt(0, stops), 0);
  assert.equal(layerAt(34, stops), 1);
  assert.equal(layerAt(60, stops), 2);
  assert.equal(layerAt(100, stops), 3);
  assert.equal(layerLabel(0, 3), 'Assembled');
  assert.equal(layerLabel(2, 3), 'Layer 2 of 3');
  assert.equal(layerLabel(3, 3), 'Fully apart (layer 3 of 3)');
});

test('the uncover hint offers pulling apart only on a model that can be', () => {
  const facts = Array.from({ length: 30 }, (_, index) => ({ id: `p${index}`, name: `Part ${String.fromCharCode(97 + (index % 26))}${index}`, buried: index % 2 === 0, size: 0.1 }));
  const plain = buildPartQuiz('toy', facts, { random: seededRandom(7) }).filter((question) => question.generated.buried);
  const apart = buildPartQuiz('toy', facts, { random: seededRandom(7), pullApart: true }).filter((question) => question.generated.buried);
  assert.ok(plain.length && apart.length);
  for (const question of plain) assert.doesNotMatch(question.hint, /Pull the model apart/);
  for (const question of apart) assert.equal(question.hint, PULL_APART_HINT);
  // The same seed asks the same questions; only the hint differs.
  assert.deepEqual(apart.map((question) => question.id), plain.map((question) => question.id));
});
