import { chromium, type FullConfig } from '@playwright/test';

/**
 * Visit every screen once before the tests start. A cold Vite dev server optimises dependencies the first time each lazy chunk
 * (the 3D viewer pulls in three.js) is requested, and then reloads every open page. Doing that here keeps it out of the tests.
 */
export default async function globalSetup(config: FullConfig) {
  const { baseURL, channel, launchOptions } = config.projects[0].use;
  const browser = await chromium.launch({ channel, ...launchOptions });
  try {
    const page = await browser.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    for (const hash of ['#/check', '#/learn', '#/explore', '#/learn/m2-cylinder-study/m2-four-stroke-guided/step/1']) {
      await page.goto(`${baseURL}/${hash}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.locator('h1, h2, h3, [role="application"]').first().waitFor({ timeout: 90_000 });
    }
    await page.waitForTimeout(3_000);
  } finally {
    await browser.close();
  }
}
