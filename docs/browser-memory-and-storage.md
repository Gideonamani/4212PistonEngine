# Browser memory and storage budgets

A student's phone has little memory and little free storage, and the models are large (the ten published files total about 100 MB to download and about 300 MB once unpacked). Two budgets keep that in bounds. They are different resources and are set separately: **memory** (this page, first section) is lost when the tab closes; **saved copies** on disk are kept between visits.

## Memory: unpacked models held by a tab

Code: `src/viewer/core/model-memory.mjs` (the rules, tested in node by `scripts/test_model_memory.mjs`), used by `src/viewer/core/assets.ts`.

A model's unpacked bytes are held in one of two ways:

| State | Meaning | Evicted? | Counted against the budget? |
|---|---|---|---|
| In use | A viewer has asked for the model and has not been closed yet (its abort signal has not fired). | Never | No |
| Idle | No viewer holds it. It stays so that closing a model and opening it again, or moving between lessons that share a model, does not download and unpack it twice. | Yes, least recently used first | Yes |

**The budget is 64 MB of idle bytes** (`IDLE_BUDGET_BYTES`). It is a starting value, chosen so the largest single model (54 MB unpacked) can stay and be reopened, while ten models can never add up to the 300 MB they would if all were kept. It is to be revisited with the Galaxy A16 measurements ([galaxy-a16-release-check.md](galaxy-a16-release-check.md)). A model larger than the whole budget is not kept once closed, and its closing does not push out the smaller ones.

Rules the tests hold:

- Everyone who asks for a model while it is downloading shares that one download and one copy. Progress is replayed to a late joiner.
- One viewer leaving (or its page changing) does not cancel the download for another viewer. The download is cancelled only when the **last** viewer gives up, and an entry that was cancelled is forgotten, so asking again starts a fresh download.
- A failed download is forgotten and every viewer waiting for it hears about it; the next request tries again.
- A viewer's hold lasts as long as its abort signal has not fired. `useModelViewer` aborts that signal when the viewer unmounts, so a viewer needs no extra code to let go.
- Prefetching (`prefetchModel`) never keeps the unpacked bytes: it downloads the model so the compressed copy is saved on the device, then lets the bytes go. Opening the model later reads the saved copy and unpacks it. A viewer that opens the model while the prefetch is under way joins that download. Prefetching does nothing where the model cannot be saved on the device or already is, and `preloadModels`'s stop function cancels a prefetch no viewer has joined.
- Saving a model for offline use (`saveModelOffline`) is separate: it also keeps nothing in memory.

What the budget does **not** cover: the GPU and the parsed scene (freed when the viewer is disposed, as before), and the bytes of models in use. The worst case is therefore the models in use, plus 64 MB idle, plus any downloads in flight.

### Measuring

`e2e/model-memory.spec.ts` makes repeated model changes in Explore and prints, after each, the bytes in use, the idle bytes and the JavaScript heap after a forced collection. The held figures come from a development-only hook (`__modelMemory`, installed in `assets.ts` only when `import.meta.env.DEV`; production has no hook and no overlay). Run it with more changes for the record:

```bash
SOAK_CHANGES=24 npx playwright test e2e/model-memory.spec.ts --project=phone-390
```

The JavaScript heap does not include the unpacked bytes (they are external array buffers), nor the GPU, so the heap column is context, and the held-bytes columns are the evidence for this budget. Process-wide memory on a phone is the Galaxy A16 exercise (issue 104).

## Saved copies on disk

Code: `src/viewer/core/model-cache.mjs` (tested in node by `scripts/test_model_cache.mjs`), used by `src/viewer/core/assets.ts` and shown by `src/components/OfflinePanel.tsx`. The files are the compressed downloads, kept in the browser's Cache Storage under the model's Drive id (a published Drive file never changes, so its id stands in for its content).

**The budget is 150 MB of stored bytes** (`MAX_BYTES`): the ten published files total about 100 MB, so every model fits with room for a few new ones. It is a starting value, to be revisited with the Galaxy A16 measurements. It is counted in bytes, not files; the old limit of twelve files said little about disk use once models differ so much in size, so it is gone. Each stored file records its own size, when it was saved and who asked for it in headers on the stored response, so the total is read from the storage itself and cannot drift from it. A file saved before sizes were recorded is measured once and stamped.

| Kind | How it gets there | Removed to make room? |
|---|---|---|
| Saved (`explicit`) | The learner pressed Save everything for offline use, or kept a model that was already there. | Never, for anything. |
| Kept (`opportunistic`) | The model was opened, or fetched ahead of time. | Yes, oldest save first, before anything else is touched. |

Rules the tests hold:

- A save that does not fit after removing every kept copy is refused, and **nothing is removed for it**. A file larger than the whole budget is refused outright. The reason is returned (`too-large`, `no-room`, `unavailable`, `write-failed`) and the offline panel says which models did not fit. `saveModelOffline` asks `roomFor` before it downloads, so it does not start a download that could not be kept (that pre-check has no test of its own; `roomFor` itself does).
- Replacing a file counts the old copy as freed. A kept write never downgrades a saved copy.
- If the browser refuses a write (its own quota is tighter than ours), the oldest kept copy is given up and the write is tried again, until there is none left to give up; then the result is `write-failed`, no half-written copy remains, and the model still loads online.
- A copy whose size is not the size the source promised, or not the size it recorded, is a damaged save and is deleted on read.
- If Cache Storage is missing or blocked (some private windows, insecure pages) nothing is saved, nothing throws, and the panel shows no models rather than offering a save that cannot work.
- Copies of a release the app no longer uses (the registry now names another Drive id) are cleared when the panel opens, but only once every model's sources could be read, so a failed lookup cannot delete a good copy. Without this, an old saved copy would take up space for good.
- Saving all models goes straight from the network to disk. It does not keep them in memory (first section).

**What the panel shows** is read back from the device when it opens, when its list is opened, and after every save, never assumed: a model counts as saved only if the storage holds it. Models only kept for having been opened are listed as "opened" and are not counted as saved, because they can be removed.

An end-to-end check against the built site (`e2e/production.spec.ts`) stands in for Drive with files of the registry's sizes, saves everything, removes one copy, and checks the panel with and without a connection.
