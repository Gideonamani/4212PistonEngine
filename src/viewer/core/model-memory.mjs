// What this browser tab keeps in memory of the model files it has downloaded and unpacked. Pure, so the rules are tested in node with a fake
// loader; assets.ts supplies the real one. (The saved copy on disk is a different budget: model-cache.mjs.)
//
// A model's bytes are held in one of two ways:
//  - in use: a viewer (or another consumer) has acquired them and has not let go yet. They are never evicted and never counted against the
//    budget, because someone is looking at that model.
//  - idle: nobody holds them. They stay so that closing a model and opening it again, or moving between lessons that share a model, does
//    not download and unpack it twice, but only up to a byte budget. Past it, the least recently used idle entries are dropped first.
// While a model is still downloading, everyone who asks for it shares that one download. It is cancelled only when the last of them gives up.

/** How many bytes of unpacked models to keep while no viewer is using them (see docs/browser-memory-and-storage.md). */
export const IDLE_BUDGET_BYTES = 64 * 1024 * 1024;

/**
 * @param {{ budgetBytes?: number }} [options]
 */
export function createModelMemory({ budgetBytes = IDLE_BUDGET_BYTES } = {}) {
  /** @type {Map<unknown, any>} */
  const entries = new Map();
  let clock = 0;

  const isIdle = (entry) => entry.consumers === 0 && entry.size !== undefined;

  /** Drop idle entries, least recently used first, until what is left fits the budget. */
  function trim() {
    const idle = [...entries.values()].filter(isIdle).sort((a, b) => a.used - b.used);
    let kept = idle.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of idle) {
      if (kept <= budgetBytes) break;
      entries.delete(entry.key);
      kept -= entry.size;
    }
  }

  function start(key, load) {
    const controller = new AbortController();
    const entry = { key, controller, consumers: 0, retain: false, size: undefined, used: 0, listeners: new Set(), last: undefined, promise: undefined };
    const report = (...update) => {
      entry.last = update;
      for (const listener of [...entry.listeners]) listener(...update);
    };
    entry.promise = (async () => load(controller.signal, report))();
    entry.promise.then(
      (bytes) => { entry.size = bytes.byteLength; },
      () => { if (entries.get(key) === entry) entries.delete(key); }, // A failed load is forgotten, so the next request tries again.
    );
    entries.set(key, entry);
    return entry;
  }

  /**
   * Ask for the model under `key`; `load(signal, onProgress)` fetches it and is called only when no one else already is. Returns the bytes
   * and a `release` that lets go of them. The hold also ends when `signal` aborts, so tying it to a viewer's lifetime is enough.
   *
   * `retain: false` is for a download made ahead of time (its bytes are already saved on disk): they are dropped as soon as the last
   * consumer lets go, unless someone who does want them joined in the meantime.
   *
   * @param {unknown} key
   * @param {(signal: AbortSignal, onProgress: (status: string, progress?: number) => void) => Promise<ArrayBuffer>} load
   * @param {{ signal?: AbortSignal, onProgress?: (status: string, progress?: number) => void, retain?: boolean }} [options]
   * @returns {{ bytes: Promise<ArrayBuffer>, release: () => void }}
   */
  function acquire(key, load, { signal, onProgress, retain = true } = {}) {
    signal?.throwIfAborted();
    const entry = entries.get(key) ?? start(key, load);
    entry.consumers += 1;
    entry.used = ++clock;
    if (retain) entry.retain = true;
    const listener = (...update) => onProgress?.(...update);
    entry.listeners.add(listener);
    if (entry.last) listener(...entry.last);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      entry.listeners.delete(listener);
      entry.consumers -= 1;
      if (entry.consumers > 0) return;
      if (entry.size === undefined) {
        // Still downloading and no one is waiting for it any more.
        entry.controller.abort();
        if (entries.get(key) === entry) entries.delete(key);
      } else if (!entry.retain || entry.size > budgetBytes) {
        entries.delete(key); // Not worth keeping, or too big to keep without throwing everything else away.
      } else {
        entry.used = ++clock;
        trim();
      }
    };

    const bytes = new Promise((resolve, reject) => {
      entry.promise.then(resolve, reject);
      if (signal) signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    signal?.addEventListener('abort', release, { once: true });
    return { bytes, release };
  }

  /** What is held now, for tests and for measuring in the browser. */
  function stats() {
    let activeBytes = 0, activeEntries = 0, idleBytes = 0, idleEntries = 0;
    for (const entry of entries.values()) {
      if (entry.size === undefined) { activeEntries += 1; continue; }
      if (entry.consumers > 0) { activeBytes += entry.size; activeEntries += 1; } else { idleBytes += entry.size; idleEntries += 1; }
    }
    return { activeEntries, activeBytes, idleEntries, idleBytes, budgetBytes };
  }

  return { acquire, stats };
}
