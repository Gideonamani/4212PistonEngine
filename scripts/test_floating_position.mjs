import assert from 'node:assert/strict';
import test from 'node:test';
import { clampHeight, clampPosition, formatPosition, parseHeight, parsePosition } from '../src/viewer/core/floating-position.mjs';

const card = { width: 300, height: 200 };
const stage = { width: 800, height: 500 };

test('a moved card stays wholly inside the model area', () => {
  assert.deepEqual(clampPosition({ x: 120, y: 40 }, card, stage), { x: 120, y: 40 });
  assert.deepEqual(clampPosition({ x: -50, y: -9 }, card, stage), { x: 0, y: 0 });
  assert.deepEqual(clampPosition({ x: 790, y: 480 }, card, stage), { x: 500, y: 300 });
  // A smaller stage (the drawer dragged taller, a phone turned) pulls the remembered corner back in.
  assert.deepEqual(clampPosition({ x: 500, y: 300 }, card, { width: 400, height: 260 }), { x: 100, y: 60 });
});

test('a card larger than the area is pinned to its top-left corner', () => {
  assert.deepEqual(clampPosition({ x: 40, y: 40 }, { width: 900, height: 600 }, stage), { x: 0, y: 0 });
});

test('the stored corner round-trips and anything else reads as "not moved"', () => {
  assert.deepEqual(parsePosition(formatPosition({ x: 12.4, y: 99.6 })), { x: 12, y: 100 });
  for (const bad of [null, undefined, '', 'oops', '{"x":1}', '{"x":"1","y":2}', '{"x":null,"y":2}']) assert.equal(parsePosition(bad), undefined, String(bad));
});

test('a dragged drawer keeps its minimum and leaves the model its room', () => {
  const limits = { min: 120, available: 700, keep: 128 };
  assert.equal(clampHeight(300, limits), 300);
  assert.equal(clampHeight(40, limits), 120);
  assert.equal(clampHeight(690, limits), 572);
  // A section too short for both: the drawer's minimum wins.
  assert.equal(clampHeight(300, { min: 120, available: 200, keep: 128 }), 120);
});

test('a stored height reads back only as a positive number', () => {
  assert.equal(parseHeight('260'), 260);
  for (const bad of ['', ' ', 'tall', '-5', '0', 'NaN', undefined]) assert.equal(parseHeight(bad), undefined, String(bad));
});
