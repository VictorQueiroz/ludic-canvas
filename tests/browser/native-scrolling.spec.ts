import { expect, test } from '@playwright/test';

test('native controls retain Yoga geometry under document-wide button styles', async ({ page }) => {
  for (const query of ['', '?kind=canvas']) {
    await page.goto(`/tests/browser/native-scrolling/${query}`);
    const row = page.getByRole('button', { name: 'Row 0', exact: true });
    await expect(row).toBeAttached();
    await page.addStyleTag({
      content:
        'button { min-width:200px; min-height:80px; max-width:240px; max-height:96px; transform:translate(20px,10px); }',
    });
    const boxes = await row.evaluate((element) => {
      const canvas = document.querySelector('canvas')!.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return { x: rect.x - canvas.x, y: rect.y - canvas.y, width: rect.width, height: rect.height };
    });
    expect(boxes).toEqual({ x: 0, y: 0, width: 320, height: 40 });
    if (!query) {
      await row.click({ position: { x: 300, y: 20 } });
      await expect(page.getByRole('button', { name: 'Row 0 selected', exact: true })).toBeAttached();
    }
  }
});

test('eligible scrolling uses actual native canvas tiles from the mounted tree', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/');
  await expect(page.getByLabel('Row 0', { exact: true })).toBeAttached();
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  const state = await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    const frame = c.frame();
    const tile = document.querySelector<HTMLCanvasElement>('[data-ludic-scroll-tile]')!;
    return {
      snapshot: c.scroll.getSnapshot(),
      info: frame.nativeScroll,
      pixel: [...tile.getContext('2d')!.getImageData(12, 12, 1, 1).data],
      errors: c.errors,
    };
  });
  expect(state.snapshot.mode).toBe('native');
  expect(state.pixel[3]).toBeGreaterThan(0);
  expect(state.info.regions).toBe(1);
  expect(state.info.rasterBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
  expect(state.errors).toEqual([]);
});

test('scroll commands, real item state, focus reveal and teardown retain their contracts', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/');
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    c.scroll.scrollTo(6000);
    c.frame();
  });
  await page.getByRole('button', { name: 'Row 151', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Row 151 selected', exact: true })).toBeAttached();
  await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    c.root.focus('row-0');
    c.frame();
  });
  await expect.poll(() => page.evaluate(() => (window as any).nativeScrolling.scroll.getSnapshot().offset)).toBe(0);
  await page.evaluate(() => (window as any).nativeScrolling.destroy());
  await expect(page.locator('[data-ludic-scroll], [data-ludic-canvas]')).toHaveCount(0);
});

test('native VirtualList fills a bounded raster window and paints a distant jump in one frame', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/?kind=virtual');
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  const result = await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    c.virtual.scrollToIndex(30000, 'start');
    const frame = c.frame();
    return { frame, state: c.virtual.scroll.getSnapshot(), tree: JSON.stringify(c.root.inspect()), errors: c.errors };
  });
  expect(result.state.mode).toBe('native');
  expect(result.tree).toContain('Virtual 30000');
  expect(result.frame.profile.mountedNodes).toBeLessThan(150);
  expect(result.frame.nativeScroll.tiles).toBeGreaterThan(0);
  expect(result.errors).toEqual([]);
});

