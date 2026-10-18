import { appReady, expect, onlyIn, test } from './fixtures';

// The GTSIO-520-H whole engine names and explains its parts from web/gtsio520-r10-parts.json (data/gtsio520-part-definitions.json): a plain
// title, one sentence on what the part does, and a Details drawer that says where each line comes from. The text is a draft until the
// instructor reviews it, so the card says so; no part number reaches the learner. This opens the 25 MB model, so it runs once.

onlyIn('phone-390');
test.describe.configure({ timeout: 240_000 });

// Leave the model's scene before the browser context is closed (see explore-spotlight.spec.ts).
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

test('the part card speaks plainly, says its text is a draft, and shows no part number', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-gtsio520-h-r10-mechanism-study"]').click();
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const panel = page.getByRole('complementary', { name: 'Explore controls' });

  // The Parts list reads in plain words and finds a part by the other names a learner knows it by.
  await panel.getByLabel('Search components').fill('tappet');
  const component = panel.getByRole('combobox', { name: 'Component' });
  const options = await component.locator('option').allTextContents();
  const lifter = options.find((text) => /lifter/i.test(text));
  expect(lifter, `a search for "tappet" should find the valve lifters, got: ${options.slice(0, 5).join(' | ')}`).toBeTruthy();
  for (const text of options) expect(text, `old catalogue-style label: ${text}`).not.toMatch(/ \/ |#\d|P\/N/);

  await component.selectOption({ label: lifter! });
  const card = page.getByRole('complementary', { name: /^Component information for / });
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toHaveText(lifter!);
  await expect(card.getByText('Draft text', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(card.getByText('Look for:')).toBeVisible();
  await expect(card.getByRole('list', { name: 'Works with' })).toBeVisible();
  await expect(card.getByText('Parts catalogue:')).toBeVisible();
  await card.getByText('Where this text comes from').click();
  await expect(card.getByText('Stated in a source').first()).toBeVisible();
  await expect(card.getByText('Learning prompt')).toBeVisible();
  await testInfo.attach('part-card', { body: await page.screenshot(), contentType: 'image/png' });

  // Nothing a learner reads carries a part number or a catalogue reference.
  const text = await card.innerText();
  expect(text).not.toMatch(/P\/N|X-30040A|X-30045A|\b\d{5,6}[A-Z]?\d*\b/);
});
