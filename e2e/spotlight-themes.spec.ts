import type { Locator, Page } from '@playwright/test';
import { expect, onlyIn, test } from './fixtures';
import { SECTION_STEP, openViewerStep } from './viewer-helpers';

// The spotlight on each theme's stage. The X-ray ghost used to be one pale colour, which on the light stage was 1.07:1 and all but invisible,
// so the check is how much of the model's picture lies away from the stage's own colour: an X-ray draws the whole model faintly, an Isolate
// only the spotlit parts. Highlight would hide a spotlit part that sits inside another (these valves are inside the head), so there it is drawn
// as an X-ray and says so. The colours themselves are pinned by scripts/test_focus_style.mjs, and what each mode does to the real models by
// scripts/test_focus_modes.mjs. Each test downloads the cylinder, so they run once, one after the other.
// Valve Operating step 2 spotlights six parts inside the head. A cross section through them shows them on the cut face, so with the step's
// plane through the valves Highlight is drawn as Highlight again, and moving the plane off them brings the X-ray back.

onlyIn('phone-390');
// Each test takes 2.5 to 4 minutes on a CI runner (a 12 MB model, then the stage is read pixel by pixel), so there is margin (PR 118).
test.describe.configure({ mode: 'serial', timeout: 360_000 });

test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

// The stage colours (STAGE_COLOR in src/theme/theme.mjs).
const STAGE = { dark: [0x07, 0x14, 0x18], light: [0xd5, 0xdf, 0xe3] };
// A picture lying more than this fraction away from the stage colour is mostly model; the old light ghost left the X-ray at 0.14, the same as
// Isolate, and the dark one (and the new light one) are at about 0.75.
const GHOST_SHOWN = 0.45;
const MODEL_ONLY = 0.3;
// Highlight draws the parts around the spotlight an opaque pale grey, which an X-ray never does (its ghost is tinted): with the head cut open
// about half of the picture is that grey, against under 0.01 for an X-ray (and for Highlight drawn as one).
const PALE_SHOWN = 0.25;
const NO_PALE = 0.1;
const WAIT = 120_000;

/**
 * Below the toolbar: the fraction of the canvas whose colour is clearly not the stage's (`away`), and the fraction that is a light neutral grey
 * other than the stage (`pale`, the opaque grey Highlight turns the other parts; the ghost is tinted and see-through).
 */
async function picture(page: Page, canvas: Locator, stage: number[]) {
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
    let away = 0, pale = 0;
    for (let index = 0; index < data.length; index += 4) {
      const [red, green, blue] = [data[index], data[index + 1], data[index + 2]];
      const fromStage = Math.max(Math.abs(red - stage[0]), Math.abs(green - stage[1]), Math.abs(blue - stage[2]));
      if (fromStage > 20) away += 1;
      // The stage is one flat colour, but on the light theme the lit pale grey comes within 20 of it, so only the stage itself is left out.
      if (fromStage > 3 && Math.min(red, green, blue) > 120 && Math.max(red, green, blue) - Math.min(red, green, blue) < 12) pale += 1;
    }
    return { away: away / (data.length / 4), pale: pale / (data.length / 4) };
  }, { png, stage });
}

const coverage = async (page: Page, canvas: Locator, stage: number[]) => (await picture(page, canvas, stage)).away;
const paleShare = async (page: Page, canvas: Locator, stage: number[]) => (await picture(page, canvas, stage)).pale;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test(`the X-ray ghost shows on the ${scheme} stage, and Highlight says when it is drawn as X-ray and when a cut lifts it`, async ({ page, problems }) => {
      test.setTimeout(360_000);
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
      expect(await paleShare(page, canvas, STAGE[scheme]), 'an X-ray has no opaque pale parts').toBeLessThan(NO_PALE);

      // The step's plane (Valve axis, 50%) cuts through every spotlit part, so the cut shows them and Highlight is drawn as Highlight.
      const sectionTab = viewer.getByRole('tab', { name: /^Section/ });
      const slider = viewer.getByRole('slider', { name: 'Plane position' });
      await sectionTab.click();
      await viewer.getByRole('switch', { name: 'Cross section' }).click();
      await expect(sectionTab).toContainText('On · R plane');
      await expect.poll(() => paleShare(page, canvas, STAGE[scheme]), { message: 'a cut through the valves lets Highlight draw the head pale', timeout: WAIT }).toBeGreaterThan(PALE_SHOWN);
      await tab.click();
      await expect(note).toHaveCount(0);
      // Moved off the valves, the plane leaves them inside the head: X-ray again, and the note is back.
      await sectionTab.click();
      await slider.fill('85');
      await expect.poll(() => paleShare(page, canvas, STAGE[scheme]), { message: 'a plane off the valves brings the X-ray back', timeout: WAIT }).toBeLessThan(NO_PALE);
      await tab.click();
      await expect(note).toBeVisible();
      // And back through them; turning the cut off then hides them again.
      await sectionTab.click();
      await slider.fill('50');
      await expect.poll(() => paleShare(page, canvas, STAGE[scheme]), { timeout: WAIT }).toBeGreaterThan(PALE_SHOWN);
      await viewer.getByRole('switch', { name: 'Cross section' }).click();
      await expect.poll(() => paleShare(page, canvas, STAGE[scheme]), { message: 'with the cut off the valves are inside the head again', timeout: WAIT }).toBeLessThan(NO_PALE);
      await tab.click();
      await expect(note).toBeVisible();
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
