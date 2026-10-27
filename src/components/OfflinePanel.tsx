import React, { useEffect, useRef, useState } from 'react';
import { Check, WifiOff } from 'lucide-react';
import { modelRegistry, type ModelSource } from '../data/modelRegistry';
import { appSavedOffline, saveLessonMedia } from '../offline/register';
import { MODEL_STORAGE_BYTES, modelSavedState, pruneStaleModels, saveModelOffline } from '../viewer/core/assets';
import { sourcesOf } from '../viewer/preload';

/** `saved`: the learner saved it for offline use and it stays. `kept`: held because it was opened, and removed if the space is needed. */
type Held = 'saved' | 'kept' | 'none';
type SavedModel = { id: string; label: string; sources: ModelSource[]; bytes: number; held: Held };

// A model whose download size is not recorded shows none, rather than a made-up one.
const megabytes = (bytes: number) => (bytes ? `${Math.max(1, Math.round(bytes / 1048576))} MB` : '');
const sumOf = (rows: SavedModel[]) => rows.reduce((sum, row) => sum + row.bytes, 0);

/**
 * The models that can be kept on this device, each with its download size and what the device really holds of it, read from the storage
 * and not remembered. Models only Drive serves qualify. When every model's sources could be read, copies of releases the app no longer
 * uses are cleared first, so an old save does not take up the space for good.
 */
async function savableModels(): Promise<SavedModel[]> {
  const known = await Promise.all(modelRegistry.map(async (definition) => {
    try { return { definition, sources: await sourcesOf(definition) }; } catch { return { definition, sources: undefined }; }
  }));
  if (known.every((row) => row.sources)) await pruneStaleModels(known.map((row) => row.sources!)).catch(() => 0);
  const rows = await Promise.all(known.map(async ({ definition, sources }): Promise<SavedModel | undefined> => {
    try {
      const state = sources?.length ? await modelSavedState(sources) : undefined;
      if (state === undefined || !sources) return undefined;
      const bytes = sources.find((source) => source.driveId)?.transferBytes ?? 0;
      return { id: definition.id, label: definition.label, sources, bytes, held: state === 'explicit' ? 'saved' : state === 'opportunistic' ? 'kept' : 'none' };
    } catch {
      return undefined;
    }
  }));
  return rows.filter((row): row is SavedModel => Boolean(row));
}

/**
 * "Use without internet" in the course information (issue #77). Once the site has been visited online, its service worker keeps the app,
 * every lesson's text and the small pictures on the device. A 3D model is kept the first time it is opened, but may be removed to make room;
 * this panel saves the rest for good, and every lesson picture and sound, ahead of a session in a hangar or classroom without a connection.
 * What it shows is read back from the device after every save, so it never promises a model that was not kept (issue #102).
 */
export const OfflinePanel: React.FC = () => {
  const [models, setModels] = useState<SavedModel[] | undefined>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const stop = useRef<AbortController | undefined>(undefined);
  const live = useRef(true);

  const refresh = async () => {
    const rows = await savableModels();
    if (live.current) setModels(rows);
    return rows;
  };

  useEffect(() => {
    live.current = true;
    void refresh();
    return () => { live.current = false; stop.current?.abort(); };
  }, []);

  const saved = (models ?? []).filter((model) => model.held === 'saved');
  const toDownload = (models ?? []).filter((model) => model.held === 'none');
  const unsaved = (models ?? []).filter((model) => model.held !== 'saved');
  const budget = megabytes(MODEL_STORAGE_BYTES);

  const saveAll = async () => {
    const controller = new AbortController();
    stop.current = controller;
    setBusy(true);
    // Ask the browser to keep these files when the device runs short of space; it may say no, and saving goes ahead either way.
    void navigator.storage?.persist?.().catch(() => false);
    let failed = 0;
    const media = await saveLessonMedia((done, total) => setStatus(`Saving lesson pictures and sound · ${done} of ${total}`));
    failed += media.failed;
    const noRoom: string[] = [];
    for (const model of unsaved) {
      if (controller.signal.aborted) return;
      try {
        const result = await saveModelOffline(model.sources, controller.signal, (_, progress) => setStatus(`Saving ${model.label}${progress === undefined ? '' : ` · ${Math.round(progress)}%`}`));
        if (!result.saved) {
          if (result.reason === 'no-room' || result.reason === 'too-large') noRoom.push(model.label); else failed += 1;
        }
      } catch {
        if (controller.signal.aborted) return;
        failed += 1;
      }
    }
    // Show what the device really holds now, whatever each save said.
    const now = await refresh();
    if (controller.signal.aborted) return;
    setBusy(false);
    const missing = now.filter((model) => model.held !== 'saved').length;
    const parts: string[] = [];
    if (!noRoom.length && !failed && !missing) parts.push('Everything is saved on this device.');
    else {
      parts.push(`${now.length - missing} of ${now.length} models are saved on this device.`);
      if (noRoom.length) parts.push(`${noRoom.join(', ')} did not fit in the ${budget} this app keeps for models.`);
      if (failed) parts.push(`${failed} ${failed === 1 ? 'file' : 'files'} could not be downloaded or kept. Try again on a better connection, or after freeing space on the device.`);
    }
    setStatus(parts.join(' '));
  };

  const app = appSavedOffline()
    ? 'The app and every lesson’s text are saved on this device, so they open without a connection.'
    : 'serviceWorker' in navigator
      ? 'The app saves itself on this device the first time it is opened online from the published site.'
      : 'This browser cannot keep the app for use without a connection.';

  const download = sumOf(toDownload);
  const buttonLabel = toDownload.length
    ? `Save everything for offline use (about ${megabytes(download)})`
    : unsaved.length ? 'Keep the opened models for offline use' : 'Save lesson pictures and sound again';

  return <section aria-labelledby="offline-title" className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 text-xs leading-relaxed text-slate-300">
    <h3 id="offline-title" className="mb-1 flex items-center gap-1.5 font-semibold text-white"><WifiOff className="h-4 w-4 text-teal-400" />Use without internet</h3>
    <p>{app}</p>
    {models && models.length > 0 && <>
      <p className="mt-2">A 3D model is kept for a while once it has been opened, but is removed when the space is needed. Before a session without a connection, save them all here, ideally over Wi-Fi.</p>
      <details className="mt-2" onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open && !busy) void refresh(); }}>
        <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-slate-200">3D models on this device: {saved.length} of {models.length}</summary>
        <ul className="flex flex-col gap-1 pb-1">{models.map((model) => <li key={model.id} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{model.label}</span>
          <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-slate-400">{megabytes(model.bytes)}
            {model.held === 'saved' && <><Check className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" /><span className="sr-only">saved</span></>}
            {model.held === 'kept' && <span className="text-slate-500">opened<span className="sr-only">, kept for now but may be removed</span></span>}
          </span>
        </li>)}</ul>
      </details>
      <button type="button" disabled={busy || (!unsaved.length && !appSavedOffline())} onClick={() => void saveAll()} className="mt-2 min-h-11 w-full rounded-xl border border-teal-400/40 bg-teal-500/10 py-2.5 font-semibold text-teal-200 hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-60">
        {buttonLabel}
      </button>
    </>}
    <p role="status" className="mt-1.5 min-h-4 text-[11px] text-slate-400">{status}</p>
  </section>;
};
