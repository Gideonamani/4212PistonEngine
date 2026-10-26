/**
 * Registers the service worker that keeps the app usable without a connection (issue #77; scripts/offline/service-worker.js). Only a
 * production build has one: the dev server would otherwise be served stale code from the device.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => console.warn('The app could not be saved for offline use.', error));
  });
}

/** Whether a service worker controls this page, so the app and its lessons open without a connection. */
export const appSavedOffline = () => 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);

/**
 * Asks the service worker to save every lesson picture and sound. Resolves when it has tried them all, with how many failed; calls
 * `onProgress` as it goes. Resolves at once with nothing to report when no service worker controls the page.
 */
export function saveLessonMedia(onProgress: (done: number, total: number) => void): Promise<{ total: number; failed: number }> {
  const worker = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
  if (!worker) return Promise.resolve({ total: 0, failed: 0 });
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) => {
      if (data?.type === 'progress') onProgress(data.done, data.total);
      if (data?.type === 'done') { channel.port1.close(); resolve({ total: data.total, failed: data.failed }); }
    };
    worker.postMessage({ type: 'save-media' }, [channel.port2]);
  });
}
