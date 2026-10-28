import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { appReady, expect, expectAccessibleAndTouchable, expectNoHorizontalOverflow, test } from './fixtures';

// The 3D part quizzes on the Check screen: one for every model that has parts to tap, made on the spot from the model's own part data.
// The oil pump is the smallest model, so these tests load fast; the generator itself is covered against every model by
// scripts/test_part_quiz.mjs.

test.describe.configure({ timeout: 120_000 });

const models = JSON.parse(fs.readFileSync('src/data/models.json', 'utf8')) as { id: string; shortLabel: string; adapter: string }[];
const quizzable = models.filter((model) => model.adapter !== 'static-gltf');
const OIL_PUMP = models.find((model) => model.id === 'oil-pump')!;

async function openPartQuiz(page: Page, label: string) {
  await page.goto('/#/check');
  await appReady(page);
  await page.getByRole('heading', { level: 4, name: label, exact: true }).click();
  // Questions are made once the model has loaded and its parts are known.
  await expect(page.getByText(/^Question 1 of \d+$/)).toBeVisible({ timeout: 90_000 });
}

/** Choose a part by stepping to the next one, which names nothing. */
async function chooseSomePart(page: Page) {
  const next = page.getByRole('button', { name: 'Next', exact: true });
  if (!(await next.isVisible())) await page.getByText('Cannot tap the model? Step through the parts').click();
  await next.click();
}

test.describe('3D part quizzes in light mode', () => {
  test.use({ colorScheme: 'light' });

  test('the list and a question, answered, have no accessibility problems', async ({ page }) => {
    await page.goto('/#/check');
    await appReady(page);
    await expectAccessibleAndTouchable(page, 'Check list, light');
    await openPartQuiz(page, OIL_PUMP.shortLabel);
    await expectAccessibleAndTouchable(page, '3D part quiz, light');
    await chooseSomePart(page);
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText(/CORRECT — WHY IT MATTERS|REVIEW THE EVIDENCE/)).toBeVisible();
    await expectAccessibleAndTouchable(page, '3D part quiz answered, light');
  });
});

test.describe('3D part quizzes', () => {
  test('every model with parts has a quiz card, and nothing is written for any of them', async ({ page }) => {
    await page.goto('/#/check');
    await appReady(page);
    await expect(page.getByRole('heading', { level: 3, name: '3D part quizzes' })).toBeVisible();
    for (const model of quizzable) await expect(page.getByRole('heading', { level: 4, name: model.shortLabel, exact: true }), model.id).toHaveCount(1);
    await expect(page.getByText('3D PART QUIZ', { exact: true })).toHaveCount(quizzable.length);
  });

  test('a round is made from the model, with no list of names and tools for looking beneath the parts', async ({ page, problems }) => {
    await openPartQuiz(page, OIL_PUMP.shortLabel);
    await expect(page.getByText('TAP THE PART ON THE MODEL')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 })).toContainText(/^Tap /);
    await expect(page.locator('select'), 'a list of names would hand the answer over').toHaveCount(0);
    for (const name of ['Hide part', 'Undo', 'Show all']) await expect(page.getByRole('button', { name }), name).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify answer' })).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, '3D part quiz');
    problems.assertNone();
  });

  test('answering marks the part, names the right one, and the next question starts from the whole model', async ({ page }) => {
    await openPartQuiz(page, OIL_PUMP.shortLabel);
    await chooseSomePart(page);
    const hide = page.getByRole('button', { name: 'Hide part' });
    await hide.click();
    await expect(page.getByText('1 part hidden')).toBeVisible();

    await chooseSomePart(page);
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText(/CORRECT — WHY IT MATTERS|REVIEW THE EVIDENCE/)).toBeVisible();
    await expect(page.locator('p[role="status"]')).toContainText(/You tapped .+\. The right answer is /);
    await expectAccessibleAndTouchable(page, '3D part quiz, answered');

    await page.getByRole('button', { name: 'Next question' }).click();
    await expect(page.getByText(/^Question 2 of \d+$/)).toBeVisible();
    await expect(page.getByText('Nothing hidden'), 'a new question starts with every part showing').toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify answer' }), 'and nothing chosen').toBeDisabled();
  });

  test('a round ends with a result and a new round brings different questions; the best score is kept', async ({ page, problems }) => {
    await openPartQuiz(page, OIL_PUMP.shortLabel);
    const asked = new Set<string>();
    for (let question = 0; question < 10; question += 1) {
      asked.add((await page.getByRole('heading', { level: 3 }).first().textContent()) ?? '');
      await chooseSomePart(page);
      await page.getByRole('button', { name: 'Verify answer' }).click();
      await page.getByRole('button', { name: /^(Next question|See your result)$/ }).click();
    }
    expect(asked.size, 'ten different questions in a round').toBeGreaterThanOrEqual(8);
    await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible();
    await expect(page.getByText(/^You found \d+ of \d+\.$/)).toBeVisible();
    await expectAccessibleAndTouchable(page, '3D part quiz, round complete');

    await page.getByRole('button', { name: 'New round, new questions' }).click();
    await expect(page.getByText(/^Question 1 of \d+$/)).toBeVisible();
    await expect(page.getByText('0 answered')).toBeVisible();

    await page.getByRole('button', { name: 'Assessments' }).click();
    await expect(page.getByRole('heading', { level: 3, name: '3D part quizzes' })).toBeVisible();
    await expect(page.getByText(/^Best \d+\/\d+$/), 'the finished round is remembered on its card').toHaveCount(1);
    problems.assertNone();
  });
});
