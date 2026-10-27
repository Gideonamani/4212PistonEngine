import type { ModelSource } from '../../data/modelRegistry';
import { createGltfLoader } from './gltf-loader';
import { MAX_BYTES, cacheAvailable, cacheKeyFor as savedCopyKey, dropCachedModel, keepCachedModel, pruneCachedModels, readCachedModel, roomFor, savedKind, writeCachedModel, type SaveOutcome } from './model-cache.mjs';
import { createModelMemory } from './model-memory.mjs';
import { orderAttempts } from './source-order.mjs';

type Candidate = ModelSource & { url: string; headers: Record<string, string>; label: string; from: 'local' | 'drive' };
let configRequest: Promise<{ drive_api_key?: string }> | undefined;

async function deliveryConfig() {
  configRequest ??= fetch('./config.json').then((response) => response.ok ? response.json() : {}).catch(() => ({}));
  return configRequest;
}

async function candidatesFor(sources: ModelSource[]): Promise<Candidate[]> {
  const { drive_api_key: apiKey = '' } = await deliveryConfig();
  return orderAttempts(sources, { apiKey, production: import.meta.env.PROD }).map(({ source, from }): Candidate => from === 'local'
    ? { ...source, url: source.localUrl!, headers: {}, label: 'local asset', from }
    : {
      ...source,
      url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(source.driveId!)}?alt=media`,
      headers: { 'X-Goog-Api-Key': apiKey },
      label: 'Drive asset',
      from,
    });
}

async function decodeModel(bytes: ArrayBuffer, signal: AbortSignal, onProgress: (status: string, progress?: number) => void) {
  signal.throwIfAborted();
  const magic = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw Error('This browser cannot unpack the compressed model.');
    onProgress('Unpacking model geometry…', 97);
    const response = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    bytes = await response.arrayBuffer();
  }
  signal.throwIfAborted();
  if (bytes.byteLength < 20 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw Error('The model response is not a valid GLB file.');
  if (new DataView(bytes).getUint32(8, true) !== bytes.byteLength) throw Error('The model download ended before the complete GLB arrived.');
  return bytes;
}

export async function loadModelBytes(
  sources: ModelSource[],
  signal: AbortSignal,
  onProgress: (status: string, progress?: number) => void,
  { waitForSave = false, kind = 'opportunistic', onSaved }: { waitForSave?: boolean; kind?: 'explicit' | 'opportunistic'; onSaved?: (outcome: SaveOutcome) => void } = {},
) {
  const failures: string[] = [];
  const candidates = await candidatesFor(sources);
  if (!candidates.length) throw Error('No model source is configured.');
  for (const candidate of candidates) {
    // A Drive file seen before is opened from this device. A copy that will not decode is dropped and downloaded again.
    const cacheKey = candidate.from === 'drive' ? savedCopyKey(candidate) : undefined;
    const saved = await readCachedModel(cacheKey, candidate.transferBytes);
    if (saved) {
      try {
        onProgress('Opening saved copy…', 90);
        return await decodeModel(saved, signal, onProgress);
      } catch (error) {
        if (signal.aborted) throw error;
        await dropCachedModel(cacheKey);
      }
    }
    try {
      onProgress('Connecting to model…', 1);
      const response = await fetch(candidate.url, { headers: candidate.headers, signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
      if (!response.ok) throw Error(`Model download failed (${response.status}).`);
      const total = Number(response.headers.get('content-length')) || candidate.transferBytes || 0;
      if (!response.body) {
        const whole = await response.arrayBuffer();
        const model = await decodeModel(whole, signal, onProgress);
        const saving = writeCachedModel(cacheKey, whole, undefined, { kind }).then((outcome) => onSaved?.(outcome));
        if (waitForSave) await saving;
        return model;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        signal.throwIfAborted();
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        onProgress(total ? `Downloading model · ${Math.floor(received / total * 96)}%` : `Downloading model · ${(received / 1048576).toFixed(1)} MB`, total ? Math.min(96, Math.floor(received / total * 96)) : undefined);
      }
      const joined = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      // Save the download only once it has unpacked into a complete GLB, so a cut-off transfer is never kept.
      const model = await decodeModel(joined.buffer, signal, onProgress);
      const saving = writeCachedModel(cacheKey, joined, undefined, { kind }).then((outcome) => onSaved?.(outcome));
      if (waitForSave) await saving;
      return model;
    } catch (error) {
      if (signal.aborted) throw error;
      failures.push(`${candidate.label}: ${error instanceof Error ? error.message : 'unknown failure'}`);
    }
  }
  throw Error(`Every configured model source failed. ${failures.join(' ')}`);
}

type Progress = (status: string, progress?: number) => void;

// Unpacked model bytes held for this tab: shared by every viewer of a model, kept briefly after the last one closes, and bounded
// (model-memory.mjs; docs/browser-memory-and-storage.md).
const memory = createModelMemory();
// Development only: lets a browser test read what is held (e2e/model-memory.spec.ts).
if (import.meta.env?.DEV) (globalThis as Record<string, unknown>).__modelMemory = memory.stats;

/** One name per set of sources, so every viewer of the same model asks for the same bytes. Sources that name nothing share nothing. */
const memoryKeyFor = (sources: ModelSource[]) => sources.map((source) => source.localUrl || source.driveId || '').join('|') || Symbol('no-source');

const loaderFor = (sources: ModelSource[]) => (signal: AbortSignal, onProgress: Progress) => loadModelBytes(sources, signal, onProgress);

/** The Drive copy a model would be saved under on this device, or undefined where models are not saved (no Drive id or no API key). */
async function savedCopyOf(sources: ModelSource[]) {
  const drive = (await candidatesFor(sources)).find((candidate) => candidate.from === 'drive');
  return drive && savedCopyKey(drive);
}

/** Whether the model is saved on this device, so it opens without a connection. Undefined where models are not saved at all. */
export async function modelSavedOffline(sources: ModelSource[]) {
  const key = await savedCopyOf(sources);
  return key ? await savedKind(key) !== undefined : undefined;
}

/**
 * How the model is held on this device: `explicit` (the learner saved it for offline use), `opportunistic` (kept because it was opened or
 * fetched ahead of time, and removed to make room when the saved models need the space), or `none`. Undefined where models are not saved.
 */
export async function modelSavedState(sources: ModelSource[]) {
  const key = await savedCopyOf(sources);
  if (!key || !await cacheAvailable()) return undefined;
  return await savedKind(key) ?? 'none';
}

/** How many bytes of models the app keeps on a device (see docs/browser-memory-and-storage.md). */
export const MODEL_STORAGE_BYTES = MAX_BYTES;

/**
 * Remove saved copies of releases the app no longer uses, given the sources of every model it has now. Without them, a copy saved for an
 * older release would stay and count against the budget for good.
 */
export async function pruneStaleModels(allSources: ModelSource[][]) {
  const keys = (await Promise.all(allSources.map(savedCopyOf))).filter((key): key is string => Boolean(key));
  return pruneCachedModels(keys);
}

export type SaveResult = { saved: true } | { saved: false; reason: 'unavailable' | 'too-large' | 'no-room' | 'write-failed' | 'not-saved' };
const resultOf = (outcome: SaveOutcome): SaveResult => outcome.saved ? { saved: true } : { saved: false, reason: outcome.reason === 'not-cacheable' ? 'unavailable' : outcome.reason };

/**
 * Download a model onto the device for use without a connection, and say whether it is now saved: the answer is read from what the device
 * kept, never assumed. Unlike opening it, this does not also keep it in this tab's memory, so saving every model does not fill a phone's
 * memory; the bytes are let go once saved. A model already kept only because it was opened becomes a saved one without downloading again.
 * Nothing is downloaded that could not be kept (it would not fit beside the models already saved).
 */
export async function saveModelOffline(sources: ModelSource[], signal: AbortSignal, onProgress: Progress): Promise<SaveResult> {
  const key = await savedCopyOf(sources);
  if (!key || !await cacheAvailable()) return { saved: false, reason: 'unavailable' };
  const held = await savedKind(key);
  if (held === 'explicit') return { saved: true };
  if (held === 'opportunistic') return resultOf(await keepCachedModel(key));
  const wanted = sources.find((source) => source.driveId)?.transferBytes;
  if (wanted && !await roomFor(wanted, undefined, { key })) return { saved: false, reason: wanted > MAX_BYTES ? 'too-large' : 'no-room' };
  let outcome: SaveOutcome | undefined;
  await loadModelBytes(sources, signal, onProgress, { waitForSave: true, kind: 'explicit', onSaved: (result) => { outcome = result; } });
  if (outcome) return resultOf(outcome);
  // The load did not write (it was served by a copy that appeared meanwhile, or by a source that is never saved): look at what is there.
  const after = await savedKind(key);
  if (after === 'opportunistic') return resultOf(await keepCachedModel(key));
  return after ? { saved: true } : { saved: false, reason: 'not-saved' };
}

/**
 * Download a model ahead of the step that needs it, so opening it later reads the saved copy from the device. Nothing stays in memory
 * afterwards (the unpacked bytes are let go, so prefetching a whole course cannot fill a phone), and a viewer that opens the model
 * meanwhile joins this download instead of starting its own. Does nothing where the model cannot be saved or already is.
 */
export async function prefetchModel(sources: ModelSource[], signal: AbortSignal) {
  if (await modelSavedOffline(sources) !== false || !await cacheAvailable()) return;
  const { bytes, release } = memory.acquire(memoryKeyFor(sources), loaderFor(sources), { signal, retain: false });
  try { await bytes; } finally { release(); }
}

/** Sources for the full engine, taken from its published contract. */
export function sourcesFromEngineContract(contract: any): ModelSource[] {
  const transport = contract.asset.transport;
  return transport ? [
    { localUrl: transport.web_url, driveId: transport.drive_file_id, compressed: transport.encoding === 'gzip', transferBytes: transport.bytes, decodedBytes: contract.asset.bytes },
    { localUrl: transport.fallback_web_url, driveId: transport.fallback_drive_file_id, transferBytes: contract.asset.bytes, decodedBytes: contract.asset.bytes },
  ] : [{ localUrl: contract.asset.web_url, transferBytes: contract.asset.bytes }];
}

/**
 * Load a model's bytes and parse them. The unpacked bytes are held, shared with any other viewer of the same model, for as long as
 * `signal` has not aborted: abort it when the viewer closes. They then stay for a while within a byte budget, so reopening the model is quick.
 */
export async function loadGltf(
  sources: ModelSource[],
  signal: AbortSignal,
  onProgress: Progress,
) {
  const { bytes: pending, release } = memory.acquire(memoryKeyFor(sources), loaderFor(sources), { signal, onProgress });
  try {
    const bytes = await pending;
    signal.throwIfAborted();
    onProgress('Preparing model geometry…', 99);
    return { bytes, gltf: await createGltfLoader().parseAsync(bytes, '') };
  } catch (error) {
    release();
    throw error;
  }
}
