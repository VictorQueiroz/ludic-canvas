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

test('logical focus reaches unmounted rows, skips disabled choices and exposes collection position', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const c = (window as any).virtual;
      const focused = c.handle.focusIndex(39999);
      c.frame();
      return await focused;
    }),
  ).toBe(true);
  const last = page.getByRole('option', { name: 'Row 39999', exact: true });
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute('aria-posinset', '40000');
  await expect(last).toHaveAttribute('aria-setsize', '40000');
  await expect(page.getByRole('listbox', { name: 'Inventory' })).toBeAttached();
  await expect(page.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: 'Row 0', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(last).toBeFocused();
  expect(
    await page.evaluate(async () => {
      const c = (window as any).virtual;
      const focused = c.handle.focusIndex(6);
      c.frame();
      return await focused;
    }),
  ).toBe(true);
  expect(await page.evaluate(() => (window as any).virtual.root.navigate('down'))).toBe(true);
  await expect(page.getByRole('option', { name: 'Row 8', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Row 8', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('focus follows stable keys across reorder, deletion and modal return', async ({ page }) => {
  await page.evaluate(async () => {
    const c = (window as any).virtual;
    const p = c.handle.focusKey(100);
    c.frame();
    await p;
    c.reverse();
  });
  await expect(page.getByLabel('Row 100', { exact: true })).toHaveAttribute('aria-posinset', '39900');
  await expect(page.getByLabel('Row 100', { exact: true })).toBeFocused();
  await page.evaluate(() => (window as any).virtual.modal(true));
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Row 100', { exact: true })).toBeFocused();
  await page.evaluate(() => (window as any).virtual.remove(100));
  await expect(page.getByLabel('Row 99', { exact: true })).toBeFocused();
});

test('pending focus is superseded, rejects missing/disabled keys and cancels on teardown', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const c = (window as any).virtual;
    const a = c.handle.focusIndex(100),
      b = c.handle.focusIndex(200);
    c.frame();
    const values = await Promise.all([a, b, c.handle.focusIndex(7), c.handle.focusKey('missing')]);
    const pending = c.handle.focusIndex(300);
    c.root.destroy();
    return { values, cancelled: await pending, disconnected: c.handle.scroll.getSnapshot().connected };
  });
  expect(result).toEqual({ values: [false, true, false, false], cancelled: false, disconnected: false });
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
});

test('pointer targets survive window replacement and cannot activate another row', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + 20);
  await page.mouse.down();
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.handle.scrollToIndex(39999);
    c.frame();
  });
  await expect(page.getByLabel('Row 0', { exact: true })).toBeAttached();
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).virtual.pressed)).toEqual([]);
  await page.evaluate(async () => {
    const c = (window as any).virtual;
    const p = c.handle.focusIndex(39999);
    c.frame();
    await p;
  });
  await expect(page.getByLabel('Row 0', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).virtual.frame().profile.mountedNodes)).toBeLessThan(44);
});

test('surviving viewport anchors follow item keys and explicit text-scale row resizing', async ({ page }) => {
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.handle.scroll.scrollTo(4005);
    c.frame();
    c.reverse();
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).virtual.handle.scroll.getSnapshot().offset))
    .toBe(1595965);
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.root.setTextScale(1.5);
    c.rowHeight(60);
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).virtual.handle.scroll.getSnapshot().offset))
    .toBe(2393945);
  expect(await page.evaluate(() => (window as any).virtual.frame().profile.mountedNodes)).toBeLessThan(40);
});

test('disabled options do not block wheel scrolling through the collection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-webkit', 'Mobile WebKit does not support mouse wheel injection.');
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.handle.scroll.scrollTo(280);
    c.frame();
  });
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + 20);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(() => page.evaluate(() => (window as any).virtual.handle.scroll.getSnapshot().offset))
    .toBeGreaterThan(280);
});

test('touch selects one option without duplicate activation', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch configuration only.');
  const box = await page.locator('canvas').boundingBox();
  await page.touchscreen.tap(box!.x + 20, box!.y + 20);
  await expect.poll(() => page.evaluate(() => (window as any).virtual.pressed)).toEqual([0]);
});

test('prefix search and paging use logical items beyond the mounted options', async ({ page }) => {
  await page.getByRole('option', { name: 'Row 0', exact: true }).focus();
  await page.keyboard.press('r');
  await expect(page.getByRole('option', { name: 'Row 1', exact: true })).toBeFocused();
  await page.keyboard.press('r');
  await expect(page.getByRole('option', { name: 'Row 2', exact: true })).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(page.getByRole('option', { name: 'Row 9', exact: true })).toBeFocused();
});

test('a virtual focus request cannot escape the active modal', async ({ page }) => {
  await page.evaluate(async () => {
    const c = (window as any).virtual;
    const request = c.handle.focusIndex(100);
    c.frame();
    await request;
  });
  await page.evaluate(() => (window as any).virtual.modal(true));
  const close = page.getByRole('button', { name: 'Close dialog', exact: true });
  await expect(close).toBeFocused();
  expect(
    await page.evaluate(async () => {
      const c = (window as any).virtual;
      const request = c.handle.focusIndex(39999);
      c.frame();
      return await request;
    }),
  ).toBe(false);
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Row 100', { exact: true })).toBeFocused();
});

test('StrictMode effect replay keeps one collection owner and cleans pending work', async ({ page }) => {
  await page.goto('/tests/browser/virtual/?strict');
  await expect(page.getByRole('option', { name: 'Row 0', exact: true })).toBeAttached();
  const result = await page.evaluate(async () => {
    const c = (window as any).virtual;
    const request = c.handle.focusKey(39999);
    c.frame();
    const focused = await request;
    c.root.destroy();
    return { focused, errors: c.errors };
  });
  expect(result).toEqual({ focused: true, errors: [] });
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
});

test('replacing focused contents inside the same modal restores an available control', async ({ page }) => {
  await page.evaluate(() => (window as any).virtual.modal(true));
  await page.getByRole('button', { name: 'Replace modal contents', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Replacement action', exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
});
