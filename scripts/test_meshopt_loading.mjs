import assert from 'node:assert/strict';
import test from 'node:test';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { createGltfLoader } from '../src/viewer/core/gltf-loader.ts';

// The app's loader must read plain GLB files and ones packed with EXT_meshopt_compression into the same scene.

await MeshoptEncoder.ready;

/** A small grid of triangles with names, normals, a morph target and an animation, like one part of a teaching model. */
function buildDocument() {
  const document = new Document();
  const buffer = document.createBuffer();
  const columns = 24;
  const positions = [];
  const normals = [];
  const indices = [];
  for (let y = 0; y <= columns; y += 1) {
    for (let x = 0; x <= columns; x += 1) {
      positions.push(x * 0.37, y * 0.37, Math.sin(x / 3) * Math.cos(y / 4));
      const normal = [-Math.cos(x / 3) * Math.cos(y / 4) / 3, Math.sin(x / 3) * Math.sin(y / 4) / 4, 1];
      const length = Math.hypot(...normal);
      normals.push(...normal.map((component) => component / length));
    }
  }
  for (let y = 0; y < columns; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const a = y * (columns + 1) + x;
      indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
    }
  }
  const accessor = (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const target = document.createPrimitiveTarget().setAttribute('POSITION', accessor('VEC3', new Float32Array(positions.map((value) => value * 0.05))));
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(normals)))
    .setIndices(accessor('SCALAR', new Uint16Array(indices)))
    .addTarget(target);
  const mesh = document.createMesh('Plate mesh').addPrimitive(primitive).setWeights([0]);
  const plate = document.createNode('Plate 1').setMesh(mesh).setTranslation([1, 2, 3]);
  document.createScene('Scene').addChild(plate);

  const times = accessor('SCALAR', new Float32Array([0, 1, 2]));
  const values = accessor('VEC3', new Float32Array([0, 0, 0, 2, 0, 0, 4, 0, 0]));
  const sampler = document.createAnimationSampler().setInput(times).setOutput(values).setInterpolation('LINEAR');
  const channel = document.createAnimationChannel().setTargetNode(plate).setTargetPath('translation').setSampler(sampler);
  document.createAnimation('Slide').addSampler(sampler).addChannel(channel);
  return document;
}

async function write(document, { compress }) {
  const io = new NodeIO();
  if (compress) {
    // The same recipe as the model optimiser: normals to 12-bit integers (no node transform needed), then the lossless meshopt codec.
    await document.transform(quantize({ pattern: /^NORMAL$/, patternTargets: /^$/, quantizeNormal: 12 }));
    document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    io.registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  }
  const glb = await io.writeBinary(document);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

const load = (bytes) => createGltfLoader().parseAsync(bytes, '');

/** The values of an attribute in order, whether the file stored it interleaved or not. */
/** Each triangle starting from its smallest index. The index codec may rotate a triangle's corners; winding and triangle order are kept. */
const triangles = (index) => Array.from({ length: index.count / 3 }, (_, triangle) => {
  const corners = [index.getX(triangle * 3), index.getX(triangle * 3 + 1), index.getX(triangle * 3 + 2)];
  const start = corners.indexOf(Math.min(...corners));
  return [corners[start], corners[(start + 1) % 3], corners[(start + 2) % 3]];
});
const values = (attribute) => Array.from({ length: attribute.count }, (_, index) => [attribute.getX(index), attribute.getY(index), attribute.getZ(index)]).flat();

test('a meshopt-compressed GLB is smaller and the app loader decodes it to the same scene', async () => {
  const plain = await write(buildDocument(), { compress: false });
  const packed = await write(buildDocument(), { compress: true });
  assert.ok(packed.byteLength < plain.byteLength * 0.6, `compressed ${packed.byteLength} vs plain ${plain.byteLength}`);

  const before = await load(plain);
  const after = await load(packed);
  const [meshBefore] = before.scene.children;
  const [meshAfter] = after.scene.children;
  assert.equal(meshAfter.name, meshBefore.name, 'node names survive');
  assert.equal(meshAfter.userData.name, 'Plate 1');
  assert.deepEqual(meshAfter.position.toArray(), meshBefore.position.toArray(), 'the node transform is untouched');

  assert.deepEqual(values(meshAfter.geometry.attributes.position), values(meshBefore.geometry.attributes.position), 'positions are bit-for-bit what was encoded');
  assert.deepEqual(triangles(meshAfter.geometry.index), triangles(meshBefore.geometry.index), 'the same triangles with the same winding');

  const normalsBefore = meshBefore.geometry.attributes.normal;
  const normalsAfter = meshAfter.geometry.attributes.normal;
  let worst = 0;
  for (let index = 0; index < normalsBefore.count; index += 1) {
    // Compare directions: a quantized vector is a hair off unit length, and acos near 1 would turn that into false degrees.
    const a = [normalsBefore.getX(index), normalsBefore.getY(index), normalsBefore.getZ(index)];
    const b = [normalsAfter.getX(index), normalsAfter.getY(index), normalsAfter.getZ(index)];
    const dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
    worst = Math.max(worst, Math.acos(Math.min(1, dot)) * 180 / Math.PI);
  }
  assert.ok(worst < 0.05, `12-bit normals differ by at most ${worst.toFixed(4)} degrees`);

  assert.deepEqual(values(meshAfter.geometry.morphAttributes.position[0]), values(meshBefore.geometry.morphAttributes.position[0]), 'morph targets are exact');
  assert.equal(after.animations.length, 1);
  assert.equal(after.animations[0].name, 'Slide');
  assert.deepEqual([...after.animations[0].tracks[0].values], [...before.animations[0].tracks[0].values]);
});

test('an ordinary GLB still loads through the same loader', async () => {
  const plain = await write(buildDocument(), { compress: false });
  const loaded = await load(plain);
  assert.equal(loaded.scene.children.length, 1);
  assert.equal(loaded.scene.children[0].geometry.attributes.position.count, 25 * 25);
});
