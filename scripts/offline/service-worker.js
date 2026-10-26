// The service worker (issue #77). scripts/build_service_worker.mjs writes dist/sw.js from this file, with VERSION, CORE and MEDIA set
// for the build above it (see precache-plan.mjs for what each holds). Only a production build has one: src/offline/register.ts.
//
//   The page            network first, so a new deployment shows at once; the saved copy when there is no connection.
//   Files of this build  from the saved copy (they change only with a new build, which brings a new VERSION).
//   Other files here     saved the first time they are fetched (lesson pictures and audio), then served from the device.
//   Google Fonts         saved the first time, then from the device; offline the app falls back to the system font until then.
//   Anything else        left to the network. Model downloads from Drive are kept by the app itself (model-cache.mjs).
/* global VERSION, CORE, MEDIA */
const SHELL = `4212-shell-${VERSION}`;
const RUNTIME = '4212-runtime-v1';
const FONTS = '4212-fonts-v1';
const SCOPE = new URL('./', self.location).href;
const local = (path) => new URL(path, SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(CORE.map(local))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Drop the saved copies of earlier builds; the runtime and font caches carry over.
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((name) => name.startsWith('4212-shell-') && name !== SHELL).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

// The app asks for every lesson picture and sound when the learner saves the course for offline use, and hears back how far it got.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'save-media') return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    const cache = await caches.open(RUNTIME);
    let done = 0;
    let failed = 0;
    for (const path of MEDIA) {
      const url = local(path);
      if (!(await cache.match(url))) {
        try {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response); else failed += 1;
        } catch {
          failed += 1;
        }
      }
      done += 1;
      port?.postMessage({ type: 'progress', done, total: MEDIA.length, failed });
    }
    port?.postMessage({ type: 'done', done, total: MEDIA.length, failed });
  })());
});

async function fromNetworkThenShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(SHELL)).put(local('index.html'), response.clone());
    return response;
  } catch (error) {
    const saved = await caches.match(local('index.html'), { cacheName: SHELL, ignoreVary: true });
    if (saved) return saved;
    throw error;
  }
}

async function savedFirst(request, cacheName) {
  // ignoreVary: a module script asks with an Origin header that the install did not send, and the server's Vary would refuse the match.
  const saved = await caches.match(request, { ignoreSearch: cacheName === SHELL, ignoreVary: true });
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.href.startsWith(SCOPE)) { event.respondWith(fromNetworkThenShell(request)); return; }
  if (url.href.startsWith(SCOPE)) {
    const path = url.pathname.slice(new URL(SCOPE).pathname.length);
    event.respondWith(savedFirst(request, CORE.includes(path) ? SHELL : RUNTIME));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(savedFirst(request, FONTS));
});
