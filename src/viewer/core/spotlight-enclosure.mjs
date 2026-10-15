// When Highlight would hide a spotlit part. Highlight colours the spotlit parts and turns every other part an opaque pale grey, so a spotlit part
// that sits inside another part (a valve inside the cylinder head) cannot be seen, from any side. X-ray draws the rest as a ghost and shows it.
// The test is on boxes, not on what the camera sees, so it is cheap, does not change as the learner turns the model, and errs towards the
// X-ray: a part that merely lies within another part's box (a plate on a casing) is treated as inside it, which costs only a style change.
// Pure, so the rule is tested without a browser; src/viewer/core/spotlight-fallback.ts turns meshes into boxes.

/** @typedef {{ min: number[], max: number[] }} Box  an axis-aligned box in world space, as [x, y, z] corners */

/** How far a part may poke out of the box around it and still count as inside, as a fraction of that box's longest side. */
export const ENCLOSURE_SLACK = 0.005;

/**
 * Whether `inner` lies within `outer`, give or take a little.
 * @param {Box} inner
 * @param {Box} outer
 */
export function boxInside(inner, outer) {
  const slack = ENCLOSURE_SLACK * Math.max(...outer.max.map((high, axis) => high - outer.min[axis]));
  return [0, 1, 2].every((axis) => inner.min[axis] >= outer.min[axis] - slack && inner.max[axis] <= outer.max[axis] + slack);
}

/**
 * The spotlit parts that are inside some other part.
 * @template {{ box: Box }} Part
 * @param {Part[]} spotlit
 * @param {{ box: Box }[]} others  every part that is not spotlit and is still on show
 * @returns {Part[]}
 */
export const enclosedParts = (spotlit, others) => spotlit.filter((part) => others.some((other) => boxInside(part.box, other.box)));

/**
 * Whether Highlight would hide any spotlit part, which is when it is drawn as an X-ray instead. Nothing spotlit, nothing hidden.
 * @param {{ box: Box }[]} spotlit
 * @param {{ box: Box }[]} others
 */
export const highlightHidesPart = (spotlit, others) => enclosedParts(spotlit, others).length > 0;
