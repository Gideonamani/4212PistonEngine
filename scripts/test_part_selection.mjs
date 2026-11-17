import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartSelection } from '../src/viewer/core/part-selection.mjs';

function fixture(known = ['A', 'B', 'C']) {
  const state = { focusActive: false, focusIds: [] };
  const features = {
    components: {
      items: known.map(id => ({ id })),
      select(id) { state.selectedId = id || undefined; },
      showAll() { state.selectedId = undefined; state.focusActive = false; state.focusIds = []; },
    },
    focus: { set(ids, mode) { assert.ok(ids.every(id => known.includes(id))); state.focusIds = [...ids]; state.focusActive = !!ids.length; state.focusMode = mode; } },
  };
  return { state, selection: createPartSelection(features, () => state, () => {}) };
}

test('a canvas/quick pick replaces a checklist selection and keeps the chosen style', () => {
  const { selection, state } = fixture();
  selection.toggle('A'); selection.toggle('B'); selection.choose('xray');
  selection.select('C');
  assert.deepEqual(selection.selectedIds(), ['C']);
  assert.equal(state.selectedId, 'C');
  assert.deepEqual(state.focusIds, ['C']);
  assert.equal(state.focusMode, 'xray');
  // Tapping the already-inspected part must also replace a later multi-selection.
  selection.toggle('B'); selection.select('C');
  assert.deepEqual(selection.selectedIds(), ['C']);
});

test('removing the last part clears inspection and focus; no stale fallback revives it', () => {
  const { selection, state } = fixture();
  selection.select('A'); selection.toggle('A');
  assert.deepEqual(selection.selectedIds(), []);
  assert.equal(state.selectedId, undefined);
  assert.equal(state.focusActive, false);
  assert.deepEqual(state.focusIds, []);
});

test('card isolation, style off, a fresh tap, and Show all form a reversible sequence', () => {
  const { selection, state } = fixture();
  selection.select('A'); selection.isolate('A'); selection.select('B');
  assert.equal(state.focusMode, 'isolate');
  assert.deepEqual(state.focusIds, ['B']);
  selection.choose('isolate');
  assert.equal(state.focusActive, false);
  assert.deepEqual(state.focusIds, []);
  // Retapping the same part is an action even though its ID has not changed.
  selection.select('B');
  assert.equal(state.focusMode, 'highlight');
  assert.equal(state.focusActive, true);
  selection.clear();
  assert.deepEqual(selection.selectedIds(), []);
  assert.equal(state.focusActive, false);
  assert.equal(state.selectedId, undefined);
  selection.choose('isolate');
  assert.equal(state.focusActive, false);
});

test('groups toggle explicitly and a new model cannot inherit another model’s IDs', () => {
  const first = fixture();
  first.selection.toggleMany(['A', 'B']); first.selection.toggleMany(['A', 'B']);
  assert.deepEqual(first.selection.selectedIds(), []);
  first.selection.isolate('A');
  const second = fixture(['X', 'Y']);
  second.selection.select('A');
  assert.deepEqual(second.selection.selectedIds(), []);
  second.selection.add(['X', 'X', 'A']);
  assert.deepEqual(second.state.focusIds, ['X']);
  assert.equal(second.state.focusMode, 'highlight');
});
