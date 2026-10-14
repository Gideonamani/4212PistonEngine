import fs from 'node:fs';
import { appReady, expect, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';

// The Explore gallery: image-first tiles, the capability icons under each, the legend in the info sheet, and the model's name and
// description in the viewer's controls panel (not over the model, so full screen shows the model alone).

type Capability = { kind: string; note: string };
type Model = { id: string; label: string; shortLabel: string; summary: string; capabilities: Capability[] };
const models: Model[] = JSON.parse(fs.readFileSync('src/data/models.json', 'utf8'));
/** A gallery tile is a button whose accessible name is the short label; the capabilities description hangs off it by id. */
const tile = (page: import('@playwright/test').Page, model: Model) => page.locator(`button[aria-describedby="capabilities-${model.id}"]`);

test.describe('Explore gallery', () => {
  test('names itself, says what to do, and offers one image tile per model', async ({ page, problems }) => {
    await page.goto('/#/explore');
    await appReady(page);
    await expect(page.getByRole('heading', { level: 1, name: '3D studies' })).toBeVisible();
    await expect(page.getByText('Select a model to explore it immersively in the 3D viewer.')).toBeVisible();
    // The gallery names itself, so the header's model picker only appears once a model is open.
    await expect(page.getByRole('button', { name: 'Select 3D Engine Model' })).toHaveCount(0);
    for (const model of models) {
      await expect(tile(page, model), `${model.id} has a tile`).toBeVisible();
      await expect(page.getByRole('button', { name: model.shortLabel, exact: true }), `${model.id} is named by its short label`).toBeVisible();
      await expect(page.getByText(model.summary), 'the description waits in the viewer').toHaveCount(0);
    }
    for (const gone of ['OPERATING-CYCLE STUDY', 'HISTORICAL RECONSTRUCTION', 'Real production models', 'Animated valve gear']) {
      await expect(page.getByText(gone, { exact: false }).filter({ visible: true }), `"${gone}" no longer competes with the pictures`).toHaveCount(0);
    }
    await expectNoHorizontalOverflow(page);
    problems.assertNone();
  });

  test('lays the tiles out in as many columns as fit: two on a phone, one only on the narrowest', async ({ page }, testInfo) => {
    await page.goto('/#/explore');
    await appReady(page);
    const boxes = await page.locator('button[aria-describedby^="capabilities-"]').evaluateAll((nodes) => nodes.map((node) => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; }));
    expect(boxes).toHaveLength(models.length);
    const columns = new Set(boxes.map((box) => Math.round(box.x))).size;
    const width = testInfo.project.use.viewport!.width;
    if (width < 344) expect(columns, `${width} px: a single column`).toBe(1);
    else expect(columns, `${width} px: at least two columns`).toBeGreaterThanOrEqual(2);
    for (const box of boxes) expect(box.height, 'a tile is taller than wide (square picture, then title and icons)').toBeGreaterThan(box.width);
    const pictures = await page.locator('button[aria-describedby^="capabilities-"] img').evaluateAll((nodes) => nodes.map((node) => { const { width: w, height: h } = node.getBoundingClientRect(); return [Math.round(w), Math.round(h)]; }));
    for (const [w, h] of pictures) expect(Math.abs(w - h), 'the picture is square').toBeLessThanOrEqual(1);
  });

  test('shows the icons each model has, in the fixed order, and says what they mean to a screen reader', async ({ page }) => {
    await page.goto('/#/explore');
    await appReady(page);
    for (const model of models) {
      const button = tile(page, model);
      const kinds = await button.locator('[data-capability]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-capability')));
      expect(kinds, model.id).toEqual(model.capabilities.map((item) => item.kind));
      const described = await button.getAttribute('aria-describedby');
      const text = await page.locator(`#${described}`).textContent();
      for (const { note } of model.capabilities) expect(text, `${model.id}: the description names "${note}"`).toContain(note);
    }
  });

  // Tailwind's hover variants apply only where the device can hover: a touch phone sees no tooltip (the info sheet has the legend).
  test.describe('with a mouse', () => {
    test.use({ hasTouch: false, isMobile: false });

    test('a hover on an icon says what the model has, in words', async ({ page }) => {
      await page.goto('/#/explore');
      await appReady(page);
      const cylinder = models.find((model) => model.id === 'cylinder')!;
      const icon = tile(page, cylinder).locator('[data-capability="section"]');
      const tooltip = icon.locator('> span');
      await expect(tooltip).toBeHidden();
      await icon.hover();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveText(cylinder.capabilities.find((item) => item.kind === 'section')!.note);
      // The tooltip stays inside its tile (and so inside the screen).
      const [tip, card] = await Promise.all([tooltip.boundingBox(), tile(page, cylinder).boundingBox()]);
      expect(tip!.x).toBeGreaterThanOrEqual(card!.x);
      expect(tip!.x + tip!.width).toBeLessThanOrEqual(card!.x + card!.width + 1);
    });
  });

  test('on a touch screen the icons stay quiet (no hover, no tooltip)', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'needs a touch screen');
    await page.goto('/#/explore');
    await appReady(page);
    const cylinder = models.find((model) => model.id === 'cylinder')!;
    const icon = tile(page, cylinder).locator('[data-capability="section"]');
    await icon.hover();
    await expect(icon.locator('> span')).toBeHidden();
  });

  test.describe('on a phone-sized screen', () => {
    onlyIn('phone-390', 'tablet-768');

    test('the info sheet explains the five icons', async ({ page }) => {
      await page.goto('/#/explore');
      await appReady(page);
      await page.getByRole('button', { name: 'About Course & Model' }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('heading', { name: 'What the icons mean' })).toBeVisible();
      for (const name of ['Animated', 'Exploded view', 'Section view', 'Named parts', 'Guided tour']) await expect(sheet.getByText(name, { exact: true })).toBeVisible();
      await expect(sheet.getByText('Evidence boundary')).toBeVisible();
    });

    test('a model opens with its name and description in the controls panel, not over the model', async ({ page, problems }) => {
      test.setTimeout(180_000);
      const model = models.find((item) => item.id === 'hydraulic-tappet')!;
      await page.goto('/#/explore');
      await appReady(page);
      await tile(page, model).click();
      const panel = page.getByRole('complementary', { name: 'Explore controls' });
      await expect(panel).toBeVisible({ timeout: 150_000 });
      await expect(panel.getByRole('heading', { name: model.shortLabel })).toBeVisible();
      await expect(panel.getByText(model.summary)).toBeVisible();
      // How to move the model is in the panel too, and nothing is written over the picture, so the model has the whole screen when the panel closes.
      await expect(panel.getByText(/Drag to rotate/)).toBeVisible();
      await expect(page.getByText(/Drag to rotate/)).toHaveCount(1);
      await expect(page.getByText('INTERNAL-MECHANISM STUDY')).toHaveCount(0);

      // The description folds away under the name, to leave the room to the controls, and unfolds again.
      const about = panel.getByRole('button', { name: model.shortLabel, exact: true });
      await expect(about).toHaveAttribute('aria-expanded', 'true');
      await about.click();
      await expect(about).toHaveAttribute('aria-expanded', 'false');
      await expect(panel.getByText(model.summary)).toHaveCount(0);
      await expect(panel.getByText(/Drag to rotate/)).toHaveCount(0);
      await expect(panel.getByRole('tablist')).toBeVisible();
      await about.click();
      await expect(panel.getByText(model.summary)).toBeVisible();

      // The whole panel scrolls, so the last control of a tab can be reached, and the tabs are pinned to its top while it does. (How far it
      // scrolls depends on the screen, so the pinning is read from the style rather than from where the tabs end up.)
      expect(await panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
      expect(await panel.getByRole('tablist').evaluate((element) => getComputedStyle(element.parentElement!).position), 'the tabs are pinned').toBe('sticky');
      const scrolls = await panel.evaluate((element) => { element.scrollTop = element.scrollHeight; return element.scrollHeight > element.clientHeight; });
      expect(scrolls, 'the panel has more in it than fits, so it scrolls').toBe(true);
      await expect(panel.getByRole('button', { name: 'Show all' }), 'the last control of the Parts tab can be reached').toBeInViewport();
      await page.getByRole('button', { name: 'Hide Explore controls' }).first().click();
      await expect(page.getByText(model.summary)).toHaveCount(0);
      await expect(page.getByRole('heading', { name: model.shortLabel })).toHaveCount(0);
      // The header's picker names the model the same short way, once a model is open.
      await expect(page.getByRole('button', { name: 'Select 3D Engine Model' })).toContainText(model.shortLabel);
      problems.assertNone();
    });
  });
});
