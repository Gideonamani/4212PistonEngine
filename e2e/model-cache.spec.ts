import { appReady, expect, onlyIn, test } from './fixtures';

// The model cache against the browser's real Cache Storage. The Drive download itself cannot run on localhost (its key only accepts the
// published site), so this exercises the cache module directly, in the page, the way assets.ts uses it.
onlyIn('phone-390');

const KEY = { driveId: 'e2e-model-cache-test' };

// A dynamic import inside the page; TypeScript would try to resolve the path if it were written inline.
const inPage = `(async (action) => {
  const cache = await import('/src/viewer/core/model-cache.mjs');
  const key = cache.cacheKeyFor(${JSON.stringify(KEY)});
  if (action === 'write') { await cache.writeCachedModel(key, new Uint8Array(4096).fill(9)); return undefined; }
  if (action === 'read') { const bytes = await cache.readCachedModel(key, 4096); return bytes ? bytes.byteLength : null; }
  if (action === 'read-wrong-size') { const bytes = await cache.readCachedModel(key, 100); return bytes ? bytes.byteLength : null; }
  if (action === 'clean') { await caches.delete(cache.CACHE_NAME); return undefined; }
})`;

const run = (page: import('@playwright/test').Page, action: string) => page.evaluate(`${inPage}(${JSON.stringify(action)})`);

test('a saved model survives a reload, and a copy of the wrong size is discarded', async ({ page }) => {
  await page.goto('/#/learn');
  await appReady(page);
  expect(await run(page, 'read'), 'nothing saved yet').toBeNull();
  await run(page, 'write');
  expect(await run(page, 'read')).toBe(4096);

  await page.reload();
  await appReady(page);
  expect(await run(page, 'read'), 'still there after a reload').toBe(4096);

  expect(await run(page, 'read-wrong-size'), 'the promised size does not match').toBeNull();
  expect(await run(page, 'read'), 'the damaged copy was deleted').toBeNull();
  await run(page, 'clean');
});
