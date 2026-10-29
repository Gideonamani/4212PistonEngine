import fs from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { appReady, expect } from './fixtures';

/** A lesson step whose media is the live operating cylinder (with controls, hotspots and a motion player). */
export const MODEL_STEP = '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1';

/** A lesson step that spotlights one part of the cylinder (the crank throw), so the focus-mode switch has something to switch. */
export const SPOTLIGHT_STEP = '#/learn/fundamentals-and-classification/parts-construction/step/5';

/** A lesson step that spotlights a part and recommends a section plane ("Valve axis"), so the Section tab offers the R chip. */
export const SECTION_STEP = '#/learn/valve-train-and-power/valve-operating/step/2';

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

/** The operating cylinder's parts in the order its viewer lists them (by name), so a test can step to a part it knows while the page never lists names. */
export const cylinderParts = (JSON.parse(fs.readFileSync('web/components.json', 'utf8')).parts as { display_name?: string; cad_stable_id: string }[])
  .map((part) => part.display_name || part.cad_stable_id)
  .sort((left, right) => left.localeCompare(right));

/**
 * Choose one of the operating cylinder's parts in a part question by stepping to it: the keyboard route, which is also how a test reaches a
 * known part without a list of names (a part question offers none). Waits for the model to load, since stepping works once its parts are known.
 * Every step redraws the model, which takes seconds on a CI runner, so it steps the shorter way round the sequence (it wraps at both ends)
 * and waits for each step to show before taking the next. Assumes no part is hidden, which is when the sequence is the whole list.
 */
export async function stepToCylinderPart(page: Page, name: string) {
  const position = cylinderParts.indexOf(name) + 1;
  expect(position, `${name} is one of the cylinder's parts`).toBeGreaterThan(0);
  const next = page.getByRole('button', { name: 'Next', exact: true });
  if (!(await next.isVisible())) await page.getByText('Cannot tap the model? Step through the parts').click();
  await expect(next).toBeEnabled({ timeout: 60_000 });
  const where = page.getByText(/^(Part \d+ of \d+|\d+ parts)$/);
  const placeNow = async () => {
    const shown = (await where.textContent()) ?? '';
    const part = /^Part (\d+) of (\d+)$/.exec(shown);
    return { shown, current: part ? Number(part[1]) : 0, total: Number(part ? part[2] : /^(\d+)/.exec(shown)![1]) };
  };
  const { current, total } = await placeNow();
  // With nothing chosen, Next goes to the first part and Previous to the last.
  const forward = current ? (position - current + total) % total : position;
  const backward = current ? (current - position + total) % total : total - position + 1;
  const button = page.getByRole('button', { name: forward <= backward ? 'Next' : 'Previous', exact: true });
  for (let steps = Math.min(forward, backward); steps > 0; steps -= 1) {
    const before = (await placeNow()).shown;
    await button.click();
    await expect(where).not.toHaveText(before);
  }
  await expect(where).toHaveText(new RegExp(`^Part ${position} of`));
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
