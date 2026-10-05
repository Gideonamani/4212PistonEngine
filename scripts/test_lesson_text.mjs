import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// UTF-8 text decoded as Latin-1 leaves a capital A with a tilde or circumflex, or a lower-case a with a circumflex, followed by a symbol (a degree sign comes out as two characters).
const MOJIBAKE = /[ÂÃâ][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]/;

const manifest = JSON.parse(fs.readFileSync('web/lessons-manifest.json', 'utf8'));

for (const path of manifest.packs) {
  test(`${path} has no garbled characters`, () => {
    const pack = JSON.parse(fs.readFileSync(`web/${path.replace(/^\.\//, '')}`, 'utf8'));
    const garbled = [];
    const walk = (value, where) => {
      if (typeof value === 'string') { if (MOJIBAKE.test(value)) garbled.push(`${where}: ${value.slice(0, 60)}`); }
      else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${where}[${index}]`));
      else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${where}.${key}`));
    };
    walk(pack, pack.id);
    assert.deepEqual(garbled, []);
  });
}

// The same damage anywhere else a person reads or edits: every JSON, Markdown, TypeScript and script file in the repository, plus the
// Unicode replacement character, which is what a decoder leaves where it gave up. Generated and third-party folders are skipped.
const SKIP = new Set(['node_modules', 'dist', 'build', 'releases', 'test-results', '.git', '.local', '.agents', 'cad_pipeline', 'cad-studies', '__pycache__']);
const TEXT = /\.(json|md|mjs|ts|tsx|css|html|py|yml)$/;
const REPLACEMENT = '\uFFFD';

function* textFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* textFiles(full);
    else if (TEXT.test(entry.name)) yield full;
  }
}

test('no file in the repository holds garbled characters or the Unicode replacement character', () => {
  const garbled = [];
  let scanned = 0;
  for (const file of textFiles('.')) {
    scanned += 1;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes(REPLACEMENT) || MOJIBAKE.test(line)) garbled.push(`${file.split(path.sep).join('/')}:${index + 1}: ${line.trim().slice(0, 70)}`);
    });
  }
  assert.ok(scanned > 100, `expected to scan the repository, saw ${scanned} files`);
  assert.deepEqual(garbled, []);
});

test('the guard itself catches both kinds of damage', () => {
  assert.ok(MOJIBAKE.test('90\u00C2\u00B0'), 'UTF-8 read as Latin-1');
  assert.ok('broken \uFFFD text'.includes(REPLACEMENT));
  assert.ok(!MOJIBAKE.test('90\u00B0 and an em dash \u2014 are fine'));
});
