import type { Locator, Page } from '@playwright/test';
import { appReady, expect, onlyIn, test } from './fixtures';

// The progress bar that opens a list of every step (or question). Agreed 4 Oct 2026 in place of the step-jump dots. A lesson with no
// 3D model keeps these tests light.
const LESSON = '#/learn/history-and-fundamentals/history-mechanical-engines/step/1';

// The list is a bottom sheet on a phone and a centred dialog on a tablet; the narrowest phone and the tablet cover both layouts.
onlyIn('phone-320', 'tablet-768');

async function openList(page: Page, noun: 'steps' | 'questions') {
  const trigger = page.getByRole('button', { name: new RegExp(`Open the list of ${noun}`) });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

/** Every element that can take focus is inside the dialog, however many times Tab is pressed either way. */
async function expectFocusTrapped(page: Page, dialog: Locator, presses: number) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press(key);
      const inside = await dialog.evaluate((element) => element.contains(document.activeElement));
      expect(inside, `focus left the list after ${key} #${i + 1}`).toBe(true);
    }
  }
}

test.describe('lesson step list', () => {
  test('the bar opens a list of every step and choosing one goes there', async ({ page, problems }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const total = Number((await page.getByText(/Step 1 of \d+/).innerText()).match(/of (\d+)/)![1]);

    const { trigger, dialog } = await openList(page, 'steps');
    await expect(dialog).toHaveAccessibleName('Steps in this lesson');
    await expect(dialog.getByRole('listitem')).toHaveCount(total);
    await expect(dialog.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(dialog.locator('[aria-current="step"]')).toContainText('step 1:');
    await expect(dialog.locator('[aria-current="step"]'), 'focus starts on the current step').toBeFocused();

    await dialog.getByRole('button', { name: /^step 3:/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/step\/3$/);
    await expect(page.getByText(new RegExp(`Step 3 of ${total}`))).toBeVisible();
    await expect(trigger, 'focus returns to the bar').toBeFocused();

    // Reopening shows where you are now, and what is behind you as done.
    await trigger.click();
    await expect(page.getByRole('dialog').locator('[aria-current="step"]')).toContainText('step 3:');
    await expect(page.getByRole('dialog').getByRole('button', { name: /^step 1:.*done/i })).toBeVisible();
    problems.assertNone();
  });

  test('Escape closes the list and returns to the bar', async ({ page }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const { trigger, dialog } = await openList(page, 'steps');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Escape closes only the list when the lesson is full screen', async ({ page }) => {
    // Where the browser has no element fullscreen (iPhones), the lesson fills the page itself and listens for Escape to leave. That
    // listener must not also hear the Escape meant for the list.
    await page.addInitScript(() => Object.defineProperty(document, 'fullscreenEnabled', { value: false }));
    await page.goto(`/${LESSON}`);
    await appReady(page);
    await page.getByRole('button', { name: 'Open full-screen lesson' }).click();
    const exit = page.getByRole('button', { name: 'Exit full-screen lesson' });
    await expect(exit).toBeVisible();
    const { dialog } = await openList(page, 'steps');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(exit, 'the lesson should still be full screen').toBeVisible();
  });

  test('focus stays inside the open list', async ({ page }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const { dialog } = await openList(page, 'steps');
    await expectFocusTrapped(page, dialog, (await dialog.getByRole('button').count()) + 2);
  });

  test('the list fits the screen and every row is a full-size target', async ({ page }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const { dialog } = await openList(page, 'steps');
    const viewport = page.viewportSize()!;
    const box = (await dialog.boundingBox())!;
    expect(box.height, 'the list is taller than 75% of the screen').toBeLessThanOrEqual(viewport.height * 0.75 + 1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    for (const button of await dialog.getByRole('button').all()) {
      const size = (await button.boundingBox())!;
      expect(Math.min(size.width, size.height), `${await button.innerText()} is too small to tap`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Check question list', () => {
  test('it shows which questions are answered and how, and jumps to one', async ({ page, problems }) => {
    await page.goto('/#/check');
    await appReady(page);
    await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
    const total = Number((await page.getByText(/Question 1 of \d+/).innerText()).match(/of (\d+)/)![1]);

    if (await page.getByText('SELECT ONE ANSWER').isVisible()) await page.getByRole('button', { name: /^A\s/ }).click();
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText(/1 answered/)).toBeVisible();

    const { trigger, dialog } = await openList(page, 'questions');
    await expect(dialog).toHaveAccessibleName('Questions in this check');
    await expect(dialog.getByRole('listitem')).toHaveCount(total);
    await expect(dialog.getByRole('button', { name: /^question 1:.*answered (correctly|incorrectly)/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^question 2:.*not reached yet/i })).toBeVisible();

    await dialog.getByRole('button', { name: /^question 3:/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(new RegExp(`Question 3 of ${total}`))).toBeVisible();
    await expect(trigger).toBeFocused();
    problems.assertNone();
  });
});
