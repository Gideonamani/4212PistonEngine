import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import test from 'node:test';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

// Where each numbered cylinder sits on the engine is declared in the engine contract (station and bank). This ties that table to the
// model itself: the cylinders' real positions in the GLB, with "right" and "forward" read from the model's own parts (its Right crankcase
// half, its propeller flange), and to the GTSIO-520 manual's numbering (from the rear, odd numbers on the right bank, even on the left).

const contract = JSON.parse(fs.readFileSync('data/engine-contracts/gtsio520-h-v5.json', 'utf8'));
const instances = contract.m4_foundation.cylinder_instances;
const MODEL = 'web/engine.glb.gz';

test('the declared stations follow the manual: from the rear, odd on the right, even on the left', () => {
  const byNumber = Object.fromEntries(instances.map((item) => [Number(item.id.split('-')[1]), item]));
  assert.deepEqual(Object.values(byNumber).map((item) => item.station), ['right-aft', 'left-aft', 'right-middle', 'left-middle', 'right-forward', 'left-forward']);
  for (const [number, item] of Object.entries(byNumber)) {
    assert.equal(item.bank, Number(number) % 2 ? 'right' : 'left', `cylinder ${number} is on the ${Number(number) % 2 ? 'right' : 'left'} bank`);
    assert.ok(item.station.startsWith(item.bank), `cylinder ${number}: the station names its own bank`);
  }
});

test('the web copy of the contract is the same table', () => {
  const published = JSON.parse(fs.readFileSync('web/engine-contract.json', 'utf8'));
  assert.deepEqual(published.m4_foundation.cylinder_instances, instances);
});

test('the declared stations match where the cylinders actually are in the model', async (context) => {
  if (!fs.existsSync(MODEL)) return context.skip(`${MODEL} is not restored`);
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const document = await io.readBinary(new Uint8Array(zlib.gunzipSync(fs.readFileSync(MODEL))));
  const nodes = document.getRoot().listNodes();
  const centre = (group) => {
    const boxes = group.map((node) => getBounds(node));
    return [0, 1, 2].map((axis) => (Math.min(...boxes.map((box) => box.min[axis])) + Math.max(...boxes.map((box) => box.max[axis]))) / 2);
  };
  // The crankcase halves are group nodes (no mesh of their own), so the bounds of every named node count, parts or groups.
  const named = (pattern) => nodes.filter((node) => pattern.test(node.getName()));

  // The model's own words for the right side and the front: its "Right" crankcase half and its propeller flange.
  const rightHalf = named(/^V5 Right crankcase half$/);
  const leftHalf = named(/^V5 Left crankcase half$/);
  assert.equal(rightHalf.length + leftHalf.length, 2, 'the model names a right and a left crankcase half');
  const rightSign = Math.sign(centre(rightHalf)[0]);
  const leftSign = Math.sign(centre(leftHalf)[0]);
  assert.ok(Math.abs(rightSign) === 1 && rightSign === -leftSign, `the two halves lie on opposite sides (${rightSign}, ${leftSign})`);
  const flange = named(/^RUN [|] V3 propeller flange with six bores$/);
  assert.equal(flange.length, 1, 'the model has its propeller flange');
  const forwardSign = Math.sign(centre(flange)[2] - centre([...rightHalf, ...leftHalf])[2]);
  assert.ok(Math.abs(forwardSign) === 1, 'the propeller end is on one side of the crankcase');

  const positions = new Map(instances.map((item) => {
    const number = Number(item.id.split('-')[1]);
    const group = named(new RegExp(`^C${number} [|]`)).filter((node) => node.getMesh());
    assert.ok(group.length > 20, `cylinder ${number} has its parts in the model`);
    const [x, , z] = centre(group);
    return [number, { side: Math.sign(x) === rightSign ? 'right' : 'left', ahead: forwardSign * z }];
  }));
  const ranked = [...positions.entries()].sort((a, b) => a[1].ahead - b[1].ahead).map(([number]) => number);
  assert.deepEqual(ranked, [1, 2, 3, 4, 5, 6], 'numbered from the rear forward');
  for (const item of instances) {
    const number = Number(item.id.split('-')[1]);
    const place = ['aft', 'aft', 'middle', 'middle', 'forward', 'forward'][ranked.indexOf(number)];
    assert.equal(item.station, `${positions.get(number).side}-${place}`, `cylinder ${number}`);
  }
});
