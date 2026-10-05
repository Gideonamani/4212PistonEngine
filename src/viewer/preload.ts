import type { CourseTrack } from '../types/engine';
import { modelsById } from '../data/modelRegistry';
import { preloadModelBytes, sourcesFromEngineContract } from './core/assets';
import { prefetchAllowed } from './core/prefetch-policy.mjs';

type NetworkInformation = { saveData?: boolean; type?: string; effectiveType?: string };
const connectionOf = () => (navigator as Navigator & { connection?: NetworkInformation }).connection;

/** Whether downloads beyond the lesson being read are welcome (see prefetch-policy.mjs). */
export const mayPrefetch = () => prefetchAllowed({ connection: connectionOf(), automated: navigator.webdriver });

/** Download the given models one after another, in lesson order, so each is local before its step is reached. Returns a stop function. */
export function preloadModels(modelIds: string[]) {
  // Respect a visitor who asked the browser to save data.
  if (connectionOf()?.saveData) return () => undefined;
  let stopped = false;
  void (async () => {
    for (const id of new Set(modelIds)) {
      const definition = modelsById[id];
      if (stopped || !definition) continue;
      try {
        let sources = definition.sources;
        if (definition.adapter === 'full-engine' && definition.contractUrl) {
          const response = await fetch(definition.contractUrl);
          if (!response.ok) continue;
          sources = sourcesFromEngineContract(await response.json());
        }
        if (sources?.length) await preloadModelBytes(sources);
      } catch {
        // A failed preload is harmless: the viewer downloads the model itself when the step is reached.
      }
    }
  })();
  return () => { stopped = true; };
}

/**
 * While a course's lesson list is open, quietly fetch every model its lessons use, in lesson order, so each is already on the device when
 * its step is reached. Waits a moment so the page's own images load first, and does nothing where mayPrefetch() says no.
 */
export function preloadCourseModels(track: CourseTrack) {
  if (!mayPrefetch()) return () => undefined;
  const ids = track.lessons.flatMap((lesson) => lesson.steps.filter((step) => step.type === 'model-pose' && step.modelId).map((step) => step.modelId!));
  let stop: () => void = () => undefined;
  const timer = window.setTimeout(() => { stop = preloadModels(ids); }, 2000);
  return () => { window.clearTimeout(timer); stop(); };
}
