import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { appReady, checkBaseline, checkCountBaseline, expect, onlyIn, test } from './fixtures';

// Two checks that hold the line. e2e/baselines/ records known problems, and the tests fail on anything not recorded there. Both baselines
// are empty since the shared-components phase (44 px targets, readable text), so any accessibility problem or small target on these
// screens now fails. Run once, at the most common phone width.
onlyIn('phone-360');
// Each test opens nine screens, one of them a 3D step that starts a large model download, and CI runs other tests alongside.
test.describe.configure({ timeout: 360_000 });

type Screen = readonly [name: string, hash: string, prepare?: (page: Page) => Promise<void>];

const SCREENS: Screen[] = [
  ['explore', '#/explore'],
  ['learn courses', '#/learn'],
  ['learn lessons', '#/learn/history-and-fundamentals'],
  ['lesson step', '#/learn/history-and-fundamentals/terminologies/step/1'],
  // The 3D viewer's toolbar appears as soon as the viewer mounts; the model itself need not have loaded.
  ['lesson model step', '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1', (page) => expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 })],
  ['lesson step list', '#/learn/history-and-fundamentals/history-mechanical-engines/step/1', async (page) => { await page.getByRole('button', { name: /Open the list of steps/ }).click(); await expect(page.getByRole('dialog')).toBeVisible(); }],
  ['check modules', '#/check'],
  ['check question', '#/check', async (page) => { await page.getByRole('button').filter({ has: page.locator('h4') }).first().click(); await expect(page.getByText(/Question 1 of \d+/)).toBeVisible(); }],
  ['check question list', '#/check', async (page) => { await page.getByRole('button').filter({ has: page.locator('h4') }).first().click(); await page.getByRole('button', { name: /Open the list of questions/ }).click(); await expect(page.getByRole('dialog')).toBeVisible(); }],
];

async function open(page: Page, [, hash, prepare]: Screen) {
  // Start every screen from a fresh page: two screens can share an address while differing in what has been opened.
  await page.goto('about:blank');
  await page.goto(`/${hash}`);
  await appReady(page);
  await page.locator('h1, h2, h3').first().waitFor();
  await prepare?.(page);
  await page.waitForTimeout(500);
}

test('axe finds no new accessibility problems on the main screens', async ({ page }) => {
  const found: Record<string, number> = {};
  for (const screen of SCREENS) {
    const [name] = screen;
    await open(page, screen);
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const rule of violations) found[`${name} | ${rule.id}`] = rule.nodes.length;
  }
  checkCountBaseline('axe', found);
});

test('no new touch target is smaller than 44 px (and none below the 24 px WCAG 2.2 minimum)', async ({ page }) => {
  const offenders: string[] = [];
  for (const screen of SCREENS) {
    const [name] = screen;
    await open(page, screen);
    const targets = await page.evaluate(() => {
      const selector = 'button, a[href], [role="button"], [role="tab"], [role="link"], input:not([type="hidden"]), select, textarea, summary';
      const out: { name: string; width: number; height: number }[] = [];
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none' || element.closest('[hidden], [aria-hidden="true"]')) continue;
        if (element.tagName === 'A' && element.closest('p, li')) continue; // links inside a sentence are exempt
        const label = element.getAttribute('aria-label') || element.innerText || element.getAttribute('title') || element.tagName;
        out.push({ name: label.trim().replace(/\s+/g, ' '), width: box.width, height: box.height });
      }
      return out;
    });
    for (const { name: label, width, height } of targets) {
      const smallest = Math.min(width, height);
      if (smallest < 44) offenders.push(`[${smallest < 24 ? '<24' : '<44'}] ${name} | ${label.replace(/^Move .* (up|down)$/, 'Move item $1').replace(/\d+/g, '#').slice(0, 40)}`);
    }
  }
  checkBaseline('tap-targets', offenders);
});
