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

// The offline panel against the real Cache Storage in the built site, with Drive stood in for by files of the sizes the registry promises
// (a model is only kept once it is a whole GLB of the right length, so each stand-in has a GLB header and exactly that length).
const driveSizes = (() => {
  const sizes = new Map<string, number>();
  const models: { sources?: { driveId?: string; transferBytes?: number }[] }[] = JSON.parse(fs.readFileSync('src/data/models.json', 'utf8'));
  for (const source of models.flatMap((model) => model.sources ?? [])) if (source.driveId) sizes.set(source.driveId, source.transferBytes ?? 1_000_000);
  const transport = JSON.parse(fs.readFileSync('web/engine-contract.json', 'utf8')).asset.transport;
  sizes.set(transport.drive_file_id, transport.bytes);
  sizes.set(transport.fallback_drive_file_id, 1_000_000);
  return sizes;
})();

function standInForDrive(page: import('@playwright/test').Page) {
  return page.route('https://www.googleapis.com/drive/**', (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const size = driveSizes.get(decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!));
    if (!size) return route.fulfill({ status: 404, headers: cors });
    const body = Buffer.alloc(size);
    body.writeUInt32LE(0x46546c67, 0);
    body.writeUInt32LE(2, 4);
    body.writeUInt32LE(size, 8);
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream' }, body });
  });
}

test('the offline panel shows what the device really holds: after saving, after a model is lost, and with no connection (issue #102)', async ({ page, context }) => {
  test.setTimeout(300_000);
  await standInForDrive(page);
  await page.goto('/#/learn');
  await appReady(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)), { message: 'the service worker should control the page', timeout: 60_000 }).toBe(true);

  const openPanel = async () => {
    await page.getByRole('button', { name: 'About Course & Model' }).click();
    const offline = page.getByRole('region', { name: 'Use without internet' });
    await offline.locator('summary').click();
    return offline;
  };
  let offline = await openPanel();
  const summary = offline.locator('summary');
  await expect(summary).toContainText(/3D models on this device: 0 of \d+/);
  const total = Number((await summary.textContent())!.match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThan(2);

  await offline.getByRole('button', { name: /Save everything for offline use/ }).click();
  await expect(offline.getByRole('status')).toContainText('Everything is saved on this device.', { timeout: 240_000 });
  await expect(summary).toContainText(`${total} of ${total}`);

  // A model the device loses (the browser may clear storage on its own): the panel is read back from the device when it is opened, and no
  // longer promises it.
  await page.evaluate(async () => {
    const cache = await caches.open('4212-models-v1');
    const keys = await cache.keys();
    await cache.delete(keys[0]);
  });
  await summary.click();
  await summary.click();
  await expect(summary).toContainText(`${total - 1} of ${total}`);
  await expect(offline.locator('li').filter({ has: page.locator('.sr-only', { hasText: /^saved$/ }) })).toHaveCount(total - 1);
  await expect(offline.getByRole('button', { name: /Save everything for offline use \(about \d+ MB\)/ })).toBeEnabled();

  // The same with no connection at all: the saved models are still there and the lost one is still missing.
  await context.setOffline(true);
  await page.reload();
  await appReady(page);
  offline = await openPanel();
  await expect(offline.locator('summary')).toContainText(`${total - 1} of ${total}`);
  await expect(offline.locator('li').filter({ has: page.locator('.sr-only', { hasText: /^saved$/ }) })).toHaveCount(total - 1);
  await context.setOffline(false);
});
