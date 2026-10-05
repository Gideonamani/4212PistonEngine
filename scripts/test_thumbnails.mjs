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

// The Explore gallery: every 3D study card has its own preview image, rendered from the current model.
const models = JSON.parse(fs.readFileSync('src/data/models.json', 'utf8'));

test('every Explore model has a distinct preview that sources.json can rebuild', () => {
  assert.deepEqual(Object.keys(sources.previews.items).sort(), models.map((model) => model.id).sort(), 'previews must cover exactly the registered models');
  const seen = new Map();
  for (const model of models) {
    assert.equal(model.previewUrl, `./model-previews/${model.id}.webp`, `${model.id} previewUrl`);
    const bytes = fs.readFileSync(fileFor(model.previewUrl));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', model.id);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', model.id);
    assert.ok(bytes.length < 60 * 1024, `${model.id} preview is ${bytes.length} bytes`);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.ok(!seen.has(hash), `${model.id} repeats the preview of ${seen.get(hash)}`);
    seen.set(hash, model.id);
    const item = sources.previews.items[model.id];
    assert.ok(item.credit && item.license, `${model.id} needs a credit and licence in sources.json`);
  }
});

// Course banners: each course page opens with a wide 2:1 picture, built from sources.json like the cards and previews.
const webpSize = (bytes) => {
  // VP8 (lossy) keeps the dimensions at bytes 26-29 as 14-bit little-endian values; VP8L and VP8X store them differently.
  const kind = bytes.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8X') return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
  const bits = bytes.readUInt32LE(21);
  return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
};

test('every course has a 2:1 banner with a recorded source', () => {
  assert.deepEqual(Object.keys(sources.banners.items).sort(), packs.map((pack) => pack.id).sort(), 'banners must cover exactly the courses');
  assert.deepEqual(sources.banners.size, [1000, 500]);
  const seen = new Map();
  for (const pack of packs) {
    assert.equal(pack.banner, `./banners/${pack.id}.webp`, `${pack.id} banner path`);
    const bytes = fs.readFileSync(fileFor(pack.banner));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', pack.id);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', pack.id);
    assert.deepEqual(webpSize(bytes), sources.banners.size, `${pack.id} banner is not 2:1 at the recorded size`);
    assert.ok(bytes.length < 80 * 1024, `${pack.id} banner is ${bytes.length} bytes`);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.ok(!seen.has(hash), `${pack.id} repeats the banner of ${seen.get(hash)}`);
    seen.set(hash, pack.id);
    const item = sources.banners.items[pack.id];
    assert.ok(item.credit && item.license, `${pack.id} banner needs a credit and licence in sources.json`);
  }
  const files = fs.readdirSync('web/banners').filter((name) => name.endsWith('.webp'));
  assert.deepEqual(files.map((name) => name.replace(/\.webp$/, '')).sort(), packs.map((pack) => pack.id).sort(), 'web/banners holds only the courses banners');
});
