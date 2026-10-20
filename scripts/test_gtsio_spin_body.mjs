import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createGtsioBodyEvaluator } from '../src/viewer/core/animated-study-motion.mjs';

// `spin:px,py,pz,ax,ay,az,rate` (CAD millimetres) is the body of a gear or shaft that turns at a fixed ratio to the crank (scripts/accessory_gears.py supplies the
// numbers; cad_pipeline/gtsio_review_motion.py writes the string and has the same maths, tested in scripts/test_gtsio_review_motion.py). The viewer's glTF frame is
// (x, CAD z, -CAD y) in metres.
const evaluate = createGtsioBodyEvaluator();
const toGltf = ([x, y, z]) => new THREE.Vector3(x / 1000, z / 1000, -y / 1000);
const rodrigues = (p, centre, axis, angle) => {
  const len = Math.hypot(...axis);
  const k = axis.map((v) => v / len);
  const v = p.map((value, i) => value - centre[i]);
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cross = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return v.map((value, i) => centre[i] + value * Math.cos(angle) + cross[i] * Math.sin(angle) + k[i] * dot * (1 - Math.cos(angle)));
};
const moved = (body, theta, point) => toGltf(point).applyMatrix4(evaluate(body, theta));

test('a spin about a Z-parallel axis turns a point by rate x crank angle about the axis through its centre', () => {
  const body = 'spin:0.000000,100.800000,0.000000,0.000000,0.000000,1.000000,-0.714285714';
  for (const theta of [0, 90, 137, 360, 515, 719]) {
    const expected = toGltf(rodrigues([12, 150, 20], [0, 100.8, 0], [0, 0, 1], (-0.714285714 * theta * Math.PI) / 180));
    assert.ok(moved(body, theta, [12, 150, 20]).distanceTo(expected) < 1e-12, `theta ${theta}`);
  }
});

test('a spin about the X axis through the alternator pinion turns the pinion at three times the crank', () => {
  const body = 'spin:40.500000,0.000000,619.000000,1.000000,0.000000,0.000000,3.000000000';
  const expected = toGltf(rodrigues([50, 12, 630], [40.5, 0, 619], [1, 0, 0], (3 * 100 * Math.PI) / 180));
  assert.ok(moved(body, 100, [50, 12, 630]).distanceTo(expected) < 1e-12);
});

test('points on the spin axis stay put, the start pose is the identity, and an axis need not be a unit vector', () => {
  const body = 'spin:0,-126,617,-1,0,0,-0.808823529';
  assert.ok(moved(body, 400, [30, -126, 617]).distanceTo(toGltf([30, -126, 617])) < 1e-12);
  assert.ok(evaluate(body, 0).equals(new THREE.Matrix4()));
  const long = 'spin:0,-126,617,-5,0,0,-0.808823529';
  assert.ok(moved(long, 123, [5, -100, 640]).distanceTo(moved(body, 123, [5, -100, 640])) < 1e-12);
});

test('a malformed spin body is the identity rather than a broken matrix, and fixed bodies do not move', () => {
  for (const body of ['spin:1,2,3', 'spin:a,b,c,d,e,f,g', 'spin:0,0,0,0,0,0,1', 'fixed:Part']) {
    assert.ok(evaluate(body, 200).equals(new THREE.Matrix4()), body);
  }
});
