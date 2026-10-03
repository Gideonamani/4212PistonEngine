import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { validateLessonPack } from '../web/schema/content-schema.mjs';

const manifest = JSON.parse(fs.readFileSync('web/lessons-manifest.json', 'utf8'));
const packs = manifest.packs.map((path) => JSON.parse(fs.readFileSync(`web/${path.replace(/^\.\//, '')}`, 'utf8')));
const sources = JSON.parse(fs.readFileSync('web/thumbnails/sources.json', 'utf8'));
const fileFor = (reference) => `web/${reference.replace(/^\.\//, '')}`;

// Every course card and every lesson card a student can open from a list carries its own thumbnail.
const cards = packs.flatMap((pack) => [
  { label: `course ${pack.id}`, thumbnail: pack.thumbnail },
  ...pack.lessons.filter((lesson) => lesson.listed !== false).map((lesson) => ({ label: `lesson ${lesson.id}`, thumbnail: lesson.thumbnail })),
]);

test('every course and listed lesson has a thumbnail file', () => {
  for (const card of cards) {
    assert.ok(card.thumbnail, `${card.label} has no thumbnail`);
    assert.ok(fs.existsSync(fileFor(card.thumbnail)), `${card.label}: ${card.thumbnail} does not exist`);
  }
});

test('thumbnail paths pass the pack schema', () => {
  for (const pack of packs) {
    const thumbnailErrors = validateLessonPack(pack).filter((error) => error.includes('thumbnail'));
    assert.deepEqual(thumbnailErrors, [], pack.id);
  }
});

test('no two cards share an image', () => {
  const seen = new Map();
  for (const card of cards) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(fileFor(card.thumbnail))).digest('hex');
    assert.ok(!seen.has(hash), `${card.label} repeats the image of ${seen.get(hash)}`);
    seen.set(hash, card.label);
  }
});

test('thumbnails are small WebP files with a recorded source', () => {
  const files = fs.readdirSync('web/thumbnails').filter((name) => name.endsWith('.webp'));
  assert.deepEqual(files.map((name) => name.replace(/\.webp$/, '')).sort(), Object.keys(sources.items).sort(), 'files and sources.json must list the same items');
  for (const name of files) {
    const bytes = fs.readFileSync(`web/thumbnails/${name}`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', name);
    assert.ok(bytes.length < 60 * 1024, `${name} is ${bytes.length} bytes`);
    const item = sources.items[name.replace(/\.webp$/, '')];
    assert.ok(item.credit && item.license, `${name} needs a credit and licence in sources.json`);
  }
});
