// The order an X-ray is drawn in. three.js draws opaque parts first and see-through ones after, so every ghost layer in front of a solid part
// was blended over it: on a model of hundreds of parts, ten or more layers at under a fifth opacity buried the spotlit part (under a dark
// wash on the light stage, a pale one on the dark stage) wherever the camera stood. A solid part drawn while others are ghosted is therefore
// moved into the see-through pass, still fully opaque and writing depth, and drawn after the ghost, so the ghost never covers it. The
// ghost's outline around it still shows where it sits. Ghosts write no depth, so nothing else changes: solid parts still hide one another.

/** The render order of a solid part drawn over the ghost; ghosts and everything else stay at three.js's default of 0. */
export const OVER_GHOST_ORDER = 1;

/**
 * Draw a mesh over the ghost, or put it back as it was.
 * @param {import('three').Mesh} mesh
 * @param {boolean} over  true for a solid part while some part is ghosted
 */
export function drawOverGhost(mesh, over) {
  mesh.renderOrder = over ? OVER_GHOST_ORDER : 0;
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    // A part's own material may be see-through to begin with (glass, a cut-away cover); that is what it goes back to.
    material.userData.ownTransparent ??= material.transparent;
    const transparent = over || material.userData.ownTransparent;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
  }
}
