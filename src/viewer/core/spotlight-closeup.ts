import * as THREE from 'three';
import { closeUpSphere, viewDistance } from './spotlight-framing.mjs';
import type { ViewerRuntime } from '../types';

const boxOf = (objects: THREE.Object3D[]) => {
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  return box.isEmpty() ? undefined : { min: box.min.toArray(), max: box.max.toArray() };
};

/**
 * Explore: zoom in on the spotlit parts (see spotlight-framing.mjs). The camera keeps its direction and its home, so Reset still goes back to
 * the whole model.
 */
export function closeUpOnSpotlight(runtime: ViewerRuntime, spotlit: THREE.Object3D[], model: THREE.Object3D) {
  const part = boxOf(spotlit), whole = boxOf([model]);
  const sphere = part && whole ? closeUpSphere(part, whole) : undefined;
  if (!sphere) return;
  const distance = viewDistance(sphere.radius, runtime.camera.fov, runtime.camera.aspect);
  // The orbit controls keep the camera no nearer than a share of the whole-model distance, which would stop it short of a very small part;
  // the next whole-model fit sets the limit again.
  runtime.controls.minDistance = Math.min(runtime.controls.minDistance, distance * 0.5);
  runtime.focus(new THREE.Vector3().fromArray(sphere.center), distance);
}
