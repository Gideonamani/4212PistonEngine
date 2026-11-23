import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { headAnchorsOf, resolveBoreAxis } from '../src/viewer/engineering/bore-geometry.mjs';
import { multiCylinderSpec } from '../src/viewer/engineering/multi-cylinder-cycle.mjs';
import { readPartBoxes } from './lib/glb-probe.mjs';

const near = (a, b, tolerance = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance);

test('an inline engine: the bore axis follows the valves, not the cylinder\'s position along the row (the Wright cylinder 1 bug)', () => {
  // Wright numbers: bores along +X from a crankshaft at x = 0, cylinders side by side along Z. Cylinder 1 is at one end of the row,
  // so "away from the middle of the barrels" is sideways (+Z) and its X part is rounding noise. The old rule flipped the axis whenever
  // that noise was negative and drew the whole overlay under the piston.
  for (const noise of [-2e-4, 0, 2e-4]) {
    const row = [0, -0.1297, -0.2594, -0.3891];
    const engineCenter = [0.291, 0, -0.1945];
    for (const z of row) {
      const result = resolveBoreAxis({
        pistonCenter: [0.2858, 0, z],
        barrelCenter: [0.291 + noise, 0, z],
        pistonSize: [0.15, 0.1011, 0.1011],
        headAnchors: headAnchorsOf({ intake: [0.415, 0.0502, z], exhaust: [0.415, -0.0502, z], head: [0.4125, 0, z] }),
        crankCenter: [0, 0, -0.244],
        engineCenter,
      });
      assert.equal(result.method, 'head-anchors');
      assert.ok(near(result.axis, [1, 0, 0], 1e-3), `row z ${z}, noise ${noise}: ${result.axis}`);
      assert.equal(result.crankConflict, false);
    }
  }
});

test('opposed, V and radial layouts all point from the crank toward the heads', () => {
  const opposed = (side) => resolveBoreAxis({ pistonCenter: [side * 0.2, 0, 0], barrelCenter: [side * 0.25, 0, 0], headAnchors: [[side * 0.4, 0.02, 0], [side * 0.4, -0.02, 0]], crankCenter: [0, 0, 0] });
  assert.ok(near(opposed(-1).axis, [-1, 0, 0]));
  assert.ok(near(opposed(1).axis, [1, 0, 0]));
  const tilt = Math.PI / 6;
  const vBank = resolveBoreAxis({ pistonCenter: [0.1, 0.17, 0], barrelCenter: [0.12, 0.2, 0], headAnchors: [[0.2, 0.34, 0.01], [0.2, 0.34, -0.01]], crankCenter: [0, 0, 0] });
  assert.ok(near(vBank.axis, [Math.sin(tilt), Math.cos(tilt), 0], 1e-2), `V bank: ${vBank.axis}`);
});

test('with no valves or head named, the piston\'s long side gives the line and the crankshaft gives the sign', () => {
  const noHeads = (barrelX) => resolveBoreAxis({ pistonCenter: [barrelX, 0, 0], barrelCenter: [barrelX, 0, 0], pistonSize: [0.15, 0.1, 0.1], crankCenter: [0, 0, 0] });
  assert.ok(near(noHeads(0.3).axis, [1, 0, 0]));
  assert.ok(near(noHeads(-0.3).axis, [-1, 0, 0]));
  assert.equal(noHeads(0.3).method, 'piston-axis');
});

test('a declared bore direction overrides everything, and a conflict with the crank is reported rather than hidden', () => {
  const hinted = resolveBoreAxis({ pistonCenter: [0, 0, 0], barrelCenter: [0, 0, 0], headAnchors: [[1, 0, 0]], hint: [0, 2, 0] });
  assert.ok(near(hinted.axis, [0, 1, 0]));
  assert.equal(hinted.method, 'hint');
  const confused = resolveBoreAxis({ pistonCenter: [0.3, 0, 0], barrelCenter: [0.3, 0, 0], headAnchors: [[0.1, 0, 0]], crankCenter: [0, 0, 0] });
  assert.equal(confused.crankConflict, true);
});

