/** @param {import('three').Object3D} object */
export function isPickVisible(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

/**
 * Raycasting is geometric: it also hits fragments that clipping removed. Match the
 * renderer's global/local clipping rules and the hit triangle's material group.
 * Ghost context is a fallback; a solid part visible through it takes priority.
 * @param {import('three').Intersection[]} hits Sorted nearest first, as returned by Raycaster.
 * @param {{ clippingPlanes?: import('three').Plane[], localClippingEnabled?: boolean }} renderer
 */
export function choosePickHit(hits, { clippingPlanes = [], localClippingEnabled = true } = {}) {
  let contextHit;
  for (const hit of hits) {
    if (!isPickVisible(hit.object)) continue;
    const mesh = /** @type {import('three').Mesh} */ (hit.object);
    const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
    if (material && (!material.visible || (material.transparent && material.opacity <= 0))) continue;
    if (clippingPlanes.some(plane => plane.distanceToPoint(hit.point) < 0)) continue;
    const local = localClippingEnabled ? material?.clippingPlanes : undefined;
    if (local?.length && (material.clipIntersection
      ? local.every(plane => plane.distanceToPoint(hit.point) < 0)
      : local.some(plane => plane.distanceToPoint(hit.point) < 0))) continue;
    if (!hit.object.userData.pickContext) return hit;
    contextHit ??= hit;
  }
  return contextHit;
}
