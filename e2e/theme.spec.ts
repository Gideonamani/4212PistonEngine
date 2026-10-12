import type { Page } from '@playwright/test';
import { appReady, expect, onlyIn, test } from './fixtures';
import { openViewerStep } from './viewer-helpers';

// The colour theme: it follows the device until the learner presses the theme button, then keeps their choice on this device.
// (The contrast of the light palette is checked by the light-mode sweep in accessibility.spec.ts.)
onlyIn('phone-360');

const THEME_KEY = '4212-theme';
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const saved = (page: Page) => page.evaluate((key) => localStorage.getItem(key), THEME_KEY);
const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  // From a fresh document each time: the same address with the same hash would be a same-page navigation, not a load.
  await page.goto('about:blank');
  await page.goto('/#/learn');
  await appReady(page);
}

test('a light device gets light mode and a dark device gets dark mode, with nothing saved', async ({ page }) => {
  await open(page, 'light');
  expect(await theme(page)).toBe('light');
  expect(await bodyBackground(page)).toBe('rgb(238, 244, 246)');
  expect(await saved(page)).toBeNull();
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();

  await open(page, 'dark');
  expect(await theme(page)).toBe('dark');
  expect(await bodyBackground(page)).toBe('rgb(6, 16, 20)');
  expect(await saved(page)).toBeNull();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
});

test('the page follows the device while the learner has not chosen', async ({ page }) => {
  await open(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => theme(page)).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => theme(page)).toBe('dark');
});

test('pressing the button switches the theme and the choice outlives a reload and the device setting', async ({ page }) => {
  await open(page, 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect.poll(() => theme(page)).toBe('dark');
  expect(await saved(page)).toBe('dark');
  expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'))).toBe('#061014');

  // The device is still light, but the learner chose dark: a reload, and the device changing its mind, both leave it dark.
  await page.reload();
  await appReady(page);
  expect(await theme(page)).toBe('dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(300);
  expect(await theme(page)).toBe('dark');

  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect.poll(() => theme(page)).toBe('light');
  expect(await saved(page)).toBe('light');
  expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'))).toBe('#eef4f6');
});

test('the theme still works when the browser blocks storage', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  await open(page, 'light');
  expect(await theme(page)).toBe('light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect.poll(() => theme(page)).toBe('dark');
});

test('the 3D stage stays dark in a light page, and the lesson text around it is light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const { viewer } = await openViewerStep(page);
  expect(await theme(page)).toBe('light');
  expect(await viewer.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(7, 20, 24)');
  expect(await bodyBackground(page)).toBe('rgb(238, 244, 246)');
  // Text inside the stage keeps its light ink, so the toolbar and the strip beneath the model stay readable.
  const stageInk = await viewer.evaluate((node) => getComputedStyle(node).color);
  const lightness = stageInk.startsWith('oklch(') ? Number(stageInk.match(/[\d.]+/)![0]) : Number(stageInk.match(/\d+/)![0]) / 255;
  expect(lightness, `stage text colour ${stageInk} should be light`).toBeGreaterThan(0.85);
});
