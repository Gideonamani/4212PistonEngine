import type { Locator, Page } from '@playwright/test';
import { expect, onlyIn, test } from './fixtures';
import { SECTION_STEP, openViewerStep } from './viewer-helpers';

// The spotlight on each theme's stage. The X-ray ghost used to be one pale colour, which on the light stage was 1.07:1 and all but invisible,
// so the check is how much of the model's picture lies away from the stage's own colour: an X-ray draws the whole model faintly, an Isolate
// only the spotlit parts. Highlight would hide a spotlit part that sits inside another (these valves are inside the head), so there it is drawn
// as an X-ray and says so. The colours themselves are pinned by scripts/test_focus_style.mjs, and what each mode does to the real models by
// scripts/test_focus_modes.mjs. Each test downloads the cylinder, so they run once, one after the other.
// Valve Operating step 2 spotlights six parts inside the head.

onlyIn('phone-390');
test.describe.configure({ mode: 'serial', timeout: 240_000 });

test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

// The stage colours (STAGE_COLOR in src/theme/theme.mjs).
const STAGE = { dark: [0x07, 0x14, 0x18], light: [0xd5, 0xdf, 0xe3] };
// A picture lying more than this fraction away from the stage colour is mostly model; the old light ghost left the X-ray at 0.14, the same as
// Isolate, and the dark one (and the new light one) are at about 0.75.
const GHOST_SHOWN = 0.45;
const MODEL_ONLY = 0.3;
const WAIT = 120_000;

/** The fraction of the canvas, below the toolbar, whose colour is clearly not the stage's. */
async function coverage(page: Page, canvas: Locator, stage: number[]) {
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const png = (await canvas.screenshot()).toString('base64');
  return page.evaluate(async ({ png, stage }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const surface = document.createElement('canvas');
    surface.width = image.width;
    surface.height = image.height;
    const context = surface.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const top = Math.floor(surface.height * 0.25);
    const { data } = context.getImageData(0, top, surface.width, surface.height - top);
    let away = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (Math.max(Math.abs(data[index] - stage[0]), Math.abs(data[index + 1] - stage[1]), Math.abs(data[index + 2] - stage[2])) > 20) away += 1;
    }
    return away / (data.length / 4);
  }, { png, stage });
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test(`the X-ray ghost shows on the ${scheme} stage, and Highlight says when it is drawn as X-ray`, async ({ page, problems }) => {
      test.setTimeout(240_000);
      const { viewer } = await openViewerStep(page, SECTION_STEP, { loadModel: true });
      await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(scheme);

      const tab = viewer.getByRole('tab', { name: /^Spotlight/ });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      const group = viewer.getByRole('group', { name: 'How the highlighted part is shown' });
      const canvas = viewer.locator('canvas');
      // A polite live region, not role="status": in this suite a status inside the viewer means the model is still loading.
      const note = viewer.getByText(/shown as an X-ray/);

      // The step names no mode, so it opens as an X-ray: the whole model, faintly, around the spotlit parts.
      await expect(group.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => coverage(page, canvas, STAGE[scheme]), { message: 'the X-ray ghost should show on the stage', timeout: WAIT }).toBeGreaterThan(GHOST_SHOWN);
      await expect(note).toHaveCount(0);

      // Isolate draws the spotlit parts alone, so most of the picture is the stage.
      await group.getByRole('button', { name: 'Isolate' }).click();
      await expect.poll(() => coverage(page, canvas, STAGE[scheme]), { message: 'isolated parts leave the stage showing', timeout: WAIT }).toBeLessThan(MODEL_ONLY);

      // Highlight would hide parts inside the head, so it is drawn as an X-ray and the panel says so.
      await group.getByRole('button', { name: 'Highlight' }).click();
      await expect(group.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'true');
      await expect(note).toBeVisible();
      await expect.poll(() => coverage(page, canvas, STAGE[scheme]), { message: 'Highlight on parts inside others is drawn as X-ray', timeout: WAIT }).toBeGreaterThan(GHOST_SHOWN);
      // Choosing another style takes the note away.
      await group.getByRole('button', { name: 'X-ray' }).click();
      await expect(note).toHaveCount(0);

      // A page that changes theme under the model repaints the spotlight in the new theme's colours, without the model being reloaded.
      const other = scheme === 'light' ? 'dark' : 'light';
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, other);
      await expect.poll(() => coverage(page, canvas, STAGE[other]), { message: `the ghost should be redrawn for the ${other} stage`, timeout: WAIT }).toBeGreaterThan(GHOST_SHOWN);
      problems.assertNone();
    });
  });
}
