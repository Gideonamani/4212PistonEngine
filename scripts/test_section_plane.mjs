import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createSectionController } from '../src/viewer/core/section-controller.mjs';

// The cross-section plane: the three standard axes, and the plane a lesson step recommends (its `sectionPlane`). The controller needs no
// renderer, so the plane it hands to the materials is checked directly.

/** A 2 x 4 x 6 box centred on (10, 0, 0), cut by a controller whose render and change hooks do nothing. */
function setup() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshStandardMaterial());
  mesh.position.set(10, 0, 0);
  mesh.updateMatrixWorld(true);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const bounds = new THREE.Box3().setFromObject(mesh);
  const section = createSectionController([mesh], bounds, () => {}, () => {}, scene);
  const plane = () => mesh.material.clippingPlanes[0];
  /** The plane's normal, with the negative zeros a flipped axis leaves turned into plain zeros. */
  const normal = () => plane().normal.toArray().map((value) => value + 0);
  /** Where the plane cuts along its own normal, as a signed distance from the box centre. */
  const centreDistance = () => plane().distanceToPoint(bounds.getCenter(new THREE.Vector3()));
  return { section, plane, normal, centreDistance, mesh };
}

test('with no recommended plane the cut works along the axis, as it always did', () => {
  const { section, normal, centreDistance, mesh } = setup();
  section.startStep(undefined);
  assert.equal(mesh.material.clippingPlanes.length, 0, 'a step starts uncut');
  assert.equal(section.snapshot().sectionRecommended, undefined);
  section.feature.setEnabled(true);
  assert.deepEqual(normal(), [0, 0, -1], 'Z, flipped, is the starting plane');
  assert.ok(Math.abs(centreDistance()) < 1e-9, 'the middle of the model');
  section.feature.setAxis('x');
  section.feature.setPosition(75);
  assert.deepEqual(normal(), [-1, 0, 0]);
  assert.ok(Math.abs(centreDistance() - 0.5) < 1e-9, '75 per cent is a quarter of the 2 mm width past the middle');
});

test('a recommended plane is offered, starts as the plane in force, and the cut is off until the learner turns it on', () => {
  const { section, normal, centreDistance, mesh } = setup();
  section.startStep({ label: 'Valve axis', normal: [0, 1, 0], offset: 0.5 });
  assert.equal(section.snapshot().sectionRecommended, 'Valve axis');
  assert.equal(section.snapshot().sectionOnRecommended, true);
  assert.equal(section.snapshot().sectionEnabled, false);
  assert.equal(mesh.material.clippingPlanes.length, 0);
  section.feature.setEnabled(true);
  assert.deepEqual(normal(), [0, -1, 0], 'the half the normal points to is cut away');
  assert.ok(Math.abs(centreDistance()) < 1e-9);
});

test('the offset places the plane across the model along its own normal', () => {
  const { section, plane, centreDistance } = setup();
  section.startStep({ label: 'Low', normal: [0, 1, 0], offset: 0.25 });
  section.feature.setEnabled(true);
  assert.equal(section.snapshot().sectionPosition, 25);
  assert.ok(Math.abs(centreDistance() + 1) < 1e-9, 'a quarter in from one face of the 4 mm height is 1 mm below the middle');
  // A tilted normal sweeps over the box's reach in that direction: |nx|*2 + |ny|*4 for a unit normal (1, 1, 0) / sqrt 2.
  section.startStep({ label: 'Tilted', normal: [1, 1, 0], offset: 1 });
  section.feature.setEnabled(true);
  const reach = (2 + 4) / Math.SQRT2;
  assert.ok(Math.abs(Math.abs(centreDistance()) - reach / 2) < 1e-9, 'offset 1 is half the reach from the middle');
  assert.ok(Math.abs(plane().normal.length() - 1) < 1e-9, 'the normal is unit length whatever the step wrote');
});

test('choosing a standard plane leaves the recommended one on offer, and it can be chosen again', () => {
  const { section, normal } = setup();
  section.startStep({ label: 'Valve axis', normal: [0, 1, 0], offset: 0.5 });
  section.feature.setEnabled(true);
  section.feature.setAxis('x');
  assert.equal(section.snapshot().sectionOnRecommended, false);
  assert.equal(section.snapshot().sectionRecommended, 'Valve axis');
  assert.deepEqual(normal(), [-1, 0, 0]);
  section.feature.useRecommended();
  assert.equal(section.snapshot().sectionOnRecommended, true);
  assert.deepEqual(normal(), [0, -1, 0]);
});

test('the next step starts uncut, with its own recommended plane or none', () => {
  const { section, mesh } = setup();
  section.startStep({ label: 'Valve axis', normal: [0, 1, 0] });
  section.feature.setEnabled(true);
  section.feature.setPosition(90);
  section.startStep(undefined);
  assert.equal(section.snapshot().sectionEnabled, false);
  assert.equal(section.snapshot().sectionRecommended, undefined);
  assert.equal(section.snapshot().sectionOnRecommended, false);
  assert.equal(section.snapshot().sectionPosition, 50);
  assert.equal(mesh.material.clippingPlanes.length, 0);
  section.feature.useRecommended();
  assert.equal(section.snapshot().sectionOnRecommended, false, 'there is nothing to switch to');
});
