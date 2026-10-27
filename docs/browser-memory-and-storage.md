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

Not yet budgeted by bytes; see issue 102.
