import AxeBuilder from '@axe-core/playwright';
import type { Locator } from '@playwright/test';
import { expect, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';
import { SECTION_STEP, SPOTLIGHT_STEP, openViewerStep, scrollAreaOf } from './viewer-helpers';

// The part chips under a lesson step's text: a step that spotlights two or more parts offers a chip for each, and tapping one shows that part
// alone in the 3D view. What a chip does to a model is decided by scripts/test_step_part_chips.mjs (which chips, how many, what a tap leaves
// chosen); this checks the part a learner touches against the real cylinder. Each test downloads it, so they run once, one after the other.
// Lesson 08 (Valve Operating): step 2 spotlights six parts and links the words "intake valve" and "exhaust valve" in its text to two of
// them (issue #69), step 3 is a picture, step 4 spotlights eight.

onlyIn('phone-390');
test.describe.configure({ mode: 'serial', timeout: 240_000 });

test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

// Software-rendered WebGL is slow when the machine is busy (CI, or a laptop with other work going): a screenshot of the canvas has been seen to
// take 8 s, and one picture needs two or more. Against expect's 10 s default a correct model timed out, so pictures are compared on this clock.
// The outer wait is longer than the inner one because it may have to take several pictures that each wait for the model to settle.
const SETTLE_WAIT = 60_000;
const COMPARE_WAIT = 120_000;

/**
 * The canvas as drawn once it has stopped changing. The page header is pinned over the top of the lesson, so the model is first scrolled
 * clear of it: reaching a chip scrolls the model partly under the header, and a picture of that would differ from one taken before.
 */
async function settledCanvas(canvas: Locator) {
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  let before = await canvas.screenshot();
  await expect.poll(async () => { const now = await canvas.screenshot(); const same = now.equals(before); before = now; return same; }, { message: 'the model should settle', timeout: SETTLE_WAIT }).toBe(true);
  return before;
}

/** Wait until the canvas, once settled, is (or is not) the same picture as `reference`. */
const expectCanvas = (canvas: Locator, reference: Buffer, same: boolean, message: string) =>
  expect.poll(async () => (await settledCanvas(canvas)).equals(reference), { message, timeout: COMPARE_WAIT }).toBe(same);

const SIX = ['Intake valve', 'Exhaust valve', 'Intake valve seat', 'Exhaust valve seat', 'Intake valve guide', 'Exhaust valve guide'];
const EIGHT_STEP = '#/learn/valve-train-and-power/valve-operating/step/4';

test('a step with several spotlit parts offers a chip for each: a tap shows one alone, a second tap puts them back', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SECTION_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const parts = page.getByRole('group', { name: 'Parts in this view' });
  const chips = parts.getByRole('button');
  await expect(chips).toHaveText(SIX);
  for (const chip of await chips.all()) await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(parts.getByRole('status')).toContainText('tap one to look at it alone');

  const canvas = viewer.locator('canvas');
  const together = await settledCanvas(canvas);

  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(parts.getByRole('status')).toContainText('Showing Exhaust valve alone');
  await expectCanvas(canvas, together, false, 'one part alone should look different from all six');

  // Another chip takes over from the first.
  await chips.nth(0).click();
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await expect(parts.getByRole('status')).toContainText('Showing Intake valve alone');

  // The same chip again gives the step its own spotlight back, drawn exactly as before (so neither pose nor camera was touched).
  await chips.nth(0).click();
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(parts.getByRole('status')).toContainText('tap one to look at it alone');
  await expectCanvas(canvas, together, true, 'letting go should restore the step\'s spotlight');
  problems.assertNone();
});

