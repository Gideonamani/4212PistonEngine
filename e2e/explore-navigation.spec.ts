import { appReady, expect, onlyIn, test } from './fixtures';

// Explore's navigation preferences: the part card can be dragged off the tool buttons and stays there, the controls drawer under the model
// can be dragged taller or shorter, and the Look tab says whether a selection moves the camera. All three are kept on the device.
onlyIn('phone-390');
test.describe.configure({ timeout: 180_000 });
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

test('the part card and the controls drawer stay where the learner puts them, and centring on a selection can be switched off', async ({ page, problems }) => {
  await page.goto('/#/explore'); await appReady(page);
  await page.locator('button[aria-describedby="capabilities-cylinder"]').click();
  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  const component = panel.getByRole('combobox', { name: 'Component', exact: true });
  await expect(component).toBeVisible({ timeout: 120_000 });

  // The drawer: drag its top bar up by 120 px; the height is kept across a reload.
  const bar = panel.getByRole('separator', { name: 'Resize Explore controls' });
  const before = (await panel.boundingBox())!.height;
  const grip = (await bar.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - 60, { steps: 4 });
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - 120, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.height - before)).toBeGreaterThan(110);
  const dragged = Math.round((await panel.boundingBox())!.height);
  await expect(bar).toHaveAttribute('aria-valuenow', String(dragged));

  // The card starts in its corner; dragged by its title row it moves, and stays inside the model area.
  await component.selectOption({ label: 'Intake inner valve spring' });
  const float = page.getByTestId('part-card-float');
  const card = page.locator('aside[aria-label^="Component information for"]');
  await expect(card).toBeVisible();
  const stage = (await page.locator('canvas').boundingBox())!;
  const title = (await card.locator('h3').boundingBox())!;
  await page.mouse.move(title.x + 20, title.y + title.height / 2);
  await page.mouse.down();
  await page.mouse.move(title.x + 40, title.y + 60, { steps: 4 });
  await page.mouse.move(title.x + 60, title.y + 2000, { steps: 4 });
  await page.mouse.up();
  const placed = (await float.boundingBox())!;
  expect(placed.y + placed.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
  expect(placed.y).toBeGreaterThan(title.y + 20);

  // Explore does not switch a part inside the head to X-ray by itself.
  await expect(panel.getByRole('tab', { name: /^Spotlight/ })).toHaveAccessibleName('Spotlight, Highlight');

  // Look: the camera switch is on by default; switched off, it is kept.
  await panel.getByRole('tab', { name: /^Look/ }).click();
  const centre = panel.getByRole('switch', { name: /Centre the part I select/ });
  await expect(centre).toHaveAttribute('aria-checked', 'true');
  await centre.click();
  await expect(centre).toHaveAttribute('aria-checked', 'false');

  // After a reload the drawer keeps its height, the card its place and the switch its choice.
  await page.reload(); await appReady(page);
  await page.locator('button[aria-describedby="capabilities-cylinder"]').click();
  await expect(component).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => Math.round((await panel.boundingBox())!.height)).toBe(dragged);
  await component.selectOption({ label: 'Exhaust outer valve spring' });
  await expect(card).toBeVisible();
  await expect.poll(async () => Math.round((await float.boundingBox())!.y)).toBe(Math.round(placed.y));
  await panel.getByRole('tab', { name: /^Look/ }).click();
  await expect(centre).toHaveAttribute('aria-checked', 'false');
  problems.assertNone();
});
