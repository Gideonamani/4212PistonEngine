import assert from 'node:assert/strict';
import test from 'node:test';
import { CUT_MARGIN, ENCLOSURE_SLACK, boxInside, boxSpan, cutShows, enclosedParts, highlightHidesPart } from '../src/viewer/core/spotlight-enclosure.mjs';

// When Highlight (spotlit parts coloured, everything else opaque pale grey) would hide a spotlit part: when it sits inside another part.

const box = (min, max) => ({ min, max });
const head = { id: 'head', box: box([0, 0, 0], [10, 10, 10]) };
const valve = { id: 'valve', box: box([4, 4, 1], [6, 6, 8]) };
const plug = { id: 'plug', box: box([4, 4, 8], [6, 6, 14]) }; // screwed into the head and standing out of it
const barrel = { id: 'barrel', box: box([20, 0, 0], [30, 10, 10]) }; // beside the head

test('a box inside another is inside it, and one that pokes out is not', () => {
  assert.equal(boxInside(valve.box, head.box), true);
  assert.equal(boxInside(plug.box, head.box), false, 'a spark plug stands out of the head');
  assert.equal(boxInside(head.box, valve.box), false, 'the container is not inside the part');
  assert.equal(boxInside(barrel.box, head.box), false, 'a neighbour is not inside');
});

test('a little overshoot is allowed, a lot is not', () => {
  const over = (by) => box([0, 0, 0], [10 + by, 10, 10]);
  assert.equal(boxInside(over(10 * ENCLOSURE_SLACK * 0.9), head.box), true, 'within the slack');
  assert.equal(boxInside(over(10 * ENCLOSURE_SLACK * 2), head.box), false, 'beyond it');
});

test('only the spotlit parts that are inside something else are enclosed', () => {
  assert.deepEqual(enclosedParts([valve, plug, barrel], [head]).map((part) => part.id), ['valve']);
  assert.deepEqual(enclosedParts([valve], []).map((part) => part.id), [], 'nothing to be inside');
  assert.deepEqual(enclosedParts([], [head]), [], 'nothing spotlit');
});

test('Highlight falls back when any spotlit part is hidden, and not otherwise', () => {
  assert.equal(highlightHidesPart([valve], [head]), true);
  assert.equal(highlightHidesPart([valve, barrel], [head]), true, 'one hidden part is enough: Highlight must never hide a spotlit part');
  assert.equal(highlightHidesPart([plug, barrel], [head]), false);
  assert.equal(highlightHidesPart([], [head]), false);
});

test('a part is not inside itself or the parts spotlit with it', () => {
  // `others` is every part that is not spotlit, so spotlit parts never hide one another: two valves, one in the other\'s box, are both seen.
  assert.equal(highlightHidesPart([head, valve], []), false);
});

// A section cut that passes through a spotlit part shows it on the cut face. The plane keeps what is on the side its normal points to, as
// three.js clipping does: distance = normal . point + constant, and points at a negative distance are cut away.
const plane = (normal, constant) => ({ normal, constant });
const throughValve = plane([1, 0, 0], -5); // x = 5, through the middle of the valve (x 4 to 6) and of the head (x 0 to 10)
const besideValve = plane([1, 0, 0], -8); // x = 8, through the head but clear of the valve

test('a box reaches from the plane as far as its corners do, whichever way the plane faces', () => {
  assert.deepEqual(boxSpan(valve.box, throughValve), [-1, 1]);
  assert.deepEqual(boxSpan(valve.box, plane([-1, 0, 0], 5)), [-1, 1], 'the reverse cut, the same plane facing the other way');
  assert.deepEqual(boxSpan(valve.box, besideValve), [-4, -2], 'wholly on the side that is cut away');
  const tilted = boxSpan(valve.box, plane([Math.SQRT1_2, Math.SQRT1_2, 0], -5 * Math.SQRT2));
  assert.ok(Math.abs(tilted[0] + Math.SQRT2) < 1e-9 && Math.abs(tilted[1] - Math.SQRT2) < 1e-9, `a tilted plane meets the corners: ${tilted}`);
});

test('a cut shows a part when the plane passes well into it, not when it grazes it or misses it', () => {
  assert.equal(cutShows([-1, 1]), true, 'through the middle');
  assert.equal(cutShows([-2, -1]), false, 'the part is wholly cut away');
  assert.equal(cutShows([1, 2]), false, 'the part is wholly kept, and still inside whatever encloses it');
  assert.equal(cutShows([-CUT_MARGIN * 0.5, 1 - CUT_MARGIN * 0.5]), false, 'a sliver taken off one side');
  assert.equal(cutShows([-(1 - CUT_MARGIN * 0.5), CUT_MARGIN * 0.5]), false, 'a sliver left on the kept side');
  assert.equal(cutShows([-CUT_MARGIN * 1.5, 1 - CUT_MARGIN * 1.5]), true, 'just past the margin');
});

test('a cut through a spotlit part lifts the fallback, and one that misses it does not', () => {
  assert.equal(highlightHidesPart([valve], [head], throughValve), false, 'the cut face shows the valve');
  assert.equal(highlightHidesPart([valve], [head], besideValve), true, 'the plane cuts the head but not the valve, which stays inside the wall');
  assert.equal(highlightHidesPart([valve], [head], undefined), true, 'no cut, as before');
  const otherValve = { id: 'other valve', box: box([7, 4, 1], [9, 6, 8]) };
  assert.equal(highlightHidesPart([valve, otherValve], [head], throughValve), true, 'every hidden part must be cut: one left inside is enough to fall back');
  assert.deepEqual(enclosedParts([valve, otherValve], [head], throughValve).map((part) => part.id), ['other valve']);
});

test("a part's own reach from the plane, when given, is used instead of its box's", () => {
  // A long thin part lying diagonally in its box: a plane can cross the box's corner and miss the part.
  const diagonal = { box: valve.box, span: [0.5, 2] };
  assert.equal(highlightHidesPart([diagonal], [head], throughValve), true, 'the box straddles the plane, the part does not');
  assert.equal(highlightHidesPart([{ box: valve.box, span: [-1, 1] }], [head], besideValve), false, 'and the other way round');
});
