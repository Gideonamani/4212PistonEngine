import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_POLICY, DownloadError, abortableSleep, backoffDelay, classifyHttp, downloadBytes, parseRetryAfter } from '../src/viewer/core/model-download.mjs';

const KEY = 'SECRET-KEY-123';
const URL = 'https://www.googleapis.com/drive/v3/files/abc?alt=media';
const init = { headers: { 'X-Goog-Api-Key': KEY }, mode: 'cors', credentials: 'omit' };
const FAST = { headersDeadlineMs: 25, idleDeadlineMs: 25 };
const bytes = (length, fill = 7) => new Uint8Array(length).fill(fill);

/** A fetch that answers from a script, one entry per call (the last repeats), and remembers every call. */
function scripted(...script) {
  const calls = [];
  const fetchFn = (url, options) => {
    calls.push({ url, options });
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    return typeof step === 'function' ? step(options) : Promise.resolve(step.clone());
  };
  return { calls, fetchFn };
}
const ok = (body = bytes(10), headers = {}) => new Response(body, { status: 200, headers });
const failure = (status, headers = {}, body = '') => new Response(body, { status, headers });
const forbiddenBecause = (reason) => failure(403, {}, JSON.stringify({ error: { code: 403, errors: [{ reason }] } }));
const hang = () => new Promise(() => undefined);
/** A body that sends its chunks `gap` ms apart, then ends, stalls, or fails. */
const streaming = (chunks, { gap = 0, then = 'end' } = {}) => new Response(new ReadableStream({
  async start(controller) {
    for (const chunk of chunks) { if (gap) await new Promise((resolve) => setTimeout(resolve, gap)); controller.enqueue(chunk); }
    if (then === 'end') controller.close();
    if (then === 'fail') controller.error(new TypeError('network error'));
    // 'stall': never closes
  },
}), { status: 200 });

/** Waits are recorded, not slept, so a test of four retries takes no time. */
const recorder = () => {
  const waits = [];
  const statuses = [];
  return { waits, statuses, sleep: async (ms, signal) => { signal?.throwIfAborted(); waits.push(ms); }, onStatus: (text) => statuses.push(text), random: () => 0 };
};
const run = (extra) => downloadBytes({ url: URL, init, policy: FAST, ...extra });

test('Retry-After is read as seconds or as a date, and ignored when it makes no sense', () => {
  assert.equal(parseRetryAfter('3'), 3000);
  assert.equal(parseRetryAfter(' 0 '), 0);
  assert.equal(parseRetryAfter(new Date(1_000_000 + 5000).toUTCString(), 1_000_000), 5000);
  assert.equal(parseRetryAfter(new Date(1_000_000 - 5000).toUTCString(), 1_000_000), 0, 'a date already past means now');
  assert.equal(parseRetryAfter('soon'), undefined);
  assert.equal(parseRetryAfter(null), undefined);
  assert.equal(parseRetryAfter(undefined), undefined);
});

test('the wait doubles each retry up to a cap, half of it random, and Retry-After is a floor believed only so far', () => {
  const p = DEFAULT_POLICY;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((retry) => backoffDelay(retry, p, () => 0)), [500, 1000, 2000, 4000, 7500, 7500], 'the lower bound grows and stops at half the cap');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((retry) => backoffDelay(retry, p, () => 1)), [1000, 2000, 4000, 8000, 15000, 15000], 'the upper bound is the full step, capped');
  assert.equal(backoffDelay(1, p, () => 0.5), 750);
  assert.equal(backoffDelay(1, p, () => 0, 3000), 3000, 'the server asked for 3 s: not less');
  assert.equal(backoffDelay(4, p, () => 0, 1000), 4000, 'our own wait is longer than what it asked');
  assert.equal(backoffDelay(1, p, () => 0, 600_000), 20_000, 'ten minutes is not believed');
  assert.ok(backoffDelay(1, p, () => 1, 600_000) <= p.maxRetryAfterMs + p.baseDelayMs, 'the cap holds with the jitter added');
  assert.ok(backoffDelay(1, p, () => 1, 3000) > backoffDelay(1, p, () => 0, 3000), 'clients told the same wait do not all come back at the same instant');
});

