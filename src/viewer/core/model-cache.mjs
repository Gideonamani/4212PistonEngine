// Keeps downloaded model files in the browser's Cache Storage, so a second visit (or the next lesson session) opens a model from the
// device instead of downloading it again over campus Wi-Fi or mobile data. Plain functions that take the storage as a parameter, so
// node can test them with an in-memory stand-in and the browser uses the real thing.

export const CACHE_NAME = '4212-models-v1';

/** How many files to keep. A model release has its own Drive id, so an old release ages out here instead of piling up. */
export const MAX_ENTRIES = 12;

const ORIGIN = 'https://model-cache.invalid';

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

/**
 * The saved bytes for a key, or undefined. A copy whose size is not the size the source promised is thrown away: it is a partial or
 * damaged save.
 * @returns {Promise<ArrayBuffer | undefined>}
 */
export async function readCachedModel(key, expectedBytes, store) {
  if (!key) return undefined;
  try {
    const cache = await open(store);
    const hit = await cache?.match(key);
    if (!hit) return undefined;
    const bytes = await hit.arrayBuffer();
    if (expectedBytes && bytes.byteLength !== expectedBytes) {
      await cache.delete(key);
      return undefined;
    }
    return bytes;
  } catch {
    return undefined;
  }
}

/** Save a completed download, then forget the oldest saves beyond MAX_ENTRIES. Failures (a full disk, say) are ignored: the model still loads. */
export async function writeCachedModel(key, bytes, store) {
  if (!key) return;
  try {
    const cache = await open(store);
    if (!cache) return;
    await cache.put(key, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }));
    const keys = await cache.keys();
    for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(stale);
  } catch {
    // Not saved; nothing else depends on it.
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
