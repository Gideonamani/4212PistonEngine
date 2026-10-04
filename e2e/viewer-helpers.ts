import type { Locator, Page } from '@playwright/test';
import { appReady, expect } from './fixtures';

/** A lesson step whose media is the live operating cylinder (with controls, hotspots and a motion player). */
export const MODEL_STEP = '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1';

/** A lesson step that spotlights one part of the cylinder (the crank throw), so the focus-mode switch has something to switch. */
export const SPOTLIGHT_STEP = '#/learn/fundamentals-and-classification/parts-construction/step/4';

/**
 * Open a lesson step that has a 3D viewer and wait for the viewer to mount. The model need not have loaded: the toolbar, the hint and
 * the layout are all there as soon as the canvas host exists, so these checks stay fast.
 */
export async function openViewerStep(page: Page, hash = MODEL_STEP) {
  await page.goto(`/${hash}`);
  await appReady(page);
  const canvasHost = page.getByRole('application');
  await expect(canvasHost).toBeVisible({ timeout: 60_000 });
  return { canvasHost, viewer: page.getByRole('region', { name: /Interactive 3D model of/ }) };
}

/** The nearest scrolling ancestor of an element: the lesson's scroll area. */
export function scrollAreaOf(element: Locator) {
  return element.evaluateHandle((node) => {
    let scroller: HTMLElement | null = node.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    return scroller ?? document.documentElement;
  });
}

/** Centre of an element, in page coordinates, for aiming the mouse. */
export async function centreOf(element: Locator) {
  const box = (await element.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
