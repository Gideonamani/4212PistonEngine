// Keeps downloaded model files in the browser's Cache Storage, so a second visit (or the next lesson session) opens a model from the
// device instead of downloading it again over campus Wi-Fi or mobile data. Plain functions that take the storage as a parameter, so
// node can test them with an in-memory stand-in and the browser uses the real thing. The policy is written up in
// docs/browser-memory-and-storage.md.
//
// Every saved file records its own size, when it was saved and whether the learner asked for it, in headers on the stored response, so what
// is on the device can be counted without unpacking anything and without a separate index that could disagree with the storage.

export const CACHE_NAME = '4212-models-v1';

/**
 * How many bytes of compressed models to keep on the device (the ten published files are about 100 MB). Counted in the bytes stored, not in
 * files: model sizes differ a lot, so a file count says little about disk use.
 */
export const MAX_BYTES = 150 * 1024 * 1024;

const ORIGIN = 'https://model-cache.invalid';

// Headers on a stored response. A save is `explicit` when the learner pressed Save for offline use: it is never removed to make room for
// anything. Otherwise it is `opportunistic` (kept because the model was opened or fetched ahead of time): the oldest go first.
const SIZE = 'x-model-bytes';
const KIND = 'x-saved-by';
const SAVED_AT = 'x-saved-at';

/**
 * The address a model file is stored under, or undefined when it should not be cached. Only Drive files qualify: a published Drive file
 * never changes (a new release gets a new id), so its id is a safe stand-in for its content. A local file can be replaced in place by a
 * re-export, so it is always fetched afresh.
 * @param {{ driveId?: string }} source
 */
export function cacheKeyFor(source) {
  return source?.driveId ? `${ORIGIN}/drive/${encodeURIComponent(source.driveId)}` : undefined;
}

const storage = () => (typeof caches === 'undefined' ? undefined : caches);

async function open(store) {
  try {
    return await (store ?? storage())?.open(CACHE_NAME);
  } catch {
    return undefined; // Cache Storage is missing or blocked (private window, insecure page): carry on without it.
  }
}

/** Whether saved copies can be kept here at all: Cache Storage is missing or blocked in some private windows and on insecure pages. */
export async function cacheAvailable(store) {
  return Boolean(await open(store));
}

/** What a stored response says about itself, without reading its body. `bytes` is 0 for a file saved before sizes were recorded. */
function describe(key, response) {
  const bytes = Number(response.headers.get(SIZE));
  return {
    key,
    bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : 0,
    kind: response.headers.get(KIND) === 'explicit' ? 'explicit' : 'opportunistic',
    savedAt: Number(response.headers.get(SAVED_AT)) || 0,
  };
}

const headersFor = (size, kind, savedAt) => ({ 'content-type': 'application/octet-stream', [SIZE]: String(size), [KIND]: kind, [SAVED_AT]: String(savedAt) });

/**
 * Every saved file with its size, kind and age, oldest first. A file saved before sizes were recorded is measured once here and stamped, as
 * an opportunistic save of unknown age (so it is the first to go).
 */
async function inventory(cache) {
  const entries = [];
  for (const request of await cache.keys()) {
    const key = request.url ?? request;
    const response = await cache.match(key);
    if (!response) continue;
    const entry = describe(key, response);
    if (!entry.bytes) {
      const buffer = await response.arrayBuffer();
      entry.bytes = buffer.byteLength;
      await cache.put(key, new Response(buffer, { headers: headersFor(entry.bytes, 'opportunistic', 0) })).catch(() => undefined);
    }
    entries.push(entry);
  }
  return entries.sort((a, b) => a.savedAt - b.savedAt);
}

const sumOf = (entries) => entries.reduce((total, entry) => total + entry.bytes, 0);

/**
 * The saved bytes for a key, or undefined. A copy whose size is not the size the source promised, or not the size it recorded when it
 * was saved, is thrown away: it is a partial or damaged save.
 * @returns {Promise<ArrayBuffer | undefined>}
 */
export async function readCachedModel(key, expectedBytes, store) {
  if (!key) return undefined;
  try {
    const cache = await open(store);
    const hit = await cache?.match(key);
    if (!hit) return undefined;
    const recorded = describe(key, hit).bytes;
    const bytes = await hit.arrayBuffer();
    if ((expectedBytes && bytes.byteLength !== expectedBytes) || (recorded && bytes.byteLength !== recorded)) {
      await cache.delete(key);
      return undefined;
    }
    return bytes;
  } catch {
    return undefined;
  }
}

/** Whether a copy is saved under the key, without reading it (for showing what is available offline). */
export async function hasCachedModel(key, store) {
  return (await savedKind(key, store)) !== undefined;
}

