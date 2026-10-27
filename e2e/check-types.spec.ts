import type { Page } from '@playwright/test';
import { appReady, expect, expectAccessibleAndTouchable, expectNoHorizontalOverflow, test } from './fixtures';

// The Check screen's answer areas for the question types beyond multiple choice and ordering: a number typed with a tolerance, and
// terms matched to descriptions. The shipped packs do not need every type yet, so the questions come from a pack made here and served
// in place of the real ones.

const pack = {
  schema: '4212.lesson-pack/v3',
  privacy: 'no learner identity',
  id: 'fixture-pack',
  title: 'Fixture checks',
  description: 'Checks made for the test.',
  lessons: [{ id: 'fixture-lesson', title: 'Fixture lesson', objective: 'Exists so the pack is a course.', reviewStatus: 'unreviewed', models: [], steps: [{ type: 'text', title: 'Only step', prompt: 'Nothing to see.' }] }],
  checks: [
    { id: 'displacement', lessonId: 'fixture-lesson', type: 'numeric', question: 'A cylinder has a 5 in bore and a 4 in stroke. What is its piston displacement?', hint: 'Use pi / 4 x bore squared x stroke.', unit: 'cu in', correctValue: 78.54, tolerance: 0.5, rationale: 'Displacement = pi / 4 x 25 x 4 = 78.54 cu in.' },
    { id: 'horsepower', lessonId: 'fixture-lesson', type: 'numeric', question: 'How many ft-lb per minute is one horsepower?', unit: 'ft-lb/min', correctValue: 33000, rationale: 'One horsepower is 33,000 foot-pounds per minute.' },
    { id: 'drives', lessonId: 'fixture-lesson', type: 'matching', question: 'Match each accessory to the job it does.', pairs: [{ left: 'Magneto', right: 'Makes the spark' }, { left: 'Vacuum pump', right: 'Drives gyro instruments' }, { left: 'Oil pump', right: 'Circulates lubricating oil' }], rationale: 'Each accessory is driven from the accessory gear train to do one job.' },
    { id: 'order-test', lessonId: 'fixture-lesson', type: 'multiple-choice', question: 'Which of these is the right one?', answers: ['The right one', 'A wrong one', 'Another wrong one'], correct: 0, rationale: 'The first option in the pack is the right one.' },
  ],
};

// Each test scans the page with axe more than once, which is slow on a busy runner.
test.describe.configure({ timeout: 120_000 });

const MANIFEST = { schema: '4212.lessons-manifest/v1', packs: ['./fixture-pack.json'] };

async function openFixtureCheck(page: Page) {
  await page.route('**/lessons-manifest.json', (route) => route.fulfill({ json: MANIFEST }));
  await page.route('**/fixture-pack.json', (route) => route.fulfill({ json: pack }));
  await page.goto('/#/check');
  await appReady(page);
  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page.getByText('Question 1 of 4')).toBeVisible();
}

test.describe('numeric question', () => {
  test('a typed number is marked within the tolerance and the right value is shown when it misses', async ({ page, problems }) => {
    await openFixtureCheck(page);
    await expect(page.getByText('ENTER A NUMBER')).toBeVisible();
    const input = page.getByLabel('Your answer, in cu in');
    const verify = page.getByRole('button', { name: 'Verify answer' });
    await expect(verify, 'nothing typed yet').toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'numeric question');

    await input.fill('about eighty');
    await expect(verify, 'words are not a number').toBeDisabled();
    await expect(page.getByRole('status')).toContainText('Enter a number');

    await input.fill('78.3');
    await expect(verify).toBeEnabled();
    await verify.click();
    await expect(page.getByText('CORRECT — WHY IT MATTERS')).toBeVisible();
    await expect(page.getByText('Your answer: 78.3 cu in')).toBeVisible();
    await expect(input, 'the answer locks').toBeDisabled();
    await expectAccessibleAndTouchable(page, 'numeric question, answered');

    await page.getByRole('button', { name: 'Next question' }).click();
    await expect(page.getByText('Question 2 of 4')).toBeVisible();
    // 33,000 with a thousands separator is read as 33000; Enter verifies.
    const second = page.getByLabel('Your answer, in ft-lb/min');
    await second.fill('33,000');
    await second.press('Enter');
    await expect(page.getByText('CORRECT — WHY IT MATTERS')).toBeVisible();
    problems.assertNone();
  });

  test('a wrong number shows the right one, with what was entered', async ({ page }) => {
    await openFixtureCheck(page);
    await page.getByLabel('Your answer, in cu in').fill('62.8');
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText('REVIEW THE EVIDENCE')).toBeVisible();
    await expect(page.getByText('The answer is 78.54 cu in (accepted within ±0.5 cu in)')).toBeVisible();
    await expect(page.getByText('(you entered 62.8 cu in)')).toBeVisible();
  });
});

