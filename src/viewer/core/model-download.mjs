// Fetching one model file over a classroom connection: another try for throttling and passing failures, after a growing, jittered wait;
// a deadline for a server that never answers and for a download that stops part-way; and a decision about which failures are worth
// another try at all. It takes the fetch, the clock and the random source as parameters so that every case is tested in node with no
// network and no waiting. assets.ts supplies the real ones and chooses between sources (source-order.mjs); this file only ever talks to
// one address. Nothing here logs or returns the request's headers, so an API key cannot leak through an error message.

export const DEFAULT_POLICY = Object.freeze({
  /** Tries per address, the first included. */
  attempts: 4,
  /** The wait before the first retry; each retry waits twice as long as the last, up to maxDelayMs, with half of it randomised. */
  baseDelayMs: 1000,
  maxDelayMs: 15_000,
  /** The longest the server's own Retry-After is believed. */
  maxRetryAfterMs: 20_000,
  /** How long to wait for the response to begin. */
  headersDeadlineMs: 30_000,
  /** How long a download may go without a single new byte before it counts as stalled. A slow download that keeps moving is left alone. */
  idleDeadlineMs: 20_000,
});

/** A failed download. `retryable` says whether another try could help; `reason` is a short word for the status line and for tests. */
export class DownloadError extends Error {
  constructor(message, { status, reason, retryable = false, retryAfterMs } = {}) {
    super(message);
    this.name = 'DownloadError';
    this.status = status;
    this.reason = reason;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/** The Retry-After header as milliseconds (it is whole seconds or an HTTP date), or undefined when absent or unreadable. */
export function parseRetryAfter(value, now = Date.now()) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  const at = Date.parse(text);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

/**
 * How long to wait before retry number `retry` (1 for the first retry): twice as long each time, up to a cap, with the lower half fixed and the
 * upper half random so a class of students does not retry in step. The server's Retry-After, believed only up to maxRetryAfterMs, is a floor.
 */
export function backoffDelay(retry, policy = DEFAULT_POLICY, random = Math.random, retryAfterMs) {
  const grown = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (retry - 1));
  const own = grown / 2 + random() * (grown / 2);
  if (retryAfterMs === undefined) return Math.round(own);
  return Math.round(Math.max(own, Math.min(retryAfterMs, policy.maxRetryAfterMs) + random() * policy.baseDelayMs / 2));
}

const RATE_LIMITED = new Set(['ratelimitexceeded', 'userratelimitexceeded', 'rate_limit_exceeded', 'resource_exhausted', 'sharingratelimitexceeded']);

/** The reason words in a Google API error body, lower-cased; empty when the body is not one. */
function apiReasons(bodyText) {
  try {
    const { error } = JSON.parse(bodyText);
    return [error?.status, ...(error?.errors ?? []).map((item) => item.reason), ...(error?.details ?? []).map((item) => item.reason)].filter(Boolean).map((word) => String(word).toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Whether a failed response is worth another try. Throttling (429), a busy or failing server (5xx) and a request timeout are. A 403 is not,
 * unless Google's own reason says the request was only rate limited: a key that is not allowed here, or a file that is not shared, will be
 * refused again however long we wait. Everything else (404, 400, 401...) is permanent.
 */
export function classifyHttp(status, bodyText = '') {
  if (status === 429) return { retryable: true, reason: 'throttled' };
  if (status === 408) return { retryable: true, reason: 'timeout' };
  if (status >= 500) return { retryable: true, reason: 'server' };
  if (status === 403) {
    const reasons = apiReasons(bodyText);
    if (reasons.some((word) => RATE_LIMITED.has(word))) return { retryable: true, reason: 'throttled' };
    return { retryable: false, reason: reasons.includes('dailylimitexceeded') ? 'daily-limit' : 'forbidden' };
  }
  return { retryable: false, reason: status === 404 ? 'not-found' : 'rejected' };
}

/** What the status line says while waiting to try again. */
const WAITING = {
  throttled: 'The model server is busy.',
  server: 'The model server had a problem.',
  timeout: 'The model server did not answer in time.',
  stalled: 'The download stalled.',
  interrupted: 'The download was interrupted.',
  network: 'The connection dropped.',
  incomplete: 'The download was cut short.',
};

/** Resolve after `ms`, or reject at once with the signal's reason if it aborts first. */
export function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); };
    const onAbort = () => { done(); reject(signal.reason); };
    const timer = setTimeout(() => { done(); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Download one address completely, trying again for failures that could pass. Returns the bytes received and whatever `validate` made of them.
 * Rejects with the signal's reason as soon as `signal` aborts, whether it is waiting for the response, reading the body or waiting to retry.
 * Otherwise rejects with a DownloadError once the failure is permanent or the tries are used up, or with the error `validate` threw (marked
 * `retryable` when more of the same file could fix it, as with a body that ended early).
 *
 * @param {object} options
 * @param {string} options.url
 * @param {RequestInit} [options.init]  Passed to fetch with the attempt's own signal added; never read or logged here.
 * @param {typeof fetch} [options.fetchFn]
 * @param {AbortSignal} [options.signal]  The caller's: aborting it stops everything.
 * @param {Partial<typeof DEFAULT_POLICY>} [options.policy]
 * @param {(ms: number, signal?: AbortSignal) => Promise<void>} [options.sleep]
 * @param {() => number} [options.random]
 * @param {() => number} [options.now]
 * @param {(status: string) => void} [options.onStatus]  Connecting, waiting to retry.
 * @param {(received: number, total: number) => void} [options.onProgress]  `total` is 0 when unknown.
 * @param {number} [options.expectedBytes]  Used for `total` when the response does not say.
 * @param {(bytes: Uint8Array) => unknown} [options.validate]
 * @returns {Promise<{ raw: Uint8Array, value: unknown, attempts: number }>}
 */
export async function downloadBytes({
  url, init = {}, fetchFn = globalThis.fetch, signal, policy: overrides, sleep = abortableSleep, random = Math.random, now = Date.now,
  onStatus = () => undefined, onProgress = () => undefined, expectedBytes = 0, validate = (bytes) => bytes,
}) {
  const policy = { ...DEFAULT_POLICY, ...overrides };

  async function attemptOnce() {
    const attempt = new AbortController();
    const stop = (reason) => { if (!attempt.signal.aborted) attempt.abort(reason); };
    const onCallerAbort = () => stop(signal.reason);
    signal?.addEventListener('abort', onCallerAbort, { once: true });
    let timer;
    const deadline = (ms, error) => { clearTimeout(timer); timer = setTimeout(() => stop(error), ms); };
    // Whatever aborts the attempt (the caller, or a deadline) ends whatever is being waited for, even a stream that ignores the signal.
    const cut = new Promise((_, reject) => { attempt.signal.addEventListener('abort', () => reject(attempt.signal.reason), { once: true }); });
    cut.catch(() => undefined);
    const until = (promise) => Promise.race([promise, cut]);
    try {
      deadline(policy.headersDeadlineMs, new DownloadError('The model server did not answer in time.', { reason: 'timeout', retryable: true }));
      const response = await until(fetchFn(url, { ...init, signal: attempt.signal }));
      clearTimeout(timer);
      if (!response.ok) {
        if (response.status === 403) deadline(policy.idleDeadlineMs, new DownloadError('The model server did not answer in time.', { reason: 'timeout', retryable: true }));
        const body = response.status === 403 ? await until(response.text()).catch(() => '') : '';
        throw new DownloadError(`Model download failed (${response.status}).`, { status: response.status, ...classifyHttp(response.status, body), retryAfterMs: parseRetryAfter(response.headers.get('retry-after'), now()) });
      }
      const promised = Number(response.headers.get('content-length')) || 0;
      const total = promised || expectedBytes;
      const chunks = [];
      let received = 0;
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          deadline(policy.idleDeadlineMs, new DownloadError('The download stalled.', { reason: 'stalled', retryable: true }));
          const { done, value } = await until(reader.read());
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          onProgress(received, total);
        }
      } else {
        deadline(policy.idleDeadlineMs, new DownloadError('The download stalled.', { reason: 'stalled', retryable: true }));
        const whole = new Uint8Array(await until(response.arrayBuffer()));
        chunks.push(whole);
        received = whole.byteLength;
        onProgress(received, total);
      }
      clearTimeout(timer);
      // A body that ends before the length the server promised was cut off. (Not checked when the server compressed it in transit: the two lengths then differ.)
      if (promised && !response.headers.get('content-encoding') && received !== promised) throw new DownloadError('The download ended early.', { reason: 'interrupted', retryable: true });
      const raw = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
      try {
        return { raw, value: await validate(raw) };
      } catch (error) {
        if (error?.retryable) throw new DownloadError(error.message, { reason: 'incomplete', retryable: true });
        throw error;
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (error instanceof DownloadError) throw error;
      if (error?.retryable === undefined && (error instanceof TypeError || error?.name === 'AbortError' || error?.name === 'NetworkError')) {
        throw new DownloadError('The connection to the model server failed.', { reason: attempt.signal.aborted ? 'interrupted' : 'network', retryable: true });
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
      stop(new DownloadError('The attempt is over.', { reason: 'finished' }));
    }
  }

  for (let attempt = 1; ; attempt += 1) {
    signal?.throwIfAborted();
    onStatus(attempt === 1 ? 'Connecting to model…' : `Connecting to model again · try ${attempt} of ${policy.attempts}`);
    try {
      return { ...(await attemptOnce()), attempts: attempt };
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (!(error instanceof DownloadError) || !error.retryable) throw error;
      if (attempt >= policy.attempts) {
        throw new DownloadError(`${error.message} Gave up after ${attempt} ${attempt === 1 ? 'try' : 'tries'}.`, { status: error.status, reason: error.reason, retryable: false });
      }
      const wait = backoffDelay(attempt, policy, random, error.retryAfterMs);
      onStatus(`${WAITING[error.reason] ?? 'The download failed.'} Trying again in ${Math.max(1, Math.round(wait / 1000))} s · try ${attempt + 1} of ${policy.attempts}…`);
      await sleep(wait, signal);
    }
  }
}
