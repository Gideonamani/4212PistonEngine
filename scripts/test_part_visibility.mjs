import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createHiddenParts, stepPart, stepPosition } from '../src/viewer/core/part-visibility.mjs';

// Hiding a part to look beneath it: which parts are hidden, what Undo brings back, and how a keyboard user steps through the parts that are
// still on show without a list of their names.

test('hiding parts takes them out of sight, and Undo brings back what the latest hide took', () => {
  const hidden = createHiddenParts();
  assert.deepEqual(hidden.hide(['cover']), ['cover']);
  assert.deepEqual(hidden.hide(['barrel', 'head']), ['barrel', 'head']);
  assert.equal(hidden.size(), 3);
  assert.ok(hidden.has('barrel') && hidden.has('cover') && !hidden.has('piston'));

  assert.deepEqual(hidden.undo(), ['barrel', 'head'], 'the latest hide comes back as one step');
  assert.deepEqual(hidden.ids(), ['cover']);
  assert.deepEqual(hidden.undo(), ['cover']);
  assert.deepEqual(hidden.undo(), [], 'nothing left to undo');
  assert.equal(hidden.size(), 0);
});

test('hiding a part that is already hidden changes nothing and leaves nothing to undo', () => {
  const hidden = createHiddenParts();
  hidden.hide(['cover']);
  assert.deepEqual(hidden.hide(['cover']), []);
  assert.deepEqual(hidden.hide(['cover', 'barrel']), ['barrel'], 'only the new part is recorded');
  assert.deepEqual(hidden.undo(), ['barrel']);
  assert.deepEqual(hidden.undo(), ['cover'], 'the repeat made no step of its own');
});

test('show all brings everything back at once and clears the history', () => {
  const hidden = createHiddenParts();
  assert.equal(hidden.clear(), false, 'nothing was hidden');
  hidden.hide(['a']);
  hidden.hide(['b', 'c']);
  assert.equal(hidden.clear(), true);
  assert.equal(hidden.size(), 0);
  assert.deepEqual(hidden.undo(), [], 'nothing to undo after show all');
});

test('stepping goes through the parts in order, skips hidden ones and wraps round', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const hidden = new Set(['b']);
  const isHidden = (id) => hidden.has(id);
  assert.equal(stepPart(ids, isHidden, undefined, 1), 'a', 'forward from nothing starts at the first');
  assert.equal(stepPart(ids, isHidden, undefined, -1), 'd', 'backward from nothing starts at the last');
  assert.equal(stepPart(ids, isHidden, 'a', 1), 'c', 'the hidden part is skipped');
  assert.equal(stepPart(ids, isHidden, 'd', 1), 'a', 'wraps round the end');
  assert.equal(stepPart(ids, isHidden, 'a', -1), 'd', 'wraps round the start');
  assert.equal(stepPart(ids, () => true, undefined, 1), undefined, 'every part hidden');
  assert.equal(stepPart(ids, isHidden, 'b', 1), 'c', 'a chosen part that has since been hidden still steps on');
});

test('the step position counts only the parts on show', () => {
  const isHidden = (id) => id === 'b';
  assert.deepEqual(stepPosition(['a', 'b', 'c'], isHidden, 'c'), { position: 2, total: 2 });
  assert.deepEqual(stepPosition(['a', 'b', 'c'], isHidden, undefined), { position: 0, total: 2 });
});

test('every adapter that lists components can hide them, undo it, show them again and report their boxes', () => {
  for (const file of ['animatedStudyAdapter', 'cylinderAdapter', 'fullEngineAdapter']) {
    const source = fs.readFileSync(new URL(`../src/viewer/adapters/${file}.ts`, import.meta.url), 'utf8');
    assert.match(source, /createHiddenParts\(\)/, `${file}: keeps a hidden list`);
    for (const method of ['hide(ids)', 'undoHide()', 'showHidden()', 'boxes:']) assert.ok(source.includes(method), `${file}: ${method}`);
    assert.match(source, /hidden\.clear\(\)/, `${file}: show all and a new lesson step bring hidden parts back`);
    assert.match(source, /!hidden\.has\(|!isHidden\(/, `${file}: a hidden part is not drawn`);
  }
});
