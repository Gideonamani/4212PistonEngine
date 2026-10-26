import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { explosionAmount, movesOf, offsetAt, stopsOf } from '../src/viewer/core/saved-motions.mjs';

// The cylinder's saved motions (web/cylinder-saved-motions.json): the exploded overview, and the removal order from the GTSIO-520 overhaul
// manual, Section VII (issue #75). This pins the way a part moves, and that the removal motion keeps the manual's order.

const data = JSON.parse(fs.readFileSync('web/cylinder-saved-motions.json', 'utf8'));
const removal = data.motions.find((motion) => motion.id === 'removal');

test('a part moves once, or several times in turn, each move as far along as its stage', () => {
  assert.deepEqual(movesOf({ stage: 2, offset_m: [1, 0, 0] }), [{ stage: 2, offset_m: [1, 0, 0] }], 'the overview\'s single move');
  const valve = { moves: [{ stage: 1, offset_m: [0.3, 0, 0] }, { stage: 2, offset_m: [0, 0.1, 0] }] };
  assert.deepEqual(offsetAt(valve, 0, 2), [0, 0, 0]);
  assert.deepEqual(offsetAt(valve, 50, 2), [0.3, 0, 0], 'out with the cylinder');
  assert.deepEqual(offsetAt(valve, 100, 2).map((value) => Math.round(value * 1000) / 1000), [0.3, 0.1, 0], 'then out of it');
  assert.deepEqual(offsetAt({ moves: [] }, 100, 2), [0, 0, 0], 'a part with no moves stays put');
  assert.equal(explosionAmount(75, 2, 2), 0.5);
  assert.deepEqual(stopsOf([{ progress: 0 }, { progress: 50 }]), [0, 50]);
});

test('the removal motion moves every part the overview does, through stages that run from 0 to 100', () => {
  assert.ok(removal, 'a removal motion is listed');
  assert.deepEqual(Object.keys(removal.parts).sort(), Object.keys(data.parts).sort());
  const progress = removal.stages.map((stage) => stage.progress);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 100);
  assert.ok(progress.every((value, index) => index === 0 || value > progress[index - 1]), 'stages in order');
  for (const [id, part] of Object.entries(removal.parts)) {
    for (const { stage } of movesOf(part)) assert.ok(Number.isInteger(stage) && stage > 0 && stage < removal.stages.length, `${id}: stage ${stage}`);
  }
  assert.match(removal.scope, /overhaul manual/);
  assert.match(removal.scope, /illustrative/);
});

test('parts come off in the manual\'s order: covers, rockers and pushrods, housings, cylinder, valves, piston, tappets, rod', () => {
  const first = (id) => Math.min(...movesOf(removal.parts[id]).map((move) => move.stage));
  const order = ['IntakeRockerCover', 'IntakeRockerArm', 'IntakePushrodHousing', 'CylinderHead', 'IntakeValveKeeper', 'PistonBody', 'IntakeHydraulicLifterBody', 'ConnectingRodCap'];
  const stages = order.map((id) => Math.max(...movesOf(removal.parts[id]).map((move) => move.stage)));
  assert.ok(stages.every((value, index) => index === 0 || value > stages[index - 1]), `in order: ${order.map((id, index) => `${id} ${stages[index]}`).join(', ')}`);
  assert.equal(first('IntakePushrod'), first('IntakeRockerArm'), 'the pushrods come out with the rockers (7-15b)');
  assert.equal(first('IntakeValve'), first('CylinderHead'), 'a valve leaves with its cylinder before it comes out of it');
  assert.deepEqual(movesOf(removal.parts.IntakeValve)[0].offset_m, movesOf(removal.parts.CylinderHead)[0].offset_m);
  assert.equal(first('FloatingPin'), first('PistonBody'), 'pin, piston and rings come off as an assembly (7-15g)');
  assert.deepEqual(movesOf(removal.parts.CrankThrow), [], 'the crankshaft stays');
  for (const [index, cite] of [[3, '7-15b'], [5, '7-15d'], [9, '7-18b']]) assert.ok(removal.stages[index].note.includes(cite), `stage ${index} cites ${cite}`);
});
