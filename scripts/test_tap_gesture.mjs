import assert from 'node:assert/strict';
import test from 'node:test';
import { createTapGesture } from '../src/viewer/core/tap-gesture.mjs';

const event = (props = {}) => ({ pointerId: 1, clientX: 100, clientY: 100, button: 0, isPrimary: true, pointerType: 'touch', ...props });

test('single-contact taps tolerate small touch jitter and are consumed once', () => {
  const tap = createTapGesture();
  tap.down(event());
  assert.equal(tap.up(event({ clientX: 106 })), true);
  assert.equal(tap.up(event()), false);
});

test('a drag cannot become a tap by returning to its starting point', () => {
  const tap = createTapGesture();
  tap.down(event()); tap.move(event({ clientX: 150 })); tap.move(event());
  assert.equal(tap.up(event()), false);
  tap.down(event());
  assert.equal(tap.up(event({ clientY: 120 })), false);
});

test('both lift orders of a pinch suppress selection until a fresh gesture', () => {
  for (const order of [[1, 2], [2, 1]]) {
    const tap = createTapGesture();
    tap.down(event()); tap.down(event({ pointerId: 2, isPrimary: false }));
    for (const pointerId of order) assert.equal(tap.up(event({ pointerId })), false);
    tap.down(event()); assert.equal(tap.up(event()), true);
  }
});

test('cancellation, lost capture, blur and the wrong pointer cannot complete a tap', () => {
  const tap = createTapGesture();
  tap.down(event()); tap.cancel(event()); assert.equal(tap.up(event()), false);
  tap.down(event()); tap.reset(); assert.equal(tap.up(event()), false);
  tap.down(event()); assert.equal(tap.up(event({ pointerId: 2 })), false);
  assert.equal(tap.up(event()), false);
});

test('secondary buttons, nonprimary contacts and modified navigation do not select', () => {
  for (const props of [{ button: 1 }, { button: 2 }, { isPrimary: false }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
    const tap = createTapGesture(); tap.down(event(props));
    assert.equal(tap.up(event(props)), false);
  }
});
