// When Highlight would hide a spotlit part. Highlight colours the spotlit parts and turns every other part an opaque pale grey, so a spotlit part
// that sits inside another part (a valve inside the cylinder head) cannot be seen, from any side. X-ray draws the rest as a ghost and shows it.
// The test is on boxes, not on what the camera sees, so it is cheap, does not change as the learner turns the model, and errs towards the
// X-ray: a part that merely lies within another part's box (a plate on a casing) is treated as inside it, which costs only a style change.
// A section cut that passes through a part shows it on the cut face, so a part the active plane cuts is not hidden, wherever the camera is.
// Pure, so the rule is tested without a browser; src/viewer/core/spotlight-fallback.ts turns meshes into boxes.

/** @typedef {{ min: number[], max: number[] }} Box  an axis-aligned box in world space, as [x, y, z] corners */
/** @typedef {{ normal: number[], constant: number }} Cut  the section plane in world space; the cut keeps what is on the side the normal points to */
/** @typedef {[number, number]} Span  the nearest and farthest a part reaches from the plane, as signed distances */

/** How far a part may poke out of the box around it and still count as inside, as a fraction of that box's longest side. */
export const ENCLOSURE_SLACK = 0.005;

/** How far into a part the plane must reach before the cut counts as showing it, as a fraction of the part's depth across the plane. A plane
 * that only grazes a part shows a sliver of it, and the margin keeps the Spotlight note from changing while the plane is at the part's edge. */
export const CUT_MARGIN = 0.1;

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
 * How far a box reaches from the plane, from its eight corners. It is wider than the part inside it unless the plane is square to an axis.
 * @param {Box} box
 * @param {Cut} cut
 * @returns {Span}
 */
export function boxSpan(box, cut) {
  const near = cut.normal.reduce((sum, n, axis) => sum + n * (n >= 0 ? box.min[axis] : box.max[axis]), cut.constant);
  const far = cut.normal.reduce((sum, n, axis) => sum + n * (n >= 0 ? box.max[axis] : box.min[axis]), cut.constant);
  return [near, far];
}

/**
 * Whether the plane passes through a part, well enough in from both of its sides, so the cut face shows it.
 * @param {Span} span
 */
export function cutShows([near, far]) {
  const margin = CUT_MARGIN * (far - near);
  return near < -margin && far > margin;
}

/**
 * The spotlit parts that are inside some other part and that no cut shows.
 * @template {{ box: Box, span?: Span }} Part
 * @param {Part[]} spotlit  `span`, when given, is the part's own reach from the plane (from its vertices); otherwise its box's is used
 * @param {{ box: Box }[]} others  every part that is not spotlit and is still on show
 * @param {Cut} [cut]  the section plane, when the model is cut open
 * @returns {Part[]}
 */
export const enclosedParts = (spotlit, others, cut) => spotlit.filter((part) =>
  others.some((other) => boxInside(part.box, other.box)) && !(cut && cutShows(part.span ?? boxSpan(part.box, cut))));

/**
 * Whether Highlight would hide any spotlit part, which is when it is drawn as an X-ray instead. Nothing spotlit, nothing hidden.
 * @param {{ box: Box, span?: Span }[]} spotlit
 * @param {{ box: Box }[]} others
 * @param {Cut} [cut]
 */
export const highlightHidesPart = (spotlit, others, cut) => enclosedParts(spotlit, others, cut).length > 0;
