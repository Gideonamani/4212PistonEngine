// Renders the app icon (web/icons/app-icon.svg) to the PNG sizes the web app manifest and iOS ask for. Run after changing the SVG:
//   node scripts/build_app_icons.mjs
// Uses the Playwright Chromium the browser tests already need, so the PNGs match how a browser draws the SVG.
import fs from 'node:fs';
import { chromium } from 'playwright';

const svg = fs.readFileSync('web/icons/app-icon.svg', 'utf8');
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

const browser = await chromium.launch();
for (const [name, size] of Object.entries(SIZES)) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `web/icons/${name}`, omitBackground: false });
  await page.close();
  console.log('wrote', `web/icons/${name}`);
}
await browser.close();