/** `explicit`, `opportunistic`, or undefined when nothing is saved under the key. Reads no file body. */
export async function savedKind(key, store) {
  if (!key) return undefined;
  try {
    const hit = await (await open(store))?.match(key);
    return hit ? describe(key, hit).kind : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether a file of this size can be saved without removing anything the learner asked to keep: the same test a save makes, so a download
 * is not started that could not be kept. `key` is the file's own place, whose current copy a save would replace.
 * @param {number} bytes
 * @param {*} [store]
 * @param {{ budgetBytes?: number, key?: string }} [options]
 */
export async function roomFor(bytes, store, { budgetBytes = MAX_BYTES, key } = {}) {
  try {
    const cache = await open(store);
    if (!cache) return false;
    const kept = (await inventory(cache)).filter((entry) => entry.kind === 'explicit' && entry.key !== key);
    return bytes <= budgetBytes && sumOf(kept) + bytes <= budgetBytes;
  } catch {
    return false;
  }
}

/**
 * What is saved: files, bytes, and how many bytes are kept for good. For the offline panel and for tests.
 * @returns {Promise<{ files: number, bytes: number, explicitBytes: number, budgetBytes: number }>}
 */
export async function savedSummary(store, { budgetBytes = MAX_BYTES } = {}) {
  try {
    const cache = await open(store);
    const entries = cache ? await inventory(cache) : [];
    return { files: entries.length, bytes: sumOf(entries), explicitBytes: sumOf(entries.filter((entry) => entry.kind === 'explicit')), budgetBytes };
  } catch {
    return { files: 0, bytes: 0, explicitBytes: 0, budgetBytes };
  }
}

/**
 * @typedef {{ saved: true, evicted: string[] } | { saved: false, reason: 'not-cacheable' | 'unavailable' | 'too-large' | 'no-room' | 'write-failed', evicted: string[] }} SaveOutcome
 */

/**
 * Save a completed download within the byte budget, making room by removing opportunistic saves, oldest first. A save the learner asked
 * for (`kind: 'explicit'`) is never removed to make room for another; if there is no room without that, nothing is written and the reason
 * says so. A file bigger than the whole budget is not saved. A failed write (a full disk, quota, storage denied) is reported, not thrown:
 * the model still loads, it just is not kept. Replacing a key counts the old copy as freed, and an opportunistic write never downgrades a
 * copy that is already explicit.
 *
 * @param {string | undefined} key
 * @param {ArrayBuffer | Uint8Array} bytes
 * @param {*} [store]
 * @param {{ kind?: 'explicit' | 'opportunistic', budgetBytes?: number, now?: number }} [options]
 * @returns {Promise<SaveOutcome>}
 */
export async function writeCachedModel(key, bytes, store, { kind = 'opportunistic', budgetBytes = MAX_BYTES, now = Date.now() } = {}) {
  const evicted = [];
  if (!key) return { saved: false, reason: 'not-cacheable', evicted };
  try {
    const cache = await open(store);
    if (!cache) return { saved: false, reason: 'unavailable', evicted };
    const size = bytes.byteLength;
    if (size > budgetBytes) return { saved: false, reason: 'too-large', evicted };
    const inventoried = await inventory(cache);
    const others = inventoried.filter((entry) => entry.key !== key);
    const keepAs = inventoried.find((entry) => entry.key === key)?.kind === 'explicit' ? 'explicit' : kind;
    if (sumOf(others.filter((entry) => entry.kind === 'explicit')) + size > budgetBytes) return { saved: false, reason: 'no-room', evicted };

    const removable = others.filter((entry) => entry.kind !== 'explicit'); // oldest first
    let total = sumOf(others) + size;
    const evictOldest = async () => {
      const entry = removable.shift();
      if (!entry) return false;
      await cache.delete(entry.key);
      evicted.push(entry.key);
      total -= entry.bytes;
      return true;
    };
    while (total > budgetBytes && await evictOldest()) { /* keep removing the oldest */ }

    for (;;) {
      try {
        await cache.put(key, new Response(bytes, { headers: headersFor(size, keepAs, now) }));
        return { saved: true, evicted };
      } catch {
        // The browser refused the write (its own quota is tighter than ours). Give up an older, opportunistic copy and try again.
        if (!await evictOldest()) {
          await cache.delete(key).catch(() => undefined);
          return { saved: false, reason: 'write-failed', evicted };
        }
      }
    }
  } catch {
    return { saved: false, reason: 'write-failed', evicted };
  }
}

/**
 * Keep for good a copy that was only kept for being opened: it is now one the learner asked to save, so it is not removed to make room.
 * @param {string} key
 * @param {*} [store]
 * @param {{ budgetBytes?: number, now?: number }} [options]
 * @returns {Promise<SaveOutcome>}
 */
export async function keepCachedModel(key, store, options) {
  try {
    const hit = await (await open(store))?.match(key);
    if (!hit) return { saved: false, reason: 'unavailable', evicted: [] };
    return writeCachedModel(key, await hit.arrayBuffer(), store, { ...options, kind: 'explicit' });
  } catch {
    return { saved: false, reason: 'write-failed', evicted: [] };
  }
}

/** Drop one save, for a copy that turned out not to decode. */
export async function dropCachedModel(key, store) {
  if (!key) return;
  try {
    await (await open(store))?.delete(key);
  } catch {
    // Nothing to do.
  }
}

/** Remove every saved file whose key is not in `keepKeys`: copies of releases the app no longer uses. Returns how many were removed. */
export async function pruneCachedModels(keepKeys, store) {
  let removed = 0;
  try {
    const cache = await open(store);
    if (!cache) return 0;
    const keep = new Set(keepKeys);
    for (const request of await cache.keys()) {
      const key = request.url ?? request;
      if (!keep.has(key) && await cache.delete(key)) removed += 1;
    }
  } catch {
    // Whatever was removed stays removed.
  }
  return removed;
}
