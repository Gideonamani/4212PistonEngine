import type { Locator, Page } from '@playwright/test';
import { appReady, expect } from './fixtures';

/** A lesson step whose media is the live operating cylinder (with controls, hotspots and a motion player). */
export const MODEL_STEP = '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1';

/** A lesson step that spotlights one part of the cylinder (the crank throw), so the focus-mode switch has something to switch. */
export const SPOTLIGHT_STEP = '#/learn/fundamentals-and-classification/parts-construction/step/4';

/** The model downloads: 16 to 35 MB each, and the page also starts them in the background (preload). */
export const MODEL_FILES = /\.glb(\.gz)?(\?.*)?$/;

/**
 * Open a lesson step that has a 3D viewer and wait for the viewer to mount. The toolbar, the hint and the layout are all there as soon
 * as the canvas host exists, so by default the model downloads are refused: most checks never look at the model, and every download is
 * tens of megabytes of transfer and decoding that slows the tests that really do need a model (on CI it made them time out). Pass
 * `{ loadModel: true }` to let the model load, for a check that needs the loaded scene.
 */
export async function openViewerStep(page: Page, hash = MODEL_STEP, { loadModel = false } = {}) {
  if (!loadModel) await page.route(MODEL_FILES, (route) => route.abort());
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
