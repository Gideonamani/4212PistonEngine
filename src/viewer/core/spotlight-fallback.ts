import * as THREE from 'three';
import { highlightHidesPart, type Cut } from './spotlight-enclosure.mjs';
import type { FocusMode } from '../types';

const boxOf = (object: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(object);
  return box.isEmpty() ? undefined : { box: { min: box.min.toArray(), max: box.max.toArray() } };
};

// A part's reach from the plane, from its own vertices, so a tilted part or a step's tilted plane is judged by the part and not by its box.
// The plane is dragged far more often than the part moves or the plane turns, so the reach along each direction is kept until either does.
const reaches = new WeakMap<THREE.Object3D, { key: string; low: number; high: number }>();
const vertex = new THREE.Vector3();
function spanOf(object: THREE.Object3D, cut: Cut): [number, number] | undefined {
  object.updateWorldMatrix(true, true);
  const key = [...cut.normal, ...object.matrixWorld.elements].join();
  let reach = reaches.get(object);
  if (reach?.key !== key) {
    const normal = new THREE.Vector3().fromArray(cut.normal);
    let low = Infinity, high = -Infinity;
    object.traverse((node) => {
      const position = (node as THREE.Mesh).isMesh ? (node as THREE.Mesh).geometry.getAttribute('position') : undefined;
      if (!position) return;
      for (let index = 0; index < position.count; index++) {
        const along = vertex.fromBufferAttribute(position, index).applyMatrix4(node.matrixWorld).dot(normal);
        if (along < low) low = along;
        if (along > high) high = along;
      }
    });
    if (low > high) return undefined;
    reach = { key, low, high };
    reaches.set(object, reach);
  }
  return [reach.low + cut.constant, reach.high + cut.constant];
}

/**
 * The style a spotlight is drawn in. It is the learner's (or the step's) choice, except that Highlight would hide a spotlit part that sits
 * inside another, so it becomes X-ray for as long as that is so. `spotlit` and `others` are the model's own meshes, `others` being the ones
 * that are not spotlit and still on show. `cut` is the section plane while the model is cut open: a part it cuts through is on show.
 */
export function effectiveFocusMode(mode: FocusMode, spotlit: THREE.Object3D[], others: THREE.Object3D[], cut?: Cut): FocusMode {
  if (mode !== 'highlight' || !spotlit.length) return mode;
  const boxes = (objects: THREE.Object3D[]) => objects.map(boxOf).filter((entry): entry is NonNullable<ReturnType<typeof boxOf>> => Boolean(entry));
  // The reach is read only for a part that is inside another (enclosedParts asks for it second), since it walks the part's vertices.
  const parts = cut ? spotlit.flatMap((object) => { const entry = boxOf(object); return entry ? [{ ...entry, get span() { return spanOf(object, cut); } }] : []; }) : boxes(spotlit);
  return highlightHidesPart(parts, boxes(others), cut) ? 'xray' : mode;
}
