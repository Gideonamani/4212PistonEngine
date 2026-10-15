import assert from 'node:assert/strict';
import test from 'node:test';
import { ENCLOSURE_SLACK, boxInside, enclosedParts, highlightHidesPart } from '../src/viewer/core/spotlight-enclosure.mjs';

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
