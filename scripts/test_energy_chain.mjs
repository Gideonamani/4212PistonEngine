import assert from 'node:assert/strict';
import test from 'node:test';
import { HEAT_SPLIT, rangesCanTotal100, STAGES } from '../src/components/energyChain.mjs';

// The energy chain in lesson 10 must run from the fuel to thrust in nine stages, each with the words the walk-through shows, and the heat
// split it draws must be the handbook's four ranges, which can add up to the whole of the heat produced.

test('the chain has nine unique stages from fuel to thrust, and each one says what turns it into the next', () => {
  assert.equal(STAGES.length, 9);
  assert.equal(new Set(STAGES.map((stage) => stage.id)).size, 9);
  assert.equal(STAGES[0].id, 'fuel');
  assert.equal(STAGES.at(-1).id, 'thrust');
  for (const stage of STAGES) for (const field of ['name', 'form', 'place', 'text', 'page']) assert.match(stage[field], /\S/, `${stage.id}: ${field}`);
  for (const stage of STAGES.slice(0, -1)) assert.match(stage.converter, /\S/, `${stage.id}: what turns it into the next stage`);
  assert.equal(STAGES.filter((stage) => stage.showsHeatSplit).length, 1, 'the heat split is shown once, at the heat stage');
  assert.equal(STAGES.find((stage) => stage.showsHeatSplit).id, 'heat');
});

test('the heat split is the handbook\'s four ranges (25-30, 15-20, 5-10 and 40-45 percent) and they can total the whole heat', () => {
  assert.deepEqual(HEAT_SPLIT.map((part) => [part.low, part.high]), [[25, 30], [15, 20], [5, 10], [40, 45]]);
  for (const part of HEAT_SPLIT) assert.ok(part.low < part.high && part.high <= 100);
  assert.ok(rangesCanTotal100());
  assert.equal(rangesCanTotal100([{ low: 60, high: 70 }, { low: 50, high: 60 }]), false, 'ranges that cannot total 100 are caught');
});
