import { appReady, expect, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';

// The course page (banner, description, the button that starts or resumes the course) and the Credits page.

const COURSE = '#/learn/history-and-fundamentals';
// The course with the longest description, so it runs past three lines on the narrowest phone whatever font the browser falls back to.
const LONG_DESCRIPTION_COURSE = '#/learn/fundamentals-and-classification';
const PROGRESS_KEY = '4212-piston-engine:lesson-progress:v1';

test.describe('the course page', () => {
  test('opens with a 2:1 banner, the title on it, and a real Start button that opens the first lesson', async ({ page, problems }) => {
    await page.goto(`/${COURSE}`);
    await appReady(page);
    const banner = page.locator('section[aria-labelledby="course-title"] img').first();
    await expect(banner).toBeVisible();
    await expect.poll(() => banner.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(1000);
    const box = (await banner.boundingBox())!;
    expect(box.width / box.height, 'banner is 2:1').toBeCloseTo(2, 1);
    await expect(page.getByRole('heading', { name: 'History & Fundamentals' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^Start course/ }).click();
    await expect(page).toHaveURL(/#\/learn\/history-and-fundamentals\/history-mechanical-engines\/step\/1$/);
    problems.assertNone();
  });

  test('once a lesson has been started the button says Continue and returns to the step reached', async ({ page }) => {
    await page.addInitScript(([key]) => localStorage.setItem(key, JSON.stringify({ 'history-mechanical-engines': { currentStep: 3 } })), [PROGRESS_KEY]);
    await page.goto(`/${COURSE}`);
    await appReady(page);
    await expect(page.getByRole('button', { name: /^Start course/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page).toHaveURL(/history-mechanical-engines\/step\/4$/);
  });

  test('when every lesson is finished the button reviews the course from the top', async ({ page }) => {
    const done = Object.fromEntries(['history-mechanical-engines', 'history-aircraft-engines', 'terminologies'].map((id) => [id, { completedAt: '2026-10-05T00:00:00Z', currentStep: 2 }]));
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [PROGRESS_KEY, JSON.stringify(done)]);
    await page.goto(`/${COURSE}`);
    await appReady(page);
    await page.getByRole('button', { name: /^Review course/ }).click();
    await expect(page).toHaveURL(/history-mechanical-engines\/step\/1$/);
  });

  test.describe('on the narrowest phone', () => {
    onlyIn('phone-320');
    test('a long description is cut to three lines and can be opened and closed', async ({ page }) => {
      await page.goto(`/${LONG_DESCRIPTION_COURSE}`);
      await appReady(page);
      const more = page.getByRole('button', { name: 'Read more' });
      await expect(more).toBeVisible();
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      const description = page.locator('#course-description');
      const collapsed = (await description.boundingBox())!.height;
      await more.click();
      await expect(page.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
      expect((await description.boundingBox())!.height, 'the full text is taller than three lines').toBeGreaterThan(collapsed);
      await page.getByRole('button', { name: 'Show less' }).click();
      await expect(page.getByRole('button', { name: 'Read more' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
});

test.describe('the Credits page', () => {
  test('is reached from the About dialog, lists third-party pictures by licence, and goes back', async ({ page, problems }) => {
    await page.goto('/#/learn');
    await appReady(page);
    await page.getByRole('button', { name: 'About Course & Model' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Picture credits and licences' }).click();
    await expect(page).toHaveURL(/#\/credits$/);
    await expect(page.getByRole('heading', { name: 'Pictures and licences' })).toBeVisible();
    for (const licence of ['CC BY 2.0', 'CC BY-SA 3.0', 'CC0', 'U.S. Government work']) await expect(page.getByRole('heading', { name: licence }), licence).toBeVisible();
    const original = page.getByRole('link', { name: 'View the original' }).first();
    await expect(original).toHaveAttribute('href', /^https:\/\/commons\.wikimedia\.org\//);
    await expect(original).toHaveAttribute('rel', /noreferrer/);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/#\/learn$/);
    problems.assertNone();
  });

  test('can be opened by its address and from the foot of the course list', async ({ page }) => {
    await page.goto('/#/credits');
    await appReady(page);
    await expect(page.getByRole('heading', { name: 'Pictures and licences' })).toBeVisible();
    await page.goto('about:blank');
    await page.goto('/#/learn');
    await appReady(page);
    await page.getByRole('main').getByRole('button', { name: 'Picture credits and licences' }).click();
    await expect(page).toHaveURL(/#\/credits$/);
  });
});
