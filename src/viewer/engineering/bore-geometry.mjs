// Which way a cylinder's bore axis points: from the crank end toward the combustion end. Plain [x, y, z] arrays and no three.js, so the
// rule is tested in node against the real part positions of every shipped engine (scripts/test_bore_geometry.mjs).
//
// The overlay (chamber glow, intake and exhaust ribbons, spark flash) is hung from the combustion end of the bore, so a bore axis that
// points the wrong way puts the whole overlay under the piston. An earlier rule flipped the axis to point "away from the middle of the
// engine". That only holds for opposed and radial engines, whose cylinders really do radiate from the centre; in a straight four such as
// the Wright the cylinders sit side by side along the crankshaft, "away from the middle" is sideways, and the sign it chose was noise.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = length(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : undefined; };
const mean = (points) => points.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0]).map((v) => v / points.length);
const negate = (a) => [-a[0], -a[1], -a[2]];

/** The longest side of a box, as a unit axis: the direction a piston is longer than it is wide only if it is a piston, so it is a last resort. */
function longestAxis(size) {
  const [x, y, z] = size.map(Math.abs);
  if (x >= y && x >= z) return [1, 0, 0];
  return y >= z ? [0, 1, 0] : [0, 0, 1];
}

/**
 * Which of a cylinder's parts to read the combustion end from. The valve pair's midpoint sits on the bore axis, so it is preferred; with
 * one valve, a head or a plug there is less to go on, so the first of those that exists is used alone. Each is a [x, y, z] or undefined.
 */
export function headAnchorsOf({ intake, exhaust, head, spark }) {
  if (intake && exhaust) return [intake, exhaust];
  return [intake, head, spark].filter(Boolean).slice(0, 1);
}

/**
 * @param {object} input  Every point is a world-space [x, y, z].
 * @param {number[]} input.pistonCenter
 * @param {number[]} input.barrelCenter
 * @param {number[]} [input.pistonSize]   Box size of the piston.
 * @param {number[][]} [input.headAnchors]  Centres of parts that sit at the combustion end: valves, the head, a spark plug.
 * @param {number[]} [input.crankCenter]  Centre of the crankshaft.
 * @param {number[]} [input.engineCenter]  Mean of the cylinder barrels; only meaningful for radiating layouts.
 * @param {number[]} [input.hint]  A direction the engine's declaration states outright (for a model none of the rules can read).
 * @returns {{ axis: number[], method: 'hint' | 'head-anchors' | 'piston-axis' | 'radial' | 'default', crankConflict: boolean }}
 *   `crankConflict` is true when the answer points toward the crankshaft: the anchors and the crank disagree, which a test should catch.
 */
export function resolveBoreAxis({ pistonCenter, barrelCenter, pistonSize, headAnchors = [], crankCenter, engineCenter, hint }) {
  const awayFromCrank = (axis) => (crankCenter ? dot(axis, sub(barrelCenter, crankCenter)) : 0);
  const done = (axis, method) => ({ axis, method, crankConflict: awayFromCrank(axis) < 0 });

  const hinted = hint && unit(hint);
  if (hinted) return done(hinted, 'hint');

  // The valves, head and plug sit at the combustion end, so the way from the piston to them is the way along the bore. This is
  // the answer wherever there are any, and nothing is flipped afterwards: where this is the only evidence it is the best there is.
  if (headAnchors.length) {
    const toward = unit(sub(mean(headAnchors), pistonCenter));
    if (toward) return done(toward, 'head-anchors');
  }

  // No valves or head named: the piston's own long side gives the line, and the crankshaft gives the sign.
  const line = pistonSize && longestAxis(pistonSize);
  if (line && crankCenter) {
    return done(awayFromCrank(line) >= 0 ? line : negate(line), 'piston-axis');
  }

  // Last resort, for radiating layouts only: away from the middle of the barrels, trusted only when it is clearly radial.
  const outward = engineCenter && unit(sub(barrelCenter, engineCenter));
  if (outward) return done(outward, 'radial');
  return done([0, 1, 0], 'default');
}
