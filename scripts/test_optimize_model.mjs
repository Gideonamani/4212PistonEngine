import assert from 'node:assert/strict';
import test from 'node:test';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { createGltfLoader } from '../src/viewer/core/gltf-loader.ts';
import { MAX_NORMAL_ERROR_DEGREES, optimizeModel, roundMantissa, triangleFingerprint } from './optimize_model.mjs';

// A small stand-in for a teaching model: a named hierarchy, a part whose triangles do not share vertices (as CAD exports often come out),
// a morph target, and an animation with far more keyframes than it needs.

function buildModel() {
  const document = new Document();
  const buffer = document.createBuffer();
  const accessor = (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const positions = [];
  const normals = [];
  const grid = 20;
  const point = (x, y) => [x * 0.013, y * 0.011, Math.sin(x / 4) * Math.cos(y / 5) * 0.02];
  const normalAt = (x, y) => {
    const n = [-Math.cos(x / 4) * Math.cos(y / 5) * 0.02 / 4 / 0.013, Math.sin(x / 4) * Math.sin(y / 5) * 0.02 / 5 / 0.011, 1];
    const length = Math.hypot(...n);
    return n.map((value) => value / length);
  };
  for (let y = 0; y < grid; y += 1) for (let x = 0; x < grid; x += 1) {
    // Two triangles per cell, six separate vertices, like an unwelded export.
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
      positions.push(...point(x + dx, y + dy));
      normals.push(...normalAt(x + dx, y + dy));
    }
  }
  const morph = document.createPrimitiveTarget().setAttribute('POSITION', accessor('VEC3', new Float32Array(positions.map((value) => value * 0.1))));
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(normals)))
    .addTarget(morph);
  const mesh = document.createMesh('Plate mesh').addPrimitive(primitive).setWeights([0]);
  const plate = document.createNode('Plate 1').setMesh(mesh).setTranslation([0.1, 0.2, 0.3]);
  const arm = document.createNode('Arm 2').setTranslation([0.05, 0, 0]).setRotation([0, 0, 0.3826834, 0.9238795]).addChild(plate);
  document.createScene('Scene').addChild(arm);

  const keys = 200;
  const times = new Float32Array(keys).map((_, index) => index / 50);
  const slide = new Float32Array(keys * 3);
  const spin = new Float32Array(keys * 4);
  for (let index = 0; index < keys; index += 1) {
    slide.set([index * 0.001, 0, 0], index * 3); // a straight line: only its ends matter
    const angle = index * 0.01;
    spin.set([0, 0, Math.sin(angle / 2), Math.cos(angle / 2)], index * 4); // a steady turn
  }
  const sampler = (path, output) => document.createAnimationSampler().setInput(accessor('SCALAR', times.slice())).setOutput(accessor(path === 'rotation' ? 'VEC4' : 'VEC3', output)).setInterpolation('LINEAR');
  // A curve, unlike the straight slide and steady spin, really needs most of its keyframes.
  const wave = new Float32Array(keys * 3);
  for (let index = 0; index < keys; index += 1) wave.set([0.05, Math.sin(index * 0.12) * 0.01, 0], index * 3);
  const slideSampler = sampler('translation', slide);
  const spinSampler = sampler('rotation', spin);
  const waveSampler = sampler('translation', wave);
  document.createAnimation('Work')
    .addSampler(slideSampler).addSampler(spinSampler).addSampler(waveSampler)
    .addChannel(document.createAnimationChannel().setTargetNode(plate).setTargetPath('translation').setSampler(slideSampler))
    .addChannel(document.createAnimationChannel().setTargetNode(arm).setTargetPath('rotation').setSampler(spinSampler))
    .addChannel(document.createAnimationChannel().setTargetNode(arm).setTargetPath('translation').setSampler(waveSampler));
  return document;
}

const write = async (document) => new NodeIO().registerExtensions(ALL_EXTENSIONS).writeBinary(document);
const source = await write(buildModel());

test('the optimised model is much smaller, and its surface, hierarchy and animation are kept', async () => {
  const { glb, report } = await optimizeModel(new Uint8Array(source));
  assert.equal(report.trianglesUnchanged, true);
  assert.equal(report.roundTripExact, true);
  assert.ok(report.verticesAfter < report.verticesBefore / 2, `welding ${report.verticesBefore} -> ${report.verticesAfter}`);
  assert.ok(report.optimizedBytes < report.sourceBytes * 0.35, `${report.sourceBytes} -> ${report.optimizedBytes}`);
  assert.ok(report.normalErrorDegrees <= MAX_NORMAL_ERROR_DEGREES, `normals moved ${report.normalErrorDegrees}`);
  assert.ok(report.positionErrorRelativeToModel < 1e-5, `positions moved ${report.positionErrorRelativeToModel}`);
  assert.ok(report.animation.keysAfter < report.animation.keysBefore / 2, `keys ${report.animation.keysBefore} -> ${report.animation.keysAfter}`);
  assert.ok(report.animation.rotationDegrees < 0.01 && report.animation.translationRelativeToModel < 5e-5);

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  await MeshoptDecoder.ready;
  const optimised = await io.readBinary(glb);
  const keyCounts = optimised.getRoot().listAnimations()[0].listSamplers().map((sampler) => sampler.getInput().getCount());
  assert.deepEqual(keyCounts.slice(0, 2), [2, 2], 'a straight slide and a steady spin need only their end keyframes');
  assert.ok(keyCounts[2] > 20 && keyCounts[2] < 200, `a curve keeps what it needs (${keyCounts[2]} of 200)`);
  const original = await io.readBinary(new Uint8Array(source));
  const summary = (document) => document.getRoot().listNodes().map((node) => ({ name: node.getName(), translation: node.getTranslation(), rotation: node.getRotation(), scale: node.getScale(), children: node.listChildren().map((child) => child.getName()), mesh: node.getMesh()?.getName() }));
  assert.deepEqual(summary(optimised), summary(original), 'node names, hierarchy and transforms are untouched');
  assert.deepEqual(optimised.getRoot().listAnimations().map((animation) => animation.getName()), ['Work']);
  assert.deepEqual(optimised.getRoot().listMeshes()[0].getWeights(), [0]);
  assert.equal(optimised.getRoot().listMeshes()[0].listPrimitives()[0].listTargets().length, 1, 'the morph target is kept');
});

