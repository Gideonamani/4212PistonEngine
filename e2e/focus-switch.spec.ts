import type { Locator } from '@playwright/test';
import { expect, onlyIn, test } from './fixtures';
import { SECTION_STEP, SPOTLIGHT_STEP, openViewerStep } from './viewer-helpers';

// The student-facing controls of a lesson's 3D model: the Spotlight tab (three ways a spotlight can be drawn: Highlight, X-ray, Isolate) and
// the Section tab (cut the model open along a plane). How each mode looks is checked against the real models in
// scripts/test_focus_modes.mjs; this checks the part a learner touches: the tabs, what they report, and that a choice outlives the step and
// the visit. Each test downloads the cylinder, so they run once, one after the other.

onlyIn('phone-390');
// The timeout is the whole test's, from the moment its browser context is made: a slow runner can take a while over that.
test.describe.configure({ mode: 'serial', timeout: 240_000 });

// Leave the model's scene before the browser context is closed. On a busy CI runner, closing a page that still holds a large WebGL scene
// can take half a minute, and the next test cannot get its context until it has.
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

const STORAGE_KEY = '4212-lesson-focus-mode';
const SWITCH = 'How the highlighted part is shown';
// The steps after the spotlight step are counted from its own position, so the test follows the lesson when a step is added before it.
// In the lesson the next step spotlights other parts of the same model, the one after is a picture, and the one after that is a spotlight again.
const FIRST = Number(SPOTLIGHT_STEP.split('/').pop());
const stepOf = (n: number) => new RegExp(`Step ${n} of \\d+`);

/** Opens a dock tab if it is not open already (a tap on an open tab closes it). */
async function openTab(tab: Locator) {
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

test('a spotlight step offers three ways to show the part, and the choice carries to the next steps', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SPOTLIGHT_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const tab = viewer.getByRole('tab', { name: /^Spotlight/ });
  // The step names no mode of its own, so the tab reports the default even before it is opened.
  await expect(tab).toContainText('X-ray');
  // The dock starts with every panel closed; a tap opens one and a second tap closes it.
  await expect(tab).toHaveAttribute('aria-selected', 'false');
  await expect(viewer.getByRole('group', { name: SWITCH })).toHaveCount(0);
  await openTab(tab);
  await tab.click();
  await expect(viewer.getByRole('group', { name: SWITCH })).toHaveCount(0);
  await openTab(tab);
  const group = viewer.getByRole('group', { name: SWITCH });
  await expect(group.getByRole('button')).toHaveText(['Highlight', 'X-ray', 'Isolate']);
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer.getByText(/faint ghost/)).toBeVisible();

  const canvas = viewer.locator('canvas');
  const asXray = await canvas.screenshot();
  await group.getByRole('button', { name: 'Highlight' }).click();
  await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'false');
  await expect(tab).toContainText('Highlight');
  await expect(viewer.getByText(/Colours the part/)).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).equals(asXray), { message: 'choosing Highlight should redraw the model' }).toBe(false);

  // The next step spotlights other parts of the same model: the choice holds, and the model is not reloaded.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(stepOf(FIRST + 1))).toBeVisible();
  await expect(viewer.getByRole('status')).toHaveCount(0);
  await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');

  // Then a picture: the viewer is tucked away, then comes back at the step after it, still on Highlight.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(stepOf(FIRST + 2))).toBeVisible();
  await expect(viewer).toBeHidden();
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(page.getByText(stepOf(FIRST + 3))).toBeVisible();
  await expect(viewer.getByRole('status')).toHaveCount(0);
  await expect(tab).toContainText('Highlight');
  await openTab(tab);
  await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('canvas').count(), 'one canvas, not one per step').toBe(1);

  // Isolate is the third way, and the hint line describes whichever is on.
  await group.getByRole('button', { name: 'Isolate' }).click();
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'true');
  await expect(tab).toContainText('Isolate');
  await expect(viewer.getByText(/part on its own/)).toBeVisible();
  problems.assertNone();
});

