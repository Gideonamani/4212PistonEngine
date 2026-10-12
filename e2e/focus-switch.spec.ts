import { expect, onlyIn, test } from './fixtures';
import { SPOTLIGHT_STEP, openViewerStep } from './viewer-helpers';

// The student-facing switch between the three ways a spotlight can be drawn (Highlight, X-ray, Isolate). How each mode looks is checked
// against the real models in scripts/test_focus_modes.mjs; this checks the part a learner touches: the switch, what it reports, and
// that their choice outlives the step and the visit. Each test downloads the cylinder, so they run once, one after the other.

onlyIn('phone-390');
test.describe.configure({ mode: 'serial' });

const STORAGE_KEY = '4212-lesson-focus-mode';
const SWITCH = 'How the highlighted part is shown';

test('a spotlight step offers three ways to show the part, and the choice carries to the next steps', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SPOTLIGHT_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const group = viewer.getByRole('group', { name: SWITCH });
  await expect(group.getByRole('button')).toHaveText(['Highlight', 'X-ray', 'Isolate']);
  // The step names no mode of its own, so the switch shows the default.
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer.getByText(/faint ghost/)).toBeVisible();

  const canvas = viewer.locator('canvas');
  const asXray = await canvas.screenshot();
  await group.getByRole('button', { name: 'Highlight' }).click();
  await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'false');
  await expect(viewer.getByText(/Colours the part/)).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).equals(asXray), { message: 'choosing Highlight should redraw the model' }).toBe(false);

  // Step 5 spotlights other parts of the same model: the choice holds, and the model is not reloaded.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(/Step 5 of \d+/)).toBeVisible();
  await expect(viewer.getByRole('status')).toHaveCount(0);
  await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');

  // Step 6 is a picture: the viewer is tucked away, then comes back at step 7 still on Highlight.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(/Step 6 of \d+/)).toBeVisible();
  await expect(viewer).toBeHidden();
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(/Step 7 of \d+/)).toBeVisible();
  await expect(viewer.getByRole('status')).toHaveCount(0);
  await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('canvas').count(), 'one canvas, not one per step').toBe(1);

  // Isolate is the third way, and the hint line describes whichever is on.
  await group.getByRole('button', { name: 'Isolate' }).click();
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer.getByText(/part on its own/)).toBeVisible();
  problems.assertNone();
});

test('a choice made on an earlier visit is already in force when the model appears', async ({ page, problems }) => {
  test.setTimeout(240_000);
  await page.addInitScript((key) => { try { localStorage.setItem(key, 'isolate'); } catch { /* storage blocked */ } }, STORAGE_KEY);
  const { viewer } = await openViewerStep(page, SPOTLIGHT_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const group = viewer.getByRole('group', { name: SWITCH });
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'false');
  problems.assertNone();
});

// The cross-section controls that join the spotlight bar: a checkbox that cuts the model, and a picker of the three standard planes plus
// the plane a step recommends (its `sectionPlane`). Lesson 08 step 2 recommends "Valve axis"; step 4 spotlights springs and names none.
const SECTION_STEP = '#/learn/valve-train-and-power/valve-operating/step/2';

test('a spotlight step offers a cross section: a checkbox, and a picker with the plane the step recommends', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SECTION_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const checkbox = viewer.getByRole('checkbox', { name: 'Cross section' });
  const plane = viewer.getByRole('button', { name: /^Section plane:/ });
  await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  await expect(plane).toHaveAccessibleName('Section plane: Valve axis');

  const canvas = viewer.locator('canvas');
  const whole = await canvas.screenshot();
  await checkbox.click();
  await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await canvas.screenshot()).equals(whole), { message: 'ticking the box should cut the model' }).toBe(false);

  await plane.click();
  const menu = page.getByRole('dialog', { name: 'Section plane' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('option')).toHaveText([/Valve axis/, /X plane/, /Y plane/, /Z plane/]);
  await expect(menu.getByRole('option', { name: /Valve axis/ })).toHaveAttribute('aria-selected', 'true');
  await expect(menu.getByRole('option', { name: /Valve axis/ })).toContainText('Recommended for this step');
  const slider = menu.getByRole('slider', { name: /Plane position/ });
  await expect(slider).toHaveValue('50');

  // Choosing a standard plane swaps the label and starts the slider in the middle again; the slider then moves the cut.
  await menu.getByRole('option', { name: /X plane/ }).click();
  await expect(plane).toHaveAccessibleName('Section plane: X plane');
  await expect(menu.getByRole('option', { name: /X plane/ })).toHaveAttribute('aria-selected', 'true');
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  await expect(menu).toContainText('100%');

  // Escape closes the picker and puts focus back on its button.
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(plane).toBeFocused();

  // The recommended plane can be chosen again.
  await plane.click();
  await menu.getByRole('option', { name: /Valve axis/ }).click();
  await expect(plane).toHaveAccessibleName('Section plane: Valve axis');
  await expect(slider).toHaveValue('50');
  await page.keyboard.press('Escape');

  // Step 4 names no plane: the cut starts off again and only the three standard planes are offered. Step 3 is text, so the viewer rests.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(viewer.getByRole('status')).toHaveCount(0);
  await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  await expect(plane).toHaveAccessibleName('Section plane: Z plane');
  await plane.click();
  await expect(menu.getByRole('option')).toHaveText([/X plane/, /Y plane/, /Z plane/]);
  problems.assertNone();
});