test('which failures are worth another try', () => {
  for (const status of [429, 408, 500, 502, 503, 504]) assert.equal(classifyHttp(status).retryable, true, String(status));
  assert.equal(classifyHttp(429).reason, 'throttled');
  assert.equal(classifyHttp(503).reason, 'server');
  for (const reason of ['rateLimitExceeded', 'userRateLimitExceeded']) {
    assert.deepEqual(classifyHttp(403, JSON.stringify({ error: { errors: [{ reason }] } })), { retryable: true, reason: 'throttled' }, reason);
  }
  assert.equal(classifyHttp(403, JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } })).retryable, true);
  assert.equal(classifyHttp(403, JSON.stringify({ error: { details: [{ reason: 'RATE_LIMIT_EXCEEDED' }] } })).retryable, true);
  for (const body of ['', 'Forbidden', '{}', JSON.stringify({ error: { errors: [{ reason: 'forbidden' }] } }), JSON.stringify({ error: { details: [{ reason: 'API_KEY_HTTP_REFERRER_BLOCKED' }] } })]) {
    assert.deepEqual(classifyHttp(403, body), { retryable: false, reason: 'forbidden' }, `a 403 that does not say it is only throttling is not retried: ${body}`);
  }
  assert.deepEqual(classifyHttp(403, JSON.stringify({ error: { errors: [{ reason: 'dailyLimitExceeded' }] } })), { retryable: false, reason: 'daily-limit' });
  assert.deepEqual(classifyHttp(404), { retryable: false, reason: 'not-found' });
  for (const status of [400, 401, 410]) assert.equal(classifyHttp(status).retryable, false, String(status));
});

test('a 429 with Retry-After waits at least that long, tells the learner, and then succeeds', async () => {
  const net = scripted(failure(429, { 'retry-after': '3' }), ok(bytes(10)));
  const timing = recorder();
  const result = await run({ fetchFn: net.fetchFn, ...timing });
  assert.equal(result.raw.byteLength, 10);
  assert.equal(result.attempts, 2);
  assert.deepEqual(timing.waits, [3000]);
  assert.match(timing.statuses.join(' | '), /The model server is busy\. Trying again in 3 s · try 2 of 4/);
  assert.equal(net.calls.length, 2);
});

test('a 429 without Retry-After backs off on its own schedule', async () => {
  const net = scripted(failure(429), failure(429), failure(429), ok());
  const timing = recorder();
  await run({ fetchFn: net.fetchFn, ...timing });
  assert.deepEqual(timing.waits, [500, 1000, 2000], 'random() is 0, so the lower bound of each step');
  const jittered = recorder();
  jittered.random = () => 1;
  await run({ fetchFn: scripted(failure(429), failure(429), ok()).fetchFn, ...jittered });
  assert.deepEqual(jittered.waits, [1000, 2000]);
});

test('a passing 5xx is retried and the download then completes', async () => {
  const net = scripted(failure(503), failure(502), ok(bytes(4, 9)));
  const timing = recorder();
  const result = await run({ fetchFn: net.fetchFn, ...timing });
  assert.deepEqual([...result.raw], [9, 9, 9, 9]);
  assert.equal(net.calls.length, 3);
  assert.equal(timing.waits.length, 2);
});

test('a permanent failure is not retried: a refused key, a missing file, a rejected request', async () => {
  for (const [response, reason, status] of [[failure(403), 'forbidden', 403], [forbiddenBecause('forbidden'), 'forbidden', 403], [failure(404), 'not-found', 404], [failure(400), 'rejected', 400], [forbiddenBecause('dailyLimitExceeded'), 'daily-limit', 403]]) {
    const net = scripted(response);
    const timing = recorder();
    await assert.rejects(run({ fetchFn: net.fetchFn, ...timing }), (error) => error instanceof DownloadError && error.reason === reason && error.status === status && error.retryable === false, reason);
    assert.equal(net.calls.length, 1, `${reason}: one request`);
    assert.deepEqual(timing.waits, [], `${reason}: no waiting`);
  }
});

