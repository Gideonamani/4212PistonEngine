import { appReady, expect, onlyIn, test } from './fixtures';
import { MODEL_STEP, openViewerStep } from './viewer-helpers';

// The Motion tab: one card with a reading, a scrubber, and Reset / Play / Loop / Speed, a Details row, and a pager when the model has more
// than one motion. Each test loads a model (16 to 35 MB), so they run once, one after the other.

onlyIn('phone-390');
test.describe.configure({ mode: 'serial' });

// A lesson step whose model lets the learner move it (the accessory drives set `lessonControls`): the player opens by itself.
const PLAYER_STEP = '#/learn/valve-train-and-power/accessories-and-drives/step/4';

test('Explore: the crank card reads the angle and the stroke, and plays, loops and slows down on request', async ({ page, problems }) => {
  test.setTimeout(240_000);
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-cylinder"]').click();
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const panel = page.getByRole('complementary', { name: 'Explore controls' });

  await panel.getByRole('tab', { name: /^Motion/ }).click({ timeout: 30_000 });
  await expect(panel.getByText('CRANK ANGLE')).toBeVisible();
  const crank = panel.getByRole('slider', { name: 'Crank angle' });
  // The track is named for the four strokes, and the one the crank is in is the card's headline.
  await expect(panel.getByText('Compression', { exact: true })).toBeVisible();
  await crank.fill('100');
  await expect(panel.getByText('Intake stroke', { exact: true })).toBeVisible();
  await expect(panel.getByRole('tab', { name: /^Motion, 100° · paused/ })).toBeVisible();
  await crank.fill('400');
  await expect(panel.getByText('Power stroke', { exact: true })).toBeVisible();
  await expect(panel.getByRole('tab', { name: /^Motion, 400° · paused/ })).toBeVisible();

  // Play runs the crank on from here; Pause stops it.
  const before = Number(await crank.inputValue());
  await panel.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(panel.getByRole('tab', { name: /playing/ })).toBeVisible();
  await expect.poll(async () => Number(await crank.inputValue()), { message: 'the crank should turn while playing' }).not.toBe(before);
  await panel.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(panel.getByRole('tab', { name: /paused/ })).toBeVisible();

  // Speed opens a row of choices and keeps the one picked.
  await panel.getByRole('button', { name: 'Speed 1×' }).click();
  const speeds = panel.getByRole('radiogroup', { name: 'Playback speed' });
  await expect(speeds.getByRole('radio')).toHaveText(['0.25×', '0.5×', '1×', '2×']);
  await speeds.getByRole('radio', { name: '2×' }).click();
  await expect(speeds).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Speed 2×' })).toBeVisible();

  // The crank loops by default. With Loop off it stops at the end of its turn, and the button then offers Replay.
  const loop = panel.getByRole('switch', { name: 'Loop' });
  await expect(loop).toHaveAttribute('aria-checked', 'true');
  await loop.click();
  await expect(loop).toHaveAttribute('aria-checked', 'false');
  await crank.fill('715');
  await panel.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Replay' })).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByRole('tab', { name: /paused/ })).toBeVisible();
  // Replay starts from the top.
  await panel.getByRole('button', { name: 'Replay' }).click();
  await expect.poll(async () => Number(await crank.inputValue()), { message: 'replay should start again from the top' }).toBeLessThan(200);
  await panel.getByRole('button', { name: 'Pause', exact: true }).click();

  // Reset puts the crank back at its start.
  await panel.getByRole('button', { name: 'Reset motion to the start' }).click();
  await expect(panel.getByRole('tab', { name: /paused/ })).toBeVisible();

  // The model has three motions; the pager walks them, and a saved motion is read in per cent, with its stages.
  await expect(panel.getByText('Animation 1 of 3')).toBeVisible();
  await panel.getByRole('button', { name: 'Next animation' }).click();
  await expect(panel.getByText('Animation 2 of 3')).toBeVisible();
  await expect(panel.getByRole('slider', { name: 'Motion progress' })).toBeVisible();
  await expect(panel.getByRole('slider', { name: 'Crank angle' })).toHaveCount(0);
  await expect(panel.getByRole('switch', { name: 'Loop' })).toHaveAttribute('aria-checked', 'false');
  await panel.getByRole('slider', { name: 'Motion progress' }).fill('50');
  await expect(panel.getByRole('tab', { name: /^Motion, 50%/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Previous animation' }).click();
  await expect(panel.getByRole('slider', { name: 'Crank angle' })).toBeVisible();
  problems.assertNone();
});

test('a lesson on a model that holds one pose reports it, in place of the POSE tag', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, MODEL_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const tab = viewer.getByRole('tab', { name: /^Motion/ });
  await expect(tab).toContainText('· pose');
  await expect(viewer.getByText(/^POSE \d/)).toHaveCount(0);
  await expect(viewer.getByRole('slider')).toHaveCount(0);
  await tab.click();
  await expect(viewer.getByText('CRANK POSE')).toBeVisible();
  await expect(viewer.getByText('This step holds one pose, so there is nothing to play.')).toBeVisible();
  // Nothing to scrub or play; the numbers sit behind Details, in full.
  await expect(viewer.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  const details = viewer.getByRole('button', { name: 'Details' });
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await details.click();
  await expect(viewer.getByText(/piston pin .* mm from crank axis/)).toBeVisible();
  problems.assertNone();
});

test('a lesson on a model the learner may move opens with the player ready', async ({ page, problems }) => {
  test.setTimeout(240_000);
  const { viewer } = await openViewerStep(page, PLAYER_STEP, { loadModel: true });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const tab = viewer.getByRole('tab', { name: /^Motion/ });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(tab).toHaveAccessibleName(/paused/);
  await expect(viewer.getByRole('slider', { name: 'Motion progress' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(viewer.getByText(/Animation 1 of \d+/)).toBeVisible();
  // A tap on the open tab closes the card.
  await tab.click();
  await expect(viewer.getByRole('slider', { name: 'Motion progress' })).toHaveCount(0);
  problems.assertNone();
});
