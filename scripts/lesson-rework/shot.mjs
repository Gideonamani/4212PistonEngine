// Screenshot lesson steps: node scripts/lesson-rework/shot.mjs <outdir> <width> <height> <scheme> <hash> [<hash> ...]
// Uses the dev server on port 5199 and the Chrome on this machine (as playwright.config.ts does when the bundled browser is missing).
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const [outDir, width, height, scheme, ...hashes] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const bundled = fs.existsSync(chromium.executablePath());
const browser = await chromium.launch({ channel: bundled ? undefined : 'chrome', args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: Number(width), height: Number(height) }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: Number(width) < 700, isMobile: Number(width) < 700 });
const page = await context.newPage();
for (const hash of hashes) {
  await page.goto('about:blank');
  await page.goto(`http://localhost:5199/${hash}`);
  await page.waitForTimeout(2500);
  const name = hash.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  await page.screenshot({ path: `${outDir}/${name}-${scheme}-${width}.png` });
  console.log('saved', name);
}
await browser.close();
