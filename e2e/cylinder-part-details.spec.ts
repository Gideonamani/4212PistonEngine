import { appReady, expect, onlyIn, test } from './fixtures';

// The operating cylinder names and explains its parts from web/cylinder-parts.json (the part store, docs/part-store.md), the way the
// GTSIO-520-H whole engine does (part-details.spec.ts): a plain title, one sentence on what the part does, what it is made of, and a
// Details drawer that says where each line comes from. The text is a draft until the instructor reviews it, so the card says so; no part
// number reaches the learner. The Parts list keeps the catalogue's names, which the lessons and checks use. This opens the cylinder, so it runs once.

onlyIn('phone-390');
test.describe.configure({ timeout: 240_000 });

// Leave the model's scene before the browser context is closed (see explore-spotlight.spec.ts).
test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

test('the cylinder part card speaks plainly, says its text is a draft, and shows no part number', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.goto('/#/explore');
  await appReady(page);
  await page.locator('button[aria-describedby="capabilities-cylinder"]').click();
  await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 150_000 });
  const panel = page.getByRole('complementary', { name: 'Explore controls' });
  const component = panel.getByRole('combobox', { name: 'Component' });
  const card = page.getByRole('complementary', { name: /^Component information for / });

  // The Parts list keeps the catalogue's names; the card speaks in the learner's.
  await component.selectOption({ label: 'Top compression ring' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toHaveText('Compression ring · top groove');
  await expect(card.getByText('Draft text', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(card.getByText('Look for:')).toBeVisible();
  await expect(card.getByRole('list', { name: 'Works with' })).toContainText('Piston');
  await expect(card.getByText('Parts catalogue:')).toBeVisible();
  await expect(card.locator('dd', { hasText: 'gray cast iron' })).toBeVisible();
  await card.getByText('Where this text comes from').click();
  await expect(card.getByText('Stated in a source').first()).toBeVisible();
  await expect(card.getByText('Worked out from a source').first()).toBeVisible();
  await expect(card.getByText('Learning prompt')).toBeVisible();
  await testInfo.attach('cylinder-part-card', { body: await page.screenshot(), contentType: 'image/png' });

  // A part whose text the cylinder takes from the maintenance manual rather than a lesson.
  await component.selectOption({ label: 'Exhaust rotocoil retainer' });
  await expect(card.getByRole('heading')).toBeVisible();
  const toggle = card.getByRole('button', { name: /^(Details|Less)$/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(card.locator('p:visible', { hasText: /gently turns the valve/ })).toBeVisible();

  // Nothing a learner reads carries a part number, a catalogue reference or one of the retired table's specifications.
  const text = await card.innerText();
  expect(text).not.toMatch(/P\/N|X-30040A|X-30045A|\b\d{5,6}[A-Z]?\d*\b|AMS\s?\d|\bkN\b|°C/);
});
