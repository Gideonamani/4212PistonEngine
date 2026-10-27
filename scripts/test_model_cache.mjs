import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CACHE_NAME, MAX_BYTES, cacheAvailable, cacheKeyFor, dropCachedModel, hasCachedModel, keepCachedModel, pruneCachedModels, readCachedModel, roomFor, savedKind, savedSummary, writeCachedModel,
} from '../src/viewer/core/model-cache.mjs';
import { prefetchAllowed } from '../src/viewer/core/prefetch-policy.mjs';

// An in-memory stand-in for CacheStorage. Responses keep their headers, `keys()` lists Requests, and `quotaBytes` plays the browser's own
// storage quota, which can be tighter than ours: a put that would take the total past it throws, as the real thing does.
function fakeStorage({ failOpen = false, failPut = false, quotaBytes = Infinity } = {}) {
  const entries = new Map();
  const total = () => [...entries.values()].reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
  const cache = {
    async match(key) { return entries.has(key) ? new Response(entries.get(key).bytes.slice(0), { headers: entries.get(key).headers }) : undefined; },
    async put(key, response) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      const replaced = entries.get(key)?.bytes.byteLength ?? 0;
      if (failPut || total() - replaced + bytes.byteLength > quotaBytes) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      entries.set(key, { bytes, headers: [...response.headers] });
    },
    async delete(key) { return entries.delete(key); },
    async keys() { return [...entries.keys()].map((key) => new Request(key)); },
  };
  return { entries, async open(name) { assert.equal(name, CACHE_NAME); if (failOpen) throw new Error('SecurityError'); return cache; } };
}

const MB = 1024 * 1024;
const bytes = (length, fill = 1) => new Uint8Array(length).fill(fill);
const keyOf = (name) => cacheKeyFor({ driveId: name });
const save = (store, name, length, options = {}) => writeCachedModel(keyOf(name), bytes(length), store, options);
const names = (store) => [...store.entries.keys()].map((key) => decodeURIComponent(key.split('/').pop())).sort();
const BUDGET = { budgetBytes: 100 };

test('only a published Drive file is cached, under its Drive id', () => {
  assert.equal(cacheKeyFor({ driveId: 'abc123' }), 'https://model-cache.invalid/drive/abc123');
  assert.notEqual(cacheKeyFor({ driveId: 'abc123' }), cacheKeyFor({ driveId: 'abc124' }));
  assert.equal(cacheKeyFor({ localUrl: './cylinder.glb.gz' }), undefined, 'a local file can be replaced in place by a re-export');
  assert.equal(cacheKeyFor({}), undefined);
  assert.equal(cacheKeyFor(undefined), undefined);
});

test('the budget is counted in bytes and is large enough for every published model', () => {
  assert.equal(MAX_BYTES, 150 * MB);
  assert.ok(MAX_BYTES > 100_052_840, 'the ten published files total 100,052,840 bytes');
});

test('what was saved comes back unchanged, and a missing key is simply a miss', async () => {
  const store = fakeStorage();
  const key = keyOf('one');
  assert.equal(await readCachedModel(key, 100, store), undefined);
  assert.deepEqual(await writeCachedModel(key, bytes(100, 7), store), { saved: true, evicted: [] });
  const hit = await readCachedModel(key, 100, store);
  assert.equal(hit.byteLength, 100);
  assert.deepEqual(new Uint8Array(hit), bytes(100, 7));
  assert.equal((await readCachedModel(key, undefined, store)).byteLength, 100, 'an unknown expected size accepts the save');
  assert.equal(await hasCachedModel(key, store), true);
});

test('a save whose size is not the promised size is a damaged save and is thrown away', async () => {
  const store = fakeStorage();
  const key = keyOf('cut');
  await writeCachedModel(key, bytes(60), store);
  assert.equal(await readCachedModel(key, 100, store), undefined);
  assert.equal(store.entries.has(key), false, 'the damaged copy is deleted so the next visit downloads it again');
});

test('a save whose body is not the size it recorded is a damaged save too', async () => {
  const store = fakeStorage();
  const key = keyOf('torn');
  store.entries.set(key, { bytes: bytes(60), headers: [['x-model-bytes', '100'], ['x-saved-by', 'explicit']] });
  assert.equal(await readCachedModel(key, undefined, store), undefined, 'even with no promised size to compare with');
  assert.equal(store.entries.has(key), false);
  assert.equal(await hasCachedModel(key, store), false);
});

test('a dropped save is gone', async () => {
  const store = fakeStorage();
  const key = keyOf('bad');
  await writeCachedModel(key, bytes(8), store);
  await dropCachedModel(key, store);
  assert.equal(await readCachedModel(key, 8, store), undefined);
});

