import type { Page } from '@playwright/test';
import { appReady, expect, test } from './fixtures';

// The lesson viewer must never swallow the screen: a finger that lands on it cannot scroll the lesson (the canvas keeps touch-none),
// so the lesson text above and below it has to stay reachable. Rule agreed 4 Oct 2026: at most 75% of the lesson's scroll area.

const MODEL_STEP = '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1';

/** The viewer's canvas frame and the scrolling area it sits in, as heights. Measured as soon as the viewer mounts; the model need not have loaded. */
async function viewerShare(page: Page) {
  await page.goto(`/${MODEL_STEP}`);
  await appReady(page);
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  return page.getByRole('application').evaluate((canvasHost) => {
    const frame = canvasHost.parentElement!;
    let scroller: HTMLElement | null = frame.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const viewer = frame.getBoundingClientRect().height;
    const area = (scroller ?? document.documentElement).clientHeight;
    return { viewer, area, share: viewer / area };
  });
}

test('portrait: the lesson viewer leaves room above and below it to scroll', async ({ page }) => {
  const { viewer, area, share } = await viewerShare(page);
  expect(share, `viewer is ${Math.round(viewer)} px of a ${area} px scroll area`).toBeLessThanOrEqual(0.75);
});

test.describe('landscape phone', () => {
  test.use({ viewport: { width: 780, height: 360 }, isMobile: true, hasTouch: true });

  // Phase 3 (lesson layout) makes this pass: today the canvas keeps a fixed 19rem height whatever the screen height.
  test.fixme('the lesson viewer is at most 75% of the scroll area', async ({ page }) => {
    const { viewer, area, share } = await viewerShare(page);
    expect(share, `viewer is ${Math.round(viewer)} px of a ${area} px scroll area`).toBeLessThanOrEqual(0.75);
  });
});
