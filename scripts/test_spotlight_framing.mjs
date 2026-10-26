import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOSE_UP_VIEW, SMALL_PART, closeUpSphere, viewDistance } from '../src/viewer/core/spotlight-framing.mjs';

// In Explore a spotlit part that is small next to its model is brought closer, in a view a set fraction of the model across.

const box = (min, max) => ({ min, max });
const engine = box([0, 0, 0], [100, 0, 0]); // 100 across, corner to corner

test('a part well under a tenth of the model is brought closer, centred, in a view a quarter of the model across', () => {
  const washer = box([40, 0, 0], [41, 0, 0]);
  const sphere = closeUpSphere(washer, engine);
  assert.deepEqual(sphere.center, [40.5, 0, 0]);
  assert.equal(sphere.radius, CLOSE_UP_VIEW * 100 / 2);
  assert.ok(sphere.radius * 2 > 1, 'the view is wider than the part, so its surroundings show');
});

test('a part of a tenth of the model or more is left where the camera has it', () => {
  assert.equal(closeUpSphere(box([0, 0, 0], [SMALL_PART * 100, 0, 0]), engine), undefined, 'exactly at the threshold');
  assert.equal(closeUpSphere(box([0, 0, 0], [30, 0, 0]), engine), undefined, 'a cylinder of a radial engine');
  assert.ok(closeUpSphere(box([0, 0, 0], [SMALL_PART * 100 * 0.9, 0, 0]), engine), 'just under it');
});

test('size is measured corner to corner, so a long thin part counts by its length', () => {
  const tube = box([0, 0, 0], [6, 6, 6]); // about 10.4 across
  assert.equal(closeUpSphere(tube, engine), undefined);
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
