import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { appReady, expect, expectAccessibleAndTouchable, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';

// The end of a lesson: what the learner should now be able to do, as a tick-list they answer honestly, kept on their device only.
onlyIn('phone-320', 'phone-390');

type Outcome = string | { heading: string; note?: string; items: string[] };
type PackLesson = { id: string; purpose?: string; coreIdea?: string; outcomes?: Outcome[] };
const lessonOf = (file: string, id: string) => (JSON.parse(fs.readFileSync(`web/${file}`, 'utf8')).lessons as PackLesson[]).find((lesson) => lesson.id === id)!;
const sentences = (outcomes: Outcome[]) => outcomes.flatMap((entry) => (typeof entry === 'string' ? [entry] : entry.items));

const history = lessonOf('history-lessons.json', 'history-mechanical-engines');
const HISTORY_DONE = '#/learn/history-and-fundamentals/history-mechanical-engines/complete';
const PRACTICALS_DONE = '#/learn/maintenance-lsa-practicals/practicals/complete';

const selfCheck = (page: Page) => page.getByRole('region', { name: 'Check yourself' });

test('the end of a lesson lists what the learner should now be able to do, and remembers their ticks', async ({ page, problems }) => {
  const outcomes = sentences(history.outcomes!);
  await page.goto(`/${HISTORY_DONE}`);
  await appReady(page);

  const box = selfCheck(page);
  await expect(box.getByText(history.purpose!)).toBeVisible();
  await expect(box.getByText(history.coreIdea!)).toBeVisible();
  const checks = box.getByRole('checkbox');
  await expect(checks).toHaveCount(outcomes.length);
  await expect(checks.first()).toHaveAccessibleName(outcomes[0]);
  await expect(box.getByText(`0 of ${outcomes.length} ticked`)).toBeVisible();

  await checks.nth(0).check();
  await checks.nth(2).check();
  await expect(box.getByText(`2 of ${outcomes.length} ticked`)).toBeVisible();

  await page.reload();
  await appReady(page);
  await expect(checks.nth(0)).toBeChecked();
  await expect(checks.nth(1)).not.toBeChecked();
  await expect(checks.nth(2)).toBeChecked();
  await expect(box.getByText(`2 of ${outcomes.length} ticked`)).toBeVisible();

  await checks.nth(0).uncheck();
  await expect(box.getByText(`1 of ${outcomes.length} ticked`)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  problems.assertNone();
});

test('the quiz, reflection and return choices are still there after the self-check', async ({ page }) => {
  await page.goto(`/${HISTORY_DONE}`);
  await appReady(page);
  await expect(page.getByRole('button', { name: 'Write a reflection' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Take this lesson/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to lessons' })).toBeVisible();
});

test('a lesson with parts, the practicals, groups its outcomes under their own headings', async ({ page }) => {
  const practicals = lessonOf('maintenance-lsa-practicals-lessons.json', 'practicals');
  await page.goto(`/${PRACTICALS_DONE}`);
  await appReady(page);
  const groups = (practicals.outcomes as Exclude<Outcome, string>[]).filter((entry) => typeof entry === 'object');
  for (const group of groups) {
    const section = selfCheck(page).getByRole('group', { name: group.heading });
    await expect(section.getByRole('checkbox')).toHaveCount(group.items.length);
  }
  await expect(selfCheck(page).getByRole('checkbox')).toHaveCount(sentences(practicals.outcomes!).length);
});

test('a lesson with no outcomes written has no self-check, and still ends properly', async ({ page }) => {
  await page.goto('/#/learn/m2-cylinder-study/m2-four-stroke-guided/complete');
  await appReady(page);
  await expect(page.getByRole('heading', { name: /You completed/ })).toBeVisible();
  await expect(selfCheck(page)).toHaveCount(0);
});

test('the self-check is accessible, with full-size targets, in dark and in light', async ({ page }) => {
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('about:blank');
    await page.goto(`/${HISTORY_DONE}`);
    await appReady(page);
    await expect(selfCheck(page)).toBeVisible();
    await expectAccessibleAndTouchable(page, `self-check (${scheme})`);
  }
});

test('finishing a lesson leads to the self-check', async ({ page }) => {
  await page.goto('/#/learn/history-and-fundamentals/history-mechanical-engines/step/10');
  await appReady(page);
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect(selfCheck(page)).toBeVisible();
});
