import fs from 'node:fs';
import { appReady, expect, expectAccessibleAndTouchable, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';

// The first step of a lesson opens it: the one sentence it is for, and, folded away until asked for, what the learner will be able to do.
onlyIn('phone-320', 'phone-390');

type Outcome = string | { heading: string; note?: string; items: string[] };
type PackLesson = { id: string; purpose?: string; coreIdea?: string; outcomes?: Outcome[] };
const lessonOf = (file: string, id: string) => (JSON.parse(fs.readFileSync(`web/${file}`, 'utf8')).lessons as PackLesson[]).find((lesson) => lesson.id === id)!;
const sentences = (outcomes: Outcome[]) => outcomes.flatMap((entry) => (typeof entry === 'string' ? [entry] : entry.items));

const history = lessonOf('history-lessons.json', 'history-mechanical-engines');
const STEP_1 = '#/learn/history-and-fundamentals/history-mechanical-engines/step/1';
const STEP_2 = '#/learn/history-and-fundamentals/history-mechanical-engines/step/2';

const opener = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'About this lesson' });

test('step 1 opens with the lesson\'s purpose, and the objectives are folded away', async ({ page }) => {
  const count = sentences(history.outcomes!).length;
  await page.goto(`/${STEP_1}`);
  await appReady(page);
  await expect(opener(page).getByText(history.purpose!)).toBeVisible();

  const toggle = opener(page).getByRole('button', { name: new RegExp(`What you will be able to do \\(${count}\\)`) });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(opener(page).getByText(sentences(history.outcomes!)[0])).toBeHidden();
  await expect(opener(page).getByText(history.coreIdea!)).toBeHidden();
});

test('the objectives open on request, as a list with the core idea, and fold away again', async ({ page }) => {
  const outcomes = sentences(history.outcomes!);
  await page.goto(`/${STEP_1}`);
  await appReady(page);
  const toggle = opener(page).getByRole('button', { name: /What you will be able to do/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(opener(page).getByRole('listitem')).toHaveCount(outcomes.length);
  await expect(opener(page).getByText(outcomes[0])).toBeVisible();
  await expect(opener(page).getByText(history.coreIdea!)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await toggle.click();
  await expect(opener(page).getByText(outcomes[0])).toBeHidden();
});

test('only the first step opens the lesson, and coming back to it finds the objectives folded again', async ({ page }) => {
  await page.goto(`/${STEP_1}`);
  await appReady(page);
  await opener(page).getByRole('button', { name: /What you will be able to do/ }).click();
  await page.getByRole('button', { name: 'Next Step' }).click();
  await expect(page.getByText(/^STEP 2/)).toBeVisible();
  await expect(opener(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(opener(page).getByRole('button', { name: /What you will be able to do/ })).toHaveAttribute('aria-expanded', 'false');
});

test('a lesson with parts lists its objectives under their own headings', async ({ page }) => {
  const practicals = lessonOf('maintenance-lsa-practicals-lessons.json', 'practicals');
  await page.goto('/#/learn/maintenance-lsa-practicals/practicals/step/1');
  await appReady(page);
  await opener(page).getByRole('button', { name: /What you will be able to do/ }).click();
  for (const group of (practicals.outcomes as Outcome[]).filter((entry): entry is Exclude<Outcome, string> => typeof entry === 'object')) {
    await expect(opener(page).getByText(group.heading, { exact: true })).toBeVisible();
  }
});

test('a lesson with no purpose written opens as it always did', async ({ page }) => {
  await page.goto('/#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1');
  await appReady(page);
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expect(opener(page)).toHaveCount(0);
});

test('the opener is accessible, with full-size targets, folded and open, in dark and in light', async ({ page }) => {
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('about:blank');
    await page.goto(`/${STEP_1}`);
    await appReady(page);
    await expectAccessibleAndTouchable(page, `lesson opener folded (${scheme})`);
    await opener(page).getByRole('button', { name: /What you will be able to do/ }).click();
    await expectAccessibleAndTouchable(page, `lesson opener open (${scheme})`);
  }
});

test('step 2 is still reachable by address, and shows no opener', async ({ page }) => {
  await page.goto(`/${STEP_2}`);
  await appReady(page);
  await expect(opener(page)).toHaveCount(0);
});
