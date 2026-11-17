import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { choosePickHit } from '../src/viewer/core/picking.mjs';

function fixture() {
  const front = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial());
  const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial());
  back.position.z = -1;
  const parent = new THREE.Group(); parent.add(front, back); parent.updateMatrixWorld(true);
  const hits = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1)).intersectObjects([front, back]);
  return { front, back, parent, hits };
}
const excludes = new THREE.Plane(new THREE.Vector3(1, 0, 0), -1);
const includes = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1);

test('clipped foreground fragments do not steal a tap from the visible surface behind', () => {
  const { front, back, hits } = fixture();
  assert.equal(choosePickHit(hits).object, front);
  front.material.clippingPlanes = [excludes];
  assert.equal(choosePickHit(hits).object, back);
  assert.equal(choosePickHit(hits, { localClippingEnabled: false }).object, front);
  assert.equal(choosePickHit(hits, { clippingPlanes: [excludes] }), undefined);
});

test('local clipping intersection and per-triangle material visibility match rendering', () => {
  const { front, back, hits } = fixture();
  front.material.clippingPlanes = [excludes, includes];
  assert.equal(choosePickHit(hits).object, back);
  front.material.clipIntersection = true;
  assert.equal(choosePickHit(hits).object, front);
  front.material = [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshBasicMaterial()];
  assert.equal(choosePickHit(hits).object, back);
  for (const hit of hits) if (hit.object === front) hit.face.materialIndex = 1;
  assert.equal(choosePickHit(hits).object, front);
});

test('solid surfaces win over ghost context, with a selectable ghost fallback', () => {
  const { front, back, hits } = fixture();
  front.material.transparent = true; front.material.opacity = .18;
  assert.equal(choosePickHit(hits).object, front, 'ordinary transparent material is not implicitly context');
  front.userData.pickContext = true;
  assert.equal(choosePickHit(hits).object, back);
  back.visible = false;
  assert.equal(choosePickHit(hits).object, front, 'context remains selectable when no solid surface is hit');
  front.material.opacity = 0;
  assert.equal(choosePickHit(hits), undefined);
});

test('a visible child of a hidden group is not pickable', () => {
  const { parent, hits } = fixture(); parent.visible = false;
  assert.equal(choosePickHit(hits), undefined);
});