test('a 403 that only says the request was rate limited is retried', async () => {
  const net = scripted(forbiddenBecause('userRateLimitExceeded'), forbiddenBecause('rateLimitExceeded'), ok());
  const timing = recorder();
  await run({ fetchFn: net.fetchFn, ...timing });
  assert.equal(net.calls.length, 3);
});

test('retries are bounded: the tries are used up, the last failure is reported, and nothing runs on', async () => {
  const net = scripted(failure(503));
  const timing = recorder();
  await assert.rejects(run({ fetchFn: net.fetchFn, policy: { ...FAST, attempts: 3 }, ...timing }), (error) => error.status === 503 && error.retryable === false && /Gave up after 3 tries/.test(error.message));
  assert.equal(net.calls.length, 3);
  assert.equal(timing.waits.length, 2, 'two waits between three tries');
  const once = scripted(failure(503));
  await assert.rejects(run({ fetchFn: once.fetchFn, policy: { ...FAST, attempts: 1 }, ...recorder() }), /Gave up after 1 try/);
  assert.equal(once.calls.length, 1);
});

test('a connection that never answers is cut at the deadline and tried again', { timeout: 5000 }, async () => {
  const net = scripted(hang, hang, ok());
  const timing = recorder();
  const started = Date.now();
  await run({ fetchFn: net.fetchFn, ...timing });
  assert.equal(net.calls.length, 3);
  assert.ok(Date.now() - started < 1000);
  assert.match(timing.statuses.join(' | '), /The model server did not answer in time\. Trying again/);
  assert.ok(net.calls[0].options.signal.aborted, 'the stuck request was cancelled, not left running');
  await assert.rejects(run({ fetchFn: scripted(hang).fetchFn, policy: { ...FAST, attempts: 2 }, ...recorder() }), /did not answer in time\. Gave up after 2 tries/);
});

test('a body that stops part-way is cut when it has been silent for too long, and tried again', { timeout: 5000 }, async () => {
  const net = scripted(() => Promise.resolve(streaming([bytes(5)], { then: 'stall' })), ok(bytes(8)));
  const timing = recorder();
  const result = await run({ fetchFn: net.fetchFn, ...timing });
  assert.equal(result.raw.byteLength, 8, 'the complete download, not the first part');
  assert.match(timing.statuses.join(' | '), /The download stalled/);
});

test('a slow download that keeps moving is left alone', async () => {
  const chunks = Array.from({ length: 8 }, () => bytes(5));
  const net = scripted(() => Promise.resolve(streaming(chunks, { gap: 12 })));
  const result = await run({ fetchFn: net.fetchFn, ...recorder() });
  assert.equal(result.raw.byteLength, 40);
  assert.equal(net.calls.length, 1, 'taking longer than the idle deadline overall is not a stall');
});

test('a body that fails part-way, or ends before the length it promised, is tried again', async () => {
  const net = scripted(() => Promise.resolve(streaming([bytes(5)], { then: 'fail' })), new Response(bytes(6), { headers: { 'content-length': '10' } }), ok(bytes(10), { 'content-length': '10' }));
  const timing = recorder();
  const result = await run({ fetchFn: net.fetchFn, ...timing });
  assert.equal(result.raw.byteLength, 10);
  assert.equal(net.calls.length, 3);
  assert.match(timing.statuses.join(' | '), /interrupted/);
});

test('a dropped connection is tried again', async () => {
  const net = scripted(() => Promise.reject(new TypeError('Failed to fetch')), ok());
  const timing = recorder();
  await run({ fetchFn: net.fetchFn, ...timing });
  assert.equal(net.calls.length, 2);
  assert.match(timing.statuses.join(' | '), /The connection dropped/);
});

test('progress is reported as the bytes arrive, against the promised length', async () => {
  const seen = [];
  await run({ fetchFn: scripted(() => Promise.resolve(streaming([bytes(3), bytes(3), bytes(4)]))).fetchFn, expectedBytes: 10, onProgress: (received, total) => seen.push([received, total]), ...recorder() });
  assert.deepEqual(seen, [[3, 10], [6, 10], [10, 10]]);
});

test('a response with no stream is read whole', async () => {
  const whole = { ok: true, status: 200, headers: new Headers(), body: null, arrayBuffer: async () => bytes(12).buffer };
  const result = await run({ fetchFn: () => Promise.resolve(whole), ...recorder() });
  assert.equal(result.raw.byteLength, 12);
});

