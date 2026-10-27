# Samsung Galaxy A16 / Chrome release check

Target confirmed by the instructor: Samsung Galaxy A16, Google Chrome. This is a physical-device acceptance check; desktop viewport emulation does not complete it. Status: **pending**.

Instructor feedback, 10 September 2026: “Yes, I emulated and it looks good.” Recorded as a positive emulated-layout review. No physical A16 timing, touch, memory or graphics-performance results have been supplied, so the device acceptance rows below remain pending.

A desktop simulation on 27 October 2026 ([galaxy-a16-baseline-2026-10-27.md](galaxy-a16-baseline-2026-10-27.md)) recorded cold and warm model loads and twenty model changes, and lists everything it could not measure. It was taken in a desktop-width viewport on a busy PC, so it is not a device result and completes none of the rows below. Its helper script and procedure are the way to take the same figures on the phone.

The instructor debugs on the phone through Chrome remote debugging (chrome://inspect on the computer); the app has no in-page diagnostics overlay by design, so timings come from DevTools, not from the page.

Reference family: Continental GTSIO-520. The current cylinder configuration remains GTSIO-520-H; check manual applicability before adding variant-specific geometry or operation.

## Record with each run

- Date, the website commit, and the model hashes: the current public release of every model, with its Drive id, size and SHA-256, is in `docs/drive-asset-manifest.json` (ten files, 100,052,840 bytes in all on 6 October 2026; recheck the manifest, which is the authority, not this page). The optimised R10 release is bound there already; the method is in [model-optimization.md](model-optimization.md).
- Phone model (including 4G/5G variant if known), Android version and Chrome version.
- Connection: Wi-Fi or mobile data; first uncached load or repeat load; whether Chrome's Data Saver is on.
- For each model opened: transfer size and download time (DevTools Network, filter on `googleapis.com`), then time from the end of the download to the first rendered frame (the unpacking and preparation share).
- Observed responsiveness, any browser error, and whether the phone became unusually warm during the exercise.

## Baseline on the current release, and again after the cache and download changes

The optimised models are published, so the "before the optimised release" baseline this section once asked for can no longer be taken on the live site. What can still be compared is the phone before and after the browser changes of 27 October 2026: the bounded memory for unpacked models, the saved-model byte budget with its offline panel, and download retries with deadlines (issues 101 to 103). Take the baseline on a site build that does not yet have them if one is still published, and repeat on the build that has them, with the same phone, connection and steps. For each of the ten models record: first-load transfer and time to first frame on Wi-Fi, the same on mobile data, and a repeat visit after closing and reopening the tab. The sizes to expect are in the manifest. Decoded size and transfer size are proxies; the phone's timings are the evidence.

Also record, for the whole exercise: at least 20 model changes in a row (Explore picker and lesson navigation, including going back to a previous lesson), with DevTools' Memory panel after a forced collection at the start, the middle and the end; one mounted viewer, and two if a screen offers them; and any tab reload, crash or lost WebGL context. The helper and the reading of the figures are in [the 27 October record](galaxy-a16-baseline-2026-10-27.md).

## GTSIO-520-H R10 card: size history

The R10 card is the largest of the interactive models (decision D3 sets the phone budget at about 16 MB of transfer, to be confirmed on this phone). The optimised file is now the published release; the live file it replaced was measured once on paper only:

| | September file (replaced) | Optimised file (published) |
|---|---|---|
| Transfer (gzip) | 25,327,875 bytes | 12,019,746 bytes (manifest, 6 October 2026) |
| Decoded | 51,199,204 bytes | not re-recorded |

Each run on the phone, in Chrome with DevTools attached (chrome://inspect on the computer, Network tab, filter `googleapis.com`), and the site opened fresh in a new tab. Record the published file, and compare it with the phone's own earlier run, not with the September figures:

1. Wi-Fi, first uncached load: open Explore, open the GTSIO-520-H R10 card. Note the transfer size, the download time (start to end of the request), and the time from the end of the download to the first rendered engine.
2. Mobile data, the same. (Background downloads must not start by themselves on mobile data.)
3. Repeat load: close the tab, reopen the site, open the same card. DevTools should show no download of the model.
4. With the model open: orbit and zoom with one and two fingers, tap three or four parts and read the part card, play the cycle and watch for stutter, run the exploded view, then collapse it. Look for wrong orientation, missing or flickering parts, and parts that jump.
5. Did the browser tab reload or crash, did the phone become noticeably warm, and did anything show an error?

The result to record is the two timings per connection (download, and download end to first frame) next to the byte counts, not a pass or fail. A smaller file is not proof of a faster start: the optimised file takes about 94 ms longer to unpack on a desktop (376 to 470 ms), and the phone is slower.
State only what was measured. Until this is run on the phone, no timing for R10 on the A16 exists; the 27 October desktop simulation gives only desktop figures (R10 downloaded in 14.0 s and was ready 3.0 s after that, on a busy PC).

## Student exercise

1. Open the published site in Chrome without signing in. Courses, Explore and Check each load without a layout break at the phone's width, in portrait and landscape.
2. Open a course. The banner sits at the top with the course title on it; the description is cut to three lines with a Read more control when it is longer; the button says Start course (or Continue after a lesson has been begun) and opens the right lesson and step.
3. Open a lesson. Each card and the lesson itself show "Instructor review pending" until a lesson is reviewed. Step through it with the Next Step button, then tap the progress bar to open the list of steps and jump to one; check the list can be dismissed and that the back control and bottom bar stay within reach.
4. On a 3D step, confirm the viewer never takes more than about three quarters of the screen height, so the text above or below it still scrolls under one finger. Rotate with one finger on the viewer and zoom with two; turn on Pan and move the model; scroll the page by dragging on the text. Rotate the phone to landscape: the lesson starts side by side, and the toggle in the top bar switches to stacked and back; the choice is remembered after a reload.
5. On a step that spotlights a part, switch between Highlight, X-ray and Isolate; the choice should hold on the next spotlight step.
6. In Explore, load the operating cylinder. Find the piston with search, select it, read its function, isolate it, then restore. Enter fullscreen or expanded view, operate the viewer, and return. Enable a section, move its plane, reverse it.
7. Play the mechanism, change speed, pause, scrub through 0/90/180/360/540/630/720 degrees, and resume; check valve gear and spring compression. Compare responsiveness with sections off and on, then enable cycle particles using View gas inside.
8. Do a Check: answer a question, read the explanation, open the question list from the progress bar and jump to another question.
9. Open the Credits page from the About dialog and from the foot of the course list; the licence groups are readable and the links to originals open.
10. Repeat load: close the tab, reopen the site and open the same model. A model that was opened before should open from the device (DevTools Network shows no download of it, and the viewer says it is opening a saved copy). With Data Saver off, on Wi-Fi, opening a course's lesson list may fetch that course's models in the background after a short pause; on mobile data it must not. During a separate transfer, cancel and retry; confirm cancellation is understandable and retry reaches the model.
11. Start and pause the optional music; it must not play before the student chooses it.
12. Course information, Use without internet, on Wi-Fi: open the list of 3D models (it shows how many are saved and which were only opened), press Save everything, and watch the progress. Afterwards the count must equal the models really saved. Then switch the phone to flight mode, reload and open a saved model (it opens) and a model that is not saved (it says at once that it is not saved and there is no connection, with no retry loop).
13. Storage: with the models saved, check the browser's storage figure for the site (DevTools Application, Storage) against the 150 MB budget in [browser-memory-and-storage.md](browser-memory-and-storage.md), and clear one saved model in DevTools; reopen the panel and confirm it no longer counts that model.
14. Download trouble: in DevTools set Network throttling to Offline in the middle of a model download. The cover should say it is trying again, then recover when the connection returns; after the tries are used up the viewer shows the reason and a Try again button that works.

Do not report a feature as tested before it exists on the build under test.

## Acceptance record

| Check | Result | Evidence / issue |
|---|---|---|
| First and repeat model loads, with timings | Pending | |
| Course page: banner, description, Start/Continue | Pending | |
| Lesson: progress bar, step list, review chip | Pending | |
| Viewer height, touch orbit/zoom, pan, page scroll; portrait and landscape | Pending | |
| Side-by-side and stacked layout, remembered after reload | Pending | |
| Highlight, X-ray and Isolate | Pending | |
| Search, selection, isolation and reset | Pending | |
| Fullscreen and return | Pending | |
| Section and solid appearance | Pending | |
| Playback and angle scrub | Pending | |
| Check flow and question list | Pending | |
| Credits page | Pending | |
| Saved copy on repeat visit; no background download on mobile data | Pending | |
| Optional audio | Pending | |
| Cancel and retry | Pending | |
| Twenty model changes in a row; retained memory after collection; no reload or lost context | Pending | Desktop simulation only: [27 October record](galaxy-a16-baseline-2026-10-27.md) |
| Save everything, flight-mode reopen, saved and missing model | Pending | |
| Storage within budget; panel follows a cleared model | Pending | |
| Download interrupted: retry status, Try again | Pending | |
| Load, memory and frame-time budgets agreed from phone figures | Pending | Not agreed: a threshold from a desktop is not a phone threshold |

Record actual timings before agreeing a performance threshold. A successful transfer alone is not a usability pass. Any inaccessible control, blank viewer, persistent failure or unreadable lesson text needs a fix and a targeted repeat check.
