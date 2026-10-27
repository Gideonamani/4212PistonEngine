# Classroom pilot plan: Drive delivery capacity (issue 105)

Status: **plan, 27 October 2026. Nothing in it has been measured.** The Cloud console has not been opened, no cohort has been named and no pilot has run. The sizes below come from `docs/drive-asset-manifest.json` and the 27 October build; every other number is a planning scenario and is labelled as one. The standing rules are in [ADR 001](../decisions/001-public-drive-browser-key.md): this plan authorises no billing, quota or key change and no synthetic burst against public Drive.

## What is known from the files

- Ten published model files, 100,052,840 bytes in all (manifest, 6 October 2026). The largest is `web/cylinder-reviewed-20261001.glb.gz` at 15,937,570 bytes; the R10 file is 12,019,746; the smallest is `web/engine.glb.gz` at 4,228,178.
- A site visit costs separate traffic from Pages and not from Drive: the 27 October build reports 101 files (5.6 MB) saved when the service worker installs and 51 more (4.2 MB) fetched on demand. These are build-output figures, not measured visits. Pages traffic is not visible in the Cloud console; it is not part of Drive quota.
- A model, once downloaded, is kept for the browser's session in memory and can be kept on the device (Cache Storage, 150 MB budget) so a repeat opening makes no Drive request. From the 27 October changes a failed download is tried again (up to 4 tries per address) before the next source; see [browser-memory-and-storage.md](../browser-memory-and-storage.md).

## Planning scenarios (arithmetic, not measurements)

Cold means no copy on the device. Transfer is the file size; a Drive request is one per cold model per device, plus retries (to be confirmed in the Network tab, not assumed).

| Scenario | Per device | For 30 devices (illustrative cohort size, not the real one) |
|---|---|---|
| One cold open of the largest model | 15.94 MB, about 25.5 s of payload at 5 Mbit/s | 478 MB; 3.8 Gbit, so about 38 s of payload at 100 Mbit/s and about 191 s at 20 Mbit/s if the room's connection is the limit |
| One cold open of R10 | 12.02 MB, about 19.2 s at 5 Mbit/s | 361 MB |
| All ten models cold | 100.05 MB, about 160 s at 5 Mbit/s | 3.0 GB |
| Warm (saved on the device) | 0 bytes from Drive | 0 |

These show what a measurement has to explain, not what the system can do. They say nothing about Google's limits for this project, which are not known until the console is inspected.

## What the pilot has to decide

1. **Cohort and conditions (the owner fills these in):** number of devices; which devices (phones, laptops); the model mix per session (which lessons, in what order, which models are opened together at the start); the network (the classroom Wi-Fi, mobile data, or both); cold or warm start; the date and time window.
2. **Acceptance budgets (to be agreed from the figures of issue 104 and the pilot, not guessed):** time from tapping a model to the first interaction; the share of opens that succeed without a retry; the share that need the Try again button; the most retries tolerated. A budget set from a desktop is not a phone budget.
3. **The supported scope the conclusion may state:** "up to N devices opening the largest model within M minutes on this network, observed on this date". Not a user-capacity promise.

## Order of work

1. Merge the download retries (issue 103). Throttle and recovery are not accepted before that, because a retry is what makes recovery possible.
2. Run the phone exercise (issue 104) so the pilot's budgets rest on a phone figure.
3. Cloud console baseline, **before** the class (owner or operator): see the next section.
4. The controlled pilot, as ordinary class use or a rehearsal with real devices. No script that makes many requests to Drive.
5. Console figures for the same window, the dated record, and the conclusion.

## Cloud console baseline (needs the project owner; the assistant cannot read it)

In Google Cloud Console, project `keongeraldo` (shared with other applications; see ADR 001):

- APIs & Services, Google Drive API, Metrics: requests, error rate and latency for the window, split by response code, and by credential where the console offers the filter. Note when the filter is not available; the project may carry other applications' traffic, and then the figures are an upper bound for this site.
- Quotas & System Limits: the limits that actually apply to the Drive API for this project (per minute, per user, per day), and how much of each the window used.
- Billing: whether a billing account is linked, and any charge. Do not attach billing for this pilot.
- Credentials: confirm that the browser key is restricted to the Drive API and the site, as ADR 001 requires, and write down only that it is, never the key.

Anything the console does not show is recorded as "unavailable", with the next measurement that would settle it.

## What to observe in the browser

Console figures do not show what a student felt. For a few instrumented devices (three to five, chosen across phones and laptops), open the browser's developer tools before the class and record, per model open: cold or warm; the time from the tap to the model being ready; the Drive requests (the Network tab filtered on `googleapis.com`) with status codes and sizes; the number of retries the cover reported; whether Try again was used; and any error text. On the other devices the instructor notes, by stopwatch from the front, how long until most are ready and which students needed help. Student names are not recorded; devices are "phone A", "laptop B".

## Paths the pilot must exercise (from the acceptance list)

| Path | How | Recorded as |
|---|---|---|
| Cold open | Clear the site's storage on an instrumented device, open the largest model | time to ready, bytes, requests |
| Warm open | Open it again | no Drive request |
| Interrupted download | In developer tools set the network to Offline for a few seconds mid-download, then back | the retry status shown, recovery or Try again |
| Throttle recovery | Only if Drive answers 429 or 403 rate limited by itself during the real class; never provoked | status codes, waits, recovery |
| Offline readiness | Course information, Use without internet, Save everything on Wi-Fi; then flight mode and reload | which models open, what the missing ones say |

## The dated record (copy this for each pilot or rehearsal)

```
Date and time window:
Website revision (commit) and deployment run:
Asset releases (manifest date and the ids opened):
Cohort: devices, kinds, how many instrumented. No names.
Network: kind, and the measured speed if taken.
Conditions: cold or warm; model mix and order; anything unusual (other classes online, a test running).
Browser observations (instrumented devices): per open, ready time, requests with status codes, retries, Try again, errors.
Instructor observations: time until most were ready; who needed help (count, not names).
Cloud console, same window: requests, error rate by code, quota use per limit, billing. Each with "read from the console" or "unavailable".
Estimates: anything calculated rather than read. Marked as estimates.
Result against the agreed budgets:
Conclusion: the supported scope observed, what stayed unmeasured, and the next measurement needed.
Contains no key values, learner personal data or private native assets: checked by:
```

## Owner decisions this plan waits for

1. The cohort size, devices and date.
2. Who opens the Cloud console, and when (before and after).
3. The model mix of the pilot session.
4. Whether a rehearsal with a few devices comes before the whole class.
