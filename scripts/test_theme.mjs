import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { DARK_QUERY, STAGE_COLOR, THEMES, THEME_COLOR, THEME_KEY, otherTheme, resolveTheme } from '../src/theme/theme.mjs';

// The colour theme: which one to show, the script that picks it before first paint, and the stylesheet that draws it.

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('the learner\'s choice wins, and otherwise the device decides', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme(undefined, true), 'dark');
  assert.equal(resolveTheme(undefined, false), 'light');
  assert.equal(resolveTheme('sepia', false), 'light', 'an unknown saved value is ignored');
  assert.deepEqual([...THEMES], ['light', 'dark']);
  assert.equal(otherTheme('dark'), 'light');
  assert.equal(otherTheme('light'), 'dark');
});

/** Run index.html's pre-paint script against a pretend browser and report what it set. */
function runInlineScript({ saved, systemDark, storageBlocked = false, noMatchMedia = false }) {
  const set = {};
  const meta = {};
  const sandbox = {
    localStorage: { getItem(key) { if (storageBlocked) throw new Error('blocked'); assert.equal(key, THEME_KEY); return saved ?? null; } },
    matchMedia(query) { if (noMatchMedia) throw new Error('unsupported'); assert.equal(query, DARK_QUERY); return { matches: systemDark }; },
    document: {
      documentElement: { setAttribute: (name, value) => { set[name] = value; } },
      querySelector: (selector) => { assert.equal(selector, 'meta[name="theme-color"]'); return { setAttribute: (name, value) => { meta[name] = value; } }; },
    },
  };
  vm.runInNewContext(inlineScript, sandbox);
  return { theme: set['data-theme'], color: meta.content };
}

test('the script that runs before first paint chooses exactly what the app will', () => {
  for (const saved of [undefined, 'light', 'dark', 'sepia']) {
    for (const systemDark of [true, false]) {
      const expected = resolveTheme(saved, systemDark);
      assert.deepEqual(runInlineScript({ saved, systemDark }), { theme: expected, color: THEME_COLOR[expected] }, `saved ${saved}, device dark ${systemDark}`);
    }
  }
});

test('blocked storage falls back to the device, and no answer from the device falls back to dark', () => {
  assert.equal(runInlineScript({ storageBlocked: true, systemDark: false }).theme, 'light');
  assert.equal(runInlineScript({ storageBlocked: true, systemDark: true }).theme, 'dark');
  assert.equal(runInlineScript({ storageBlocked: true, noMatchMedia: true }).theme, 'dark');
  assert.equal(runInlineScript({ saved: 'light', noMatchMedia: true }).theme, 'light', 'a saved choice needs no answer from the device');
});

const tokenValue = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1].toLowerCase();
const block = (selector) => css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? assert.fail(`no ${selector} block in index.css`);
const themeTokens = css.match(/@theme\s*\{([\s\S]*?)\n\}/)[1];
const lightPalette = block(":root\\[data-theme='light'\\]");
const darkRestore = block('\\.stay-dark');
const varNames = (text) => new Set(text.match(/--color-[a-z0-9-]+(?=:)/g));

test('the browser chrome colour is the page canvas in each theme', () => {
  assert.equal(THEME_COLOR.dark, tokenValue(themeTokens, '--color-canvas'));
  assert.equal(THEME_COLOR.light, tokenValue(lightPalette, '--color-canvas'));
  assert.match(html, new RegExp(`<meta name="theme-color" content="${THEME_COLOR.dark}"`), 'the static tag matches the dark default');
});

test('the 3D stage clear colour matches between theme tokens and Three.js clear colour', () => {
  assert.equal(STAGE_COLOR.dark, tokenValue(themeTokens, '--color-stage'));
  assert.equal(STAGE_COLOR.light, tokenValue(lightPalette, '--color-stage'));
});

test('a region that stays dark restores every colour the light theme changes', () => {
  const changed = varNames(lightPalette);
  const restored = varNames(darkRestore);
  assert.deepEqual([...changed].filter((name) => !restored.has(name)), [], 'in the light block but not restored by .stay-dark');
  assert.deepEqual([...restored].filter((name) => !changed.has(name)), [], 'restored by .stay-dark but never changed by the light block');
});

const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sourceFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)])).filter((file) => /\.tsx$/.test(file));

test('screens use theme tokens, not fixed hex colours, so light mode reaches them', () => {
  // The 3D stage (#071418 matches the WebGL clear colour), its overlay gradient, and the scrim under a title on a photo are dark on purpose.
  const allowed = new Set(['071418', '061216', '040e13']);
  const offenders = [];
  for (const file of sourceFiles('src')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\b(?:bg|from|via|to|border|text|ring|shadow|fill|stroke)-\[#([0-9a-fA-F]{6})\]/g)) {
      if (!allowed.has(match[1].toLowerCase())) offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], 'use bg-canvas / bg-panel / bg-inset / bg-raised (see src/index.css) or a palette colour');
});

test('the lesson diagrams draw in theme colours, so they follow light and dark', () => {
  // #fff is the white ring round a marker dot, #111827 the dark digit on a highlighted cylinder: both sit on a colour that does not flip.
  const allowed = new Set(['#fff', '#111827']);
  const offenders = [];
  for (const file of sourceFiles('src/components').filter((name) => /Artifacts\.tsx$/.test(name))) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/#[0-9a-fA-F]{3,6}\b|rgba?\(/g)) {
      if (!allowed.has(match[0].toLowerCase())) offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], 'use var(--color-...) so the colour follows the theme');
});