test('files of mixed sizes are kept within the byte budget, oldest first', async () => {
  const store = fakeStorage();
  assert.deepEqual(await save(store, 'a', 40, { ...BUDGET, now: 1 }), { saved: true, evicted: [] });
  assert.deepEqual(await save(store, 'b', 30, { ...BUDGET, now: 2 }), { saved: true, evicted: [] });
  const third = await save(store, 'c', 50, { ...BUDGET, now: 3 });
  assert.equal(third.saved, true);
  assert.deepEqual(third.evicted, [keyOf('a')], '120 bytes would not fit: the oldest goes');
  assert.deepEqual(names(store), ['b', 'c']);
  const fourth = await save(store, 'd', 90, { ...BUDGET, now: 4 });
  assert.deepEqual(fourth.evicted, [keyOf('b'), keyOf('c')], 'one big file can push out several small ones');
  assert.deepEqual(names(store), ['d']);
  assert.equal((await savedSummary(store, BUDGET)).bytes, 90);
});

test('the oldest save goes first by when it was saved, not by where it sits in the storage', async () => {
  const store = fakeStorage();
  await save(store, 'late', 40, { ...BUDGET, now: 50 });
  await save(store, 'early', 40, { ...BUDGET, now: 10 });
  const result = await save(store, 'new', 40, { ...BUDGET, now: 90 });
  assert.deepEqual(result.evicted, [keyOf('early')]);
});

test('replacing a file counts the old copy as freed, not as extra', async () => {
  const store = fakeStorage();
  await save(store, 'a', 60, { ...BUDGET, now: 1 });
  await save(store, 'b', 40, { ...BUDGET, now: 2 });
  const replaced = await save(store, 'a', 60, { ...BUDGET, now: 3 });
  assert.deepEqual(replaced, { saved: true, evicted: [] }, '100 bytes still fit: a was replaced, not added');
  const grown = await save(store, 'a', 70, { ...BUDGET, now: 4 });
  assert.deepEqual(grown.evicted, [keyOf('b')], 'a grew by 10, so 110 bytes would be held');
  assert.equal((await savedSummary(store, BUDGET)).bytes, 70);
});

test('a file bigger than the whole budget is not saved and nothing is removed for it', async () => {
  const store = fakeStorage();
  await save(store, 'a', 40, BUDGET);
  assert.deepEqual(await save(store, 'huge', 101, BUDGET), { saved: false, reason: 'too-large', evicted: [] });
  assert.deepEqual(names(store), ['a']);
  assert.deepEqual(await save(store, 'huge', 101, { ...BUDGET, kind: 'explicit' }), { saved: false, reason: 'too-large', evicted: [] });
  assert.equal(await roomFor(101, store, BUDGET), false);
});

test('a save the learner asked for is never removed to make room', async () => {
  const store = fakeStorage();
  await save(store, 'kept', 60, { ...BUDGET, kind: 'explicit', now: 1 });
  await save(store, 'opened', 30, { ...BUDGET, now: 2 });
  const result = await save(store, 'next', 40, { ...BUDGET, now: 3 });
  assert.deepEqual(result.evicted, [keyOf('opened')], 'the opportunistic copy goes, though it is newer');
  assert.deepEqual(names(store), ['kept', 'next']);
  assert.equal(await savedKind(keyOf('kept'), store), 'explicit');
  assert.equal(await savedKind(keyOf('next'), store), 'opportunistic');
  assert.equal(await savedKind(keyOf('gone'), store), undefined);
});

test('when only saved files stand in the way, nothing is written and nothing is removed for nothing', async () => {
  const store = fakeStorage();
  await save(store, 'kept', 80, { ...BUDGET, kind: 'explicit', now: 1 });
  await save(store, 'opened', 15, { ...BUDGET, now: 2 });
  assert.deepEqual(await save(store, 'next', 40, { ...BUDGET, now: 3 }), { saved: false, reason: 'no-room', evicted: [] });
  assert.deepEqual(names(store), ['kept', 'opened'], 'the opened copy was not thrown away for a save that could not happen');
  assert.deepEqual(await save(store, 'more', 30, { ...BUDGET, kind: 'explicit', now: 4 }), { saved: false, reason: 'no-room', evicted: [] }, 'one saved file does not displace another');
  assert.deepEqual(names(store), ['kept', 'opened']);
});

test('roomFor gives the answer a save would give', async () => {
  const store = fakeStorage();
  await save(store, 'kept', 60, { ...BUDGET, kind: 'explicit' });
  await save(store, 'opened', 30, BUDGET);
  assert.equal(await roomFor(40, store, BUDGET), true, 'the opened copy would make way');
  assert.equal(await roomFor(41, store, BUDGET), false);
  assert.equal(await roomFor(100, store, { ...BUDGET, key: keyOf('kept') }), true, 'replacing the saved file itself');
  assert.equal(await roomFor(10, fakeStorage({ failOpen: true }), BUDGET), false);
});

test('an opened copy is never saved over a file the learner asked to keep, as a lesser kind', async () => {
  const store = fakeStorage();
  await save(store, 'a', 40, { ...BUDGET, kind: 'explicit', now: 1 });
  await save(store, 'a', 40, { ...BUDGET, now: 2 });
  assert.equal(await savedKind(keyOf('a'), store), 'explicit');
});

