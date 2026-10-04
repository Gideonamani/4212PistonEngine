import { appReady, expect, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';

// Behaviour checks at phone widths. They replace the old source-text assertions in scripts/test_training_shell.mjs: what matters is
// what a student can do and sees, not how the source is written.

const MODEL_LESSON = '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1';

// The dev server hands the browser three.js as hundreds of separate modules, so the viewer takes a while to appear the first time.
const VIEWER_APPEARS = { timeout: 60_000 };

test.describe('every main screen', () => {
  for (const [name, hash] of [['Explore', '#/explore'], ['Learn', '#/learn'], ['Check', '#/check']] as const) {
    test(`${name} loads without errors and fits the screen`, async ({ page, problems }) => {
      await page.goto(`/${hash}`);
      await appReady(page);
      await expect(page.locator('h1, h2, h3').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      problems.assertNone();
    });
  }
});

test('Learn: open a course, open a lesson, and step through it', async ({ page, problems }) => {
  await page.goto('/#/learn');
  await appReady(page);
  await page.getByRole('button').filter({ has: page.locator('h3') }).first().click();
  await expect(page.getByRole('button', { name: 'Back to courses' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // The lesson has two ways back to its list: the top bar and the bottom dock.
  await page.getByRole('button', { name: 'Back to lessons' }).first().click();
  await expect(page.getByRole('button', { name: 'Back to courses' })).toBeVisible();
  problems.assertNone();
});

test('Learn: the address follows the lesson, and Back leaves it', async ({ page }) => {
  await page.goto('/#/learn');
  await appReady(page);
  await page.getByRole('button').filter({ has: page.locator('h3') }).first().click();
  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page).toHaveURL(/#\/learn\/[^/]+\/[^/]+\/step\/1$/);
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page).toHaveURL(/\/step\/2$/);
  // Moving between steps replaces the history entry, so Back goes up to the course's lesson list.
  await page.goBack();
  await expect(page).toHaveURL(/#\/learn\/[^/]+$/);
  await expect(page.getByRole('button', { name: 'Back to courses' })).toBeVisible();
});

test('Check: an answer locks and the explanation appears', async ({ page, problems }) => {
  await page.goto('/#/check');
  await appReady(page);
  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page.getByText(/Question 1 of \d+/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const verify = page.getByRole('button', { name: 'Verify answer' });
  if (await page.getByText('SELECT ONE ANSWER').isVisible()) await page.getByRole('button', { name: /^A\s/ }).click();
  await expect(verify).toBeEnabled();
  await verify.click();

  await expect(page.getByText(/CORRECT — WHY IT MATTERS|REVIEW THE EVIDENCE/)).toBeVisible();
  await expect(verify).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Next question|Finish assessment/ })).toBeVisible();
  if (await page.getByText('SELECT ONE ANSWER').isVisible()) await expect(page.getByRole('button', { name: /^A\s/ })).toBeDisabled();
  problems.assertNone();
});

test.describe('3D viewer', () => {
  onlyIn('phone-390');
  // Each test decodes a 35 MB model; running them side by side makes every one of them slow enough to time out.
  test.describe.configure({ mode: 'serial' });

  test('a lesson step loads its model and shows the canvas inside the screen', async ({ page, problems }) => {
    test.setTimeout(180_000);
    await page.goto(`/${MODEL_LESSON}`);
    await appReady(page);
    const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
    await expect(viewer).toBeVisible(VIEWER_APPEARS);
    await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
    const canvas = viewer.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
    expect(box.x + box.width, 'canvas overflows the screen width').toBeLessThanOrEqual(viewport.width + 1);
    await expect(viewer.getByRole('group', { name: 'How the highlighted part is shown' }), 'a step that spotlights nothing has no focus switch').toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    problems.assertNone();
  });

  test('the model survives moving between steps, and the keyboard controls do not throw', async ({ page, problems }) => {
    test.setTimeout(180_000);
    await page.goto(`/${MODEL_LESSON}`);
    await appReady(page);
    const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
    await expect(viewer).toBeVisible(VIEWER_APPEARS);
    await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

    await page.getByRole('application').focus();
    for (const key of ['ArrowLeft', 'ArrowUp', 'Equal', 'Minus', 'Home']) await page.keyboard.press(key);

    await page.getByRole('button', { name: /Next Step/ }).click();
    await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();
    await expect(viewer.getByRole('status'), 'the loaded model should not be rebuilt between steps').toHaveCount(0);
    expect(await page.locator('canvas').count(), 'one canvas, not one per step').toBe(1);
    problems.assertNone();
  });

  test('Explore opens the operating cylinder and loads it', async ({ page, problems }) => {
    test.setTimeout(180_000);
    await page.goto('/#/explore');
    await appReady(page);
    await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Detailed operating cylinder' }) }).click();
    await expect(page.getByRole('application')).toBeVisible(VIEWER_APPEARS);
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
    await expect(page.locator('canvas')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    problems.assertNone();
  });
});
