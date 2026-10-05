import type { Locator, Page } from '@playwright/test';
import { expect, onlyIn, test } from './fixtures';
import { MODEL_STEP, openViewerStep, scrollAreaOf } from './viewer-helpers';

// Where the lesson puts its 3D viewer. The canvas keeps touch-none (a drag rotates the model), so a finger that lands on it cannot scroll
// the lesson; the layout has to leave somewhere else to scroll from. Rules agreed 4 Oct 2026:
//   stacked  the viewer is at most 75% of the lesson's scroll area, so lesson text is always within reach above or below it
//   side     (landscape) the viewer has its own column and the text scrolls beside it; students choose, the default follows orientation
// None of these wait for the model to download: the layout exists as soon as the viewer mounts.

const LAYOUT_BUTTON = 'Side-by-side layout';
const STORAGE_KEY = '4212-lesson-layout';

/** The viewer's canvas frame against the scrolling area it sits in. */
async function viewerShare(page: Page) {
  const { canvasHost } = await openViewerStep(page);
  return measure(page, canvasHost);
}

function measure(_page: Page, canvasHost: Locator) {
  return canvasHost.evaluate((host) => {
    const frame = host.parentElement!;
    let scroller: HTMLElement | null = frame.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const viewer = frame.getBoundingClientRect().height;
    const area = (scroller ?? document.documentElement).clientHeight;
    return { viewer, area, share: viewer / area };
  });
}

// A hair over 0.75 is sub-pixel rounding, not a breach.
const MAX_SHARE = 0.751;

test('portrait: the lesson viewer leaves room above and below it to scroll', async ({ page }) => {
  const { viewer, area, share } = await viewerShare(page);
  expect(share, `viewer is ${Math.round(viewer)} px of a ${area} px scroll area`).toBeLessThanOrEqual(MAX_SHARE);
});

test('portrait: there is no side-by-side choice to make', async ({ page }) => {
  await openViewerStep(page);
  await expect(page.getByRole('button', { name: LAYOUT_BUTTON })).toHaveCount(0);
  const { box: viewerBox } = await boxes(page);
  const heading = (await page.getByRole('heading', { level: 2 }).first().boundingBox())!;
  expect(viewerBox.y + viewerBox.height, 'the text should sit below the viewer').toBeLessThanOrEqual(heading.y + 1);
});

async function boxes(page: Page) {
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  return { viewer, box: (await viewer.boundingBox())! };
}

test.describe('landscape phone', () => {
  onlyIn('phone-390');
  test.use({ viewport: { width: 780, height: 360 }, isMobile: true, hasTouch: true });

  test('it starts side by side: the viewer has the left column and the text sits beside it', async ({ page }) => {
    await openViewerStep(page);
    const { box } = await boxes(page);
    const heading = (await page.getByRole('heading', { level: 2 }).first().boundingBox())!;
    expect(box.x + box.width, 'the text should start to the right of the viewer').toBeLessThanOrEqual(heading.x + 1);
    expect(box.width, 'the viewer should leave the text a real column').toBeLessThanOrEqual(page.viewportSize()!.width * 0.65);
    expect(heading.y, 'the heading should be on screen without scrolling').toBeLessThan(page.viewportSize()!.height);
    await expect(page.getByRole('button', { name: LAYOUT_BUTTON })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the viewer stays in view while the text scrolls beside it', async ({ page }) => {
    const { canvasHost } = await openViewerStep(page);
    const scroller = await scrollAreaOf(canvasHost);
    const { box: before } = await boxes(page);
    await scroller.evaluate((node: HTMLElement) => node.scrollTo({ top: 150 }));
    await expect.poll(() => scroller.evaluate((node: HTMLElement) => node.scrollTop), { message: 'the lesson should have something to scroll' }).toBeGreaterThan(0);
    const { box: after } = await boxes(page);
    expect(Math.abs(after.y - before.y), 'the viewer should stay put while the text scrolls').toBeLessThanOrEqual(10);
    expect(after.y + after.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  });

  test('choosing stacked puts the text under the viewer, which is then at most 75% of the scroll area', async ({ page }) => {
    const { canvasHost } = await openViewerStep(page);
    await page.getByRole('button', { name: LAYOUT_BUTTON }).click();
    await expect(page.getByRole('button', { name: LAYOUT_BUTTON })).toHaveAttribute('aria-pressed', 'false');
    const { viewer, area, share } = await measure(page, canvasHost);
    expect(share, `viewer is ${Math.round(viewer)} px of a ${area} px scroll area`).toBeLessThanOrEqual(MAX_SHARE);
    const { box } = await boxes(page);
    const heading = (await page.getByRole('heading', { level: 2 }).first().boundingBox())!;
    expect(box.y + box.height, 'the text should sit below the viewer').toBeLessThanOrEqual(heading.y + 1);
  });

  test('the choice is remembered, and a stored choice is honoured on the next visit', async ({ page }) => {
    test.setTimeout(120_000);
    await openViewerStep(page);
    await page.getByRole('button', { name: LAYOUT_BUTTON }).click();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('stacked');
    await page.reload();
    // The toggle is in the lesson's top bar, so it is there before the viewer has finished mounting.
    await expect(page.getByRole('button', { name: LAYOUT_BUTTON })).toHaveAttribute('aria-pressed', 'false', { timeout: 60_000 });
  });

  test('switching layout does not rebuild the 3D viewer', async ({ page }) => {
    await openViewerStep(page);
    await page.locator('canvas').evaluate((canvas) => { (canvas as HTMLCanvasElement & { kept?: boolean }).kept = true; });
    for (let turn = 0; turn < 2; turn++) await page.getByRole('button', { name: LAYOUT_BUTTON }).click();
    expect(await page.locator('canvas').evaluate((canvas) => Boolean((canvas as HTMLCanvasElement & { kept?: boolean }).kept)), 'the canvas was recreated').toBe(true);
    expect(await page.locator('canvas').count()).toBe(1);
  });

  test('the Back link and the step list are within reach without the bottom dock', async ({ page }) => {
    await openViewerStep(page, MODEL_STEP);
    await expect(page.getByRole('button', { name: 'Back to lessons' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Open the list of steps/ })).toBeVisible();
  });
});
