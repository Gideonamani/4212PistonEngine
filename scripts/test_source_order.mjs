import assert from 'node:assert/strict';
import test from 'node:test';
import { orderAttempts } from '../src/viewer/core/source-order.mjs';

const cylinder = { localUrl: './cylinder.glb.gz', driveId: 'drive-cylinder' };
const engine = [
  { localUrl: './engine.glb.gz', driveId: 'drive-engine-gz' },
  { localUrl: './engine.glb', driveId: 'drive-engine' },
];
const summary = (attempts) => attempts.map(({ source, from }) => `${from}:${from === 'drive' ? source.driveId : source.localUrl}`);

test('in development local copies come first, then Drive', () => {
  assert.deepEqual(summary(orderAttempts([cylinder], { apiKey: 'key' })), ['local:./cylinder.glb.gz', 'drive:drive-cylinder']);
  assert.deepEqual(summary(orderAttempts(engine, { apiKey: 'key' })), ['local:./engine.glb.gz', 'local:./engine.glb', 'drive:drive-engine-gz', 'drive:drive-engine']);
});

test('in production a source Drive can serve skips its local attempt, so no request 404s first', () => {
  assert.deepEqual(summary(orderAttempts([cylinder], { apiKey: 'key', production: true })), ['drive:drive-cylinder']);
  assert.deepEqual(summary(orderAttempts(engine, { apiKey: 'key', production: true })), ['drive:drive-engine-gz', 'drive:drive-engine']);
});

test('in production without an API key the local copy is the only way to load, so it stays', () => {
  assert.deepEqual(summary(orderAttempts([cylinder], { production: true })), ['local:./cylinder.glb.gz']);
});

test('in production a source with no Drive id keeps its local attempt', () => {
  const localOnly = { localUrl: './wright.glb' };
  assert.deepEqual(summary(orderAttempts([localOnly, cylinder], { apiKey: 'key', production: true })), ['local:./wright.glb', 'drive:drive-cylinder']);
});

test('a source with no way to load produces no attempt', () => {
  assert.deepEqual(orderAttempts([{}], { apiKey: 'key', production: true }), []);
  assert.deepEqual(orderAttempts([]), []);
});
