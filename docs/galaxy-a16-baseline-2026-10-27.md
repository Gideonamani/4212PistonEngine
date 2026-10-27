# Viewer load and navigation baseline, 27 October 2026 (desktop simulation)

**This is not a Samsung Galaxy A16 result.** It was taken on a desktop PC with Claude in Chrome standing in for the phone, because the phone was not to hand. It records what was actually observed and what could not be measured, so the physical run in [galaxy-a16-release-check.md](galaxy-a16-release-check.md) has a procedure and a comparison. No row of that check's acceptance record is marked passed from it, and none of these figures is an estimate of how the phone will behave: the phone's CPU, GPU, memory and network are all different.

## Conditions

| | |
|---|---|
| Date | 27 October 2026 |
| Site | The published site, `https://gideonamani.github.io/4212PistonEngine/`, serving website commit `6f1a00a` (main after the memory change, #109; deploy run 40503423162 succeeded). It does **not** yet include the saved-model budget (#102) or the retry and deadline work (#103). |
| Browser | Chrome 155 on Windows 11, driven by the Claude in Chrome extension. 8 logical cores, `navigator.deviceMemory` 8. |
| Viewport | **1536 × 742 CSS px at 1.25 device pixel ratio: a desktop layout.** Resizing the window to 500 × 915 did not change the viewport, so none of this ran in a phone-width layout, with touch, or with a phone's pixel density. |
| Machine load | About 84 % CPU busy from other applications during the run, and about 640 MB of free RAM. Every timing below is inflated by that, by an unknown amount. |
| Connection | The PC's own network. `navigator.connection` reported effective type 4g, downlink 10 Mbit/s, round trip 250 ms, Data Saver off. Wired or Wi-Fi was not recorded. |
| Cache state | This Chrome profile had one saved model, a file that is not in the current manifest (an older release of something), saved in the format used before sizes were recorded. The four models below were not saved, so their first load is a cold download. |

Models measured, with the current public release (`docs/drive-asset-manifest.json`, 6 October 2026):

| Model | Registry id | Drive file (start) | Transfer bytes | SHA-256 (start) |
|---|---|---|---|---|
| Hydraulic tappet | `hydraulic-tappet` | `1u8hplcs` | 7,126,499 | `0e2632609a9ec7c5` |
| Oil pump and relief valve | `oil-pump` | `167cbQkD` | 4,696,163 | `0322990a175dde34` |
| Operating cylinder | `cylinder` | `1CwfNUit` | 15,937,570 | `b34300914d27a5f1` |
| GTSIO-520-H R10 | `gtsio520-h-r10-mechanism-study` | `1Gx9nOjT` | 12,019,746 | `bcc141fafe3a282a` |

## Cold loads: first open of a model, opened from the Explore picker or its gallery tile

Times are from the click. "Request starts" is when the browser began the Drive request (after the 3D viewer's code and the model's session had started), "download" is the request's duration, "ready" is when the loading cover had gone and the canvas was there (sampled every 40 ms), and "after download" is ready minus the end of the download: unpacking, parsing and the first frame, together.

| Model | Request starts | Download | Throughput | Ready | After download | JS heap after |
|---|---|---|---|---|---|---|
| Hydraulic tappet (7.1 MB) | 2.85 s | 9.19 s | 6.2 Mbit/s | 13.57 s | 1.52 s | 88 MB |
| Oil pump (4.7 MB) | 2.18 s | 7.51 s | 5.0 Mbit/s | 10.89 s | 1.20 s | 110 MB |
| Operating cylinder (15.9 MB) | 0.60 s | 16.32 s | 7.8 Mbit/s | 18.87 s | 1.96 s | 176 MB |
| R10 (12.0 MB) | 0.58 s | 13.96 s | 6.9 Mbit/s | 17.56 s | 3.02 s | 196 MB |

The first model's 2.85 s before its request includes loading the 3D viewer's code for the first time. The JS heap is `performance.memory.usedJSHeapSize`, which is not collected on demand from a page, so it includes garbage and is not a peak; it does not include the unpacked model bytes (array buffers) or the GPU.

## Twenty model changes, warm

After the four cold loads above, twenty model changes through the Explore picker, five of each of the four models in a rotating order, each opened from the saved copy on the device or from memory.

| Model | Ready (ms), five opens, sorted | Median |
|---|---|---|
| Oil pump | 860, 885, 1016, 1146, 1192 | 1.0 s |
| Operating cylinder | 1528, 1644, 1668, 1770, 1888 | 1.7 s |
| Hydraulic tappet | 1450, 1981, 2051, 2169, 2470 | 2.1 s |
| R10 | 2556, 2703, 2916, 3428, 3433 | 2.9 s |

- No Drive request was made for any of the twenty: every open was served from the device.
- No error alert and no page reload occurred in the 24 loads (the page's JavaScript state persisted throughout), and the viewer's canvas was present each time. The rendered picture itself was not inspected.
- JS heap after each change ranged from 112 MB to 246 MB with no clear trend (first five changes 182–235 MB, last five 185–246 MB; when the browser collects garbage dominates). This is context, not a memory budget: see the unavailable list.

## Not measured, and why

| Item | Status |
|---|---|
| Frame-time distribution while orbiting or playing a cycle | **Unavailable.** The page's `requestAnimationFrame` ran about once a second (deltas of about 1,011 ms) because the browser window was behind other windows; frame times from it would measure that, not the viewer. |
| Peak and retained process memory, GPU memory, context loss | **Unavailable.** Page JavaScript cannot read process memory; the held-bytes figures for the unpacked-model cache are in the memory guide and come from a development-only hook that the published site does not have. |
| Transfer size from Resource Timing | Reported as 0 for Drive requests: Drive does not send `Timing-Allow-Origin`. The byte counts above are the manifest's. |
| Phone-width layout, touch, two-finger gestures, Pan | Not exercised (see the viewport row). |
| Selection, isolation, sections, cycle playback, exploded layouts on the cylinder and the dense engine | Not exercised in this run. |
| Saving every model for offline use, disconnecting, reopening, eviction feedback | Not exercised: the published site does not yet have the saved-model budget (#102). |
| Throttled download, retry, deadline | Not exercised: the published site does not yet have #103. |
| Mobile-data prefetch policy | Not exercised: it needs a phone on mobile data. |
| Cancellation and returning to a previous lesson | Not exercised in this run. |
| Any budget (load, memory, frame time) | **Not agreed.** A threshold from a loaded desktop would be meaningless for a phone. |

## What to take from it

- The procedure works and can be repeated on the phone with the same four models (below). On the phone, record every row marked unavailable here.
- On this PC, a model's first open was dominated by the download (68–86 % of the time to ready), not by unpacking and parsing (1.2–3.0 s); the largest after-download time was the R10, which is the densest scene. Whether that ratio holds on the phone is the open question the physical run answers.
- Warm opens of a model already saved on the device cost 0.9–3.4 s and no network.

## How to repeat

On the phone: connect it to the computer, open `chrome://inspect` on the computer and inspect the site's tab. In the DevTools Console paste the helper below, open the Explore gallery, open one model from its tile, and then call `await __measure('label', index)` for each model in the picker's order (0 operating cylinder, 1 six-cylinder engine, 2 R10, 3 Wright Flyer, 4 Wright reconstruction, 5 Langley, 6 Gnome, 7 hydraulic tappet, 8 oil pump, 9 accessories and drives). Take the frame-time and memory figures from DevTools' Performance and Memory panels instead of the page. No in-page diagnostics overlay exists or is wanted.

```js
window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.__open = async (index) => {
  document.querySelector('button[aria-label="Select 3D Engine Model"]').click();
  await __sleep(250);
  [...document.querySelector('div.absolute.left-0.top-full').querySelectorAll('button')][index].click();
};
window.__measure = async (label, index) => {
  const before = performance.getEntriesByType('resource').length;
  const t0 = performance.now();
  let appeared = null, ready = null, alert = null;
  await __open(index);
  while (performance.now() - t0 < 38000) {
    const status = document.querySelector('[role=status]');
    if (status && appeared === null) appeared = Math.round(performance.now() - t0);
    const failure = document.querySelector('[role=alert]');
    if (failure) { alert = failure.textContent.slice(0, 120); break; }
    if (appeared !== null && !status && document.querySelector('[role=application]')) { ready = Math.round(performance.now() - t0); break; }
    await __sleep(40);
  }
  const drive = performance.getEntriesByType('resource').slice(before).filter((e) => e.name.includes('googleapis.com/drive'))
    .map((e) => ({ startMs: Math.round(e.startTime - t0), downloadEndMs: Math.round(e.responseEnd - t0), durMs: Math.round(e.duration) }));
  return { label, coverAppearedMs: appeared, readyMs: ready, alert, driveRequests: drive, jsHeapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) };
};
```

Before a cold run clear the site's saved models in DevTools → Application → Storage (or open a model that is not yet saved); the phone's first open of each model is the cold figure and every later open of it is warm. Record the date, the website commit, the model hashes from the manifest, the phone model, Android and Chrome versions, whether Chrome's Data Saver is on and the connection (Wi-Fi or mobile data) beside the figures, as in the check's list.
