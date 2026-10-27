import assert from 'node:assert/strict';
import test from 'node:test';
import { IDLE_BUDGET_BYTES, createModelMemory } from '../src/viewer/core/model-memory.mjs';

const MB = 1024 * 1024;

/** A loader whose downloads finish when the test says so, and which remembers how it was called. */
function fakeNetwork() {
  const calls = [];
  const load = (name, size) => (signal, onProgress) => new Promise((resolve, reject) => {
    const call = { name, signal, onProgress, finish: () => resolve(new ArrayBuffer(size)), fail: (error = new Error('Model download failed (503).')) => reject(error) };
    signal.addEventListener('abort', () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError')), { once: true });
    calls.push(call);
  });
  return { calls, load, started: (name) => calls.filter((call) => call.name === name).length };
}

/** Open a model, let its download finish and let go of it, the way a viewer that is shown and closed does. */
async function visit(memory, network, name, size, options = {}) {
  const hold = memory.acquire(name, network.load(name, size), options);
  const call = network.calls.findLast((item) => item.name === name && !item.signal.aborted);
  call?.finish();
  const bytes = await hold.bytes;
  hold.release();
  return bytes;
}

test('the idle budget is documented in bytes and is the one the app uses', () => {
  assert.equal(IDLE_BUDGET_BYTES, 64 * MB);
  assert.equal(createModelMemory().stats().budgetBytes, 64 * MB);
});

test('a model opened again after it was closed is not downloaded a second time', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  const first = await visit(memory, network, 'cylinder', 10 * MB);
  assert.deepEqual(memory.stats(), { activeEntries: 0, activeBytes: 0, idleEntries: 1, idleBytes: 10 * MB, budgetBytes: 100 * MB });
  const again = memory.acquire('cylinder', network.load('cylinder', 10 * MB));
  assert.equal(await again.bytes, first, 'the same decoded copy');
  assert.equal(network.started('cylinder'), 1, 'one download for the visit and the return');
  assert.equal(memory.stats().activeBytes, 10 * MB, 'it is in use again, so it counts as in use');
  again.release();
});

test('two viewers of one model share a single download and a single copy', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  const progress = [];
  const one = memory.acquire('engine', network.load('engine', 20 * MB), { onProgress: (status) => progress.push(`one:${status}`) });
  network.calls[0].onProgress('Downloading model · 40%', 40);
  const two = memory.acquire('engine', network.load('engine', 20 * MB), { onProgress: (status) => progress.push(`two:${status}`) });
  assert.equal(network.calls.length, 1, 'the second viewer joined the download in flight');
  assert.deepEqual(progress, ['one:Downloading model · 40%', 'two:Downloading model · 40%'], 'a late viewer is told where the download has got to');
  network.calls[0].finish();
  assert.equal(await one.bytes, await two.bytes);
  assert.equal(memory.stats().activeBytes, 20 * MB, 'counted once, not twice');
  one.release();
  assert.equal(memory.stats().activeBytes, 20 * MB, 'still in use by the other viewer');
  two.release();
  assert.equal(memory.stats().idleBytes, 20 * MB);
});

test('one viewer leaving mid-download does not cancel it for the other', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  const leaving = new AbortController();
  const gone = memory.acquire('engine', network.load('engine', 5 * MB), { signal: leaving.signal });
  const staying = memory.acquire('engine', network.load('engine', 5 * MB));
  leaving.abort(new DOMException('Aborted', 'AbortError'));
  await assert.rejects(gone.bytes, { name: 'AbortError' });
  assert.equal(network.calls[0].signal.aborted, false, 'the download carries on for the viewer that stayed');
  network.calls[0].finish();
  assert.equal((await staying.bytes).byteLength, 5 * MB);
  assert.equal(network.calls.length, 1, 'no restart');
  staying.release();
});

test('when the last viewer leaves mid-download the download is cancelled and forgotten', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  const first = new AbortController();
  const second = new AbortController();
  const a = memory.acquire('engine', network.load('engine', 5 * MB), { signal: first.signal });
  const b = memory.acquire('engine', network.load('engine', 5 * MB), { signal: second.signal });
  first.abort(new DOMException('Aborted', 'AbortError'));
  assert.equal(network.calls[0].signal.aborted, false);
  second.abort(new DOMException('Aborted', 'AbortError'));
  await assert.rejects(a.bytes);
  await assert.rejects(b.bytes);
  assert.equal(network.calls[0].signal.aborted, true, 'no one is waiting for it');
  assert.deepEqual(memory.stats(), { activeEntries: 0, activeBytes: 0, idleEntries: 0, idleBytes: 0, budgetBytes: 100 * MB });
  const retry = memory.acquire('engine', network.load('engine', 5 * MB));
  assert.equal(network.calls.length, 2, 'asking again starts a fresh download');
  network.calls[1].finish();
  assert.equal((await retry.bytes).byteLength, 5 * MB);
  retry.release();
});

test('a viewer that is already gone cannot start a download', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory();
  const signal = AbortSignal.abort(new DOMException('Aborted', 'AbortError'));
  assert.throws(() => memory.acquire('engine', network.load('engine', MB), { signal }), { name: 'AbortError' });
  assert.equal(network.calls.length, 0);
});

