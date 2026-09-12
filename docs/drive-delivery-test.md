# Google Drive delivery experiment — 8 September 2026

Live page: https://gideonamani.github.io/4212PistonEngine/

Repository: https://github.com/Gideonamani/4212PistonEngine

The working folder is already synchronized to Google Drive. Use that synchronization for model exports; do not separately upload files.

## Model and sharing

- Synced export: `.local/GTSIO520_Cylinder_Drive_Test.glb`.
- Drive file ID: `1D7NCgWBjdUKRpjPwh50nxB4KImdwj7Oq`.
- Explicitly verified `anyone` / `reader` permission on this file only.
- Size: 25,246,544 bytes; 60 CAD component IDs preserved.
- SHA-256: `5f14a83aa045ef1b195c0ea0114600637eb69096a811ab0965c9bf123013c61f`.
- Static assembly pose only, not a completed animated engine viewer.

## Results

- Local browser control loaded all 60 components and rendered the cylinder assembly.
- GitHub Pages deployment succeeded.
- The Pages viewer requests the Drive model anonymously with CORS enabled and credentials omitted. It contains no bundled engine-model fallback, proxy, authentication token or manual download step.
- Both `drive.google.com/uc` and `drive.usercontent.google.com/download` returned `TypeError: Failed to fetch` in the in-app browser. Omitting the referrer did not resolve the local browser failure.
- Separately, anonymous HTTP GET from the shell returned 200 and the exact GLB bytes, verified by SHA-256. Response included `Access-Control-Allow-Origin: *`. A range request returned 206 with a valid glTF header.
- Therefore public access and the asset are verified, but interactive Drive delivery in the tested browser has not passed. The generic fetch error does not establish its precise cause; do not claim that all Drive delivery is impossible or that missing CORS headers have been demonstrated.
- Next diagnostic: open the deployed page in a normal Chrome/Edge session without signing into Google, and inspect the failed network request if it still fails.

## Follow-up diagnosis

The user also reproduced the failure in Chrome and Edge. A controlled HTTP request using the same public content URL, Origin header and byte range, with browser fetch metadata (`Sec-Fetch-Dest: empty`, `Sec-Fetch-Mode: cors`, `Sec-Fetch-Site: cross-site`) and a Chrome user agent returned **403 Forbidden**, HTML rather than GLB, and no Access-Control-Allow-Origin header. Adding `confirm=t` also returned 403. A request with only `Sec-Fetch-Mode: cors` still returned 206 and model bytes; do not attribute the rejection to that header alone.

This explains the earlier discrepancy: successful plain HTTP access did not establish that Drive would serve the browser's cross-site request. The correct file ID and public permission were already verified. The standard Drive API `files.get?alt=media` endpoint was also tested anonymously and returned 403 with `The request is missing a valid API key.` A supported API integration requires project/API-key setup and separate end-to-end testing. No API key was created or inserted into the website.

Evidence files are in `.local/browser-headers.txt`, `.local/browser-response.bin`, `.local/confirmed-headers.txt`, and `.local/mode-only-headers.txt`.

## Publishing

Only `.github/workflows/pages.yml`, `.gitignore`, and the selected web files were committed. The workflow publishes `web/`; `web/control.glb` is ignored and used only for localhost control testing.

Re-export with Blender using `export_drive_test.py`, let Drive sync the existing file, verify its file ID and sharing, then test the page. This is a delivery experiment, not yet the full CAD-edit propagation pipeline.

## Redundant upload

One separate upload had already started before the user explained the existing Drive synchronization. It completed as file `1BwwdIhzbka_jXCJi15bWMB3dTzv8i8d7` in My Drive. It remains private and is not used by the website. No further uploads were performed.

## Successful API delivery — 9 September 2026

Commit e265d0c deployed successfully (Actions run 34320286928). Official Drive API files.get with alt=media and the user-provided restricted standard browser key returned HTTP 200, model/gltf-binary. The live GitHub Pages browser rendered all 60 components (24.1 MiB), with piston selection, correct function text, gold isolation, transparent context, camera orbit and zoom verified visually. Requests omit cookies and use strict-origin-when-cross-origin for website-key restrictions. The API key is sent in X-Goog-Api-Key and is not printed in the diagnostic log. The model remains solely on Drive; no production GLB fallback was added to Pages. This verifies static model delivery and interaction, not operating animations or the full CAD-edit propagation pipeline.
