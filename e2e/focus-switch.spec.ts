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
  const { viewer } = await openViewerStep(page, SPOTLIGHT_STEP);
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
  const { viewer } = await openViewerStep(page, SPOTLIGHT_STEP);
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const group = viewer.getByRole('group', { name: SWITCH });
  await expect(group.getByRole('button', { name: 'Isolate' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'false');
  problems.assertNone();
});
