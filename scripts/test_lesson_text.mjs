import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// UTF-8 text decoded as Latin-1 leaves a lead character (Â, Ã, â) followed by a continuation byte shown as a symbol, e.g. "90Â°".
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