test('a failed download is forgotten, every waiting viewer hears of it, and the next request tries again', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  const one = memory.acquire('engine', network.load('engine', 5 * MB));
  const two = memory.acquire('engine', network.load('engine', 5 * MB));
  network.calls[0].fail();
  await assert.rejects(one.bytes, /503/);
  await assert.rejects(two.bytes, /503/);
  one.release();
  two.release();
  assert.equal(memory.stats().idleEntries + memory.stats().activeEntries, 0, 'nothing is left behind');
  const retry = memory.acquire('engine', network.load('engine', 5 * MB));
  assert.equal(network.calls.length, 2);
  network.calls[1].finish();
  await retry.bytes;
  retry.release();
  assert.equal(memory.stats().idleBytes, 5 * MB);
});

test('a load that throws before it starts counts as a failed download', async () => {
  const memory = createModelMemory();
  const hold = memory.acquire('x', () => { throw new Error('No model source is configured.'); });
  await assert.rejects(hold.bytes, /No model source/);
  hold.release();
  assert.equal(memory.stats().idleEntries + memory.stats().activeEntries, 0);
});

test('closed models are dropped least recently used first once they exceed the byte budget', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  await visit(memory, network, 'a', 40 * MB);
  await visit(memory, network, 'b', 40 * MB);
  assert.equal(memory.stats().idleBytes, 80 * MB);
  await visit(memory, network, 'a', 40 * MB); // touching a again makes b the oldest
  assert.equal(network.started('a'), 1, 'a was still held');
  await visit(memory, network, 'c', 40 * MB);
  const { idleBytes, idleEntries } = memory.stats();
  assert.equal(idleBytes, 80 * MB);
  assert.equal(idleEntries, 2);
  await visit(memory, network, 'a', 40 * MB);
  assert.equal(network.started('a'), 1, 'a survived');
  await visit(memory, network, 'b', 40 * MB);
  assert.equal(network.started('b'), 2, 'b was the one dropped, so it is downloaded again');
});

test('a model in use is never dropped and does not count against the budget', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 50 * MB });
  const open = memory.acquire('big', network.load('big', 60 * MB));
  network.calls[0].finish();
  await open.bytes;
  await visit(memory, network, 'p', 30 * MB);
  await visit(memory, network, 'q', 30 * MB);
  await visit(memory, network, 'r', 30 * MB);
  const stats = memory.stats();
  assert.equal(stats.activeBytes, 60 * MB, 'the open model is untouched');
  assert.ok(stats.idleBytes <= 50 * MB, `idle bytes ${stats.idleBytes} stay within the budget`);
  assert.equal(await memory.acquire('big', network.load('big', 60 * MB)).bytes, await open.bytes);
  assert.equal(network.started('big'), 1);
});

test('a closed model larger than the whole budget is not kept, and does not push out the smaller ones', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 50 * MB });
  await visit(memory, network, 'small', 20 * MB);
  await visit(memory, network, 'huge', 80 * MB);
  assert.deepEqual(memory.stats(), { activeEntries: 0, activeBytes: 0, idleEntries: 1, idleBytes: 20 * MB, budgetBytes: 50 * MB });
});

test('a download made ahead of time is let go of once used, unless a viewer wanted it', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  await visit(memory, network, 'ahead', 10 * MB, { retain: false });
  assert.equal(memory.stats().idleEntries, 0, 'nothing kept: its bytes are saved on disk instead');

  const prefetch = memory.acquire('shared', network.load('shared', 10 * MB), { retain: false });
  const viewer = memory.acquire('shared', network.load('shared', 10 * MB));
  assert.equal(network.started('shared'), 1, 'the viewer joined the download already under way');
  network.calls.findLast((call) => call.name === 'shared').finish();
  await prefetch.bytes;
  prefetch.release();
  assert.equal(memory.stats().activeBytes, 10 * MB);
  viewer.release();
  assert.equal(memory.stats().idleBytes, 10 * MB, 'a viewer wanted it, so it is kept for the next visit');
});

test('letting go twice, or after the signal aborts, counts once', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  const controller = new AbortController();
  const one = memory.acquire('engine', network.load('engine', 5 * MB), { signal: controller.signal });
  const two = memory.acquire('engine', network.load('engine', 5 * MB));
  network.calls[0].finish();
  await one.bytes;
  one.release();
  one.release();
  controller.abort();
  assert.equal(memory.stats().activeBytes, 5 * MB, 'the second viewer still holds it');
  two.release();
  two.release();
  assert.equal(memory.stats().idleBytes, 5 * MB);
});

test('the viewer closing (its signal aborting) after the model loaded lets the model go idle', async () => {
  const network = fakeNetwork();
  const memory = createModelMemory({ budgetBytes: 100 * MB });
  const viewer = new AbortController();
  const hold = memory.acquire('engine', network.load('engine', 5 * MB), { signal: viewer.signal });
  network.calls[0].finish();
  await hold.bytes;
  assert.equal(memory.stats().activeBytes, 5 * MB);
  viewer.abort();
  assert.equal(memory.stats().activeBytes, 0);
  assert.equal(memory.stats().idleBytes, 5 * MB);
});

test('prefetching a course and opening and closing models never keeps more than the budget idle', async () => {
  const network = fakeNetwork();
  const budget = 64 * MB;
  const memory = createModelMemory({ budgetBytes: budget });
  // Ten models of 4 to 52 MB, visited in a fixed scrambled order, some of them prefetched and some opened.
  const sizes = Array.from({ length: 10 }, (_, index) => (4 + index * 5.3) * MB | 0);
  for (let step = 0; step < 60; step += 1) {
    const index = (step * 7 + (step >> 2)) % sizes.length;
    await visit(memory, network, `model-${index}`, sizes[index], step % 3 === 0 ? { retain: false } : {});
    const { idleBytes } = memory.stats();
    assert.ok(idleBytes <= budget, `step ${step}: ${idleBytes} idle bytes exceed ${budget}`);
  }
});
