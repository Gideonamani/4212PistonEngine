// Renders the app's own 3D models to WebP images for card thumbnails, course banners and Explore previews, without a person pasting
// scripts into a DevTools console. It runs the capture function (scripts/capture_model_thumbnail.js) in a real browser against the dev
// server, once for each named call recorded in scripts/thumbnail_sources/captures.js, and saves the result beside that file.
//
//   npx vite --port 5173 --strictPort          (in another terminal; the models must be restored into web/)
//   node scripts/capture_renders.mjs cylinder-valve-train banner-valve-train
//   node scripts/capture_renders.mjs --list
//
// Then build the cards: python scripts/build_thumbnails.py. The window is 1000 x 700 so the page lays out as a desktop; the image size
// comes from each capture's own width and height, not from the window.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCES = path.join(ROOT, 'scripts', 'thumbnail_sources');
const BASE = process.env.CAPTURE_URL || 'http://localhost:5173';

function loadCaptures() {
  const source = fs.readFileSync(path.join(SOURCES, 'captures.js'), 'utf8');
  return new Function(`${source}\nreturn THUMBNAIL_CAPTURES;`)();
}

const captures = loadCaptures();
const names = process.argv.slice(2);
if (names.includes('--list') || names.length === 0) {
  console.log(captures.map((capture) => `${capture.name}  (${capture.model})`).join('\n'));
  process.exit(0);
}
const unknown = names.filter((name) => !captures.some((capture) => capture.name === name));
if (unknown.length) {
  console.error(`Not in captures.js: ${unknown.join(', ')}`);
  process.exit(1);
}

const captureSource = fs.readFileSync(path.join(ROOT, 'scripts', 'capture_model_thumbnail.js'), 'utf8');
const channel = process.env.PW_CHANNEL || (fs.existsSync(chromium.executablePath()) ? undefined : 'chrome');
const browser = await chromium.launch({ channel, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', (error) => console.error('page error:', error.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.addScriptTag({ content: captureSource });
  for (const name of names) {
    const capture = captures.find((item) => item.name === name);
    const dataUrl = await page.evaluate(async (call) => {
      let image = '';
      await captureModel(call.model, call.name, call.view, {
        ...call.options,
        // Keep the page's own PNG, then convert it to WebP in the page so the file needs no extra tool.
        onImage: async (png) => {
          const picture = new Image();
          picture.src = png;
          await picture.decode();
          const canvas = document.createElement('canvas');
          canvas.width = picture.naturalWidth;
          canvas.height = picture.naturalHeight;
          canvas.getContext('2d').drawImage(picture, 0, 0);
          image = canvas.toDataURL('image/webp', 0.92);
        },
      });
      return image;
    }, capture);
    const file = path.join(SOURCES, `${name}.webp`);
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`${name}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
} finally {
  await browser.close();
}
