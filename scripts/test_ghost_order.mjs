import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { OVER_GHOST_ORDER, drawOverGhost } from '../src/viewer/core/ghost-order.mjs';

// A solid part drawn while others are ghosted moves into three.js's see-through pass, after the ghost, so the ghost's layers never cover it.

const mesh = (material) => new THREE.Mesh(new THREE.BoxGeometry(), material);

test('a part drawn over the ghost comes after it, still opaque, and goes back as it was', () => {
  const material = new THREE.MeshStandardMaterial();
  const part = mesh(material);
  const version = material.version;
  drawOverGhost(part, true);
  assert.equal(part.renderOrder, OVER_GHOST_ORDER);
  assert.ok(OVER_GHOST_ORDER > 0, 'after the ghost, which stays at the default order');
  assert.equal(material.transparent, true, 'in the see-through pass, which three.js draws after the opaque one');
  assert.equal(material.opacity, 1, 'and still fully opaque');
  assert.equal(material.depthWrite, true, 'and still hiding what is behind it');
  assert.ok(material.version > version, 'the material is rebuilt, since three.js compiles opaque and see-through materials differently');
  drawOverGhost(part, false);
  assert.equal(part.renderOrder, 0);
  assert.equal(material.transparent, false);
});

test('a material that is see-through of its own stays so', () => {
  const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4 });
  const part = mesh(glass);
  drawOverGhost(part, true);
  drawOverGhost(part, false);
  assert.equal(glass.transparent, true);
  assert.equal(glass.opacity, 0.4);
});

test('every material of a multi-material part is moved, and a repeat call changes nothing', () => {
  const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
  const part = mesh(materials);
  drawOverGhost(part, true);
  assert.ok(materials.every((material) => material.transparent));
  const versions = materials.map((material) => material.version);
  drawOverGhost(part, true);
  assert.deepEqual(materials.map((material) => material.version), versions, 'no rebuild when nothing changes');
});