test.describe('matching question', () => {
  async function openMatching(page: Page) {
    await openFixtureCheck(page);
    await page.getByRole('button', { name: /Open the list of questions/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^question 3:/i }).click();
    await expect(page.getByText('Question 3 of 4')).toBeVisible();
  }

  test('every term needs a match before it can be verified, and the options do not follow the pairs', async ({ page, problems }) => {
    await openMatching(page);
    await expect(page.getByText('MATCH EACH ITEM')).toBeVisible();
    const verify = page.getByRole('button', { name: 'Verify answer' });
    await expect(verify).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'matching question');

    const magneto = page.getByLabel('Magneto');
    const options = await magneto.locator('option').allInnerTexts();
    expect(options, 'alphabetical, after the prompt option').toEqual(['Choose a match…', 'Circulates lubricating oil', 'Drives gyro instruments', 'Makes the spark']);

    await magneto.selectOption('Makes the spark');
    await page.getByLabel('Vacuum pump').selectOption('Drives gyro instruments');
    await expect(verify, 'one term still unmatched').toBeDisabled();
    await page.getByLabel('Oil pump').selectOption('Circulates lubricating oil');
    await expect(verify).toBeEnabled();
    await verify.click();
    await expect(page.getByText('CORRECT — WHY IT MATTERS')).toBeVisible();
    await expect(page.getByLabel('Magneto'), 'the answers lock').toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next question' })).toBeVisible();
    await expectAccessibleAndTouchable(page, 'matching question, answered');
    problems.assertNone();
  });

  test('a wrong pairing is marked and the right match is shown beside it', async ({ page }) => {
    await openMatching(page);
    await page.getByLabel('Magneto').selectOption('Circulates lubricating oil');
    await page.getByLabel('Vacuum pump').selectOption('Drives gyro instruments');
    await page.getByLabel('Oil pump').selectOption('Makes the spark');
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText('REVIEW THE EVIDENCE')).toBeVisible();
    await expect(page.getByText('Correct match: Makes the spark')).toBeVisible();
    await expect(page.getByText('Correct match: Circulates lubricating oil')).toBeVisible();
    await expect(page.getByText(/Correct match: Drives gyro instruments/), 'the right pairing needs no correction').toHaveCount(0);
  });
});

test.describe('multiple-choice question', () => {
  test('the options are shown in a random order, and the right one is still marked right', async ({ page }) => {
    // With Math.random fixed at 0 the shuffle is a fixed rotation, so the first option in the pack is shown third.
    await page.addInitScript(() => { Math.random = () => 0; });
    await openFixtureCheck(page);
    await page.getByRole('button', { name: /Open the list of questions/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^question 4:/i }).click();
    await expect(page.getByText('Question 4 of 4')).toBeVisible();
    const options = page.getByRole('button', { name: /^[A-C]\s/ });
    const shown = (await options.allInnerTexts()).map((text) => text.replace(/^[A-C]\s*/, '').trim());
    expect(shown, 'a fixed rotation of the pack order, not the pack order').toEqual(['A wrong one', 'Another wrong one', 'The right one']);
    await page.getByRole('button', { name: /The right one/ }).click();
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText('CORRECT — WHY IT MATTERS')).toBeVisible();
  });
});

