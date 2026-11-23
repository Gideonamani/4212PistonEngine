import { appReady, expect, onlyIn, test } from './fixtures';

onlyIn('tablet-768');
test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

test('GTSIO-520-H whole engine enables multi-cylinder airflow, opens Cycle Split, and switches hero cylinders', { tag: '@large-model' }, async ({ page, problems }) => {
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-gtsio520-h-r10-mechanism-study"]').click();
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  await panel.getByRole('tab', { name: /^Motion/ }).click();
  const toggle = panel.getByRole('checkbox', { name: /Multi-cylinder airflow/ });
  await expect(toggle).toBeVisible();
  await toggle.click();

  // Cycle Split opens automatically with the 6-cylinder firing-order selector.
  const split = page.getByRole('complementary', { name: 'Cycle split view' });
  await expect(split).toBeVisible({ timeout: 15_000 });
  const firingGroup = split.getByRole('radiogroup', { name: 'Firing order cylinder selector' });
  await expect(firingGroup.getByRole('radio')).toHaveCount(6);
  await expect(firingGroup.getByRole('radio', { name: '1', exact: true })).toHaveAttribute('aria-checked', 'true');

  // Switch tracked hero cylinder to Cylinder 4 and scrub crank angle.
  await firingGroup.getByRole('radio', { name: '4', exact: true }).click();
  await expect(firingGroup.getByRole('radio', { name: '4', exact: true })).toHaveAttribute('aria-checked', 'true');
  const slider = split.getByRole('slider', { name: 'Crank angle' });
  await slider.fill('370');
  await page.screenshot({ path: '.local/gtsio-multi-cycle-split.png' });
  problems.assertNone();
});

test('1903 Wright inline four opens its casing and draws every cylinder overlay at the valve end, above the piston', { tag: '@large-model' }, async ({ page, problems }) => {
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-wright-1903-reconstruction"]').click();
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  await panel.getByRole('tab', { name: /^Motion/ }).click();
  await panel.getByRole('checkbox', { name: /Multi-cylinder airflow/ }).click();
  const split = page.getByRole('complementary', { name: 'Cycle split view' });
  await expect(split).toBeVisible({ timeout: 15_000 });
  await expect(split.getByRole('radiogroup', { name: 'Firing order cylinder selector' }).getByRole('radio')).toHaveCount(4);

  // Cylinder 1 in its intake stroke, then its power stroke: the glow, ports and ring belong at the valve boxes, not under the piston.
  const slider = split.getByRole('slider', { name: 'Crank angle' });
  await slider.fill('100');
  await page.screenshot({ path: '.local/wright-cycle-intake.png' });
  await slider.fill('400');
  await page.screenshot({ path: '.local/wright-cycle-power.png' });

  // What the overlay hangs from is checked against the real part positions in scripts/test_bore_geometry.mjs; here, the scene must stay healthy.
  problems.assertNone();
});

test('1913 Gnome Monosoupape rotary enables rotating 9-cylinder airflow and Cycle Split', { tag: '@large-model' }, async ({ page, problems }) => {
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-gnome-monosoupape-1913"]').click();
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  await panel.getByRole('tab', { name: /^Motion/ }).click();
  await panel.getByRole('checkbox', { name: /Multi-cylinder airflow/ }).click();

  const split = page.getByRole('complementary', { name: 'Cycle split view' });
  await expect(split).toBeVisible({ timeout: 15_000 });
  const firingGroup = split.getByRole('radiogroup', { name: 'Firing order cylinder selector' });
  await expect(firingGroup.getByRole('radio')).toHaveCount(9);

  // Rotate to 150° so the skirt-port transfer mist & rotating chambers are clearly visible.
  await split.getByRole('slider', { name: 'Crank angle' }).fill('150');
  await page.screenshot({ path: '.local/gnome-multi-cycle-split.png' });
  problems.assertNone();
});