test('a choice made on an earlier visit is already in force when the model appears', async ({ page, problems }) => {
  test.setTimeout(240_000);
  await page.addInitScript((key) => { try { localStorage.setItem(key, 'isolate'); } catch { /* storage blocked */ } }, STORAGE_KEY);
  const { viewer } = await openViewerStep(page, SPOTLIGHT_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const tab = viewer.getByRole('tab', { name: /^Spotlight/ });
  await expect(tab).toContainText('Isolate');
  await openTab(tab);
  const group = viewer.getByRole('group', { name: SWITCH });
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'false');

  // The sliders button on the model hides and shows the whole dock.
  await viewer.getByRole('button', { name: 'Hide model controls' }).click();
  await expect(viewer.getByRole('tablist', { name: 'Model controls' })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Show model controls' }).click();
  await expect(viewer.getByRole('tablist', { name: 'Model controls' })).toBeVisible();
  problems.assertNone();
});

// The Section tab: a switch that cuts the model, chips for the three standard planes plus R, the plane a step recommends (its
// `sectionPlane`, named in a line under the chips), and a slider that moves the cut. Lesson 08 step 2 recommends "Valve axis"; step 4
// spotlights springs and names none.

test('a spotlight step offers a cross section: a switch, chips for the planes, and R for the plane the step recommends', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, SECTION_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });

  const tab = viewer.getByRole('tab', { name: /^Section/ });
  await expect(tab).toContainText('Off');
  await openTab(tab);
  const cut = viewer.getByRole('switch', { name: 'Cross section' });
  const planes = viewer.getByRole('radiogroup', { name: 'Section plane' });
  const chips = planes.getByRole('radio');
  await expect(cut).toHaveAttribute('aria-checked', 'false');
  // The step's own name for its plane survives only in the line under the chips: on the chip it is always "R".
  await expect(chips).toHaveText(['R', 'X', 'Y', 'Z']);
  await expect(chips.nth(0)).toHaveAccessibleName('R, the recommended plane: Valve axis');
  await expect(chips.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(viewer.getByText('R is the plane recommended for this step: Valve axis.')).toBeVisible();
  await expect(viewer.getByText('R plane · 50%')).toBeVisible();

  const canvas = viewer.locator('canvas');
  const whole = await canvas.screenshot();
  await cut.click();
  await expect(cut).toHaveAttribute('aria-checked', 'true');
  await expect(tab).toContainText('On · R plane');
  await expect.poll(async () => (await canvas.screenshot()).equals(whole), { message: 'switching it on should cut the model' }).toBe(false);

  const slider = viewer.getByRole('slider', { name: 'Plane position' });
  await expect(slider).toHaveValue('50');

  // Choosing a standard plane starts the slider in the middle again; the slider then moves the cut.
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(chips.nth(0)).toHaveAttribute('aria-checked', 'false');
  await expect(tab).toContainText('On · X plane');
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  await expect(viewer.getByText('X plane · 100%')).toBeVisible();

  // The recommended plane can be chosen again.
  await chips.nth(0).click();
  await expect(chips.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(slider).toHaveValue('50');

  // Choosing a plane while the cut is off switches it on: the learner wants to see it.
  await cut.click();
  await expect(cut).toHaveAttribute('aria-checked', 'false');
  await chips.nth(3).click();
  await expect(cut).toHaveAttribute('aria-checked', 'true');
  await expect(tab).toContainText('On · Z plane');

  // Step 4 names no plane: the cut starts off again and only the three standard planes are offered. Step 3 is text, so the viewer rests.
  await page.getByRole('button', { name: /Next Step/ }).click();
  await page.getByRole('button', { name: /Next Step/ }).click();
  await expect(viewer.getByRole('status')).toHaveCount(0);
  await expect(cut).toHaveAttribute('aria-checked', 'false');
  await expect(chips).toHaveText(['X', 'Y', 'Z']);
  await expect(chips.nth(2)).toHaveAttribute('aria-checked', 'true');
  await expect(viewer.getByText(/recommended for this step/)).toHaveCount(0);
  problems.assertNone();
});
