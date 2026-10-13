import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { appReady, checkBaseline, checkCountBaseline, expect, onlyIn, test } from './fixtures';
import { MODEL_FILES, MODEL_STEP, SECTION_STEP, SPOTLIGHT_STEP } from './viewer-helpers';

// Two checks that hold the line. e2e/baselines/ records known problems, and the tests fail on anything not recorded there. Both baselines
// are empty since the shared-components phase (44 px targets, readable text), so any accessibility problem or small target on these
// screens now fails. Run at the most common phone width, and again at tablet width, where the header's mode tabs replace the bottom bar.
// (The native lesson interactives are audited one by one, at every width, in lesson-interactives.spec.ts.)
onlyIn('phone-360', 'tablet-768');
// Each test opens a dozen screens, four of them 3D steps that load a large model (the later ones from the saved copy), and CI runs other tests alongside.
test.describe.configure({ timeout: 360_000 });

type Screen = readonly [name: string, hash: string, prepare?: (page: Page) => Promise<void>];

/** Waits for the model's dock, opens the tab that matches `name` (unless it opened by itself), and waits for what its panel shows. */
const openDockTab = (name: RegExp, shows: (page: Page) => Locator) => async (page: Page) => {
  const tab = page.getByRole('tab', { name });
  await expect(tab).toBeVisible({ timeout: 150_000 });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(shows(page)).toBeVisible();
};

const SCREENS: Screen[] = [
  ['explore', '#/explore'],
  ['learn courses', '#/learn'],
  ['learn lessons', '#/learn/history-and-fundamentals'],
  ['lesson step', '#/learn/history-and-fundamentals/terminologies/step/1'],
  // The 3D viewer's toolbar appears as soon as the viewer mounts; the model itself need not have loaded.
  ['lesson model step', '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1', (page) => expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 })],
  // The dock's tabs only exist once the model has loaded, so these wait for the whole model, then open the panel they are about.
  ['lesson spotlight step', SPOTLIGHT_STEP, openDockTab(/^Spotlight/, (page) => page.getByRole('group', { name: 'How the highlighted part is shown' }))],
  ['lesson section step', SECTION_STEP, openDockTab(/^Section/, (page) => page.getByRole('radiogroup', { name: 'Section plane' }))],
  ['lesson motion step', MODEL_STEP, openDockTab(/^Motion/, (page) => page.getByText('This step holds one pose, so there is nothing to play.'))],
  ['lesson step list', '#/learn/history-and-fundamentals/history-mechanical-engines/step/1', async (page) => { await page.getByRole('button', { name: /Open the list of steps/ }).click(); await expect(page.getByRole('dialog')).toBeVisible(); }],
  ['credits', '#/credits'],
  ['check modules', '#/check'],
  ['check question', '#/check', async (page) => { await page.getByRole('button').filter({ has: page.locator('h4') }).first().click(); await expect(page.getByText(/Question 1 of \d+/)).toBeVisible(); }],
  ['check question list', '#/check', async (page) => { await page.getByRole('button').filter({ has: page.locator('h4') }).first().click(); await page.getByRole('button', { name: /Open the list of questions/ }).click(); await expect(page.getByRole('dialog')).toBeVisible(); }],
];

// The 3D steps need the whole model and say nothing more about the shell, so the tablet run leaves them to the phone run.
const NEEDS_MODEL = ['lesson spotlight step', 'lesson section step', 'lesson motion step'];
const MODEL_SCREENS = new Set(['lesson model step', ...NEEDS_MODEL]);
const screensFor = (project: string) => (project === 'tablet-768' ? SCREENS.filter(([name]) => !MODEL_SCREENS.has(name)) : SCREENS);

async function open(page: Page, [, hash, prepare]: Screen) {
  // Start every screen from a fresh page: two screens can share an address while differing in what has been opened.
  await page.goto('about:blank');
  await page.goto(`/${hash}`);
  await appReady(page);
  await page.locator('h1, h2, h3').first().waitFor();
  await prepare?.(page);
  await page.waitForTimeout(500);
}

/** Run axe over each screen and count what it finds, as "screen | rule" keys. */
async function sweep(page: Page, screens: Screen[]) {
  const found: Record<string, number> = {};
  for (const screen of screens) {
    const [name] = screen;
    await open(page, screen);
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const rule of violations) found[`${name} | ${rule.id}`] = rule.nodes.length;
  }
  return found;
}

test('axe finds no new accessibility problems on the main screens', async ({ page }, testInfo) => {
  checkCountBaseline('axe', await sweep(page, screensFor(testInfo.project.name)));
});

/**
 * Every lesson step that shows a native diagram (`url: "artifact:<id>"`), read from the packs so a new diagram is covered without anyone
 * remembering to add it. The diagrams draw in theme colours, so each one has to be checked in light as well as dark.
 */
function diagramScreens(): Screen[] {
  const packs: string[] = JSON.parse(fs.readFileSync('web/lessons-manifest.json', 'utf8')).packs;
  return packs.flatMap((file) => {
    const pack = JSON.parse(fs.readFileSync(`web/${file.replace('./', '')}`, 'utf8'));
    return (pack.lessons as { id: string; listed?: boolean; steps: { url?: string }[] }[])
      .filter((lesson) => lesson.listed !== false)
      .flatMap((lesson) => lesson.steps.flatMap((step, index): Screen[] => (step.url?.startsWith('artifact:') ? [[`diagram ${step.url.slice(9)}`, `#/learn/${pack.id}/${lesson.id}/step/${index + 1}`]] : [])));
  });
}

// Light mode is the same app in a second palette (src/index.css), so it gets the same zero-problems bar as dark: contrast is the thing a
// palette can get wrong. The 3D stage stays dark in both and its models are covered above, so they are not downloaded here.
test.describe('light mode', () => {
  test.use({ colorScheme: 'light' });

  test('axe finds no accessibility problems on the main screens or the lesson diagrams', async ({ page }, testInfo) => {
    await page.route(MODEL_FILES, (route) => route.abort());
    const screens = [...screensFor(testInfo.project.name).filter(([name]) => !NEEDS_MODEL.includes(name)), ...(testInfo.project.name === 'tablet-768' ? [] : diagramScreens())];
    checkCountBaseline('axe-light', await sweep(page, screens));
  });
});

test('no new touch target is smaller than 44 px (and none below the 24 px WCAG 2.2 minimum)', async ({ page }, testInfo) => {
  const offenders: string[] = [];
  for (const screen of screensFor(testInfo.project.name)) {
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
