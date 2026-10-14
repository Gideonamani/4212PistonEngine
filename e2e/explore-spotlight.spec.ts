import { appReady, expect, onlyIn, test } from './fixtures';

// Explore's controls are the lesson dock's tabs plus more (Parts, Motion, Look). Its Spotlight replaces the old "Isolate part" and "Isolate
// subassembly" buttons: the learner picks the part (or the subassembly) in Parts and chooses here how to show it. This opens the operating
// cylinder, so it runs once.

onlyIn('phone-390');
// The timeout is the whole test's, from the moment its browser context is made: a slow runner can take a while over that.
test.describe.configure({ timeout: 240_000 });

test('Explore offers the five tabs, and its Spotlight follows the part the learner picks', async ({ page, problems }) => {
  test.setTimeout(240_000);
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-cylinder"]').click();
  // The viewer loads lazily, so wait for its canvas host before waiting for the loading cover to go.
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const panel = page.getByRole('complementary', { name: 'Explore controls' });

  const tabs = panel.getByRole('tab');
  await expect(tabs).toHaveCount(5, { timeout: 30_000 });
  await expect(tabs.nth(0)).toHaveAccessibleName('Parts');
  await expect(tabs.nth(1)).toHaveAccessibleName(/^Motion/);
  await expect(tabs.nth(2)).toHaveAccessibleName(/^Spotlight/);
  await expect(tabs.nth(3)).toHaveAccessibleName(/^Section/);
  await expect(tabs.nth(4)).toHaveAccessibleName('Look');
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

  // The old buttons are gone from Parts; "Show all" stays.
  await expect(panel.getByRole('button', { name: 'Isolate part' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Isolate subassembly' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Show all' })).toBeVisible();

  // With nothing chosen, the spotlight has nothing to aim at: the tiles wait and the panel says why.
  await tabs.nth(2).click();
  const group = panel.getByRole('group', { name: 'How the highlighted part is shown' });
  await expect(group.getByRole('button', { name: 'Isolate' })).toBeDisabled();
  await expect(panel.getByText('Choose a part or a subassembly in Parts')).toBeVisible();

  // Pick a part in Parts, and the tiles come alive.
  await tabs.nth(0).click();
  const component = panel.getByRole('combobox', { name: 'Component' });
  await component.selectOption({ label: 'Crankshaft throw' });
  await tabs.nth(2).click();
  await expect(group.getByRole('button', { name: 'Isolate' })).toBeEnabled();
  await expect(panel.getByText('Crankshaft throw').first()).toBeVisible();

  const canvas = viewer.locator('canvas');
  const whole = await canvas.screenshot();
  await group.getByRole('button', { name: 'Isolate' }).click();
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'true');
  await expect(tabs.nth(2)).toHaveAccessibleName('Spotlight, Isolate');
  await expect.poll(async () => (await canvas.screenshot()).equals(whole), { message: 'isolating should redraw the model' }).toBe(false);

  // The spotlight follows the next part the learner picks, even from another tab.
  await tabs.nth(0).click();
  await component.selectOption({ label: 'Connecting rod' });
  await tabs.nth(2).click();
  await expect(panel.getByText('Connecting rod').first()).toBeVisible();
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'true');

  // Another style, then the same one again to switch the spotlight off.
  await group.getByRole('button', { name: 'X-ray' }).click();
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'false');
  await group.getByRole('button', { name: 'X-ray' }).click();
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'false');
  await expect(tabs.nth(2)).toHaveAccessibleName('Spotlight, Off');

  // The same goes for a whole subassembly, and "Show all" puts everything back.
  await tabs.nth(0).click();
  await panel.getByRole('combobox', { name: 'Subassembly' }).selectOption({ index: 1 });
  await tabs.nth(2).click();
  await group.getByRole('button', { name: 'Highlight' }).click();
  await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');
  await tabs.nth(0).click();
  await panel.getByRole('button', { name: 'Show all' }).click();
  await expect(tabs.nth(2)).toHaveAccessibleName('Spotlight, Off');

  // The Section tab has the same card a lesson shows (with no R, because no step recommends a plane), plus Reverse cut and Reset.
  await tabs.nth(3).click();
  await expect(panel.getByRole('switch', { name: 'Cross section' })).toHaveAttribute('aria-checked', 'false');
  await expect(panel.getByRole('radiogroup', { name: 'Section plane' }).getByRole('radio')).toHaveText(['X', 'Y', 'Z']);
  await expect(panel.getByRole('button', { name: 'Reverse cut' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Reset' })).toBeVisible();
  await panel.getByRole('switch', { name: 'Cross section' }).click();
  await expect(tabs.nth(3)).toHaveAccessibleName(/^Section, On/);
  problems.assertNone();
});