test('the same input always gives the same bytes', async () => {
  const first = await optimizeModel(new Uint8Array(source));
  const second = await optimizeModel(new Uint8Array(source));
  assert.equal(first.report.optimizedSha256, second.report.optimizedSha256);
  assert.equal(first.report.gzipSha256, second.report.gzipSha256, 'the gzip is reproducible too');
});

test('the optimised model loads in the app loader with node names intact', async () => {
  const { glb } = await optimizeModel(new Uint8Array(source));
  const loaded = await createGltfLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  const arm = loaded.scene.children[0];
  assert.equal(arm.userData.name, 'Arm 2');
  assert.equal(arm.children[0].userData.name, 'Plate 1');
  assert.equal(arm.children[0].isMesh, true, 'the mesh stays on its own named node, with no correction node added');
  assert.equal(loaded.animations[0].name, 'Work');
});

test('the fingerprint ignores order and corner rotation but notices any change', async () => {
  const document = buildModel();
  const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const baseline = triangleFingerprint(primitive);
  assert.equal(triangleFingerprint(primitive), baseline);
  const moved = buildModel().getRoot().listMeshes()[0].listPrimitives()[0];
  moved.getAttribute('POSITION').getArray()[300] += 1e-6;
  assert.notEqual(triangleFingerprint(moved), baseline, 'a vertex moved by a micrometre changes the fingerprint');
  const turned = buildModel().getRoot().listMeshes()[0].listPrimitives()[0];
  const positions = turned.getAttribute('POSITION').getArray();
  const normals = turned.getAttribute('NORMAL').getArray();
  // Rotate the corners of the first triangle, with all its data: same surface, same winding.
  const deltas = turned.listTargets()[0].getAttribute('POSITION').getArray();
  for (const array of [positions, normals, deltas]) {
    const [a, b, c] = [array.slice(0, 3), array.slice(3, 6), array.slice(6, 9)];
    array.set(b, 0); array.set(c, 3); array.set(a, 6);
  }
  assert.equal(triangleFingerprint(turned), baseline, 'rotating a triangle keeps its winding and its fingerprint');
  const flipped = buildModel().getRoot().listMeshes()[0].listPrimitives()[0];
  const flippedPositions = flipped.getAttribute('POSITION').getArray();
  const [a, b] = [flippedPositions.slice(0, 3), flippedPositions.slice(3, 6)];
  flippedPositions.set(b, 0); flippedPositions.set(a, 3);
  assert.notEqual(triangleFingerprint(flipped), baseline, 'reversing a triangle changes its winding and its fingerprint');
});

test('rounding the mantissa keeps the error under the bits asked for', () => {
  const values = Float32Array.from({ length: 5000 }, (_, index) => Math.sin(index) * 0.3);
  const original = Float32Array.from(values);
  const worst = roundMantissa(values, 16);
  assert.ok(worst > 0, 'something was rounded');
  for (let index = 0; index < values.length; index += 1) {
    assert.ok(Math.abs(values[index] - original[index]) <= Math.abs(original[index]) * 2 ** -16, `value ${index}`);
  }
  assert.equal(roundMantissa(Float32Array.from([0, -0, 1]), 16), 0, 'zeros and powers of two are exact');
});

test('a change to positions or normals beyond the limit is refused instead of shipped', async () => {
  await assert.rejects(optimizeModel(new Uint8Array(source), { positionMantissaBits: 8 }), /Positions moved/);
  await assert.rejects(optimizeModel(new Uint8Array(source), { normalBits: 8 }), /Normals moved/);
});

test('a loose resampler tolerance is tightened per track until the measured error is within the limit', async () => {
  // The resampler drops keyframes greedily, so its tolerance does not bound the result. The optimiser measures and tightens instead.
  const { report, glb } = await optimizeModel(new Uint8Array(source), { animationTolerance: 0.05 });
  assert.ok(report.animation.translationRelativeToModel <= 1e-4, `translation error ${report.animation.translationRelativeToModel}`);
  assert.ok(report.animation.rotationDegrees <= 0.01);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  await MeshoptDecoder.ready;
  const keys = (await io.readBinary(glb)).getRoot().listAnimations()[0].listSamplers().map((sampler) => sampler.getInput().getCount());
  assert.ok(keys[2] > 20, `the curved track kept ${keys[2]} keyframes instead of being flattened by the loose tolerance`);
});

test('a track that cannot be reduced within its limit is kept exactly as it was', async () => {
  const { glb } = await optimizeModel(new Uint8Array(source), { animationTolerance: 0.05, animationRetries: 0 });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  await MeshoptDecoder.ready;
  const keys = (await io.readBinary(glb)).getRoot().listAnimations()[0].listSamplers().map((sampler) => sampler.getInput().getCount());
  assert.equal(keys[2], 200, 'the curve is untouched when the loose tolerance would have damaged it');
  assert.deepEqual(keys.slice(0, 2), [2, 2], 'straight and steady tracks are still reduced, since they lose nothing');
});
