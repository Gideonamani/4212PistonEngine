import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { driveTrainPlan, hubOf, isInboundPath, orientEdges, pathForMotion } from '../src/viewer/engineering/drive-train-flow.mjs';

const contract = JSON.parse(fs.readFileSync('web/accessory-drives-contract.json', 'utf8'));
const { powerPaths, gearMeshes } = contract;

test('orientEdges points every edge away from the source, whatever order the edges are listed in', () => {
  const listedBackwards = [['C', 'B'], ['B', 'A'], ['D', 'B']];
  assert.deepEqual(orientEdges(listedBackwards, 'A'), [
    { from: 'A', to: 'B', hops: 0 },
    { from: 'B', to: 'C', hops: 1 },
    { from: 'B', to: 'D', hops: 1 },
  ]);
  // The same graph driven from the other end runs the other way.
  assert.deepEqual(orientEdges(listedBackwards, 'C').map((e) => `${e.from}>${e.to}`), ['C>B', 'B>A', 'B>D']);
  // An edge the source cannot reach keeps its listed direction.
  assert.deepEqual(orientEdges([['X', 'Y']], 'A'), [{ from: 'X', to: 'Y', hops: Infinity }]);
});

test('the hub is the crankshaft gear, and only the starter path feeds it', () => {
  assert.equal(hubOf(powerPaths), 'CrankGear');
  assert.deepEqual(powerPaths.filter((path) => isInboundPath(path, 'CrankGear')).map((path) => path.id), ['starter']);
});

test('while the engine runs, torque flows out from the crankshaft gear and the starter path is idle', () => {
  const plan = driveTrainPlan(powerPaths, { motionId: 'Operating mechanism' });
  assert.equal(plan.mode, 'running');
  assert.equal(plan.inbound, false);
  const edges = plan.edges.map((edge) => `${edge.from}>${edge.to}`);
  assert.ok(edges.includes('CrankGear>IdlerGear'));
  assert.ok(edges.every((edge) => !edge.endsWith('>CrankGear')), 'nothing flows back into the crankshaft gear');
  for (const idle of ['StarterMotor', 'StarterWorm', 'WormWheel', 'ClutchSpring', 'StarterDrum', 'StarterShaftGear']) {
    assert.ok(edges.every((edge) => !edge.includes(idle)), `${idle} is idle while the engine runs`);
  }
  // Each shared edge is drawn once.
  assert.equal(new Set(edges).size, edges.length);
});

test('every flow that joins a driver and a driven gear runs from the driver to the driven gear', () => {
  const plan = driveTrainPlan(powerPaths, { motionId: 'Operating mechanism' });
  const flowing = new Set(plan.edges.map((edge) => `${edge.from}>${edge.to}`));
  let checked = 0;
  for (const mesh of gearMeshes) {
    const forward = `${mesh.driver}>${mesh.driven}`;
    const backward = `${mesh.driven}>${mesh.driver}`;
    if (!flowing.has(forward) && !flowing.has(backward)) continue;
    assert.ok(flowing.has(forward) && !flowing.has(backward), `${mesh.driver} drives ${mesh.driven}, so the flow must run ${forward}`);
    checked += 1;
  }
  assert.ok(checked >= 4, `only ${checked} gear meshes were on the plan`);
});

test('the starter path runs from the starter motor into the crankshaft gear, and a focus motion picks its path', () => {
  for (const plan of [driveTrainPlan(powerPaths, { activePathId: 'starter' }), driveTrainPlan(powerPaths, { motionId: 'Starter engagement and start' })]) {
    assert.equal(plan.mode, 'path');
    assert.equal(plan.pathId, 'starter');
    assert.equal(plan.inbound, true);
    assert.equal(plan.edges[0].from, 'StarterMotor');
    assert.equal(plan.edges.at(-1).to, 'CrankGear');
    assert.deepEqual(plan.edges.map((edge) => edge.hops), [0, 1, 2, 3, 4, 5]);
  }
  assert.equal(pathForMotion(powerPaths, 'Focus: oil-tach').id, 'oil-tach');
  assert.equal(pathForMotion(powerPaths, 'Operating mechanism'), undefined);
});

test('a chosen path wins over the motion, and its edges start at the crankshaft gear', () => {
  const plan = driveTrainPlan(powerPaths, { activePathId: 'magnetos', motionId: 'Starter engagement and start' });
  assert.equal(plan.pathId, 'magnetos');
  assert.equal(plan.inbound, false);
  assert.deepEqual(plan.edges.slice(0, 3).map((edge) => `${edge.from}>${edge.to}`), ['CrankGear>IdlerGear', 'IdlerGear>LeftMagGear', 'IdlerGear>RightMagGear']);
});
