import type { Locator, Page } from '@playwright/test';
import { appReady, expect, onlyIn, test } from './fixtures';

// How a model's finish reads on each stage. The lighting used to be about twice as bright as a surface's colour asks for, so the oil pump (pale pastel
// plastics in its file) came out nearly white and, on the light stage, vanished into its background; the cylinder, the R10 and the rest were washed
// out the same way. This opens the oil pump (the smallest model, 4.7 MB) in Explore and reads the picture: how much of the model is near-white, and how
// colourful it is. The lighting numbers are pinned by scripts/test_lighting.mjs and the colours by scripts/test_inspection_colours.mjs.

onlyIn('phone-390');
test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

// The stage colours (STAGE_COLOR in src/theme/theme.mjs).
const STAGE = { dark: [0x07, 0x14, 0x18], light: [0xd5, 0xdf, 0xe3] };

/**
 * The model's pixels in the canvas (those clearly not the stage's colour): the share that is near-white (above 0.92 luminance), the share that is
 * bright (above 0.8) and how colourful they are on average (the spread between the strongest and weakest channel, 0 to 1).
 */
async function finish(page: Page, canvas: Locator, stage: number[]) {
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
    const { data } = context.getImageData(0, 0, surface.width, surface.height);
    let model = 0, white = 0, bright = 0, chroma = 0;
    for (let index = 0; index < data.length; index += 4) {
      const [red, green, blue] = [data[index], data[index + 1], data[index + 2]];
      if (Math.abs(red - stage[0]) + Math.abs(green - stage[1]) + Math.abs(blue - stage[2]) < 24) continue;
      model += 1;
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      if (luminance > 0.92) white += 1;
      if (luminance > 0.8) bright += 1;
      chroma += (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
    }
    return { model: model / (data.length / 4), white: white / Math.max(model, 1), bright: bright / Math.max(model, 1), chroma: chroma / Math.max(model, 1) };
  }, { png, stage });
}

test('the oil pump is not washed out on either stage, and the Look tab switches to the file\'s own colours', async ({ page, problems }) => {
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-oil-pump"]').click();
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const canvas = viewer.locator('canvas');
  const theme = (value: 'dark' | 'light') => page.evaluate((next) => { document.documentElement.dataset.theme = next; }, value);

  // Inspection colours, the opening look: no white wash, and plainly coloured, on the dark stage and on the light one. Every picture below waits
  // up to 90 s: a CI runner draws in software and shares its processor with the other worker's model tests, and a stage change redraws the model
  // (on a busy runner the 30 s this first allowed ran out with the pump still being drawn, though it loaded in 7 s and the test passes unloaded).
  const seen = {} as Record<'dark' | 'light', Awaited<ReturnType<typeof finish>>>;
  for (const stage of ['dark', 'light'] as const) {
    await theme(stage);
    await expect.poll(async () => (seen[stage] = await finish(page, canvas, STAGE[stage])).model, { message: `the pump shows on the ${stage} stage`, timeout: 90_000 }).toBeGreaterThan(0.05);
    expect(seen[stage].white, `${stage}: near-white share of the pump`).toBeLessThan(0.1);
    expect(seen[stage].bright, `${stage}: bright share of the pump`).toBeLessThan(0.35);
    expect(seen[stage].chroma, `${stage}: colourfulness of the pump`).toBeGreaterThan(0.25);
  }

  // Look > Colour treatment > Original CAD colours: the file's own pastels, which are far less colourful than the inspection colours.
  await theme('dark');
  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  await panel.getByRole('tab', { name: 'Look' }).click();
  const treatment = panel.getByLabel('Colour treatment');
  await expect(treatment).toHaveValue('inspection');
  await treatment.selectOption('cad');
  await expect(treatment).toHaveValue('cad');
  await expect.poll(async () => (await finish(page, canvas, STAGE.dark)).chroma, { message: 'the file\'s own colours are paler than the inspection colours', timeout: 90_000 }).toBeLessThan(seen.dark.chroma - 0.15);
  await treatment.selectOption('inspection');
  await expect.poll(async () => (await finish(page, canvas, STAGE.dark)).chroma, { message: 'and back again', timeout: 90_000 }).toBeGreaterThan(0.25);
  problems.assertNone();
});
