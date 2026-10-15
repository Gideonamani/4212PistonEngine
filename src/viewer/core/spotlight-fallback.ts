import * as THREE from 'three';
import { highlightHidesPart } from './spotlight-enclosure.mjs';
import type { FocusMode } from '../types';

const boxOf = (object: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(object);
  return box.isEmpty() ? undefined : { box: { min: box.min.toArray(), max: box.max.toArray() } };
};

/**
 * The style a spotlight is drawn in. It is the learner's (or the step's) choice, except that Highlight would hide a spotlit part that sits
 * inside another, so it becomes X-ray for as long as that is so. `spotlit` and `others` are the model's own meshes, `others` being the ones
 * that are not spotlit and still on show.
 */
export function effectiveFocusMode(mode: FocusMode, spotlit: THREE.Object3D[], others: THREE.Object3D[]): FocusMode {
  if (mode !== 'highlight' || !spotlit.length) return mode;
  const boxes = (objects: THREE.Object3D[]) => objects.map(boxOf).filter((entry): entry is NonNullable<ReturnType<typeof boxOf>> => Boolean(entry));
  return highlightHidesPart(boxes(spotlit), boxes(others)) ? 'xray' : mode;
}
