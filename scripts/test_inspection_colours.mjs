import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { STAGE_COLOR } from '../src/theme/theme.mjs';
import { SPOTLIGHT_PALETTE } from '../src/viewer/core/focus-style.mjs';
import { GROUP_COLOURS, groupColour, groupColourMap } from '../src/viewer/core/inspection-colours.mjs';

// The inspection colours of a model that has none of its own: what the palette must keep apart, and how a model's groups take their colours.

const linear = (value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgbOf = (hex) => { const n = typeof hex === 'string' ? parseInt(hex.slice(1), 16) : hex; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const luminance = (hex) => { const [r, g, b] = rgbOf(hex).map(linear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
const oklab = (hex) => {
  const [r, g, b] = rgbOf(hex).map(linear);
  const [l, m, s] = [0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b].map(Math.cbrt);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const distance = (a, b) => Math.hypot(...oklab(a).map((value, index) => value - oklab(b)[index]));

test('the palette is twelve different colours', () => {
  assert.equal(GROUP_COLOURS.length, 12);
  assert.equal(new Set(GROUP_COLOURS).size, 12);
  for (const colour of GROUP_COLOURS) assert.match(colour, /^#[0-9a-f]{6}$/);
});

test('every colour shows against both stages', () => {
  for (const colour of GROUP_COLOURS) {
    assert.ok(contrast(colour, STAGE_COLOR.light) >= 1.7, `${colour} against the light stage: ${contrast(colour, STAGE_COLOR.light).toFixed(2)}:1`);
    assert.ok(contrast(colour, STAGE_COLOR.dark) >= 2.2, `${colour} against the dark stage: ${contrast(colour, STAGE_COLOR.dark).toFixed(2)}:1`);
  }
});

test('no two colours are alike, and colours next to each other in the list are far apart', () => {
  for (let first = 0; first < GROUP_COLOURS.length; first++) {
    for (let second = first + 1; second < GROUP_COLOURS.length; second++) {
      assert.ok(distance(GROUP_COLOURS[first], GROUP_COLOURS[second]) >= 0.08, `${GROUP_COLOURS[first]} and ${GROUP_COLOURS[second]}`);
    }
    const next = GROUP_COLOURS[(first + 1) % GROUP_COLOURS.length];
    assert.ok(distance(GROUP_COLOURS[first], next) >= 0.18, `${GROUP_COLOURS[first]} then ${next}: groups met one after the other must not look alike`);
  }
});

test('no colour is the spotlight\'s: not a Highlight teal, not an X-ray ghost, not a Highlight\'s pale grey', () => {
  for (const colour of GROUP_COLOURS) {
    for (const theme of ['dark', 'light', 'neutral']) {
      const palette = SPOTLIGHT_PALETTE[theme];
      for (const [name, spotlight] of [['highlight', palette.highlightColor], ['ghost', palette.ghostColor], ['pale grey', palette.paleColor]]) {
        assert.ok(distance(colour, spotlight) >= 0.09, `${colour} is within ${distance(colour, spotlight).toFixed(3)} of the ${theme} ${name}`);
      }
    }
  }
});

test('a group takes its colour from the order the groups first appear, and keeps it as more parts are met', () => {
  const colours = groupColourMap(['crank', 'rods', 'crank', 'rods', 'valves', 'crank']);
  assert.deepEqual([...colours.keys()], ['crank', 'rods', 'valves']);
  assert.equal(colours.get('crank'), GROUP_COLOURS[0]);
  assert.equal(colours.get('rods'), GROUP_COLOURS[1]);
  assert.equal(colours.get('valves'), GROUP_COLOURS[2]);
  assert.equal(groupColourMap(['crank', 'rods', 'valves', 'sump']).get('rods'), colours.get('rods'), 'a later group does not move an earlier one');
});

test('a model with more groups than colours goes round again, darker and then lighter, and the colours stay different', () => {
  const seen = new Set();
  for (let index = 0; index < 36; index++) seen.add(groupColour(index));
  assert.equal(seen.size, 36, 'three rounds give thirty-six colours');
  for (let index = 0; index < 12; index++) {
    assert.equal(groupColour(index), GROUP_COLOURS[index]);
    assert.ok(luminance(groupColour(index + 12)) < luminance(groupColour(index)), `round two of colour ${index} is darker`);
    assert.ok(luminance(groupColour(index + 24)) > luminance(groupColour(index)), `round three of colour ${index} is lighter`);
  }
  assert.equal(groupColour(36), GROUP_COLOURS[0], 'and then it repeats');
});

test('every contract\'s groups can be coloured, and the largest (the R10) needs the extra rounds', () => {
  for (const file of fs.readdirSync('web').filter((name) => name.endsWith('-contract.json') && name !== 'engine-contract.json')) {
    const contract = JSON.parse(fs.readFileSync(`web/${file}`, 'utf8'));
    if (!Array.isArray(contract.parts)) continue;
    const colours = groupColourMap(contract.parts.map((part) => part.group));
    for (const part of contract.parts) assert.match(colours.get(part.group) ?? '', /^#[0-9a-f]{6}$/, `${file}: ${part.id} has a group colour`);
  }
  const r10 = JSON.parse(fs.readFileSync('web/gtsio520-r10-contract.json', 'utf8'));
  assert.ok(groupColourMap(r10.parts.map((part) => part.group)).size > 24, 'the R10 has more groups than two rounds of the palette');
});
