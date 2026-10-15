import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_FOCUS_MODE, FOCUS_MODES, FOCUS_MODE_HINTS, FOCUS_MODE_LABELS, HIGHLIGHT_COLOR, PALE_COLOR, SPOTLIGHT_PALETTE, XRAY_COLOR, XRAY_OPACITY, focusModeOrDefault, isFocusMode, partLook, partRole, spotlightPalette } from '../src/viewer/core/focus-style.mjs';
import { FOCUS_MODES as SCHEMA_FOCUS_MODES } from '../web/schema/content-schema.mjs';
import { STAGE_COLOR, THEMES } from '../src/theme/theme.mjs';

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

// The spotlight's colours, for each stage. Flat colours against the stage are a floor, not the whole picture (an X-ray ghost works by many
// thin layers stacking up, and is judged by eye), but a ghost on the wrong side of the background cannot work at all.
const channel = (value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => { const n = typeof hex === 'string' ? parseInt(hex.slice(1), 16) : hex; return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const PALETTE_KEYS = ['ghostColor', 'ghostOpacity', 'highlightColor', 'highlightEmissive', 'paleColor'];

test('every theme has a complete spotlight palette, and anything else gets the dark one', () => {
  for (const theme of THEMES) assert.deepEqual(Object.keys(SPOTLIGHT_PALETTE[theme]).sort(), PALETTE_KEYS, theme);
  assert.equal(spotlightPalette('light'), SPOTLIGHT_PALETTE.light);
  assert.equal(spotlightPalette('dark'), SPOTLIGHT_PALETTE.dark);
  for (const other of [undefined, null, '', 'Light', 'sepia']) assert.equal(spotlightPalette(other), SPOTLIGHT_PALETTE.dark, String(other));
});

test('the old constants are the dark palette', () => {
  assert.deepEqual([XRAY_COLOR, XRAY_OPACITY, PALE_COLOR, HIGHLIGHT_COLOR], [SPOTLIGHT_PALETTE.dark.ghostColor, SPOTLIGHT_PALETTE.dark.ghostOpacity, SPOTLIGHT_PALETTE.dark.paleColor, SPOTLIGHT_PALETTE.dark.highlightColor]);
});

test('the x-ray ghost is drawn on the far side of the stage from its background', () => {
  assert.ok(luminance(SPOTLIGHT_PALETTE.dark.ghostColor) > luminance(STAGE_COLOR.dark), 'pale layers on the dark stage');
  assert.ok(luminance(SPOTLIGHT_PALETTE.light.ghostColor) < luminance(STAGE_COLOR.light), 'dark layers on the light stage (a pale ghost there was 1.07:1 and all but vanished)');
});

test('a picture on a transparent background gets the neutral palette, which stands clear of both stages', () => {
  assert.equal(spotlightPalette('neutral'), SPOTLIGHT_PALETTE.neutral);
  assert.deepEqual(Object.keys(SPOTLIGHT_PALETTE.neutral).sort(), PALETTE_KEYS);
  const ghost = luminance(SPOTLIGHT_PALETTE.neutral.ghostColor);
  assert.ok(ghost > luminance(STAGE_COLOR.dark) && ghost < luminance(STAGE_COLOR.light), 'a mid tone: lighter than the dark stage, darker than the light one');
  for (const theme of THEMES) {
    assert.ok(contrast(SPOTLIGHT_PALETTE.neutral.ghostColor, STAGE_COLOR[theme]) >= 3, `${theme}: the neutral ghost is at least 3:1 against the stage`);
    assert.ok(contrast(SPOTLIGHT_PALETTE.neutral.highlightColor, STAGE_COLOR[theme]) >= 3, `${theme}: the neutral highlight is at least 3:1 against the stage`);
    assert.ok(contrast(SPOTLIGHT_PALETTE.neutral.paleColor, STAGE_COLOR[theme]) >= 1.1, `${theme}: the neutral pale grey is told apart from the stage`);
  }
});

test('the colours that carry a spotlight stand clear of the stage in both themes', () => {
  for (const theme of THEMES) {
    const palette = SPOTLIGHT_PALETTE[theme];
    assert.ok(contrast(palette.highlightColor, STAGE_COLOR[theme]) >= 3, `${theme}: the highlight colour is at least 3:1 against the stage`);
    assert.ok(contrast(palette.paleColor, STAGE_COLOR[theme]) >= 1.1, `${theme}: the pale grey is told apart from the stage`);
    assert.ok(palette.ghostOpacity > 0 && palette.ghostOpacity < 0.5, `${theme}: the ghost stays see-through`);
  }
});
