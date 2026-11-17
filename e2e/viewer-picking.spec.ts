import { expect, onlyIn, test } from './fixtures';

onlyIn('phone-390');

test('real pointer events distinguish taps from camera gestures and pick rendered surfaces', async ({ page, problems }) => {
  await page.goto('/e2e/runtime-harness.html');
  await page.waitForFunction(() => Boolean((window as any).runtimeTest));
  const reset = () => page.evaluate(() => (window as any).runtimeTest.reset());
  const picks = () => page.evaluate(() => [...(window as any).runtimeTest.picks]);
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;

  await page.touchscreen.tap(x, y);
  await expect.poll(picks).toEqual(['front']);
  await reset();
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 5 }); await page.mouse.move(x, y, { steps: 5 }); await page.mouse.up();
  expect(await picks()).toEqual([]);
  await page.mouse.click(x, y, { button: 'right' });
  expect(await picks()).toEqual([]);

  const cdp = await page.context().newCDPSession(page);
  for (const remaining of [1, 2]) {
    const touches = [{ x: x - 40, y, id: 1 }, { x: x + 40, y, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches.map(t => ({ ...t, x: t.x + (t.id === 1 ? -10 : 10) })) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: touches.filter(t => t.id === remaining) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await picks()).toEqual([]);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await picks()).toEqual([]);
  await reset();
  await page.touchscreen.tap(x, y);
  expect(await picks()).toEqual(['front']);

  await reset(); await page.evaluate(() => (window as any).runtimeTest.clip());
  await page.mouse.click(x, y); expect(await picks()).toEqual(['back']);
  await reset(); await page.evaluate(() => (window as any).runtimeTest.ghost());
  await page.mouse.click(x, y); expect(await picks()).toEqual(['back']);
  await reset(); await page.evaluate(() => (window as any).runtimeTest.hideBack());
  await page.touchscreen.tap(x, y); expect(await picks()).toEqual(['front']);
  problems.assertNone();
});
