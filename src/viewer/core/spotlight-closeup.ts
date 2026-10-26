import * as THREE from 'three';
import { closeUpSphere, viewDistance } from './spotlight-framing.mjs';
import type { ViewerRuntime } from '../types';

const boxOf = (objects: THREE.Object3D[]) => {
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  return box.isEmpty() ? undefined : { min: box.min.toArray(), max: box.max.toArray() };
};

/**
 * Explore: bring small spotlit parts into view (see spotlight-framing.mjs). The camera keeps its direction and its home, so Reset still goes
 * back to the whole model. Does nothing for parts large enough to find where the camera already is.
 */
export function closeUpOnSmallParts(runtime: ViewerRuntime, spotlit: THREE.Object3D[], model: THREE.Object3D) {
  const part = boxOf(spotlit), whole = boxOf([model]);
  const sphere = part && whole ? closeUpSphere(part, whole) : undefined;
  if (!sphere) return;
  runtime.focus(new THREE.Vector3().fromArray(sphere.center), viewDistance(sphere.radius, runtime.camera.fov, runtime.camera.aspect));
}
