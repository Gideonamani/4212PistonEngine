import fs from 'node:fs';
import { appReady, expect, expectNoHorizontalOverflow, onlyIn, test } from './fixtures';

// The courses written for the second half of the syllabus (lessons 9 to 18): each course page shows its banner and lessons, and every
// picture and interactive step of every lesson actually appears. 3D steps are left to the viewer tests because each one starts a
// model download.

const SYLLABUS_PACKS = ['valve-train-and-power', 'breathing-and-performance', 'requirements-and-malfunctions', 'maintenance-lsa-practicals'];
const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const manifest = readJson('web/lessons-manifest.json') as { packs: string[] };
const packs = manifest.packs.map((path) => readJson(`web/${path.replace(/^\.\//, '')}`)).filter((pack) => SYLLABUS_PACKS.includes(pack.id));

onlyIn('phone-390');
// A lesson can have twenty steps, each opened on a fresh page.
test.describe.configure({ timeout: 300_000 });

for (const pack of packs) {
  test.describe(pack.title, () => {
    test('the course page shows its banner, its lessons and their review status', async ({ page, problems }) => {
      await page.goto(`/#/learn/${pack.id}`);
      await appReady(page);
      await expect(page.getByRole('heading', { name: pack.title })).toBeVisible();
      const banner = page.locator('img[src$="' + pack.banner.replace('./', '/') + '"]');
      await expect(banner).toBeVisible();
      expect(await banner.evaluate((image: HTMLImageElement) => image.naturalWidth), 'the banner loaded').toBeGreaterThan(0);
      for (const lesson of pack.lessons) await expect(page.getByText(lesson.title, { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Instructor review pending').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      problems.assertNone();
    });

    for (const lesson of pack.lessons) {
      test(`${lesson.title}: every picture and interactive step shows`, async ({ page, problems }) => {
        for (const [index, step] of lesson.steps.entries()) {
          if (step.type !== 'image' && step.type !== 'web-embed') continue;
          await page.goto('about:blank');
          await page.goto(`/#/learn/${pack.id}/${lesson.id}/step/${index + 1}`);
          await appReady(page);
          await expect(page.getByRole('heading', { name: step.title, exact: true }), `step ${index + 1} opens`).toBeVisible();
          if (step.type === 'image') {
            const image = page.locator(`img[src$="${step.url.replace('./', '/')}"]`);
            await expect(image, `step ${index + 1} (${step.title}) shows its figure`).toBeVisible();
            expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth), `${step.url} loaded`).toBeGreaterThan(200);
          } else {
            await expect(page.getByText('This learning activity is not available'), `step ${index + 1} (${step.title}) has its interactive`).toHaveCount(0);
          }
          await expectNoHorizontalOverflow(page);
        }
        problems.assertNone();
      });
    }
  });
}
