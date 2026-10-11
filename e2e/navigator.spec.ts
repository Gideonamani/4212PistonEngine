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

test.describe('lesson footer', () => {
  const READOUT = /Switch between percent and steps left/;

  test('progress lives in a footer docked to the bottom edge, not in a header', async ({ page, problems }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const viewport = page.viewportSize()!;
    const opener = page.getByRole('button', { name: /Open the list of steps/ });
    await expect(opener).toContainText('Lesson 01');
    const box = (await opener.boundingBox())!;
    expect(box.y + box.height, 'the footer should sit at the bottom edge').toBeGreaterThan(viewport.height - 40);
    // The header keeps only the way back; the old "Step x of y" strip and its percentage are gone from the top.
    await expect(page.getByText(/% complete/), 'no progress strip at the top').toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to lessons' })).toHaveCount(1);
    problems.assertNone();
  });

  test('the step count sits over the percentage, and every target is a full-size one', async ({ page }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const readout = page.getByRole('button', { name: READOUT });
    const [count, percent] = [readout.locator('span').nth(0), readout.locator('span').nth(1)];
    await expect(count).toHaveText(/^1\/\d+$/);
    await expect(percent).toHaveText(/^\d+%$/);
    const [top, bottom] = [(await count.boundingBox())!, (await percent.boundingBox())!];
    expect(top.y + top.height, 'the count should be above the percentage').toBeLessThanOrEqual(bottom.y + 1);
    expect(Math.abs(top.x + top.width - (bottom.x + bottom.width)), 'the two should line up on the right').toBeLessThan(2);
    for (const button of [page.getByRole('button', { name: /Open the list of steps/ }), readout, page.locator('button[aria-hidden="true"][tabindex="-1"]')]) {
      const size = (await button.boundingBox())!;
      expect(Math.min(size.width, size.height), 'footer targets are at least 44 px').toBeGreaterThanOrEqual(44);
    }
  });

  test('tapping the count and percentage flips the readout between percent and steps left, and it is remembered', async ({ page }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const readout = page.getByRole('button', { name: READOUT });
    const total = Number((await readout.locator('span').nth(0).innerText()).split('/')[1]);
    await readout.click();
    await expect(readout.locator('span').nth(1)).toHaveText(`${total - 1} left`);
    await page.reload();
    await appReady(page);
    await expect(readout.locator('span').nth(1)).toHaveText(`${total - 1} left`);
    await readout.click();
    await expect(readout.locator('span').nth(1)).toHaveText(/^\d+%$/);
  });

  test('tapping the footer opens the step list over the lesson instead of leaving it', async ({ page }) => {
    await page.goto(`/${LESSON}`);
    await appReady(page);
    const { dialog } = await openList(page, 'steps');
    await expect(page).toHaveURL(/\/step\/1$/);
    await expect(dialog.getByText('History of Mechanical Engines')).toBeVisible();
    await expect(dialog.getByText('NOW')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // The chevron is the same button for a finger that goes looking for it.
    await page.locator('button[aria-hidden="true"][tabindex="-1"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/\/step\/1$/);
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
