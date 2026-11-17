import { appReady, expect, onlyIn, test } from './fixtures';

onlyIn('phone-390', 'tablet-768');
test.describe.configure({ timeout: 180_000 });
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

test('canvas, checklist, card and Spotlight agree throughout selection changes', async ({ page, problems }, testInfo) => {
  await page.goto('/#/explore'); await appReady(page);
  await page.locator('button[aria-describedby="capabilities-cylinder"]').click();
  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  const component = panel.getByRole('combobox', { name: 'Component', exact: true });
  await expect(component).toBeVisible({ timeout: 120_000 });
  const card = page.locator('aside[aria-label^="Component information for"]');
  const partsTab = panel.getByRole('tab', { name: 'Parts', exact: true });
  const spotlightTab = panel.getByRole('tab', { name: /^Spotlight/ });
  await component.selectOption({ label: 'Crankshaft throw' });

  await page.getByRole('button', { name: 'Reset and centre 3D view', exact: true }).click();

  // Tap visible geometry, using a small deterministic grid to accommodate the two layouts.
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  for (const [fx, fy] of [[.5,.5],[.45,.35],[.5,.3],[.55,.4],[.6,.5],[.4,.55],[.4,.65],[.55,.6]]) {
    await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
    if (await component.inputValue() !== 'CrankThrow') break;
  }
  await expect(component).not.toHaveValue('CrankThrow');
  const picked = (await component.locator('option:checked').textContent())!;
  await expect(card).toBeVisible();
  await expect(panel.getByRole('button', { name: `Remove ${picked}`, exact: true })).toBeVisible();
  await spotlightTab.click();
  await expect(panel.getByRole('tabpanel')).toContainText(`Spotlight on ${picked}.`);
  await page.screenshot({ path: testInfo.outputPath('selection-fixed.png') });

  // Card isolation uses the same remembered style as the Spotlight tiles.
  await card.getByRole('button', { name: 'Isolate', exact: true }).click();
  await expect(spotlightTab).toHaveAccessibleName('Spotlight, Isolate');
  await partsTab.click();
  await component.selectOption({ label: 'Connecting rod' });
  await expect(card.getByRole('button', { name: 'Unisolate', exact: true })).toBeVisible();
  await spotlightTab.click();
  const styles = panel.getByRole('group', { name: 'How the highlighted part is shown' });
  await expect(styles.getByRole('button', { name: 'Isolate', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await styles.getByRole('button', { name: 'Isolate', exact: true }).click();
  await expect(spotlightTab).toHaveAccessibleName('Spotlight, Off');
  await expect(card.getByRole('button', { name: 'Isolate', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Unisolate', exact: true })).toHaveCount(0);

  await partsTab.click();
  await panel.getByRole('button', { name: 'Remove Connecting rod', exact: true }).click();
  await expect(component).toHaveValue('');
  await expect(card).toHaveCount(0);
  await expect(spotlightTab).toHaveAccessibleName('Spotlight, Off');
  await component.selectOption({ label: 'Crankshaft throw' });
  await panel.getByRole('button', { name: 'Connecting rod', exact: true }).click();
  await expect(panel.getByText('2 parts selected', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Show all', exact: true }).click();
  await expect(component).toHaveValue('');
  await expect(card).toHaveCount(0);
  await expect(spotlightTab).toHaveAccessibleName('Spotlight, Off');
  await component.selectOption({ label: 'Intake valve seat' });
  const revealNote = page.getByText('Highlight · X-ray reveal', { exact: false });
  await expect(revealNote).toBeVisible();
  await page.getByRole('button', { name: 'Hide Explore controls', exact: true }).first().click();
  const noteBox = (await revealNote.boundingBox())!;
  const playerBox = (await page.locator('[aria-label="Floating motion player"]').boundingBox())!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(playerBox.y);
  await page.screenshot({ path: testInfo.outputPath('xray-reveal.png') });
  await page.getByRole('button', { name: 'Show Explore controls', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Search components' }).fill('Intake');
  await page.getByRole('button', { name: 'Select 3D Engine Model', exact: true }).click();
  await page.getByRole('button', { name: 'Hydraulic tappet', exact: true }).click();
  const nextViewer = page.getByRole('region', { name: 'Interactive 3D model of the Hydraulic tappet internals', exact: true });
  await expect(nextViewer).toBeVisible();
  await expect(component.locator('option[value="IntakeValve"]')).toHaveCount(0);
  await expect(component).toBeVisible({ timeout: 120_000 });
  await expect(component).toHaveValue('');
  await expect(panel.getByRole('textbox', { name: 'Search components' })).toHaveValue('');
  await expect(card).toHaveCount(0);
  await expect(spotlightTab).toHaveAccessibleName('Spotlight, Off');
  await component.selectOption({ index: 1 });
  await expect(spotlightTab).toHaveAccessibleName('Spotlight, Highlight');
  problems.assertNone();
});
