import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
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

test('once visited online, the app and its lessons open with no connection (issue #77)', async ({ page, context }) => {
  await page.route('https://www.googleapis.com/drive/**', (route) => route.abort());
  await page.goto('/#/learn');
  await appReady(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');

  // The service worker installs (saving the app, the lesson packs and the small pictures) and takes control of the page.
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)), { message: 'the service worker should control the page', timeout: 60_000 }).toBe(true);

  await context.setOffline(true);
  await page.goto('/#/learn/history-and-fundamentals/history-mechanical-engines/step/2');
  await page.reload();
  await appReady(page);
  await expect(page.getByRole('heading', { name: 'What is an engine?' })).toBeVisible();

  // The course information says so, and offers to save the 3D models too.
  await page.getByRole('button', { name: 'About Course & Model' }).click();
  const offline = page.getByRole('region', { name: 'Use without internet' });
  await expect(offline).toContainText('The app and every lesson’s text are saved on this device');
  await expect(offline.getByRole('button', { name: /Save everything for offline use/ })).toBeVisible();
  await offline.getByText(/3D models on this device: 0 of \d+/).click();
  // The panel's own controls (the dialog's close buttons predate it and are left to the shell's touch-target baseline).
  const { violations } = await new AxeBuilder({ page }).include('section[aria-labelledby="offline-title"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((rule) => `${rule.id} (${rule.nodes.length})`)).toEqual([]);
  for (const control of [offline.getByRole('button', { name: /Save everything/ }), offline.locator('summary')]) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await context.setOffline(false);
});
