# Card thumbnails

Every course and listed lesson card shows its own square image. The lesson packs name the file (`"thumbnail": "./thumbnails/lesson-<id>.webp"` on a lesson, `course-<pack id>.webp` on a pack); the Check cards reuse their pack's image. If a file is missing or fails to load, the card falls back to the drawn illustration chosen from its title.

## Where each image comes from

`web/thumbnails/sources.json` records, for every thumbnail, the source (a page of a manual or book in the `Notes` folder, an existing image in `web/`, or a render of one of the app's 3D models), the crop, and the credit and licence. `scripts/build_thumbnails.py` reads it and writes the 360 px WebP files beside it:

```
python scripts/build_thumbnails.py --notes "../Notes" --sheet contact.png
python scripts/build_thumbnails.py --notes "../Notes" --only lesson-terminologies
```

- `pdf` items render the given page and crop a fraction of it (`box`: left, top, right, bottom). `fit: "contain"` pads a tall figure to a square using its own background colour; the default `cover` fills the square.
- `image` items crop an existing file under `web/`.
- `render` items use a PNG/WebP captured from the app's own viewer and kept in `scripts/thumbnail_sources/`. `scripts/capture_model_thumbnail.js` documents the exact camera settings and how to capture a new one.
- `diagonal` items join two parts along a teal seam, for lessons that compare two things (opposed and radial engines; tappet and oil pump).

The Notes folder is not part of the repository, so a source PDF that is not found is skipped with a warning and the committed thumbnail is left alone.

## Adding or changing one

1. Edit its entry in `sources.json` (or add one), then run the build script and look at the contact sheet.
2. Point the lesson or pack at `./thumbnails/<item id>.webp`.
3. `npm test` checks that every course and listed lesson has a distinct, small WebP with a credit and licence recorded.

The two Wikimedia photos (CC BY 2.0 and CC BY-SA 3.0) are credited in `sources.json` and in the lesson steps that use the same pictures.
