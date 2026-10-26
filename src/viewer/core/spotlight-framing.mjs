// Bringing a small spotlit part into view. At the whole-model framing a lock washer on a 1,400-part engine is a few pixels across on a phone,
// however it is drawn, so in Explore a spotlit part that is small next to its model is brought closer: the camera keeps the learner's
// direction and moves in until the view is a set fraction of the model across, so the part sits among its surroundings and not alone. Large
// parts are already in view and the camera is left where the learner put it. Pure, so the rule is tested without a browser;
// src/viewer/core/spotlight-closeup.ts turns meshes into boxes and moves the camera.

/** @typedef {{ min: number[], max: number[] }} Box  an axis-aligned box in world space, as [x, y, z] corners */

/** A spotlit part whose box is less than this fraction of the model's across (corner to corner) counts as small. */
export const SMALL_PART = 0.1;

/** A small part is shown in a view this fraction of the model across, so its surroundings show with it. */
export const CLOSE_UP_VIEW = 0.25;

const across = (box) => Math.hypot(...box.max.map((high, axis) => high - box.min[axis]));

/**
 * The sphere to frame for a spotlit part, or nothing when it is large enough to find at the model's own framing.
 * @param {Box} part  the box around every spotlit part
 * @param {Box} model  the box around the whole model
 * @returns {{ center: number[], radius: number } | undefined}
 */
export function closeUpSphere(part, model) {
  const size = across(part), whole = across(model);
  if (!(whole > 0) || !Number.isFinite(size) || size >= SMALL_PART * whole) return undefined;
  return { center: part.min.map((low, axis) => (low + part.max[axis]) / 2), radius: CLOSE_UP_VIEW * whole / 2 };
}

/**
 * How far from a sphere's centre the camera must be for the sphere to fill the view, with a margin; the same rule as the runtime's fit.
 * @param {number} radius
 * @param {number} fovDegrees  the camera's vertical field of view
 * @param {number} aspect  width over height
 */
export function viewDistance(radius, fovDegrees, aspect) {
  const vertical = fovDegrees * Math.PI / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * Math.max(aspect, 0.1));
  return radius / Math.sin(Math.min(vertical, horizontal) / 2) * (aspect < 1 ? 1.18 : 1.08);
}
