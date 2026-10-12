import fs from 'node:fs';
import { appReady, expect, expectAccessibleAndTouchable, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';

// Reading comfort in a lesson step: type size and spacing, short paragraphs, and the learner's own text-size choice.
onlyIn('phone-320', 'phone-390');

const SIZE_KEY = '4212-lesson-text-size';

/** The first plain-text step of a lesson whose text is long enough to need paragraphs, read from the pack so the test follows the content. */
function longTextStep() {
  const pack = JSON.parse(fs.readFileSync('web/history-lessons.json', 'utf8'));
  for (const lesson of pack.lessons as { id: string; steps: { type: string; prompt: string }[] }[]) {
    const index = lesson.steps.findIndex((step) => step.type === 'text' && step.prompt.length > 450);
    if (index >= 0) return { hash: `#/learn/${pack.id}/${lesson.id}/step/${index + 1}`, text: lesson.steps[index].prompt };
  }
  throw new Error('no long text step found in history-lessons.json');
}

const fontSize = (locator: import('@playwright/test').Locator) => locator.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));

test('a long step is shown as short paragraphs in comfortable type', async ({ page, problems }) => {
  const { hash, text } = longTextStep();
  await page.goto(`/${hash}`);
  await appReady(page);
  const paragraphs = page.locator('.lesson-prose > p');
  expect(await paragraphs.count(), 'a 450-character step should not be one block').toBeGreaterThanOrEqual(2);

  const first = paragraphs.first();
  expect(await fontSize(first), 'body text is at least 16 px').toBeGreaterThanOrEqual(16);
  const { lineHeight, fontPx } = await first.evaluate((node) => ({ lineHeight: parseFloat(getComputedStyle(node).lineHeight), fontPx: parseFloat(getComputedStyle(node).fontSize) }));
  expect(lineHeight / fontPx, 'line height is generous').toBeGreaterThanOrEqual(1.6);

  // The paragraphs are the lesson's own words, only broken up.
  const shown = (await paragraphs.allInnerTexts()).join(' ').replace(/\s+/g, ' ').trim();
  expect(shown).toBe(text.replace(/\s+/g, ' ').trim());
  await expectNoHorizontalOverflow(page);
  problems.assertNone();
});

test('the learner can make the lesson text larger, and the choice is remembered', async ({ page }) => {
  const { hash } = longTextStep();
  await page.goto(`/${hash}`);
  await appReady(page);
  const first = page.locator('.lesson-prose > p').first();
  const standard = await fontSize(first);

  await page.getByRole('button', { name: 'Text size' }).click();
  const group = page.getByRole('group', { name: 'Text size' });
  await expect(group.getByRole('button', { name: /^Standard/ })).toHaveAttribute('aria-pressed', 'true');
  await group.getByRole('button', { name: /^Larger/ }).click();
  await expect(group).toHaveCount(0);
  expect(await fontSize(first)).toBeCloseTo(standard * 1.3, 0);
  expect(await page.evaluate((key) => localStorage.getItem(key), SIZE_KEY)).toBe('larger');

  await page.reload();
  await appReady(page);
  expect(await fontSize(page.locator('.lesson-prose > p').first())).toBeCloseTo(standard * 1.3, 0);
  await page.getByRole('button', { name: 'Text size' }).click();
  await expect(page.getByRole('group', { name: 'Text size' }).getByRole('button', { name: /^Larger/ })).toHaveAttribute('aria-pressed', 'true');

  // The largest size still fits the screen without sideways scrolling.
  await page.getByRole('group', { name: 'Text size' }).getByRole('button', { name: /^Largest/ }).click();
  expect(await fontSize(page.locator('.lesson-prose > p').first())).toBeCloseTo(standard * 1.5, 0);
  await expectNoHorizontalOverflow(page);
});

test('the text-size menu closes on Escape and every choice is a full-size target', async ({ page }) => {
  const { hash } = longTextStep();
  await page.goto(`/${hash}`);
  await appReady(page);
  const button = page.getByRole('button', { name: 'Text size' });
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expectAccessibleAndTouchable(page, 'text size menu');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Text size' })).toHaveCount(0);
  await expect(button).toBeFocused();
});

test.describe('light mode', () => {
  test.use({ colorScheme: 'light' });

  test('the text-size menu is readable in light mode too', async ({ page }) => {
    const { hash } = longTextStep();
    await page.goto(`/${hash}`);
    await appReady(page);
    await page.getByRole('button', { name: 'Text size' }).click();
    await expectAccessibleAndTouchable(page, 'text size menu (light)');
  });
});
