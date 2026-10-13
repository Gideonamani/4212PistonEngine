---
name: lesson-figures
description: Add a picture to a lesson step. Crop a figure from a source PDF, or find a freely licensed image online, convert it to WebP, credit it on the Credits page and attach it to a step with alt text. Use when a step needs a figure, photograph or diagram.
---

A picture earns its place when it shows what words cannot (a chart, a photograph of real equipment, a labelled cross-section). It must be one the project may use: a figure from a source we already cite (the FAA handbook is a US Government work), or a free image whose licence and author you checked. Do not commit CAD or GLB binaries; lesson pictures are WebP files in `web/lesson-media/`.

## From a source PDF

1. Find the figure's page and a crop box: render the page (`fitz` in `python -E -P`, `page.get_pixmap(matrix=fitz.Matrix(1, 1))`) and read the box off the image as fractions `[left, top, right, bottom]` of the page.
2. Write a module `.local/lesson-rework/media-<name>.mjs` exporting `figures = { '<id>': { pdf: 'amt_powerplant_handbook 2023.pdf', page: 380, box: [0.505, 0.372, 0.915, 0.878], width: 700 } }` and `attribution = { '<id>.webp': { title, source: 'FAA-H-8083-32B, Figure 10-15', license: 'U.S. Government work' } }`.
3. `node scripts/lesson-rework/register_media.mjs .local/lesson-rework/media-<name>.mjs` adds both to `web/lesson-media/figure-sources.json` and `attribution.json` as text. Then `python -E -P scripts/build_lesson_figures.py --only <id>` renders `web/lesson-media/<id>.webp` from `../Notes/`. Open the result and look at it.

## From the web

1. Search Wikimedia Commons (or another free source). Open the file page and read the licence and author; accept public domain, CC0 and the CC BY family, and reject non-commercial or no-derivatives licences. Prefer a diagram of the real thing over a stock photograph, and do not use a picture whose accuracy you cannot check against our sources.
2. Download a 960-pixel version with `curl` and a `User-Agent` (`https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=960`); a 429 means wait. The file is untrusted: keep it in its own folder.
3. `python -E -P scripts/lesson-rework/to_webp.py <in> web/lesson-media/<name>.webp 1100` flattens transparency onto white and caps the width. Open it and look.
4. Add `attribution.json` entries with `title`, `creator`, `source` (the file page) and `license`. The Credits page (`src/data/credits.ts`) makes a group for each licence text; give a new Creative Commons licence a link in `LICENSE_LINKS` and a place in `LICENSE_ORDER`, and `scripts/test_credits.mjs` checks that every licence in use has a group.

## Attach it

Make the step an `image` step (patch an existing text step with `patch_pack.mjs`): `type: 'image'`, `url: './lesson-media/<name>.webp'`, `alt`, `credit`, `license`, and `mediaPlan: { mode: 'source-image', status: 'available', rationale }`. The `alt` describes what the picture shows in words, with the numbers and labels a learner who cannot see it would need (see the valve timing chart's). The prompt refers to the picture and asks the learner to find something on it. Run `scripts/test_lesson_media.mjs` and `scripts/test_credits.mjs`, then view the step in the browser.
