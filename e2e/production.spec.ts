import fs from 'node:fs';
import { appReady, expect, onlyIn, test } from './fixtures';

// Checks on the built site (npm run build, served by vite preview). A production build deletes every model file and loads models from
// Drive, so these only mean something there. They skip when there is no build to test.
onlyIn('phone-390');
test.use({ baseURL: 'http://localhost:4174' });
test.skip(!fs.existsSync('dist/index.html'), 'no production build: run npm run build first');

test('a model is requested from Drive first, with no local model request that can only 404', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/\.glb(\.gz)?(\?|$)/.test(url) || url.includes('googleapis.com/drive/v3/files/')) requests.push(url);
  });
  // Do not download from Drive for real; refusing the request is enough to see where the app asked. The load error that follows is expected.
  await page.route('https://www.googleapis.com/drive/**', (route) => route.abort());

  await page.goto('/#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1');
  await appReady(page);
  await expect.poll(() => requests.length, { timeout: 60_000 }).toBeGreaterThan(0);

  expect(requests[0], 'the first model request should go to Drive').toContain('googleapis.com/drive/v3/files/');
  expect(requests.filter((url) => url.startsWith('http://localhost:4174')), 'a local model file was requested in production').toEqual([]);
});
