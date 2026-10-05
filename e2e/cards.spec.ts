import fs from 'node:fs';
import { appReady, expect, expectNoHorizontalOverflow, test } from './fixtures';

// What the cards and steps say about themselves: the instructor-review chip, no empty picture panel on a text step, no tags guessed
// from words in a title, and a neutral frame when a card has no picture.

const readPack = (file: string) => JSON.parse(fs.readFileSync(`web/${file}`, 'utf8')) as { lessons: { listed?: boolean; reviewStatus: string }[] };
const PENDING = 'Instructor review pending';

test('Learn: a lesson card says its review is pending until the instructor has reviewed it', async ({ page, problems }) => {
  const waiting = readPack('history-lessons.json').lessons.filter((lesson) => lesson.listed !== false && lesson.reviewStatus !== 'reviewed').length;
  await page.goto('/#/learn/history-and-fundamentals');
  await appReady(page);
  await expect(page.getByRole('button').filter({ has: page.locator('h4') }), 'the course lists its lessons').not.toHaveCount(0);
  await expect(page.getByText(PENDING)).toHaveCount(waiting);
  await expectNoHorizontalOverflow(page);
  problems.assertNone();
});

test('Learn: the chip also shows inside the lesson', async ({ page, problems }) => {
  await page.goto('/#/learn/history-and-fundamentals/history-mechanical-engines/step/1');
  await appReady(page);
  await expect(page.getByText(PENDING)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  problems.assertNone();
});

test('Learn: a text step has no empty picture panel above its heading', async ({ page, problems }) => {
  await page.goto('/#/learn/history-and-fundamentals/history-mechanical-engines/step/1');
  await appReady(page);
  const heading = page.getByRole('heading', { level: 2 }).first();
  await expect(heading).toBeVisible();
  const label = await page.getByText(/^STEP 1/).boundingBox();
  const title = await heading.boundingBox();
  // A blank media slot used to put 176-208 px between the step label and the heading; a gap is a few pixels.
  expect(title!.y - (label!.y + label!.height), 'something sits between the step label and the heading').toBeLessThan(40);
  problems.assertNone();
});

test('Check: cards and questions carry no tag guessed from the course name', async ({ page, problems }) => {
  await page.goto('/#/check');
  await appReady(page);
  await expect(page.getByText(/OPERATING CYCLE|FOUNDATIONS/)).toHaveCount(0);
  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page.getByText(/Question 1 of \d+/)).toBeVisible();
  await expect(page.getByText(/^(4stroke|components|diagnostics)$/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  problems.assertNone();
});

test('a card whose picture is missing shows the neutral frame', async ({ page }) => {
  await page.route('**/thumbnails/*.webp', (route) => route.abort());
  await page.goto('/#/learn');
  await appReady(page);
  await expect(page.locator('svg.lucide-cog').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
