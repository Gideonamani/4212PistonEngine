import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { Document, NodeIO } from '@gltf-transform/core';

// scripts/mirror_gtsio_r10.mjs reflects the R10 source GLB in x: positions and normals change x, the winding of every triangle is reversed, nothing else changes.
// The fixture is two parts that SHARE an index buffer (identical fasteners do), which an earlier version reflected twice.
const tool = path.resolve(import.meta.dirname, 'mirror_gtsio_r10.mjs');
const tetra = [0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4]; // x, y, z of four corners
const faces = new Uint16Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]); // outward-facing (positive volume)

const volume = (positions, indices) => {
  let v = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [p, q, r] = [indices[i], indices[i + 1], indices[i + 2]].map((k) => [positions[3 * k], positions[3 * k + 1], positions[3 * k + 2]]);
    v += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6;
  }
  return v;
};

test('the reflection negates x, reverses the winding once per shared buffer and keeps names and the other axes', async () => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const sharedIndices = doc.createAccessor().setType('SCALAR').setArray(faces).setBuffer(buffer);
  const offsets = [0, 10];
  offsets.forEach((dx, k) => {
    const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array(tetra.map((v, i) => (i % 3 === 0 ? v + dx : v)))).setBuffer(buffer);
    const normals = doc.createAccessor().setType('VEC3').setArray(new Float32Array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])).setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', positions).setAttribute('NORMAL', normals).setIndices(sharedIndices);
    const node = doc.createNode(`Part${k}`).setMesh(doc.createMesh(`Mesh${k}`).addPrimitive(prim));
    scene.addChild(node);
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-'));
  const input = path.join(dir, 'in.glb.gz');
  const output = path.join(dir, 'out.glb.gz');
  const io = new NodeIO();
  fs.writeFileSync(input, zlib.gzipSync(Buffer.from(await io.writeBinary(doc))));
  execFileSync(process.execPath, [tool, input, output], { stdio: 'pipe' });
  const out = await io.readBinary(new Uint8Array(zlib.gunzipSync(fs.readFileSync(output))));
  const nodes = out.getRoot().listNodes().filter((n) => n.getMesh());
  assert.deepEqual(nodes.map((n) => n.getName()), ['Part0', 'Part1']);
  nodes.forEach((node, k) => {
    const prim = node.getMesh().listPrimitives()[0];
    const positions = prim.getAttribute('POSITION').getArray();
    const normals = prim.getAttribute('NORMAL').getArray();
    const indices = prim.getIndices().getArray();
    tetra.forEach((v, i) => {
      const expected = i % 3 === 0 ? 0 - (v + offsets[k]) : v;
      assert.equal(positions[i], expected, `part ${k} position ${i}`);
    });
    assert.deepEqual([...normals], [-1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 0, 1].map((v) => v + 0));
    assert.deepEqual([...indices], [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]); // each triangle's second and third corners swapped, once
    assert.ok(volume(positions, indices) > 0, 'the solid still faces outwards');
  });
  assert.match(out.getRoot().getExtras().handedness, /reflected x/);
});

test('a node that carries a transform is refused, because the reflection assumes baked world positions', async () => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array(tetra)).setBuffer(buffer);
  const normals = doc.createAccessor().setType('VEC3').setArray(new Float32Array(tetra)).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(faces).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', positions).setAttribute('NORMAL', normals).setIndices(indices);
  doc.createScene().addChild(doc.createNode('Moved').setTranslation([1, 0, 0]).setMesh(doc.createMesh('M').addPrimitive(prim)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-'));
  const input = path.join(dir, 'in.glb');
  fs.writeFileSync(input, Buffer.from(await new NodeIO().writeBinary(doc)));
  assert.throws(() => execFileSync(process.execPath, [tool, input, path.join(dir, 'out.glb.gz')], { stdio: 'pipe' }));
});