// Real positions of every shipped multi-cylinder engine. The models are not in Git: where one is not on this machine its test is skipped
// (scripts/fetch_drive_assets.py restores them).
const ENGINES = [
  ['gtsio520-h-r10-mechanism-study', 'gtsio520-r10', 'gtsio520-r10-static-opt1.glb.gz'],
  ['merlin-iii-operating-study-4', 'merlin-iii-operating-study-4', 'merlin-iii-operating-study-4.glb.gz'],
  ['gnome-monosoupape-1913', 'gnome-monosoupape-1913', 'gnome-monosoupape-1913.glb.gz'],
  ['langley-manly-balzer-1903', 'langley-manly-balzer-1903', 'langley-manly-balzer-1903.glb.gz'],
  ['wright-1903-reconstruction', 'wright-1903-reconstruction', 'wright-1903-reconstruction.glb.gz'],
];

function axesOf(modelId, contractName, file) {
  const boxes = readPartBoxes(`web/${file}`);
  if (!boxes) return undefined;
  const spec = multiCylinderSpec(modelId, JSON.parse(fs.readFileSync(`web/${contractName}-contract.json`, 'utf8')));
  const center = (id) => (id ? boxes.get(id)?.center : undefined);
  const barrels = spec.cylinders.map((c) => center(c.barrelId)).filter(Boolean);
  const engineCenter = barrels.reduce((sum, p) => sum.map((v, i) => v + p[i] / barrels.length), [0, 0, 0]);
  return spec.cylinders.map((cyl) => ({
    cyl,
    result: resolveBoreAxis({
      pistonCenter: center(cyl.pistonId),
      barrelCenter: center(cyl.barrelId),
      pistonSize: boxes.get(cyl.pistonId).size,
      headAnchors: headAnchorsOf({ intake: center(cyl.intakeValveId), exhaust: center(cyl.exhaustValveId), head: center(cyl.headId), spark: center(cyl.sparkId) }),
      crankCenter: center(spec.crankId),
      engineCenter,
    }),
  }));
}

for (const [modelId, contractName, file] of ENGINES) {
  test(`${modelId}: every cylinder's bore axis comes from its valves and points away from the crankshaft`, (t) => {
    const axes = axesOf(modelId, contractName, file);
    if (!axes) return t.skip(`web/${file} is not on this machine`);
    for (const { cyl, result } of axes) {
      assert.equal(result.method, 'head-anchors', `${modelId} cylinder ${cyl.id}`);
      assert.equal(result.crankConflict, false, `${modelId} cylinder ${cyl.id} points toward the crankshaft: ${result.axis.map((v) => v.toFixed(2))}`);
    }
  });
}

test('Wright: all four cylinders point along +X, toward the valve boxes', (t) => {
  const axes = axesOf(...ENGINES[4]);
  if (!axes) return t.skip('web/wright-1903-reconstruction.glb.gz is not on this machine');
  for (const { cyl, result } of axes) assert.ok(near(result.axis, [1, 0, 0], 0.02), `cylinder ${cyl.id}: ${result.axis.map((v) => v.toFixed(3))}`);
});

test('Merlin: the two banks lean 60 degrees apart and the cylinders in a bank point nearly the same way', (t) => {
  const axes = axesOf(...ENGINES[1]);
  if (!axes) return t.skip('web/merlin-iii-operating-study-4.glb.gz is not on this machine');
  const bank = (letter) => axes.filter(({ cyl }) => cyl.id.endsWith(letter)).map(({ result }) => result.axis);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const letter of ['A', 'B']) for (const axis of bank(letter)) assert.ok(dot(axis, bank(letter)[0]) > 0.97, `bank ${letter} is not parallel`);
  const between = Math.acos(Math.max(-1, Math.min(1, dot(bank('A')[0], bank('B')[0])))) * 180 / Math.PI;
  assert.ok(Math.abs(between - 60) < 8, `the banks are ${between.toFixed(1)} degrees apart`);
});
