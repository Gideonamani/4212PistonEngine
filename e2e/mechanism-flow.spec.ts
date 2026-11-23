import { appReady, expect, onlyIn, test } from './fixtures';

onlyIn('tablet-768');
test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

test('Hydraulic tappet opens in cutaway mode with live oil-flow & hydraulic-lock cues', { tag: '@large-model' }, async ({ page, problems }) => {
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-hydraulic-tappet"]').click();
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 120_000 });

  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  await panel.getByRole('tab', { name: /^Motion/ }).click();
  const toggle = panel.getByRole('checkbox', { name: /Oil flow & hydraulic lock/ });
  await expect(toggle).toBeChecked();

  // Scrub to 50% (Trapped oil under load) and capture screenshot.
  await panel.getByRole('slider', { name: 'Motion progress' }).fill('50');
  await expect(panel.getByText(/Trapped oil under load · SEALED/)).toBeVisible();
  await page.screenshot({ path: '.local/tappet-flow.png' });
  problems.assertNone();
});

test('Oil pump opens with ghosted housing, outer gear-pocket flow and relief-valve bypass', async ({ page, problems }) => {
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-oil-pump"]').click();
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 120_000 });

  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  await panel.getByRole('tab', { name: /^Motion/ }).click();
  const toggle = panel.getByRole('checkbox', { name: /Oil flow & relief bypass/ });
  await expect(toggle).toBeChecked();
  await expect(panel.getByText(/outer gear pockets/)).toBeVisible();
  await page.screenshot({ path: '.local/oil-pump-flow.png' });
  problems.assertNone();
});

test('Accessories and drives opens with ghosted housing, metallic palette and torque ribbons', { tag: '@large-model' }, async ({ page, problems }) => {
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-accessory-drives"]').click();
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 120_000 });

  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  await panel.getByRole('tab', { name: /^Motion/ }).click();
  const toggle = panel.getByRole('checkbox', { name: /Torque flow & cutaway housing/ });
  await expect(toggle).toBeChecked();
  await page.screenshot({ path: '.local/accessory-flow.png' });
  problems.assertNone();
});