test('unsupported arrangements preserve canvas scrolling and native surfaces survive mode changes', async ({
  page,
}) => {
  for (const kind of ['canvas', 'editor', 'nested', 'overlap', 'gesture', 'scale', 'unlabeled']) {
    await page.goto(`/tests/browser/native-scrolling/?kind=${kind}`);
    await expect(page.getByLabel('Row 0', { exact: true })).toBeAttached();
    await expect(page.locator('[data-ludic-scroll]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).nativeScrolling.scroll.getSnapshot().mode)).toBe('canvas');
  }
  await page.goto('/tests/browser/native-scrolling/?shared');
  await expect(page.getByLabel('Row 0', { exact: true })).toBeAttached();
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(0);
});

test('presentation changes retain the offset, focused DOM control and React state', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/');
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    c.scroll.scrollTo(6000);
    c.frame();
  });
  await page.getByRole('button', { name: 'Row 151', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Row 151 selected', exact: true })).toBeAttached();
  await page.evaluate(() => {
    (window as any).nativeFocused = document.activeElement;
    (window as any).nativeScrolling.change('canvas');
  });
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).nativeScrolling.scroll.getSnapshot().mode))
    .toBe('canvas');
  await page.evaluate(() => (window as any).nativeScrolling.change('simple'));
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  const state = await page.evaluate(() => ({
    snapshot: (window as any).nativeScrolling.scroll.getSnapshot(),
    sameFocus: document.activeElement === (window as any).nativeFocused,
    label: document.activeElement?.getAttribute('aria-label'),
  }));
  expect(state.snapshot.offset).toBe(6000);
  expect(state.sameFocus).toBe(true);
  expect(state.label).toBe('Row 151 selected');
});

test('native surfaces and handles remain isolated across roots', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/');
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  await page.evaluate(async () => {
    const c = (window as any).nativeScrolling;
    c.other = await c.second();
    c.scroll.scrollTo(400);
    c.frame();
    c.other.scroll.scrollTo(800);
    c.other.root.frame();
  });
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(2);
  const state = await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    const before = { first: c.scroll.getSnapshot().offset, second: c.other.scroll.getSnapshot().offset };
    c.destroy();
    const after = c.other.root.frame().nativeScroll;
    c.other.root.destroy();
    return { before, after };
  });
  expect(state.before).toEqual({ first: 400, second: 800 });
  expect(state.after.regions).toBe(1);
  await expect(page.locator('[data-ludic-scroll], [data-ludic-canvas]')).toHaveCount(0);
});

test('small budgets fall back and explicit unsupported native mode reports an error', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/?budget=100');
  await expect(page.getByLabel('Row 0', { exact: true })).toBeAttached();
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).nativeScrolling.scroll.getSnapshot().mode)).toBe('canvas');
  await page.goto('/tests/browser/native-scrolling/?kind=required&shared');
  await expect
    .poll(() => page.evaluate(() => (window as any).nativeScrolling?.errors.join(' ') ?? ''))
    .toContain('root-owned WebGL context');
});

test('native touch panning cancels activation and a subsequent tap uses native clicks', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'Trusted touch-drag injection is mobile Chromium-only; other projects cover native structure and commands.',
  );
  await page.goto('/tests/browser/native-scrolling/');
  const viewport = page.locator('[data-ludic-scroll]');
  await expect(viewport).toHaveCount(1);
  const rect = (await viewport.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.synthesizeScrollGesture', {
      x: rect.x + 100,
      y: rect.y + 190,
      yDistance: -180,
      speed: 450,
      gestureSourceType: 'touch',
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).nativeScrolling.scroll.getSnapshot().offset))
      .toBeGreaterThan(50);
    await expect(page.getByRole('button', { name: /selected/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Row 6', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Row 6 selected', exact: true })).toBeAttached();
  } finally {
    await cdp.detach();
  }
});

test('native anchors use the new extent before a text-scale row-height command', async ({ page }) => {
  await page.goto('/tests/browser/virtual/?native');
  await expect(page.getByLabel('Row 0', { exact: true })).toBeAttached();
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.handle.scroll.scrollTo(4005);
    c.frame();
    c.reverse();
  });
  await expect
    .poll(() => page.evaluate(() => Math.abs((window as any).virtual.handle.scroll.getSnapshot().offset - 1595965)))
    .toBeLessThan(1);
  await page.evaluate(() => {
    const c = (window as any).virtual;
    c.root.setTextScale(1.5);
    c.rowHeight(60);
  });
  await expect
    .poll(() => page.evaluate(() => Math.abs((window as any).virtual.handle.scroll.getSnapshot().offset - 2393945)))
    .toBeLessThan(1);
  expect(await page.evaluate(() => (window as any).virtual.handle.scroll.getSnapshot().mode)).toBe('native');
  expect(await page.evaluate(() => (window as any).virtual.frame().profile.mountedNodes)).toBeLessThan(150);
});