// model-click: tap a part on the 3D model. A second fixture pack, so the questions above keep their numbering.
const clickPack = {
  ...pack,
  id: 'click-pack',
  title: 'Fixture part checks',
  checks: [
    { id: 'tap-piston', lessonId: 'fixture-lesson', type: 'model-click', question: 'Tap the piston.', hint: 'It is the part the rings sit on.', modelId: 'cylinder', correctNodeId: 'PistonBody', rationale: 'The piston carries the rings and takes the force of combustion.' },
    { id: 'tap-intake', lessonId: 'fixture-lesson', type: 'model-click', question: 'Tap any part of the intake valve train.', modelId: 'cylinder', correctNodeId: 'intake', rationale: 'The intake valve, its guide, springs and rocker are the intake valve train.' },
  ],
};

async function openClickCheck(page: Page) {
  await page.route('**/lessons-manifest.json', (route) => route.fulfill({ json: { ...MANIFEST, packs: ['./click-pack.json'] } }));
  await page.route('**/click-pack.json', (route) => route.fulfill({ json: clickPack }));
  await page.goto('/#/check');
  await appReady(page);
  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page.getByText('Question 1 of 2')).toBeVisible();
  await expect(page.getByText('TAP THE PART ON THE MODEL')).toBeVisible();
  // The viewer's code loads on demand; its canvas appears once it has.
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
}

// The list needs the model, so it is enabled only once the model has loaded.
async function chooseFromList(page: Page, part: string) {
  await page.getByText('Cannot use the model? Choose the part from a list').click();
  const list = page.getByLabel('Part', { exact: true });
  await expect(list, 'the model has loaded').toBeEnabled({ timeout: 60_000 });
  await list.selectOption({ label: part });
}

test.describe('model-click question', () => {
  test('a part chosen from the list is marked, and the right part is named once verified', async ({ page, problems }) => {
    await openClickCheck(page);
    const verify = page.getByRole('button', { name: 'Verify answer' });
    await expect(verify, 'nothing tapped yet').toBeDisabled();
    await expect(page.locator('p[role="status"]')).toContainText('Tap a part on the model');
    await expectNoHorizontalOverflow(page);

    await chooseFromList(page, 'Piston');
    await expect(verify).toBeEnabled();
    await expect(page.locator('p[role="status"]'), 'the name of the chosen part is not given away before Verify').not.toContainText('Piston');
    await verify.click();
    await expect(page.getByText('CORRECT — WHY IT MATTERS')).toBeVisible();
    await expect(page.locator('p[role="status"]')).toContainText('You tapped Piston. The right answer is Piston.');
    await expect(page.getByLabel('Part', { exact: true }), 'the answer locks').toBeDisabled();
    await expectAccessibleAndTouchable(page, 'model-click question, answered');
    problems.assertNone();
  });

  test('a wrong part is marked and the right one is named; a part in the right group counts', async ({ page }) => {
    await openClickCheck(page);
    await chooseFromList(page, 'Intake valve');
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText('REVIEW THE EVIDENCE')).toBeVisible();
    await expect(page.locator('p[role="status"]')).toContainText('You tapped Intake valve. The right answer is Piston.');

    await page.getByRole('button', { name: 'Next question' }).click();
    await expect(page.getByText('Question 2 of 2')).toBeVisible();
    await chooseFromList(page, 'Intake rocker arm');
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText('CORRECT — WHY IT MATTERS'), 'any part of the intake group is right').toBeVisible();
  });

  test('a tap on the model itself chooses a part', async ({ page, problems }) => {
    await openClickCheck(page);
    const canvas = page.getByRole('application');
    // The loading cover goes away when the model's session exists.
    await expect(page.locator('div[role="status"][aria-live="polite"]')).toHaveCount(0, { timeout: 60_000 });
    const box = (await canvas.boundingBox())!;
    const verify = page.getByRole('button', { name: 'Verify answer' });
    // The model fills the frame, so some point of a coarse grid lands on a part.
    for (const [fx, fy] of [[0.5, 0.5], [0.4, 0.5], [0.6, 0.5], [0.5, 0.4], [0.5, 0.6], [0.35, 0.35], [0.65, 0.65], [0.3, 0.6], [0.7, 0.4]]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      if (await verify.isEnabled()) break;
    }
    await expect(verify, 'a tap landed on a part').toBeEnabled();
    await expect(page.locator('p[role="status"]')).toContainText('A part is highlighted');
    problems.assertNone();
  });
});


