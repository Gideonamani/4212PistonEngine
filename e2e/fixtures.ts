import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

/**
 * What a test run saw go wrong: console errors, uncaught exceptions, and failed or 4xx/5xx requests to our own origin or to Drive.
 * Third-party hosts (fonts) are stubbed so a run never depends on the network.
 */
export type Problems = { list: string[]; assertNone: () => void };

const ours = (url: string) => url.startsWith('http://localhost:4173') || url.includes('googleapis.com/drive/');

export const test = base.extend<{ problems: Problems }>({
  problems: async ({ page }, use) => {
    const list: string[] = [];
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (message) => { if (message.type() === 'error') list.push(`console error: ${message.text()}`); });
    page.on('pageerror', (error) => list.push(`uncaught exception: ${error.message}`));
    page.on('requestfailed', (request) => { if (ours(request.url()) && request.failure()?.errorText !== 'net::ERR_ABORTED') list.push(`request failed: ${request.url()} (${request.failure()?.errorText})`); });
    page.on('response', (response) => { if (ours(response.url()) && response.status() >= 400) list.push(`HTTP ${response.status()}: ${response.url()}`); });
    await use({ list, assertNone: () => expect(list, 'errors seen while the page ran').toEqual([]) });
  },
});

export { expect };

/** Only run in the named projects (viewport sizes), for checks that do not need repeating at every width. */
export const onlyIn = (...projects: string[]) => test.beforeEach(({}, testInfo) => {
  test.skip(!projects.includes(testInfo.project.name), `runs only in ${projects.join(', ')}`);
});

/** The page's content never needs sideways scrolling. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth, 'page is wider than the screen').toBeLessThanOrEqual(clientWidth);
}

/** Wait for the app's first paint of real content: the curriculum has loaded and the loading message is gone. */
export async function appReady(page: Page) {
  await expect(page.getByText('Loading published curriculum')).toHaveCount(0);
}

// Ratchet baselines: today's known problems are recorded so a check can fail on any NEW one, then be tightened to zero as the
// matching phase lands. Run with UPDATE_BASELINES=1 to rewrite them after an improvement.
const baselineDir = path.resolve('e2e/baselines');

export function checkBaseline(name: string, found: string[]) {
  const file = path.join(baselineDir, `${name}.json`);
  const sorted = [...new Set(found)].sort();
  if (process.env.UPDATE_BASELINES) {
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
    return;
  }
  const known: string[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const added = sorted.filter((item) => !known.includes(item));
  expect(added, `new problems not in e2e/baselines/${name}.json (fix them, or re-baseline with UPDATE_BASELINES=1 if intended)`).toEqual([]);
  const fixed = known.filter((item) => !sorted.includes(item));
  if (fixed.length) console.log(`${name}: ${fixed.length} baseline entries are now fixed; re-baseline to lock the gain in:\n  ${fixed.join('\n  ')}`);
}

/** Like checkBaseline, for counts: a rule may keep its recorded count or go down, never up, and no new rule may appear. */
export function checkCountBaseline(name: string, found: Record<string, number>) {
  const file = path.join(baselineDir, `${name}.json`);
  if (process.env.UPDATE_BASELINES) {
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(found).sort()), null, 2)}\n`);
    return;
  }
  const known: Record<string, number> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const worse = Object.entries(found).filter(([key, count]) => count > (known[key] ?? 0)).map(([key, count]) => `${key}: ${count} (baseline ${known[key] ?? 0})`);
  expect(worse, `worse than e2e/baselines/${name}.json (fix them, or re-baseline with UPDATE_BASELINES=1 if intended)`).toEqual([]);
  const better = Object.entries(known).filter(([key, count]) => (found[key] ?? 0) < count).map(([key, count]) => `${key}: ${count} -> ${found[key] ?? 0}`);
  if (better.length) console.log(`${name}: improved; re-baseline to lock the gain in:\n  ${better.join('\n  ')}`);
}

/** Axe finds nothing wrong on the screen as it stands, and every control is at least 44 px in both directions. */
export async function expectAccessibleAndTouchable(page: Page, what: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((rule) => `${rule.id} (${rule.nodes.length})`), `${what}: axe`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')]
    .filter((element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden')
    .map((element) => ({ name: element.getAttribute('aria-label') || element.innerText.trim().slice(0, 30) || element.tagName, size: Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height) }))
    .filter((target) => target.size < 44));
  expect(small, `${what}: targets under 44 px`).toEqual([]);
}
