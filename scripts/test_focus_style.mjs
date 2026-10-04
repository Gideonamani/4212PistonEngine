import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_FOCUS_MODE, FOCUS_MODES, FOCUS_MODE_HINTS, FOCUS_MODE_LABELS, focusModeOrDefault, isFocusMode, partLook, partRole } from '../src/viewer/core/focus-style.mjs';
import { FOCUS_MODES as SCHEMA_FOCUS_MODES } from '../web/schema/content-schema.mjs';

test('there are three modes, and the default is the original ghosting', () => {
  assert.deepEqual([...FOCUS_MODES], ['highlight', 'xray', 'isolate']);
  assert.equal(DEFAULT_FOCUS_MODE, 'xray');
  for (const mode of FOCUS_MODES) {
    assert.ok(FOCUS_MODE_LABELS[mode], `${mode} has a label`);
    assert.ok(FOCUS_MODE_HINTS[mode], `${mode} has a hint`);
  }
});

test('the lesson schema accepts exactly the modes the viewer draws', () => {
  assert.deepEqual([...SCHEMA_FOCUS_MODES], [...FOCUS_MODES]);
});

test('an unknown or missing mode falls back to the default', () => {
  assert.equal(focusModeOrDefault('isolate'), 'isolate');
  for (const bad of [undefined, null, '', 'Isolate', 'ghost', 3, {}]) assert.equal(focusModeOrDefault(bad), DEFAULT_FOCUS_MODE, String(bad));
  assert.equal(isFocusMode('highlight'), true);
  assert.equal(isFocusMode('ghost'), false);
});

test('with no spotlight nothing changes, whatever the mode', () => {
  for (const mode of FOCUS_MODES) assert.deepEqual(partLook(mode, partRole(false, false)), { visible: true, look: 'normal' }, mode);
  assert.equal(partRole(false, true), 'plain', 'the spotlight set is ignored when no spotlight is active');
});

test('highlight colours the spotlit parts and turns the rest pale and solid', () => {
  assert.deepEqual(partLook('highlight', partRole(true, true)), { visible: true, look: 'highlight' });
  assert.deepEqual(partLook('highlight', partRole(true, false)), { visible: true, look: 'pale' });
});

test('x-ray keeps the spotlit parts as they are and ghosts the rest', () => {
  assert.deepEqual(partLook('xray', partRole(true, true)), { visible: true, look: 'normal' });
  assert.deepEqual(partLook('xray', partRole(true, false)), { visible: true, look: 'ghost' });
});

test('isolate keeps the spotlit parts as they are and hides the rest', () => {
  assert.deepEqual(partLook('isolate', partRole(true, true)), { visible: true, look: 'normal' });
  assert.deepEqual(partLook('isolate', partRole(true, false)), { visible: false, look: 'normal' });
});
