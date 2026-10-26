import React, { useEffect, useRef, useState } from 'react';
import { Check, WifiOff } from 'lucide-react';
import { modelRegistry, type ModelSource } from '../data/modelRegistry';
import { appSavedOffline, saveLessonMedia } from '../offline/register';
import { modelSavedOffline, saveModelOffline } from '../viewer/core/assets';
import { sourcesOf } from '../viewer/preload';

type SavedModel = { id: string; label: string; sources: ModelSource[]; bytes: number; saved: boolean };

// A model whose download size is not recorded shows none, rather than a made-up one.
const megabytes = (bytes: number) => (bytes ? `${Math.max(1, Math.round(bytes / 1048576))} MB` : '');

/** The models that can be kept on this device, each with its download size and whether it is saved. Models only Drive serves qualify. */
async function savableModels(): Promise<SavedModel[]> {
  const rows = await Promise.all(modelRegistry.map(async (definition) => {
    try {
      const sources = await sourcesOf(definition);
      const saved = sources?.length ? await modelSavedOffline(sources) : undefined;
      if (saved === undefined || !sources) return undefined;
      const bytes = sources.find((source) => source.driveId)?.transferBytes ?? 0;
      return { id: definition.id, label: definition.label, sources, bytes, saved };
    } catch {
      return undefined;
    }
  }));
  return rows.filter((row): row is SavedModel => Boolean(row));
}

/**
 * "Use without internet" in the course information (issue #77). Once the site has been visited online, its service worker keeps the app,
 * every lesson's text and the small pictures on the device. A 3D model is saved the first time it is opened; this panel saves the rest, and
 * every lesson picture and sound, ahead of a session in a hangar or classroom without a connection.
 */
export const OfflinePanel: React.FC = () => {
  const [models, setModels] = useState<SavedModel[] | undefined>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const stop = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void savableModels().then((rows) => { if (live) setModels(rows); });
    return () => { live = false; stop.current?.abort(); };
  }, []);

  const unsaved = (models ?? []).filter((model) => !model.saved);
  const saveAll = async () => {
    const controller = new AbortController();
    stop.current = controller;
    setBusy(true);
    // Ask the browser to keep these files when the device runs short of space; it may say no, and saving goes ahead either way.
    void navigator.storage?.persist?.().catch(() => false);
    let failed = 0;
    const media = await saveLessonMedia((done, total) => setStatus(`Saving lesson pictures and sound · ${done} of ${total}`));
    failed += media.failed;
    for (const model of unsaved) {
      if (controller.signal.aborted) return;
      try {
        await saveModelOffline(model.sources, controller.signal, (_, progress) => setStatus(`Saving ${model.label}${progress === undefined ? '' : ` · ${Math.round(progress)}%`}`));
        setModels((rows) => rows?.map((row) => (row.id === model.id ? { ...row, saved: true } : row)));
      } catch {
        if (controller.signal.aborted) return;
        failed += 1;
      }
    }
    setBusy(false);
    setStatus(failed ? `Saved, except ${failed} ${failed === 1 ? 'file' : 'files'} that could not be downloaded. Try again on a better connection.` : 'Everything is saved on this device.');
  };

  const app = appSavedOffline()
    ? 'The app and every lesson’s text are saved on this device, so they open without a connection.'
    : 'serviceWorker' in navigator
      ? 'The app saves itself on this device the first time it is opened online from the published site.'
      : 'This browser cannot keep the app for use without a connection.';

  return <section aria-labelledby="offline-title" className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 text-xs leading-relaxed text-slate-300">
    <h3 id="offline-title" className="mb-1 flex items-center gap-1.5 font-semibold text-white"><WifiOff className="h-4 w-4 text-teal-400" />Use without internet</h3>
    <p>{app}</p>
    {models && models.length > 0 && <>
      <p className="mt-2">Each 3D model is kept once it has been opened. Before a session without a connection, save them all here, ideally over Wi-Fi.</p>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-slate-200">3D models on this device: {models.length - unsaved.length} of {models.length}</summary>
        <ul className="flex flex-col gap-1 pb-1">{models.map((model) => <li key={model.id} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{model.label}</span>
          <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-slate-400">{megabytes(model.bytes)}{model.saved && <><Check className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" /><span className="sr-only">saved</span></>}</span>
        </li>)}</ul>
      </details>
      <button type="button" disabled={busy || (!unsaved.length && !appSavedOffline())} onClick={() => void saveAll()} className="mt-2 min-h-11 w-full rounded-xl border border-teal-400/40 bg-teal-500/10 py-2.5 font-semibold text-teal-200 hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-60">
        {unsaved.length ? `Save everything for offline use (about ${megabytes(unsaved.reduce((sum, model) => sum + model.bytes, 0))})` : 'Save lesson pictures and sound again'}
      </button>
    </>}
    <p role="status" className="mt-1.5 min-h-4 text-[11px] text-slate-400">{status}</p>
  </section>;
};
