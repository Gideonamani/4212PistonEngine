import fs from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';

// Smoke tests run against the Vite dev server, because it serves the model files restored into web/ (a production build
// deletes them and loads from Drive, whose API key only accepts the published site as referrer).
//
// Browser: CI installs Playwright's Chromium. Locally, if that is not installed, use the Google Chrome already on the machine.
// Override with PW_CHANNEL=chrome|msedge.
const bundledChromium = fs.existsSync(chromium.executablePath());
const channel = process.env.PW_CHANNEL || (!process.env.CI && !bundledChromium ? 'chrome' : undefined);

const phone = (width: number, height: number) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  outputDir: 'test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // Software rendering in CI so WebGL behaves the same everywhere; locally let Chrome use the GPU if it can.
      args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--use-angle=swiftshader'] : [])],
    },
  },
  projects: [
    { name: 'phone-320', use: phone(320, 640) },
    { name: 'phone-360', use: phone(360, 780) },
    { name: 'phone-390', use: phone(390, 844) },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 }, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: [
    { command: 'npx vite --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
    // The production build (npm run build), served as published, for the checks that only mean something in a production bundle.
    ...(fs.existsSync('dist/index.html') ? [{ command: 'npx vite preview --port 4174 --strictPort', url: 'http://localhost:4174', reuseExistingServer: !process.env.CI, timeout: 60_000 }] : []),
  ],
});
