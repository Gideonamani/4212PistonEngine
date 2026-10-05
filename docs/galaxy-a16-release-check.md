# Samsung Galaxy A16 / Chrome release check

Target confirmed by the instructor: Samsung Galaxy A16, Google Chrome. This is a physical-device acceptance check; desktop viewport emulation does not complete it. Status: **pending**.

Instructor feedback, 10 September 2026: “Yes, I emulated and it looks good.” Recorded as a positive emulated-layout review. No physical A16 timing, touch, memory or graphics-performance results have been supplied, so the device acceptance rows below remain pending.

The instructor debugs on the phone through Chrome remote debugging (chrome://inspect on the computer); the app has no in-page diagnostics overlay by design, so timings come from DevTools, not from the page.

Reference family: Continental GTSIO-520. The current cylinder configuration remains GTSIO-520-H; check manual applicability before adding variant-specific geometry or operation.

## Record with each run

- Date, the website commit, and the model hashes: the current release is in `docs/drive-asset-manifest.json`; the optimised release, once published and bound, is in `releases/model-optimization-opt1.json` (see [model-optimization.md](model-optimization.md)).
- Phone model (including 4G/5G variant if known), Android version and Chrome version.
- Connection: Wi-Fi or mobile data; first uncached load or repeat load; whether Chrome's Data Saver is on.
- For each model opened: transfer size and download time (DevTools Network, filter on `googleapis.com`), then time from the end of the download to the first rendered frame (the unpacking and preparation share).
- Observed responsiveness, any browser error, and whether the phone became unusually warm during the exercise.

## Baseline before the optimised models

Take this once on the live site before the optimised release is bound, and again after, with the same phone, connection and steps, so the saving is measured instead of assumed. For each of the six models record: first-load transfer and time to first frame on Wi-Fi, the same on mobile data, and a repeat visit after closing and reopening the tab. The sizes to expect are in the manifest; the optimisation record gives the new ones. Decoded size and transfer size are proxies; the phone's timings are the evidence.

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

Record actual timings before agreeing a performance threshold. A successful transfer alone is not a usability pass. Any inaccessible control, blank viewer, persistent failure or unreadable lesson text needs a fix and a targeted repeat check.
