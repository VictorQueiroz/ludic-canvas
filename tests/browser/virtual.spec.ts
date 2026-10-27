import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/virtual/');
  await expect(page.getByLabel('Row 0', { exact: true })).toBeAttached();
});
test('forty thousand rows mount a bounded window and a distant jump paints in the same manual frame', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const c = (window as any).virtual;
    const before = c.frame();
    const moved = c.handle.scrollToIndex(39999, 'end');
    const after = c.frame();
    return { before, after, moved, tree: JSON.stringify(c.root.inspect()), errors: c.errors };
  });
  expect(result.before.profile.mountedNodes).toBeLessThan(40);
  expect(result.after.profile.mountedNodes).toBeLessThan(40);
  expect(result.moved).toBe(true);
  expect(result.tree).toContain('Row 39999');
  expect(result.after.profile.layoutPasses).toBe(2);
  expect(result.errors).toEqual([]);
});

test('shrinking and emptying collections clamps the extent and teardown releases the handle', async ({ page }) => {
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.handle.scrollToIndex(39999);
    c.frame();
    c.changeCount(400);
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).virtual.handle.scroll.getSnapshot().contentHeight))
    .toBe(16000);
  const nodes = await page.evaluate(() => (window as any).virtual.frame().profile.mountedNodes);
  expect(nodes).toBeLessThan(40);
  await page.evaluate(() => (window as any).virtual.changeCount(0));
  await expect.poll(() => page.evaluate(() => (window as any).virtual.handle.scroll.getSnapshot().maxOffset)).toBe(0);
  await expect(page.locator('[aria-label^="Row "]')).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const c = (window as any).virtual;
      c.root.destroy();
      return c.handle.scrollToIndex(0);
    }),
  ).toBe(false);
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
});
test('pixel scrolling inside one range does not render rows again and resizing updates the window', async ({
  page,
}) => {
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.handle.scroll.scrollTo(5);
    c.frame();
  });
  const result = await page.evaluate(() => {
    const c = (window as any).virtual;
    const before = c.renders;
    c.handle.scroll.scrollTo(10);
    c.frame();
    const after = c.renders;
    document.querySelector('canvas')!.style.height = '120px';
    const resized = c.frame();
    return { before, after, resized, state: c.handle.scroll.getSnapshot() };
  });
  expect(result.before).toBe(result.after);
  expect(result.state.viewportHeight).toBe(120);
  expect(result.resized.profile.mountedNodes).toBeLessThan(25);
});
