import fs from 'node:fs';
import { appReady, expect, expectAccessibleAndTouchable, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';
import { MODEL_FILES } from './viewer-helpers';

// Native interactives inside lesson steps. They are plain React (no 3D model), so these tests stay light.

const CAM_STEP = '#/learn/valve-train-and-power/valve-operating/step/6';

test.describe('Valve Operating: lift and duration', () => {
  test('the valve is open while the lobe lifts the tappet and closed on the base circle', async ({ page, problems }) => {
    await page.goto(`/${CAM_STEP}`);
    await appReady(page);
    await expect(page.getByRole('heading', { name: 'Lift and duration' })).toBeVisible();
    const crank = page.getByRole('slider', { name: 'Crank angle' });
    const summary = page.getByText(/^Crank \d+° · cam \d+°\./);

    await expect(summary, 'starts at the peak, half a turn of the cam in').toContainText('Crank 80° · cam 40°');
    await expect(page.getByText('the valve is open')).toBeVisible();

    await crank.fill('440');
    await expect(summary).toContainText('Crank 440° · cam 220°');
    await expect(page.getByText('the valve is closed')).toBeVisible();
    await expect(page.getByText('its spring holds it on the seat')).toBeVisible();

    // The graph always agrees with the cam: the standard lobe opens 50 degrees before TDC and closes 30 degrees after BDC.
    await crank.fill('690');
    await expect(page.getByText('the valve is open')).toBeVisible();
    await crank.fill('230');
    await expect(page.getByText('the valve is closed')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'lift and duration');
    problems.assertNone();
  });

  test('a taller, longer lobe lifts further and holds the valve open for longer', async ({ page }) => {
    await page.goto(`/${CAM_STEP}`);
    await appReady(page);
    const summary = page.getByText(/Lift \d+ units at most/);
    await expect(summary).toContainText('Lift 10 units at most · opens for 260° of crank rotation (130° of cam rotation)');

    await page.getByRole('button', { name: 'High lift, long duration' }).click();
    await expect(page.getByRole('button', { name: 'High lift, long duration' })).toHaveAttribute('aria-pressed', 'true');
    await expect(summary).toContainText('Lift 13 units at most · opens for 300° of crank rotation (150° of cam rotation)');

    await page.getByRole('button', { name: 'Low lift, short duration' }).click();
    await expect(summary).toContainText('Lift 7 units at most · opens for 220° of crank rotation (110° of cam rotation)');

    // At 230 degrees the long lobe is still lifting the valve but the short lobe has let it close.
    await page.getByRole('slider', { name: 'Crank angle' }).fill('225');
    await expect(page.getByText('the valve is closed')).toBeVisible();
    await page.getByRole('button', { name: 'High lift, long duration' }).click();
    await expect(page.getByText('the valve is open')).toBeVisible();
  });
});

test.describe('Accessories and Drives: the gear explorer', () => {
  const GEAR_STEP = '#/learn/valve-train-and-power/accessories-and-drives/step/6';

  test('the driven speed follows the teeth, and an idler turns it the same way without changing the ratio', async ({ page, problems }) => {
    await page.goto(`/${GEAR_STEP}`);
    await appReady(page);
    await expect(page.getByRole('heading', { name: 'Try the gear explorer' })).toBeVisible();
    const driver = page.getByRole('slider', { name: 'Turn the driver gear' });
    const summary = page.getByText(/^Driver [\d.]+ turns? · driven/);

    // A 12-tooth driver and a 24-tooth driven gear: one turn of the driver is half a turn of the driven gear, the other way.
    await driver.fill('360');
    await expect(summary).toContainText('Driver 1 turn · driven 0.5 turns, the opposite way');
    await expect(page.getByText('12 ÷ 24 = 0.5')).toBeVisible();
    await expect(page.getByText('1,200 rpm')).toBeVisible();

    // A 36-tooth driven gear takes three turns of the driver to turn once.
    await page.getByRole('group', { name: 'Driven teeth' }).getByRole('button', { name: '36 teeth' }).click();
    await driver.fill('1080');
    await expect(summary).toContainText('Driver 3 turns · driven 1 turn, the opposite way');
    await expect(page.getByText('The driven gear turns slower than the driver.')).toBeVisible();

    // The idler brings the direction back and leaves the ratio alone.
    await page.getByRole('button', { name: 'Add an idler' }).click();
    await expect(page.getByRole('button', { name: '18-tooth idler in place' })).toHaveAttribute('aria-pressed', 'true');
    await expect(summary).toContainText('Driver 3 turns · driven 1 turn, the same way');
    await expect(page.getByText('12 ÷ 36 = 0.333')).toBeVisible();
    await expect(page.getByText('does not change the ratio')).toBeVisible();

    // A bigger driver makes the driven gear faster.
    await page.getByRole('group', { name: 'Driver teeth' }).getByRole('button', { name: '36 teeth' }).click();
    await page.getByRole('group', { name: 'Driven teeth' }).getByRole('button', { name: '12 teeth' }).click();
    await expect(page.getByText('The driven gear turns faster than the driver.')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'gear explorer');
    problems.assertNone();
  });
});

test.describe('Power Generation: the energy chain', () => {
  const CHAIN_STEP = '#/learn/valve-train-and-power/power-generation/step/2';

  test('the walk goes from the fuel to thrust and shows where the heat goes', async ({ page, problems }) => {
    await page.goto(`/${CHAIN_STEP}`);
    await appReady(page);
    await expect(page.getByRole('heading', { name: 'Walk the energy chain', level: 2 })).toBeVisible();
    const stages = page.getByRole('list', { name: 'The stages of the energy chain' });
    await expect(stages.getByRole('button')).toHaveCount(9);
    await expect(page.getByText('Stage 1 of 9')).toBeVisible();
    await expect(page.getByText('15,560,000 ft-lb')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous stage' })).toBeDisabled();

    await page.getByRole('button', { name: 'Next stage' }).click();
    await expect(page.getByText('Stage 2 of 9')).toBeVisible();
    await expect(page.getByText('Where the heat goes, in percent of the heat produced')).toBeVisible();
    await expect(page.getByText('40 to 45')).toBeVisible();

    await stages.getByRole('button', { name: /Shaft power/ }).click();
    await expect(page.getByText('Stage 7 of 9')).toBeVisible();
    await expect(page.getByText('as much as 10 to 15 percent')).toBeVisible();
    await expect(page.getByText('Where the heat goes, in percent of the heat produced')).toHaveCount(0);

    await stages.getByRole('button', { name: /Thrust/ }).click();
    await expect(page.getByText('Stage 9 of 9')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next stage' })).toBeDisabled();
    await expect(page.getByText('Becomes the next stage through')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'energy chain');
    problems.assertNone();
  });
});

test.describe('Factors Affecting Power: air available', () => {
  const AIR_STEP = '#/learn/breathing-and-performance/factors-affecting-power/step/2';

  test('the example days and the sliders change how much air is available to burn', async ({ page, problems }) => {
    await page.goto(`/${AIR_STEP}`);
    await appReady(page);
    await expect(page.getByRole('heading', { name: 'Air available' })).toBeVisible();
    const bar = page.getByRole('img', { name: /Air available to burn: [\d.]+ percent/ });
    await expect(bar).toHaveAccessibleName('Air available to burn: 100 percent of a standard sea-level day');
    await expect(page.getByText('Density altitude: about 0 ft.')).toBeVisible();

    await page.getByRole('button', { name: 'Hot, humid day at sea level' }).click();
    await expect(bar).toHaveAccessibleName('Air available to burn: 89.4 percent of a standard sea-level day');
    await expect(page.getByText(/Density altitude: about [1-9][\d,]* ft\./)).toBeVisible();

    await page.getByRole('button', { name: 'Standard day, sea level' }).click();
    await page.getByLabel(/^Altitude/).fill('5000');
    await expect(bar).toHaveAccessibleName('Air available to burn: 86.2 percent of a standard sea-level day');
    await expect(page.getByText('24.9 inHg')).toBeVisible();

    await page.getByLabel(/^Temperature compared with standard/).fill('20');
    await expect(bar, 'heat takes more away').not.toHaveAccessibleName(/86\.2 percent/);
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'air available');
    problems.assertNone();
  });
});

test.describe('Performance Calculations: PLANK calculator', () => {
  const PLANK_STEP = '#/learn/breathing-and-performance/performance-calculations/step/4';

  test('the example engines and the sliders change the horsepower the formula gives', async ({ page, problems }) => {
    await page.goto(`/${PLANK_STEP}`);
    await appReady(page);
    await expect(page.getByRole('heading', { name: 'PLANK calculator' })).toBeVisible();
    const result = page.getByText(/^Indicated horsepower = P × L × A × N × K ÷ 33,000 = /);

    await page.getByRole('button', { name: 'Four-cylinder example' }).click();
    await expect(result, 'the course deck example: 135 psi, 4.5 in stroke, 5.0 in bore, 2,400 rpm, four cylinders').toContainText('= 144.6 hp');
    await expect(result).toContainText('the brake horsepower is 130.1 hp');

    await page.getByRole('button', { name: 'Handbook example, 12 cylinders' }).click();
    await expect(result, 'the handbook example, with its pressure corrected to 165 psi').toContainText('= 1069.1 hp');

    // Twice the cylinders is twice the power: the handbook example with six cylinders gives half.
    await page.getByLabel(/^K: number of cylinders/).fill('6');
    await expect(result).toContainText('= 534.6 hp');
    await expectNoHorizontalOverflow(page);
    await expectAccessibleAndTouchable(page, 'PLANK calculator');
    problems.assertNone();
  });
});

// Every native interactive in the lesson packs, each opened once (on the first step that shows it) at the narrowest phone width, where
// layouts wrap and controls crowd, and at tablet width, where the header's mode tabs show. The list is read from the packs, so an
// interactive added later is held to the same line without anyone remembering to add it here.
test.describe('every native interactive is accessible and touchable', () => {
  onlyIn('phone-320', 'tablet-768');
  // A cold dev server and axe's full-page scan take most of the default minute on a loaded machine or a shared CI runner.
  test.describe.configure({ timeout: 120_000 });
  const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const packs = (readJson('web/lessons-manifest.json') as { packs: string[] }).packs.map((path) => readJson(`web/${path.replace(/^\.\//, '')}`));
  const interactives = new Map<string, { hash: string; title: string }>();
  for (const pack of packs) for (const lesson of pack.lessons) for (const [index, step] of lesson.steps.entries()) {
    const id = typeof step.url === 'string' && step.url.startsWith('artifact:') ? step.url.slice('artifact:'.length) : '';
    if (id && !interactives.has(id)) interactives.set(id, { hash: `#/learn/${pack.id}/${lesson.id}/step/${index + 1}`, title: step.title });
  }

  test('the packs contain interactives to check', () => {
    expect(interactives.size, 'no artifact: steps found in web/*-lessons.json').toBeGreaterThan(10);
  });

  for (const [id, { hash, title }] of interactives) {
    test(id, async ({ page }) => {
      // None of these steps shows a model; refuse the downloads the page starts in the background (tens of megabytes each). The refusal
      // makes the app try Drive, which turns a stranger away, so this test leaves request errors to the tests above.
      await page.route(MODEL_FILES, (route) => route.abort());
      await page.goto(`/${hash}`);
      await appReady(page);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByText('This learning activity is not available')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await expectAccessibleAndTouchable(page, id);
    });
  }
});