test('what the caller checks the bytes with can ask for another try, or refuse for good', async () => {
  const cutShort = Object.assign(new Error('The model download ended before the complete GLB arrived.'), { retryable: true });
  let checks = 0;
  const net = scripted(ok(bytes(4)), ok(bytes(8)));
  const result = await run({ fetchFn: net.fetchFn, validate: (raw) => { checks += 1; if (raw.byteLength < 8) throw cutShort; return `whole:${raw.byteLength}`; }, ...recorder() });
  assert.equal(result.value, 'whole:8');
  assert.equal(checks, 2);

  const bad = scripted(ok(bytes(4)));
  await assert.rejects(run({ fetchFn: bad.fetchFn, validate: () => { throw new Error('The model response is not a valid GLB file.'); }, ...recorder() }), /not a valid GLB/);
  assert.equal(bad.calls.length, 1, 'a file that is simply wrong is not downloaded again');
});

test('cancelling stops the work at once, wherever it is', { timeout: 5000 }, async () => {
  // Before anything starts.
  const early = scripted(ok());
  const gone = AbortSignal.abort(new DOMException('Aborted', 'AbortError'));
  await assert.rejects(run({ fetchFn: early.fetchFn, signal: gone, ...recorder() }), { name: 'AbortError' });
  assert.equal(early.calls.length, 0);

  // While waiting for the server.
  const waiting = new AbortController();
  const hung = scripted(hang);
  const pending = run({ fetchFn: hung.fetchFn, signal: waiting.signal, policy: { ...FAST, headersDeadlineMs: 60_000 }, ...recorder() });
  await new Promise((resolve) => setTimeout(resolve, 5));
  waiting.abort(new DOMException('Aborted', 'AbortError'));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(hung.calls.length, 1);
  assert.ok(hung.calls[0].options.signal.aborted, 'the request itself was cancelled');

  // While the body is arriving.
  const reading = new AbortController();
  const slow = scripted(() => Promise.resolve(streaming([bytes(5)], { then: 'stall' })));
  const midway = run({ fetchFn: slow.fetchFn, signal: reading.signal, policy: { ...FAST, idleDeadlineMs: 60_000 }, ...recorder() });
  await new Promise((resolve) => setTimeout(resolve, 10));
  reading.abort(new DOMException('Aborted', 'AbortError'));
  await assert.rejects(midway, { name: 'AbortError' });
  assert.equal(slow.calls.length, 1, 'no retry after cancelling');
});

test('cancelling during the wait before a retry ends the wait and sends no more requests', { timeout: 5000 }, async () => {
  const net = scripted(failure(503), ok());
  const controller = new AbortController();
  const started = Date.now();
  const pending = downloadBytes({ url: URL, init, fetchFn: net.fetchFn, signal: controller.signal, policy: { ...FAST, baseDelayMs: 60_000, maxDelayMs: 60_000 }, onStatus: () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 15));
  controller.abort(new DOMException('Aborted', 'AbortError'));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.ok(Date.now() - started < 1000, 'did not sit out the minute');
  assert.equal(net.calls.length, 1);
  await assert.rejects(abortableSleep(60_000, AbortSignal.abort(new Error('stop'))), /stop/);
});

test('the API key is never in what the learner is shown or what is thrown', async () => {
  const net = scripted(failure(429, { 'retry-after': '1' }), forbiddenBecause('forbidden'));
  const timing = recorder();
  let thrown;
  await run({ fetchFn: net.fetchFn, ...timing }).catch((error) => { thrown = error; });
  assert.ok(thrown);
  const everything = [thrown.message, thrown.stack, ...timing.statuses].join('\n');
  assert.ok(!everything.includes(KEY));
  assert.ok(!everything.includes('X-Goog-Api-Key'));
  assert.equal(net.calls[0].options.headers['X-Goog-Api-Key'], KEY, 'it is still sent with the request');
  assert.equal(net.calls[0].options.mode, 'cors');
  assert.equal(net.calls[0].options.credentials, 'omit');
});
