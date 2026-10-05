import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildCredits, OWN_RENDER_LICENSE } from '../src/data/credits.ts';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const sources = readJson('web/thumbnails/sources.json');
const attribution = readJson('web/lesson-media/attribution.json');
const credits = buildCredits(sources, attribution);
const listed = credits.groups.flatMap((group) => group.entries.map((entry) => ({ ...entry, license: group.license })));

// Every picture record anywhere in sources.json, and every figure in attribution.json, that is not the app's own render.
const records = [
  ...Object.entries(sources.items), ...Object.entries(sources.previews.items), ...Object.entries(sources.banners.items),
].map(([id, item]) => ({ id, label: item.credit, license: item.license, link: item.source }))
  .concat(Object.entries(attribution).map(([id, item]) => ({ id, label: item.title, license: item.license, link: item.source })));

test('every picture that is not the app\'s own render is credited with its licence', () => {
  const thirdParty = records.filter((record) => record.license !== OWN_RENDER_LICENSE);
  assert.ok(thirdParty.length > 10, 'expected the shipped third-party pictures');
  for (const record of thirdParty) {
    const hit = listed.find((entry) => entry.license === record.license && (record.link?.startsWith('http') ? entry.link === record.link : entry.label === record.label || entry.reference === record.link));
    assert.ok(hit, `${record.id} (${record.license}) is missing from the Credits page`);
  }
});

test('every licence in use has a group, and no group is empty or a duplicate', () => {
  const used = new Set(records.map((record) => record.license).filter((license) => license !== OWN_RENDER_LICENSE));
  assert.deepEqual(new Set(credits.groups.map((group) => group.license)), used);
  assert.equal(credits.groups.length, used.size, 'one group per licence');
  for (const group of credits.groups) assert.ok(group.entries.length > 0, group.license);
});

test('the app\'s own renders are counted, not listed', () => {
  const renders = [sources.items, sources.previews.items, sources.banners.items].flatMap((section) => Object.values(section)).filter((item) => item.license === OWN_RENDER_LICENSE);
  assert.ok(renders.length >= 15, 'expected the cards, previews and banners rendered from the app');
  assert.equal(credits.ownRenderCount, renders.length);
  assert.ok(credits.groups.every((group) => group.license !== OWN_RENDER_LICENSE));
});

test('a picture used on a card, a banner and in a lesson is one entry, and open licences link to their terms', () => {
  const omega = listed.filter((entry) => entry.link?.includes('Gnome_Omega'));
  assert.equal(omega.length, 1, 'the Gnome Omega photograph appears in sources.json twice and in attribution.json');
  assert.equal(omega[0].creator, 'Valder137', 'structured fields from attribution.json win');
  assert.equal(omega[0].license, 'CC BY 2.0');
  for (const group of credits.groups.filter((item) => item.license.startsWith('CC'))) assert.match(group.licenseLink || '', /^https:\/\/creativecommons\.org\//, group.license);
});

test('open licences come first, and a made-up licence still gets listed', () => {
  const fake = buildCredits(
    { items: { a: { credit: 'Thing', license: 'Custom Terms 9' } }, previews: { items: {} } },
    { 'b.webp': { title: 'Photo', creator: 'Someone', source: 'https://example.org/photo', license: 'CC BY 2.0' } },
  );
  assert.deepEqual(fake.groups.map((group) => group.license), ['CC BY 2.0', 'Custom Terms 9']);
  assert.equal(fake.groups[1].licenseLink, undefined);
  assert.equal(fake.ownRenderCount, 0);
});
