import { modelsById } from '../data/modelRegistry';
import { preloadModelBytes, sourcesFromEngineContract } from './core/assets';

/** Download the given models one after another, in lesson order, so each is local before its step is reached. Returns a stop function. */
export function preloadModels(modelIds: string[]) {
  // Respect a visitor who asked the browser to save data.
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return () => undefined;
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
