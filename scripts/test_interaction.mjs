import assert from 'node:assert/strict';
import test from 'node:test';
import { WHEEL_ZOOM_HINT, viewerHint, wheelDecision } from '../src/viewer/core/interaction.mjs';

// The rules for mouse-wheel zoom and the hint line under a viewer. In a lesson the page scrolls, so a wheel turn over the viewer must
// scroll the page unless Ctrl or Cmd is held (a trackpad pinch arrives as a wheel event with ctrlKey set, so it still zooms).

test('a lesson viewer lets the page scroll unless Ctrl or Cmd is held', () => {
  assert.equal(wheelDecision({ ctrlKey: false, metaKey: false }, 'modifier'), 'scroll');
  assert.equal(wheelDecision({}, 'modifier'), 'scroll');
  assert.equal(wheelDecision({ ctrlKey: true }, 'modifier'), 'zoom');
  assert.equal(wheelDecision({ metaKey: true }, 'modifier'), 'zoom');
});

test('a viewer that owns the whole screen always zooms', () => {
  assert.equal(wheelDecision({ ctrlKey: false, metaKey: false }, 'always'), 'zoom');
  assert.equal(wheelDecision({ ctrlKey: true }, 'always'), 'zoom');
});

test('the hint matches how the learner is holding the device and which tool is on', () => {
  assert.match(viewerHint({ mode: 'orbit', touch: true, wheelZoom: 'modifier' }), /rotate/i);
  assert.match(viewerHint({ mode: 'orbit', touch: true, wheelZoom: 'modifier' }), /pinch/i);
  assert.doesNotMatch(viewerHint({ mode: 'orbit', touch: true, wheelZoom: 'modifier' }), /ctrl|scroll/i, 'a phone has no Ctrl key');

  assert.match(viewerHint({ mode: 'orbit', touch: false, wheelZoom: 'modifier' }), /ctrl/i);
  assert.match(viewerHint({ mode: 'orbit', touch: false, wheelZoom: 'always' }), /scroll to zoom/i);
  assert.doesNotMatch(viewerHint({ mode: 'orbit', touch: false, wheelZoom: 'always' }), /ctrl/i);

  for (const touch of [true, false]) {
    for (const wheelZoom of ['modifier', 'always']) {
      assert.match(viewerHint({ mode: 'pan', touch, wheelZoom }), /pan/i, 'pan mode says so');
      assert.doesNotMatch(viewerHint({ mode: 'pan', touch, wheelZoom }), /rotate/i, 'pan mode does not promise rotation');
    }
  }
});

test('the on-canvas zoom hint names both modifier keys', () => {
  assert.match(WHEEL_ZOOM_HINT, /ctrl/i);
  assert.match(WHEEL_ZOOM_HINT, /⌘|cmd/i);
});