// name-part: the model spotlights one part and the learner names it (issue #76). The question opens on the keepers, a small part, so the
// camera's close-up matters.
const namePack = {
  ...pack,
  id: 'name-pack',
  title: 'Fixture naming checks',
  checks: [
    { id: 'name-keeper', lessonId: 'fixture-lesson', type: 'name-part', question: 'Name the highlighted part.', hint: 'It sits at the tip of the valve stem.', modelId: 'cylinder', partId: 'IntakeValveKeeper', answers: ['Valve keepers', 'Spring retainer', 'Valve guide'], correct: 0, rationale: 'The keepers lock the retainer to the stem.' },
    { id: 'name-pushrod', lessonId: 'fixture-lesson', type: 'name-part', question: 'Name the highlighted part.', modelId: 'cylinder', partId: 'IntakePushrod', answers: ['Pushrod', 'Pushrod housing', 'Rocker shaft'], correct: 0, rationale: 'The pushrod carries the tappet\'s lift to the rocker arm.' },
  ],
};

async function openNameCheck(page: Page) {
  await page.route('**/lessons-manifest.json', (route) => route.fulfill({ json: { ...MANIFEST, packs: ['./name-pack.json'] } }));
  await page.route('**/name-pack.json', (route) => route.fulfill({ json: namePack }));
  await page.goto('/#/check');
  await appReady(page);
  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page.getByText('Question 1 of 2')).toBeVisible();
  await expect(page.getByText('NAME THE HIGHLIGHTED PART', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
}

test.describe('name-part question', () => {
  // The cylinder downloads in each test, which is slow on a busy runner.
  test.describe.configure({ timeout: 240_000 });
  test('the model shows the part without naming it; the right name is marked, and a wrong one is corrected', async ({ page, problems }) => {
    await openNameCheck(page);
    const model = page.getByRole('region', { name: /Interactive 3D model of the .*, with one part highlighted/ });
    await expect(model).toBeVisible();
    await expect(model, 'the model never names the part').not.toContainText(/keeper/i);
    await expect(model.getByRole('status'), 'the model has loaded').toHaveCount(0, { timeout: 150_000 });
    const verify = page.getByRole('button', { name: 'Verify answer' });
    await expect(verify, 'nothing chosen yet').toBeDisabled();
    await expect(page.getByRole('button', { name: /Valve keepers|Spring retainer|Valve guide/ })).toHaveCount(3);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /Valve keepers/ }).click();
    await verify.click();
    await expect(page.getByText('CORRECT — WHY IT MATTERS')).toBeVisible();
    await expectAccessibleAndTouchable(page, 'name-part question, answered');

    await page.getByRole('button', { name: 'Next question' }).click();
    await expect(page.getByText('Question 2 of 2')).toBeVisible();
    await page.getByRole('button', { name: /Rocker shaft/ }).click();
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText('REVIEW THE EVIDENCE')).toBeVisible();
    problems.assertNone();
  });

  test('the close-up can be brought back after the learner turns away', async ({ page, problems }) => {
    await openNameCheck(page);
    await expect(page.getByRole('region', { name: /with one part highlighted/ }).getByRole('status')).toHaveCount(0, { timeout: 150_000 });
    await page.getByRole('button', { name: 'Back to the highlighted part' }).click();
    await expect(page.getByRole('button', { name: /Valve keepers/ })).toBeEnabled();
    problems.assertNone();
  });
});