test('a chosen part does not follow the learner: not to the next step, and not back to this one', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SECTION_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const parts = page.getByRole('group', { name: 'Parts in this view' });
  const canvas = viewer.locator('canvas');
  const together = await settledCanvas(canvas);
  await parts.getByRole('button', { name: 'Exhaust valve guide' }).click();
  await expect(parts.getByRole('button', { name: 'Exhaust valve guide' })).toHaveAttribute('aria-pressed', 'true');

  // The next step is a picture: no viewer, no chips.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(/Step 3 of \d+/)).toBeVisible();
  await expect(viewer).toBeHidden();
  await expect(parts).toHaveCount(0);

  // Back at the spotlight step the chip is let go and the model shows the step's own spotlight again, though the view itself never changed.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();
  await expect(viewer.getByRole('status')).toHaveCount(0);
  await expect(parts.getByRole('button', { pressed: true })).toHaveCount(0);
  await expectCanvas(canvas, together, true, 'the step\'s own spotlight should be back');

  // Forward twice, to the next spotlight step: its own chips, none chosen.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(/Step 4 of \d+/)).toBeVisible();
  await expect(parts.getByRole('button', { name: '+2 more' })).toBeVisible();
  await expect(parts.getByRole('button', { pressed: true })).toHaveCount(0);
  problems.assertNone();
});

test('a long row of chips shows the first six, and the rest on request', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, EIGHT_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const parts = page.getByRole('group', { name: 'Parts in this view' });
  const chips = parts.getByRole('button');
  await expect(chips).toHaveCount(7);
  const more = parts.getByRole('button', { name: '+2 more' });
  await expect(more).toBeVisible();
  await more.click();
  await expect(chips).toHaveCount(9);
  await expect(parts.getByRole('button', { name: 'Show fewer' })).toBeVisible();
  await expect(more).toHaveCount(0);
  await parts.getByRole('button', { name: 'Show fewer' }).click();
  await expect(chips).toHaveCount(7);
  problems.assertNone();
});

test('a step that spotlights one part has no chips: there is nothing to tell apart', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SPOTLIGHT_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  await expect(page.getByRole('group', { name: 'Parts in this view' })).toHaveCount(0);
  problems.assertNone();
});

test('words in the step text linked to a part choose it like its chip, by touch or keyboard, and bring the model into view', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SECTION_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const text = page.locator('.lesson-prose');
  const parts = page.getByRole('group', { name: 'Parts in this view' });
  const words = text.getByRole('button');
  await expect(words).toHaveText(['intake valve', 'exhaust valve']);
  for (const word of await words.all()) await expect(word).toHaveAttribute('aria-pressed', 'false');
  const canvas = viewer.locator('canvas');
  const together = await settledCanvas(canvas);

  // Read on until the model has scrolled out of sight, then tap a word: the model comes back into view showing that part alone.
  const area = await scrollAreaOf(text);
  await area.evaluate((scroller, line) => { scroller.scrollTop += (line as HTMLElement).getBoundingClientRect().top - scroller.getBoundingClientRect().top; }, await text.elementHandle());
  const shownShare = () => canvas.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0)) / box.height;
  });
  expect(await shownShare(), 'the model has scrolled mostly out of sight').toBeLessThan(0.5);
  await words.nth(1).click();
  await expect(words.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(parts.getByRole('button', { name: 'Exhaust valve', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(parts.getByRole('status')).toContainText('Showing Exhaust valve alone');
  await expect.poll(shownShare, { message: 'the model should be back in view' }).toBeGreaterThan(0.9);
  await expectCanvas(canvas, together, false, 'one part alone should look different from all six');

  // The chip and the word are one choice: the chip lets go of what the word chose.
  await parts.getByRole('button', { name: 'Exhaust valve', exact: true }).click();
  await expect(words.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await expect(parts.getByRole('status')).toContainText('tap one to look at it alone');

  // By keyboard: a word is a button in the tab order.
  await words.nth(0).focus();
  await page.keyboard.press('Enter');
  await expect(words.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(parts.getByRole('status')).toContainText('Showing Intake valve alone');
  await page.keyboard.press('Space');
  await expect(words.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expectCanvas(canvas, together, true, 'letting go should restore the step\'s spotlight');

  // Buttons inside a sentence pass axe, and the text still fits the narrowest phone.
  const { violations } = await new AxeBuilder({ page }).include('.lesson-prose').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((rule) => `${rule.id} (${rule.nodes.length})`)).toEqual([]);
  await page.setViewportSize({ width: 320, height: 640 });
  await expectNoHorizontalOverflow(page);
  problems.assertNone();
});
