import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createGtsioBodyEvaluator } from '../src/viewer/core/animated-study-motion.mjs';

// The R10 export is the reflection x -> -x of the CAD frame its motion maths is written in (contract.procedural.mirror_x, written by
// cad_pipeline/gtsio_layout.py EXPORT_MIRROR_X; docs/r10-handedness.md). With the flag every body but the spinning ones is conjugated by the
// reflection, so each is the exact mirror image of its CAD-frame self. glTF x is CAD x, so the reflection is the same scale(-1, 1, 1) in both frames.
const params = { case_cam_y: -78, head_seat: 157, valve_offset: 25, intake_angle: 18, exhaust_angle: 20, intake_valve_length: 124.206, exhaust_valve_length: 124.714, cam_rate: -0.5 };
const plain = createGtsioBodyEvaluator(params);
const mirrored = createGtsioBodyEvaluator(params, { mirrorX: true });
const R = new THREE.Matrix4().makeScale(-1, 1, 1);
const reflected = (m) => R.clone().multiply(m).multiply(R);
const close = (a, b, tolerance = 1e-12) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < tolerance);

const bodies = ['crank', 'cam', 'rod1', 'rod2', 'rod5', 'piston1', 'piston4', 'lifter:Intake3', 'lifter:Exhaust2', 'valve:Intake1', 'valve:Exhaust6', 'rocker:Intake5',
  'rocker:Exhaust4', 'pushrod:Intake3', 'pushrod:Exhaust1', 'spring:Intake1', 'spring:Exhaust6'];

test('with mirrorX every body is the reflection of its CAD-frame matrix at every crank angle', () => {
  for (const body of bodies) {
    for (const theta of [0, 23, 137, 360, 515, 719]) {
      assert.ok(close(mirrored(body, theta), reflected(plain(body, theta))), `${body} at ${theta}`);
    }
  }
});

test('the mirrored crank turns the other way about +Z and the rest pose is unchanged', () => {
  const point = new THREE.Vector3(1, 0, 0); // CAD (1, 0, 0) is glTF (1, 0, 0)
  const plainPoint = point.clone().applyMatrix4(plain('crank', 90));
  const mirroredPoint = point.clone().applyMatrix4(mirrored('crank', 90));
  // a quarter turn: CAD +90 about +Z takes +X to +Y (glTF -Z); the mirror image takes +X to -Y (glTF +Z)
  assert.ok(Math.abs(plainPoint.z + 1) < 1e-12 && Math.abs(mirroredPoint.z - 1) < 1e-12);
  for (const body of bodies) assert.ok(mirrored(body, 0).equals(new THREE.Matrix4()) || close(mirrored(body, 0), new THREE.Matrix4(), 1e-9), body);
});

test('spinning bodies are written in the export frame and the flag does not touch them', () => {
  const spin = 'spin:-0.000000,100.800000,0.000000,0.000000,0.000000,1.000000,0.714285714';
  for (const theta of [0, 90, 311]) assert.ok(mirrored(spin, theta).equals(plain(spin, theta)), String(theta));
  assert.ok(mirrored('fixed:Part', 90).equals(new THREE.Matrix4()));
});
