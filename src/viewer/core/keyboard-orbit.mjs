import * as THREE from 'three';

const STEP = Math.PI / 24;
const POLAR_LIMIT = 0.08;

/**
 * The camera's new offset from its target after a key press in the 3D view: arrow keys orbit, plus and minus zoom.
 * Returns undefined for any other key, so the caller can leave the event alone.
 */
export function offsetAfterKey(offset, key) {
  if (key === '+' || key === '=') return offset.clone().multiplyScalar(0.84);
  if (key === '-') return offset.clone().multiplyScalar(1.18);
  if (!key.startsWith('Arrow')) return undefined;
  const spherical = new THREE.Spherical().setFromVector3(offset);
  if (key === 'ArrowLeft') spherical.theta -= STEP;
  if (key === 'ArrowRight') spherical.theta += STEP;
  if (key === 'ArrowUp') spherical.phi = Math.max(POLAR_LIMIT, spherical.phi - STEP);
  if (key === 'ArrowDown') spherical.phi = Math.min(Math.PI - POLAR_LIMIT, spherical.phi + STEP);
  return new THREE.Vector3().setFromSpherical(spherical);
}
