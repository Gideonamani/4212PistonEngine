# Paper mockup exports

JSX exports pulled directly from Paper Desktop (`get_jsx` inside the app), pasted
here so we have exact specs to build against without depending on the Paper MCP
plugin's weekly usage limit (see the `reference-paper-mockups` memory). These are
reference-only — not part of the built site, not imported by anything.

File: **4212PistonEngine** (team: Gideonamani's Team)
`https://app.paper.design/file/01M2GQ4NMAEFWBDDGCXB8EPJEY`

## Artboards (10 total)

- [x] Explore — Desktop → `explore-desktop.jsx` (implemented in training.html)
- [x] Learn — Desktop → `learn-desktop.jsx` (implemented in training.html + training-modes.mjs)
- [ ] Learn — Lesson List (Desktop) → `learn-lesson-list-desktop.jsx`
- [ ] Check yourself — Lesson List (Desktop) → `check-lesson-list-desktop.jsx`
- [ ] Check yourself — Desktop → `check-desktop.jsx`
- [ ] Check yourself — Exam (Desktop) → `check-exam-desktop.jsx`
- [ ] Explore — Mobile → `explore-mobile.jsx`
- [ ] Learn — Mobile → `learn-mobile.jsx`
- [ ] Check yourself — Mobile → `check-mobile.jsx`
- [ ] Check yourself — Mode Select (Desktop) → `check-mode-select-desktop.jsx`

To add one: select the artboard in Paper Desktop, run its `get_jsx` (or whatever
"copy as code" action is available in the app), and paste the result in chat —
keep the leading comment block (file URL, artboard name, date) so we know
provenance. Drop it in as the matching filename above.
