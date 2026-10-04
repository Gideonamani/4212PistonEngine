import { expect, test } from './fixtures';
import { centreOf, openViewerStep, scrollAreaOf } from './viewer-helpers';

// What a learner can do to the 3D viewer inside a lesson, apart from where it sits (layout.spec.ts) and how a spotlight is drawn
// (focus-switch.spec.ts). None of these wait for the model to download: the controls exist as soon as the viewer mounts.

test('the lesson viewer has a pan toggle, and the hint follows it', async ({ page }) => {
  const { viewer } = await openViewerStep(page);
  const pan = viewer.getByRole('button', { name: 'Pan model' });
  await expect(pan).toHaveAttribute('aria-pressed', 'false');
  await expect(viewer.getByText(/Drag to rotate/)).toBeVisible();

  await pan.click();
  await expect(viewer.getByRole('button', { name: 'Return to rotate mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer.getByText(/Drag to pan/)).toBeVisible();
  await expect(viewer.getByText(/Drag to rotate/)).toHaveCount(0);

  await viewer.getByRole('button', { name: 'Return to rotate mode' }).click();
  await expect(viewer.getByRole('button', { name: 'Pan model' })).toHaveAttribute('aria-pressed', 'false');
  await expect(viewer.getByText(/Drag to rotate/)).toBeVisible();
});

test('every tool on the viewer sits inside the canvas, even on the narrowest phone', async ({ page }) => {
  const { canvasHost, viewer } = await openViewerStep(page);
  const frame = (await canvasHost.boundingBox())!;
  for (const name of ['Pan model', 'Reset and centre 3D view', 'Explore']) {
    const box = (await viewer.getByRole('button', { name }).boundingBox())!;
    expect(box.x, `${name} starts left of the canvas`).toBeGreaterThanOrEqual(frame.x - 1);
    expect(box.x + box.width, `${name} ends right of the canvas`).toBeLessThanOrEqual(frame.x + frame.width + 1);
  }
});

test.describe('mouse wheel', () => {
  // A phone has no wheel; this is for the learner on a laptop or desktop, so run once at a tablet width with a mouse.
  test.use({ hasTouch: false, isMobile: false });

  test('turning the wheel over the viewer scrolls the lesson, and says how to zoom', async ({ page }) => {
    const { canvasHost, viewer } = await openViewerStep(page);
    const scroller = await scrollAreaOf(canvasHost);
    const before = await scroller.evaluate((node: HTMLElement) => node.scrollTop);
    const { x, y } = await centreOf(canvasHost);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 240);
    await expect.poll(() => scroller.evaluate((node: HTMLElement) => node.scrollTop), { message: 'the lesson should scroll under a wheel turn over the viewer' }).toBeGreaterThan(before);
    await expect(viewer.getByText('Hold Ctrl (⌘ on Mac) and scroll to zoom')).toBeVisible();
    // The hint is a courtesy that goes away by itself.
    await expect(viewer.getByText('Hold Ctrl (⌘ on Mac) and scroll to zoom')).toHaveCount(0, { timeout: 5_000 });
  });

  test('with Ctrl held the wheel is left to the viewer, so the lesson does not scroll', async ({ page }) => {
    const { canvasHost, viewer } = await openViewerStep(page);
    const scroller = await scrollAreaOf(canvasHost);
    const { x, y } = await centreOf(canvasHost);
    await page.mouse.move(x, y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 240);
    await page.keyboard.up('Control');
    await page.waitForTimeout(400);
    expect(await scroller.evaluate((node: HTMLElement) => node.scrollTop)).toBe(0);
    await expect(viewer.getByText('Hold Ctrl (⌘ on Mac) and scroll to zoom')).toHaveCount(0);
  });
});
