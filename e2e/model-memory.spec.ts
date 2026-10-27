import fs from 'node:fs';
import { appReady, expect, onlyIn, test } from './fixtures';

// Repeated model changes in Explore, with what the page holds of the unpacked models read after each one (the development-only
// `__modelMemory` hook in assets.ts) beside the JavaScript heap after a forced collection. The held bytes must stay within the idle budget
// whatever order the models are visited in, and must not climb as the visits go on. See docs/browser-memory-and-storage.md.
//
// SOAK_CHANGES sets how many changes to make (default 8, enough for the check; use 24 or more to record the figures the docs ask for):
//   SOAK_CHANGES=24 npx playwright test e2e/model-memory.spec.ts --project=phone-390
onlyIn('phone-390');
test.describe.configure({ timeout: 900_000 });

type Model = { id: string; shortLabel: string; adapter: string; sources?: { localUrl?: string }[] };
const registry: Model[] = JSON.parse(fs.readFileSync('src/data/models.json', 'utf8'));
/** Models whose file is restored into web/ (the full engine names its file in its contract, so it counts when engine.glb.gz is there). */
const available = registry.filter((model) => model.adapter === 'full-engine'
  ? fs.existsSync('web/engine.glb.gz') || fs.existsSync('web/engine-opt1.glb.gz')
  : (model.sources ?? []).some((source) => source.localUrl && fs.existsSync(`web/${source.localUrl.replace(/\?.*$/, '').replace(/^\.\//, '')}`)));

const CHANGES = Number(process.env.SOAK_CHANGES) || 8;

test.afterEach(async ({ page }) => { await page.goto('about:blank').catch(() => undefined); });

test(`${CHANGES} model changes in Explore keep the unpacked models held within the budget`, async ({ page, problems }) => {
  test.skip(available.length < 3, 'needs at least three restored models (python scripts/fetch_drive_assets.py)');
  const session = await page.context().newCDPSession(page);
  const heapAfterCollection = async () => {
    await session.send('HeapProfiler.collectGarbage');
    const { metrics } = await session.send('Performance.getMetrics');
    return Math.round(metrics.find((metric) => metric.name === 'JSHeapUsedSize')!.value);
  };
  await session.send('Performance.enable');

  await page.goto('/#/explore');
  await appReady(page);
  const viewer = page.getByRole('region', { name: /Interactive 3D model of/ });
  const rows: { change: number; model: string; activeBytes: number; idleBytes: number; idleEntries: number; budgetBytes: number; jsHeapBytes: number }[] = [];

  for (let change = 0; change < CHANGES; change += 1) {
    // Visit the models in a fixed scrambled order so each one is revisited after others have come and gone.
    const model = available[(change * 3 + (change >> 1)) % available.length];
    if (change === 0) await page.locator(`button[aria-describedby="capabilities-${model.id}"]`).click();
    else {
      await page.getByRole('button', { name: 'Select 3D Engine Model' }).click();
      await page.getByRole('button', { name: model.shortLabel, exact: true }).click();
    }
    await expect(page.getByRole('application')).toBeVisible({ timeout: 60_000 });
    await expect(viewer.getByRole('status')).toHaveCount(0, { timeout: 180_000 });
    await page.waitForTimeout(500);
    const held = await page.evaluate(() => (globalThis as unknown as { __modelMemory: () => Record<string, number> }).__modelMemory());
    rows.push({ change: change + 1, model: model.id, activeBytes: held.activeBytes, idleBytes: held.idleBytes, idleEntries: held.idleEntries, budgetBytes: held.budgetBytes, jsHeapBytes: await heapAfterCollection() });
    expect(held.activeEntries, 'one viewer is mounted, so one model is in use').toBe(1);
    expect(held.idleBytes, `after change ${change + 1} (${model.id})`).toBeLessThanOrEqual(held.budgetBytes);
  }

  const table = rows.map((row) => `${String(row.change).padStart(2)}  ${row.model.padEnd(34)} in use ${(row.activeBytes / 1048576).toFixed(1).padStart(5)} MB  idle ${(row.idleBytes / 1048576).toFixed(1).padStart(5)} MB (${row.idleEntries})  JS heap ${(row.jsHeapBytes / 1048576).toFixed(1).padStart(6)} MB`).join('\n');
  console.log(`\nModel memory over ${CHANGES} changes (budget ${(rows[0].budgetBytes / 1048576).toFixed(0)} MB idle):\n${table}\n`);
  await test.info().attach('model-memory.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });

  // The held models stop growing: nothing after the first few changes pushes the figure above what it had already reached.
  const settled = rows.slice(Math.floor(rows.length / 2));
  const earlier = rows.slice(0, Math.floor(rows.length / 2));
  expect(Math.max(...settled.map((row) => row.idleBytes)), 'idle bytes keep within the budget in the second half too').toBeLessThanOrEqual(rows[0].budgetBytes);
  expect(Math.max(...settled.map((row) => row.jsHeapBytes)), 'the JavaScript heap does not climb with the visits').toBeLessThanOrEqual(Math.max(...earlier.map((row) => row.jsHeapBytes)) * 1.5 + 8 * 1048576);
  problems.assertNone();
});