test('content beyond native browser height limits retains the canvas command range', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/?kind=virtual&height=1000');
  await expect(page.getByRole('option', { name: 'Virtual 0', exact: true })).toBeAttached();
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(0);
  const state = await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    c.virtual.scrollToIndex(39999, 'end');
    c.frame();
    return c.virtual.scroll.getSnapshot();
  });
  expect(state.mode).toBe('canvas');
  expect(state.offset).toBe(39999760);
});

test('a window blur clears a native press without activating the item', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/?reduced');
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Row 0', exact: true }).dispatchEvent('pointerdown', {
    pointerId: 12,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 12,
    clientY: 12,
  });
  const colors = await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    const now = performance.now();
    c.root.frame(now + 100);
    const sample = () => [
      ...document
        .querySelector<HTMLCanvasElement>('[data-ludic-scroll-tile="0"]')!
        .getContext('2d')!
        .getImageData(200, 30, 1, 1).data,
    ];
    const pressed = sample();
    window.dispatchEvent(new Event('blur'));
    c.root.frame(now + 200);
    return { pressed, released: sample(), errors: c.errors };
  });
  expect(colors.pressed[3]).toBeLessThan(colors.released[3]!);
  expect(colors.errors).toEqual([]);
  await expect(page.getByRole('button', { name: /selected/ })).toHaveCount(0);
});

test('text scaling refreshes native pixels without changing fixed row geometry', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/?reduced');
  await expect(page.locator('[data-ludic-scroll]')).toHaveCount(1);
  const result = await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    const pixels = () => [
      ...document
        .querySelector<HTMLCanvasElement>('[data-ludic-scroll-tile="0"]')!
        .getContext('2d')!
        .getImageData(0, 0, 150, 40).data,
    ];
    const before = pixels();
    const extent = c.scroll.getSnapshot().contentHeight;
    c.root.setTextScale(1.5);
    const frame = c.frame();
    const after = pixels();
    return {
      changed: before.some((value, i) => value !== after[i]),
      copied: frame.nativeScroll.copiedTiles,
      extent,
      nextExtent: c.scroll.getSnapshot().contentHeight,
    };
  });
  expect(result.changed).toBe(true);
  expect(result.copied).toBeGreaterThan(0);
  expect(result.nextExtent).toBe(result.extent);
});

test('prepared native pixels move while application frames are paused', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/');
  await expect(page.locator('[data-ludic-scroll-tile="0"]')).toBeAttached();
  const result = await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    c.pause();
    const viewport = document.querySelector<HTMLElement>('[data-ludic-scroll]')!;
    const tile = document.querySelector<HTMLElement>('[data-ludic-scroll-tile="0"]')!;
    const before = tile.getBoundingClientRect().top;
    viewport.scrollTop = 80;
    return { moved: before - tile.getBoundingClientRect().top, offset: c.scroll.getSnapshot().offset };
  });
  expect(result.moved).toBe(80);
  expect(result.offset).toBe(0);
});

test('context loss suspends native surfaces and recovery preserves state and scrolling', async ({ page }) => {
  await page.goto('/tests/browser/native-scrolling/');
  const viewport = page.locator('[data-ludic-scroll]');
  await expect(viewport).toBeVisible();
  await page.getByRole('button', { name: 'Row 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Row 0 selected', exact: true })).toBeAttached();
  await page.evaluate(() => (window as any).nativeScrolling.contextLoss.loseContext());
  await expect(viewport).toBeHidden();
  await expect(page.getByRole('button', { name: 'Row 0 selected', exact: true, includeHidden: true })).toBeHidden();
  await page.evaluate(() => (window as any).nativeScrolling.contextLoss.restoreContext());
  await expect(viewport).toBeVisible();
  await page.evaluate(() => {
    const c = (window as any).nativeScrolling;
    c.scroll.scrollTo(400);
    c.frame();
  });
  await page.getByRole('button', { name: 'Row 11', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Row 11 selected', exact: true })).toBeAttached();
  expect(await page.evaluate(() => (window as any).nativeScrolling.errors)).toEqual([]);
});
