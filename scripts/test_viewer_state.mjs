import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { lessonProfile, viewFromStep, viewKey } from '../src/viewer/core/view-state.mjs';
import { offsetAfterKey } from '../src/viewer/core/keyboard-orbit.mjs';

test('a lesson step maps to the view the viewer applies', () => {
  assert.deepEqual(viewFromStep({ action: { type: 'cycle-angle', value: 400 }, focusParts: ['CylinderHead'], focusMode: 'isolate', savedMotionId: 'exploded', motionProgress: 50, viewPreset: 'x', focusHotspots: ['a'] }), {
    savedMotionId: 'exploded', motionProgress: 50, initialAngle: 400, initialCycle: true, viewPreset: 'x', focusHotspots: ['a'], focusParts: ['CylinderHead'], focusMode: 'isolate',
  });
  assert.equal(viewFromStep({ action: { type: 'angle', value: 90 } }).initialCycle, false);
  assert.equal(viewFromStep({ action: { type: 'angle', value: 90 } }).initialAngle, 90);
  assert.equal(viewFromStep({ action: { type: 'angle', value: 'full' } }).initialAngle, undefined, 'only numbers are angles');
  assert.equal(viewFromStep({}).initialCycle, false);
});

test('the view key changes only when something the viewer shows changes', () => {
  const base = { initialAngle: 90, focusParts: ['a', 'b'] };
  assert.equal(viewKey(base), viewKey({ ...base }));
  assert.equal(viewKey({ initialAngle: 90 }), viewKey({ initialAngle: 90, viewPreset: undefined }), 'undefined and absent are the same');
  assert.equal(viewKey(base), viewKey({ initialAngle: 90, focusParts: ['a', 'b'] }), 'a new array with the same parts is not a change');
  for (const change of [{ initialAngle: 91 }, { initialCycle: true }, { viewPreset: 'engine-overview' }, { focusHotspots: ['magneto'] }, { focusParts: ['a'] }, { focusMode: 'isolate' }, { savedMotionId: 'exploded' }, { motionProgress: 25 }]) {
    assert.notEqual(viewKey(base), viewKey({ ...base, ...change }), JSON.stringify(change));
  }
  assert.equal(viewKey(undefined), viewKey({}));
});

test('static scans use the reference profile and everything else the dynamic one', () => {
  assert.equal(lessonProfile('static-gltf'), 'lesson-reference');
  for (const adapter of ['operating-cylinder', 'full-engine', 'animated-study']) assert.equal(lessonProfile(adapter), 'lesson-dynamic');
});

test('arrow keys orbit, plus and minus zoom, other keys are left alone', () => {
  const offset = new THREE.Vector3(2, 1, 2);
  const radius = offset.length();
  assert.equal(offsetAfterKey(offset, 'a'), undefined);
  assert.equal(offsetAfterKey(offset, 'Home'), undefined, 'Home is handled by the caller');
  assert.ok(offsetAfterKey(offset, '+').length() < radius);
  assert.equal(offsetAfterKey(offset, '=').length(), offsetAfterKey(offset, '+').length());
  assert.ok(offsetAfterKey(offset, '-').length() > radius);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    const moved = offsetAfterKey(offset, key);
    assert.ok(Math.abs(moved.length() - radius) < 1e-9, `${key} keeps the distance`);
    assert.ok(moved.distanceTo(offset) > 1e-6, `${key} moves the camera`);
  }
  const left = new THREE.Spherical().setFromVector3(offsetAfterKey(offset, 'ArrowLeft'));
  const right = new THREE.Spherical().setFromVector3(offsetAfterKey(offset, 'ArrowRight'));
  assert.ok(right.theta > left.theta);
  assert.equal(offset.x, 2, 'the input offset is not mutated');
});

test('orbiting never flips over the poles', () => {
  let up = new THREE.Vector3(0.01, 3, 0.01);
  for (let i = 0; i < 20; i += 1) up = offsetAfterKey(up, 'ArrowUp');
  assert.ok(new THREE.Spherical().setFromVector3(up).phi >= 0.08 - 1e-9);
  let down = new THREE.Vector3(0.01, -3, 0.01);
  for (let i = 0; i < 20; i += 1) down = offsetAfterKey(down, 'ArrowDown');
  assert.ok(new THREE.Spherical().setFromVector3(down).phi <= Math.PI - 0.08 + 1e-9);
});
