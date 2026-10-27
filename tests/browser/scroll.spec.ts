import { expect, test } from '@playwright/test';

test('scroll handles observe layout, clamp commands, reveal focus and disconnect on teardown', async ({ page }) => {
  await page.goto('/tests/browser/scroll/');
  await expect(page.locator('output')).toContainText('"connected":true');
  expect(await page.evaluate(() => (window as any).scrolling.scroll.getSnapshot())).toMatchObject({
    offset: 0,
    viewportHeight: 240,
    contentHeight: 4000,
    maxOffset: 3760,
  });
  await page.evaluate(() => {
    const c = (window as any).scrolling;
    c.scroll.scrollTo(9000);
    c.frame();
  });
  await expect(page.locator('output')).toContainText('"offset":3760');
  await page.evaluate(() => {
    const c = (window as any).scrolling;
    c.root.focus('item-0');
    c.frame();
  });
  await expect(page.locator('output')).toContainText('"offset":0');
  const result = await page.evaluate(async () => {
    const c = (window as any).scrolling;
    const before = c.events.length;
    c.scroll.scrollTo(500);
    c.scroll.scrollBy(100);
    c.frame();
    await Promise.resolve();
    const state = c.scroll.getSnapshot();
    const eventCount = c.events.length - before;
    c.root.destroy();
    return { state, eventCount, disconnected: c.scroll.getSnapshot(), errors: c.errors };
  });
  expect(result.state.offset).toBe(600);
  expect(result.eventCount).toBe(1);
  expect(result.disconnected.connected).toBe(false);
  expect(result.errors).toEqual([]);
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
});

test('scroll subscriptions clean up and handles isolate roots and enforce ownership', async ({ page }) => {
  await page.goto('/tests/browser/scroll/');
  await expect(page.locator('output')).toContainText('"connected":true');
  await page.evaluate(async () => {
    const c = (window as any).scrolling;
    c.other = await c.second();
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).scrolling.other.scroll.getSnapshot().connected))
    .toBe(true);
  const state = await page.evaluate(() => {
    const c = (window as any).scrolling;
    let notifications = 0;
    const unsubscribe = c.scroll.subscribe(() => notifications++);
    c.scroll.scrollTo(100);
    c.frame();
    unsubscribe();
    c.scroll.scrollTo(200);
    c.frame();
    return { notifications, first: c.scroll.getSnapshot().offset, second: c.other.scroll.getSnapshot().offset };
  });
  expect(state).toEqual({ notifications: 1, first: 200, second: 0 });
  await page.evaluate(async () => {
    const c = (window as any).scrolling;
    c.duplicate = await c.second(true);
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).scrolling.errors.join(' ')))
    .toContain('only one ScrollArea');
  await page.evaluate(() => {
    const c = (window as any).scrolling;
    c.other.root.destroy();
    c.duplicate.root.destroy();
    c.root.destroy();
  });
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
});
