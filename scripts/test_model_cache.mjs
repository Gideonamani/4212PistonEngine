import assert from 'node:assert/strict';
import test from 'node:test';
import { CACHE_NAME, MAX_ENTRIES, cacheKeyFor, dropCachedModel, readCachedModel, writeCachedModel } from '../src/viewer/core/model-cache.mjs';
import { prefetchAllowed } from '../src/viewer/core/prefetch-policy.mjs';

// An in-memory stand-in for CacheStorage with the same ordering rule as a browser: a key keeps its place until it is replaced, and
// keys() lists them oldest first.
function fakeStorage({ failOpen = false, failPut = false } = {}) {
  const entries = new Map();
  const cache = {
    async match(key) { return entries.has(key) ? new Response(entries.get(key).slice(0)) : undefined; },
    async put(key, response) {
      if (failPut) throw new Error('QuotaExceededError');
      entries.delete(key);
      entries.set(key, new Uint8Array(await response.arrayBuffer()));
    },
    async delete(key) { return entries.delete(key); },
    async keys() { return [...entries.keys()]; },
  };
  return { entries, async open(name) { assert.equal(name, CACHE_NAME); if (failOpen) throw new Error('SecurityError'); return cache; } };
}

const bytes = (length, fill = 1) => new Uint8Array(length).fill(fill);

test('only a published Drive file is cached, under its Drive id', () => {
  assert.equal(cacheKeyFor({ driveId: 'abc123' }), 'https://model-cache.invalid/drive/abc123');
  assert.notEqual(cacheKeyFor({ driveId: 'abc123' }), cacheKeyFor({ driveId: 'abc124' }));
  assert.equal(cacheKeyFor({ localUrl: './cylinder.glb.gz' }), undefined, 'a local file can be replaced in place by a re-export');
  assert.equal(cacheKeyFor({}), undefined);
  assert.equal(cacheKeyFor(undefined), undefined);
});

test('what was saved comes back unchanged, and a missing key is simply a miss', async () => {
  const store = fakeStorage();
  const key = cacheKeyFor({ driveId: 'one' });
  assert.equal(await readCachedModel(key, 100, store), undefined);
  await writeCachedModel(key, bytes(100, 7), store);
  const hit = await readCachedModel(key, 100, store);
  assert.equal(hit.byteLength, 100);
  assert.deepEqual(new Uint8Array(hit), bytes(100, 7));
  assert.equal((await readCachedModel(key, undefined, store)).byteLength, 100, 'an unknown expected size accepts the save');
});

test('a save whose size is not the promised size is a damaged save and is thrown away', async () => {
  const store = fakeStorage();
  const key = cacheKeyFor({ driveId: 'cut' });
  await writeCachedModel(key, bytes(60), store);
  assert.equal(await readCachedModel(key, 100, store), undefined);
  assert.equal(store.entries.has(key), false, 'the damaged copy is deleted so the next visit downloads it again');
});

test('only the newest saves are kept', async () => {
  const store = fakeStorage();
  for (let index = 0; index < MAX_ENTRIES + 3; index += 1) await writeCachedModel(cacheKeyFor({ driveId: `file-${index}` }), bytes(8, index), store);
  assert.equal(store.entries.size, MAX_ENTRIES);
  assert.equal(store.entries.has(cacheKeyFor({ driveId: 'file-0' })), false, 'the oldest is gone');
  assert.equal(store.entries.has(cacheKeyFor({ driveId: `file-${MAX_ENTRIES + 2}` })), true, 'the newest is kept');
});

test('a dropped save is gone', async () => {
  const store = fakeStorage();
  const key = cacheKeyFor({ driveId: 'bad' });
  await writeCachedModel(key, bytes(8), store);
  await dropCachedModel(key, store);
  assert.equal(await readCachedModel(key, 8, store), undefined);
});

test('a blocked or full cache never stops a model from loading', async () => {
  const key = cacheKeyFor({ driveId: 'x' });
  const blocked = fakeStorage({ failOpen: true });
  assert.equal(await readCachedModel(key, 8, blocked), undefined);
  await assert.doesNotReject(writeCachedModel(key, bytes(8), blocked));
  await assert.doesNotReject(dropCachedModel(key, blocked));
  const full = fakeStorage({ failPut: true });
  await assert.doesNotReject(writeCachedModel(key, bytes(8), full));
  assert.equal(await readCachedModel(key, 8, full), undefined);
  assert.equal(await readCachedModel(undefined, 8, full), undefined, 'a source with no key is never looked up');
});

test('background downloads wait for an ordinary fast connection and stay out of test runs', () => {
  assert.equal(prefetchAllowed(), true, 'a browser without the connection API is treated as ordinary');
  assert.equal(prefetchAllowed({ connection: { effectiveType: '4g', type: 'wifi' } }), true);
  assert.equal(prefetchAllowed({ connection: { type: 'ethernet' } }), true);
  assert.equal(prefetchAllowed({ connection: { saveData: true, effectiveType: '4g' } }), false, 'data saver');
  assert.equal(prefetchAllowed({ connection: { type: 'cellular', effectiveType: '4g' } }), false, 'mobile data');
  assert.equal(prefetchAllowed({ connection: { effectiveType: '3g' } }), false, 'a slow network');
  assert.equal(prefetchAllowed({ connection: { effectiveType: '4g' }, automated: true }), false, 'an automated browser');
});