// part-number: the same spotlight, but the learner finds the catalogue line for the part, and the screen says whose catalogue it is (issue #76).
const catalogueLines = [
  { index: '13-42', number: '538304', description: 'Push Rod Assembly' },
  { index: '13-38', number: '537296', description: 'Housing, Push Rod' },
  { index: '13-41', number: '626147', description: 'Spring, Push Rod Housing' },
];
const numberPack = {
  ...pack,
  id: 'number-pack',
  title: 'Fixture part-number checks',
  checks: [
    {
      id: 'number-pushrod', lessonId: 'fixture-lesson', type: 'part-number', question: 'In the IO-520 parts catalogue, figure 13, which line names the same kind of part as the one highlighted?', hint: 'Its housing and the spring on that housing have lines of their own.',
      modelId: 'cylinder', partId: 'IntakePushrod', answers: catalogueLines.map((line) => `${line.number} · ${line.description}`), correct: 0,
      catalogue: { engine: 'IO-520', applicability: 'similar-engine', title: 'Continental IO-520 Illustrated Parts Catalog, Form X-30040A', edition: 'May 1969', figure: '13, Cylinder Assembly', lines: catalogueLines },
      rationale: 'Index 42 is the push rod assembly. These are the IO-520\'s numbers, not the GTSIO-520-H\'s.',
    },
  ],
};

async function openNumberCheck(page: Page) {
  await page.route('**/lessons-manifest.json', (route) => route.fulfill({ json: { ...MANIFEST, packs: ['./number-pack.json'] } }));
  await page.route('**/number-pack.json', (route) => route.fulfill({ json: numberPack }));
  await page.goto('/#/check');
  await appReady(page);
  await page.getByRole('button').filter({ has: page.locator('h4') }).first().click();
  await expect(page.getByText('Question 1 of 1')).toBeVisible();
  await expect(page.getByText('FIND THE CATALOGUE LINE', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
}

test.describe('part-number question', () => {
  // The cylinder downloads in each test, which is slow on a busy runner.
  test.describe.configure({ timeout: 240_000 });
  test('the screen says the numbers are the IO-520\'s, never the GTSIO-520-H\'s, before and after the answer', async ({ page, problems }) => {
    await openNumberCheck(page);
    const notice = page.getByRole('note');
    await expect(notice).toContainText('IO-520 CATALOGUE · NOT THE GTSIO-520-H');
    await expect(notice).toContainText('Continental IO-520 Illustrated Parts Catalog, Form X-30040A (May 1969), figure 13, Cylinder Assembly');
    await expect(notice).toContainText('may carry a different number');
    const model = page.getByRole('region', { name: /Interactive 3D model of the .*, with one part highlighted/ });
    await expect(model, 'the model never names the part').not.toContainText(/push ?rod/i);
    await expect(model.getByRole('status'), 'the model has loaded').toHaveCount(0, { timeout: 150_000 });
    const verify = page.getByRole('button', { name: 'Verify answer' });
    await expect(verify, 'nothing chosen yet').toBeDisabled();
    await expect(page.getByRole('button', { name: /\d{6} · / }), 'each answer is a catalogue line, number then description').toHaveCount(3);
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'part-number question');

    await page.getByRole('button', { name: /537296 · Housing, Push Rod/ }).click();
    await verify.click();
    await expect(page.getByText('REVIEW THE EVIDENCE')).toBeVisible();
    await expect(page.getByText(/These are the IO-520's numbers/), 'the explanation repeats whose numbers they are').toBeVisible();
    await expect(page.getByRole('button', { name: /538304 · Push Rod Assembly/ }), 'the right line is shown after a miss').toBeVisible();
    await expect(notice, 'the notice stays after the answer').toBeVisible();
    await expectAccessibleAndTouchable(page, 'part-number question, answered');
    problems.assertNone();
  });

  test('the right catalogue line is marked correct', async ({ page, problems }) => {
    await openNumberCheck(page);
    await expect(page.getByRole('region', { name: /with one part highlighted/ }).getByRole('status')).toHaveCount(0, { timeout: 150_000 });
    await page.getByRole('button', { name: /538304 · Push Rod Assembly/ }).click();
    await page.getByRole('button', { name: 'Verify answer' }).click();
    await expect(page.getByText('CORRECT — WHY IT MATTERS')).toBeVisible();
    problems.assertNone();
  });
});
