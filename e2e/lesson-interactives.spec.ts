import { appReady, expect, expectAccessibleAndTouchable, expectNoHorizontalOverflow, test } from './fixtures';

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

test.describe('Factors Affecting Power: air available', () => {
  const AIR_STEP = '#/learn/breathing-and-performance/factors-affecting-power/step/2';

  test('the example days and the sliders change how much air is available to burn', async ({ page, problems }) => {
    await page.goto(`/${AIR_STEP}`);
    await appReady(page);
    await expect(page.getByRole('heading', { name: 'Air available' })).toBeVisible();
    const bar = page.getByRole('img', { name: /Air available to burn: [\d.]+ percent/ });
    await expect(bar).toHaveAccessibleName('Air available to burn: 100 percent of a standard sea-level day');

    await page.getByRole('button', { name: 'Hot, humid day at sea level' }).click();
    await expect(bar).toHaveAccessibleName('Air available to burn: 89.4 percent of a standard sea-level day');

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