test('a copy kept for being opened becomes a saved one without a new download, if it fits', async () => {
  const store = fakeStorage();
  await save(store, 'opened', 40, { ...BUDGET, now: 1 });
  assert.equal(await savedKind(keyOf('opened'), store), 'opportunistic');
  assert.deepEqual(await keepCachedModel(keyOf('opened'), store, BUDGET), { saved: true, evicted: [] });
  assert.equal(await savedKind(keyOf('opened'), store), 'explicit');
  assert.equal((await readCachedModel(keyOf('opened'), 40, store)).byteLength, 40, 'same bytes');

  const crowded = fakeStorage();
  await save(crowded, 'kept', 80, { ...BUDGET, kind: 'explicit', now: 1 });
  await save(crowded, 'opened', 15, { ...BUDGET, now: 2 });
  assert.deepEqual(await keepCachedModel(keyOf('opened'), crowded, { budgetBytes: 90 }), { saved: false, reason: 'no-room', evicted: [] });
  assert.equal(await savedKind(keyOf('opened'), crowded), 'opportunistic', 'still there, still removable');
  assert.deepEqual(await keepCachedModel(keyOf('missing'), crowded, BUDGET), { saved: false, reason: 'unavailable', evicted: [] });
});

test('a write the browser refuses gives up older opened copies and tries again, then reports honestly', async () => {
  // The browser's quota (100) is tighter than our budget (150 MB): a put that does not fit throws.
  const store = fakeStorage({ quotaBytes: 100 });
  await save(store, 'old', 60, { now: 1 });
  const fits = await save(store, 'new', 60, { now: 2 });
  assert.deepEqual(fits, { saved: true, evicted: [keyOf('old')] }, 'the refusal freed the oldest opened copy and the retry went through');
  assert.deepEqual(names(store), ['new']);

  const stuck = fakeStorage({ quotaBytes: 100 });
  await save(stuck, 'kept', 60, { kind: 'explicit', now: 1 });
  assert.deepEqual(await save(stuck, 'next', 60, { kind: 'explicit', now: 2 }), { saved: false, reason: 'write-failed', evicted: [] }, 'nothing it may remove, so it says so');
  assert.deepEqual(names(stuck), ['kept'], 'no half-written copy and the saved file untouched');

  const full = fakeStorage({ failPut: true });
  full.entries.set(keyOf('opened'), { bytes: bytes(10), headers: [['x-model-bytes', '10']] });
  assert.deepEqual(await save(full, 'x', 8), { saved: false, reason: 'write-failed', evicted: [keyOf('opened')] }, 'every write fails: it tried the only opened copy and then stopped');
  assert.equal(full.entries.has(keyOf('x')), false);
  assert.equal(await hasCachedModel(keyOf('x'), full), false);
});

test('a blocked cache never stops a model from loading, and says it saved nothing', async () => {
  const key = keyOf('x');
  const blocked = fakeStorage({ failOpen: true });
  assert.equal(await readCachedModel(key, 8, blocked), undefined);
  assert.deepEqual(await writeCachedModel(key, bytes(8), blocked), { saved: false, reason: 'unavailable', evicted: [] });
  assert.equal(await cacheAvailable(blocked), false);
  assert.equal(await cacheAvailable(fakeStorage()), true);
  assert.equal(await hasCachedModel(key, blocked), false);
  await assert.doesNotReject(dropCachedModel(key, blocked));
  assert.deepEqual(await savedSummary(blocked), { files: 0, bytes: 0, explicitBytes: 0, budgetBytes: MAX_BYTES });
  assert.deepEqual(await writeCachedModel(undefined, bytes(8), fakeStorage()), { saved: false, reason: 'not-cacheable', evicted: [] }, 'a source with no key is never stored');
  assert.equal(await readCachedModel(undefined, 8, fakeStorage()), undefined);
});

test('a file saved before sizes were recorded is measured once, counted, and is the first to go', async () => {
  const store = fakeStorage();
  store.entries.set(keyOf('legacy'), { bytes: bytes(60), headers: [] });
  const result = await save(store, 'new', 60, { ...BUDGET, now: 5 });
  assert.deepEqual(result, { saved: true, evicted: [keyOf('legacy')] });

  const again = fakeStorage();
  again.entries.set(keyOf('legacy'), { bytes: bytes(30), headers: [] });
  assert.equal((await savedSummary(again, BUDGET)).bytes, 30);
  assert.ok(new Headers(again.entries.get(keyOf('legacy')).headers).get('x-model-bytes'), 'its size is now written down, so it is not measured again');
});

test('saved copies of releases the app no longer uses can be cleared', async () => {
  const store = fakeStorage();
  await save(store, 'current', 20, { kind: 'explicit' });
  await save(store, 'old-release', 20, { kind: 'explicit' });
  await save(store, 'older', 20);
  assert.equal(await pruneCachedModels([keyOf('current')], store), 2);
  assert.deepEqual(names(store), ['current']);
  assert.equal(await pruneCachedModels([keyOf('current')], fakeStorage({ failOpen: true })), 0);
});

test('the summary counts files, bytes and the bytes kept for good', async () => {
  const store = fakeStorage();
  await save(store, 'a', 30, { kind: 'explicit' });
  await save(store, 'b', 20);
  assert.deepEqual(await savedSummary(store), { files: 2, bytes: 50, explicitBytes: 30, budgetBytes: MAX_BYTES });
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
