// Bringing the spotlit part into view. In Explore, spotlighting a part zooms in on it: the camera keeps the learner's direction and moves in
// until the view is a few times the part across, so the part sits among its surroundings and not alone. That is what makes a small part
// findable at all (at the whole-model framing a lock washer on a 1,400-part engine is a few pixels across on a phone, however it is drawn),
// and a large part gets a modest zoom too, so the learner always sees where the spotlight went. (A view of a fixed share of the model was tried
// first and left the smallest parts lost in a screen full of ghost.) Pure, so the rule is tested without a browser;
// src/viewer/core/spotlight-closeup.ts turns meshes into boxes and moves the camera.

/** @typedef {{ min: number[], max: number[] }} Box  an axis-aligned box in world space, as [x, y, z] corners */

/** The spotlit part is shown in a view this many times its own size across, so its surroundings show with it. */
export const CLOSE_UP_VIEW = 5;

/** ...but never more than this share of the model across, so a large part still gets a modest zoom. */
export const MAX_VIEW = 0.75;

/** ...and never less than this many times the part, so the whole part fits in the view. */
export const MIN_VIEW = 1.25;

const across = (box) => Math.hypot(...box.max.map((high, axis) => high - box.min[axis]));

/**
 * The sphere to frame for the spotlit parts: centred on them, five times their size across, at most three quarters of the model, at least
 * enough to hold them, and never wider than the whole model. Nothing for an empty or degenerate model.
 * @param {Box} part  the box around every spotlit part
 * @param {Box} model  the box around the whole model
 * @returns {{ center: number[], radius: number } | undefined}
 */
export function closeUpSphere(part, model) {
  const size = across(part), whole = across(model);
  if (!(whole > 0) || !Number.isFinite(size)) return undefined;
  const view = Math.min(whole, Math.max(MIN_VIEW * size, Math.min(CLOSE_UP_VIEW * size, MAX_VIEW * whole)));
  return { center: part.min.map((low, axis) => (low + part.max[axis]) / 2), radius: view / 2 };
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
