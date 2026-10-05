import assert from 'node:assert/strict';
import test from 'node:test';
import { LESSON_LAYOUTS, SIDE_BY_SIDE_QUERY, effectiveLayout } from '../src/components/lesson/layout.mjs';

// Which layout a lesson uses: the learner's choice where there is room for both, a landscape screen starting side by side.

test('a screen without room always stacks, whatever was chosen before', () => {
  for (const choice of [undefined, 'stacked', 'side']) assert.equal(effectiveLayout({ roomForSideBySide: false, choice }), 'stacked');
});

test('a wide landscape screen starts side by side and keeps the learner\'s choice', () => {
  assert.equal(effectiveLayout({ roomForSideBySide: true }), 'side');
  assert.equal(effectiveLayout({ roomForSideBySide: true, choice: 'side' }), 'side');
  assert.equal(effectiveLayout({ roomForSideBySide: true, choice: 'stacked' }), 'stacked');
});

test('the two layouts and the room test are what the rest of the app expects', () => {
  assert.deepEqual([...LESSON_LAYOUTS], ['stacked', 'side']);
  assert.match(SIDE_BY_SIDE_QUERY, /landscape/);
});
