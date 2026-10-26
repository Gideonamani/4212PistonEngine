import type { ModelSource } from '../../data/modelRegistry';
import { createGltfLoader } from './gltf-loader';
import { cacheKeyFor as savedCopyKey, dropCachedModel, hasCachedModel, readCachedModel, writeCachedModel } from './model-cache.mjs';
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
  { waitForSave = false } = {},
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
        const saving = writeCachedModel(cacheKey, whole);
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
      const saving = writeCachedModel(cacheKey, joined);
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
type CacheEntry = { promise: Promise<ArrayBuffer>; last?: [string, number | undefined]; listeners: Set<Progress> };

// Decoded model bytes are kept for the session, so a preload and every later viewer of the same model share one download and unpack.
const byteCache = new Map<string, CacheEntry>();

const cacheKeyFor = (sources: ModelSource[]) => sources.map((source) => source.localUrl || source.driveId || '').join('|');

function cachedModelBytes(sources: ModelSource[], signal: AbortSignal, onProgress: Progress) {
  const key = cacheKeyFor(sources);
  let entry = key ? byteCache.get(key) : undefined;
  if (!entry) {
    const created: CacheEntry = { listeners: new Set(), promise: undefined as unknown as Promise<ArrayBuffer> };
    created.promise = loadModelBytes(sources, signal, (status, progress) => {
      created.last = [status, progress];
      created.listeners.forEach((listener) => listener(status, progress));
    });
    entry = created;
    if (key) {
      byteCache.set(key, created);
      created.promise.catch(() => { if (byteCache.get(key) === created) byteCache.delete(key); });
    }
  }
  entry.listeners.add(onProgress);
  if (entry.last) onProgress(...entry.last);
  return entry.promise.finally(() => entry.listeners.delete(onProgress));
}

/** Start downloading a model in the background so a later viewer finds it already local. */
export function preloadModelBytes(sources: ModelSource[]) {
  return cachedModelBytes(sources, new AbortController().signal, () => undefined);
}

/** The Drive copy a model would be saved under on this device, or undefined where models are not saved (no Drive id or no API key). */
async function savedCopyOf(sources: ModelSource[]) {
  const drive = (await candidatesFor(sources)).find((candidate) => candidate.from === 'drive');
  return drive && savedCopyKey(drive);
}

/** Whether the model is saved on this device, so it opens without a connection. Undefined where models are not saved at all. */
export async function modelSavedOffline(sources: ModelSource[]) {
  const key = await savedCopyOf(sources);
  return key ? hasCachedModel(key) : undefined;
}

/**
 * Download a model onto the device for use without a connection. Unlike a preload it is not also kept in this session's memory, so saving
 * every model does not fill a phone's memory; the bytes are let go once saved. Does nothing for a model that is already saved.
 */
export async function saveModelOffline(sources: ModelSource[], signal: AbortSignal, onProgress: Progress) {
  if (await modelSavedOffline(sources) !== false) return;
  await loadModelBytes(sources, signal, onProgress, { waitForSave: true });
}

/** Sources for the full engine, taken from its published contract. */
export function sourcesFromEngineContract(contract: any): ModelSource[] {
  const transport = contract.asset.transport;
  return transport ? [
    { localUrl: transport.web_url, driveId: transport.drive_file_id, compressed: transport.encoding === 'gzip', transferBytes: transport.bytes, decodedBytes: contract.asset.bytes },
    { localUrl: transport.fallback_web_url, driveId: transport.fallback_drive_file_id, transferBytes: contract.asset.bytes, decodedBytes: contract.asset.bytes },
  ] : [{ localUrl: contract.asset.web_url, transferBytes: contract.asset.bytes }];
}

export async function loadGltf(
  sources: ModelSource[],
  signal: AbortSignal,
  onProgress: Progress,
) {
  let bytes: ArrayBuffer;
  try {
    bytes = await cachedModelBytes(sources, signal, onProgress);
  } catch (error) {
    // A shared download may have been aborted by another viewer; retry with this viewer's own signal.
    if (signal.aborted) throw error;
    bytes = await loadModelBytes(sources, signal, onProgress);
  }
  signal.throwIfAborted();
  onProgress('Preparing model geometry…', 99);
  return { bytes, gltf: await createGltfLoader().parseAsync(bytes, '') };
}
