import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOSE_UP_VIEW, MAX_VIEW, MIN_VIEW, closeUpSphere, viewDistance } from '../src/viewer/core/spotlight-framing.mjs';

// In Explore, spotlighting a part zooms in on it: a view a few times the part across, centred on it, so it shows with its surroundings.

const box = (min, max) => ({ min, max });
const engine = box([0, 0, 0], [100, 0, 0]); // 100 across, corner to corner
const viewOf = (part) => closeUpSphere(part, engine).radius * 2;

test('a small part is shown centred, in a view five times its size', () => {
  const washer = box([40, 0, 0], [41, 0, 0]);
  assert.deepEqual(closeUpSphere(washer, engine).center, [40.5, 0, 0]);
  assert.equal(viewOf(washer), CLOSE_UP_VIEW * 1);
  assert.ok(CLOSE_UP_VIEW > 1, 'the view is wider than the part, so its surroundings show');
});

test('a large part still gets a modest zoom: the view is at most three quarters of the model', () => {
  assert.equal(viewOf(box([0, 0, 0], [30, 0, 0])), MAX_VIEW * 100, 'a cylinder of a radial engine');
  assert.ok(MAX_VIEW < 1, 'closer than the whole-model framing');
});

test('the whole part always fits, and the view never pulls back past the whole model', () => {
  const crankcase = box([0, 0, 0], [70, 0, 0]);
  assert.equal(viewOf(crankcase), MIN_VIEW * 70, 'a part bigger than three quarters of the view gets room around it');
  assert.equal(viewOf(box([0, 0, 0], [95, 0, 0])), 100, 'a part nearly the size of the model: the whole-model view, no further');
});

test('the view grows smoothly with the part, with no jump between small and large', () => {
  let previous = 0;
  for (let size = 1; size <= 100; size += 1) {
    const view = viewOf(box([0, 0, 0], [size, 0, 0]));
    assert.ok(view >= previous, `the view never shrinks as the part grows (${size})`);
    assert.ok(view - previous <= CLOSE_UP_VIEW + 1e-9, `and never jumps (${size})`);
    previous = view;
  }
});

test('size is measured corner to corner, so a long thin part counts by its length', () => {
  const tube = box([0, 0, 0], [6, 6, 6]); // about 10.4 across
  assert.ok(Math.abs(viewOf(tube) - 52) < 0.1);
});

test('an empty or degenerate model never moves the camera', () => {
  assert.equal(closeUpSphere(box([0, 0, 0], [1, 1, 1]), box([0, 0, 0], [0, 0, 0])), undefined);
  assert.equal(closeUpSphere(box([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]), engine), undefined, 'an empty part box');
});

test('the camera stands far enough back for the sphere to fill the narrower side of the view, with the runtime fit margin', () => {
  // A square view at 90 degrees: a unit sphere just fills it at sqrt(2), and the margin for a landscape view is 1.08.
  assert.ok(Math.abs(viewDistance(1, 90, 1) - Math.SQRT2 * 1.08) < 1e-9);
  // A phone held upright is narrower than it is tall, so the horizontal angle decides and the camera stands further back.
  assert.ok(viewDistance(1, 45, 0.46) > viewDistance(1, 45, 1.5));
  assert.ok(Math.abs(viewDistance(2, 45, 1.5) - 2 * viewDistance(1, 45, 1.5)) < 1e-9, 'twice the sphere, twice the distance');
});
