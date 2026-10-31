import { expect, test, type Page } from '@playwright/test';

async function scene(page: Page, name: string) {
  await page.evaluate((name) => (window as any).routing.render(name), name);
  await expect(page.locator('output')).toHaveText(name);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/input/');
  await expect(page.locator('output')).toHaveText('map');
});

test('wheel routes without a prior pointermove and overlays block the world surface', async ({ page }) => {
  const prevented = await page.evaluate(() => (window as any).routing.wheel(10, 10));
  expect(prevented).toBe(true);
  expect(await page.evaluate(() => (window as any).routing.calls.map((e: any) => e.name))).toEqual(['map']);
  for (const name of ['map', 'button', 'disabled', 'modal']) {
    await scene(page, name);
    await page.evaluate((name) => {
      const c = (window as any).routing;
      c.calls.length = 0;
      c.wheel(name === 'button' || name === 'disabled' ? 190 : 50, 50);
      if (name === 'modal') c.wheel(10, 10);
    }, name);
    expect(await page.evaluate(() => (window as any).routing.calls)).toEqual([]);
  }
});

test('wheel preserves units, modifiers, coordinates and bubbling cancellation', async ({ page }) => {
  await scene(page, 'bubble');
  const result = await page.evaluate(() => {
    const c = (window as any).routing;
    c.wheel(20, 20, {
      deltaX: 2,
      deltaY: 3,
      deltaZ: 4,
      deltaMode: 1,
      ctrlKey: true,
      shiftKey: true,
      altKey: true,
      metaKey: true,
    });
    return c.calls;
  });
  expect(result.map((e: any) => e.name)).toEqual(['child', 'parent']);
  expect(result[0]).toMatchObject({
    x: 20,
    y: 20,
    localX: 15,
    localY: 15,
    deltaX: 2,
    deltaY: 3,
    deltaZ: 4,
    deltaMode: 1,
    ctrlKey: true,
    shiftKey: true,
    altKey: true,
    metaKey: true,
    prevented: false,
  });
  for (const mode of ['prevent', 'stop']) {
    await page.evaluate((mode) => (window as any).routing.mode(mode), mode);
    await expect(page.locator('output')).toHaveText(`bubble:${mode}`);
    const state = await page.evaluate(() => {
      const c = (window as any).routing;
      c.calls.length = 0;
      return { prevented: c.wheel(20, 20), calls: c.calls };
    });
    expect(state.calls.map((e: any) => e.name)).toEqual(mode === 'stop' ? ['child'] : ['child', 'parent']);
    expect(state.prevented).toBe(mode === 'prevent');
    if (mode === 'prevent') expect(state.calls[1].prevented).toBe(true);
  }
});

test('wheel preserves line units when the browser selects units on first access', async ({ page }) => {
  await scene(page, 'bubble');
  const calls = await page.evaluate(() => {
    const c = (window as any).routing;
    const rect = c.canvas.getBoundingClientRect();
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 20,
      clientY: rect.top + 20,
    });
    // Model Gecko's trusted line-event getters. Constructed WheelEvents skip
    // this compatibility conversion, so ordinary synthetic events miss it.
    let modeChecked: boolean | undefined;
    Object.defineProperty(event, 'deltaMode', {
      get() {
        modeChecked ??= true;
        return modeChecked ? 1 : 0;
      },
    });
    for (const [name, value] of [
      ['deltaX', 2],
      ['deltaY', 3],
      ['deltaZ', 4],
    ] as const) {
      Object.defineProperty(event, name, {
        get() {
          modeChecked ??= false;
          return modeChecked ? value : value * 40;
        },
      });
    }
    c.canvas.dispatchEvent(event);
    return c.calls;
  });
  expect(calls.map((e: any) => e.name)).toEqual(['child', 'parent']);
  for (const call of calls) expect(call).toMatchObject({ deltaMode: 1, deltaX: 2, deltaY: 3, deltaZ: 4 });
});

test('hit query respects geometry, clips, pass-through and disabled controls', async ({ page }) => {
  await scene(page, 'geometry');
  const hits = await page.evaluate(() => {
    const c = (window as any).routing;
    return [
      [20, 20],
      [60, 20],
      [100, 20],
      [140, 20],
      [175, 15],
      [210, 20],
      [20, 90],
      [70, 90],
      [105, 70],
      [165, 70],
      [220, 90],
      [-1, 10],
      [321, 10],
    ].map(([x, y]) => c.over(x, y));
  });
  expect(hits).toEqual([true, true, false, false, true, false, true, false, true, true, false, false, false]);
});

test('nested scrolling chains at boundaries and disabled children remain scrollable', async ({ page }) => {
  await scene(page, 'scroll');
  const state = await page.evaluate(() => {
    const c = (window as any).routing;
    c.wheel(10, 10, { deltaY: 1, deltaMode: 1 });
    const first = c.inner.getSnapshot().offset;
    c.inner.scrollTo(10000);
    c.frame();
    c.wheel(10, 10, { deltaY: 1, deltaMode: 2 });
    return { first, outer: c.outer.getSnapshot().offset, calls: c.calls.map((e: any) => e.name) };
  });
  expect(state.first).toBe(32);
  expect(state.outer).toBe(240);
  expect(state.calls).toEqual(['inner', 'outer', 'inner', 'outer']);
});

test('preventDefault cancels scrolling while stopPropagation preserves the default scroll', async ({ page }) => {
  for (const name of ['prevent', 'stop']) {
    await scene(page, name);
    const state = await page.evaluate(() => {
      const c = (window as any).routing;
      c.calls.length = 0;
      c.wheel(10, 10);
      return { offset: c.inner.getSnapshot().offset, calls: c.calls.map((e: any) => e.name) };
    });
    expect(state.offset).toBe(name === 'prevent' ? 0 : 40);
    expect(state.calls).toEqual(name === 'prevent' ? ['inner', 'outer'] : ['inner']);
  }
});

test('external controls use fresh coordinates and stay blocked at scroll boundaries', async ({ page }) => {
  await scene(page, 'overlay');
  expect(
    await page.evaluate(() => {
      const c = (window as any).routing;
      c.wheel(50, 50);
      c.wheel(10, 10);
      return c.external;
    }),
  ).toBe(1);
  await scene(page, 'scroll');
  expect(
    await page.evaluate(() => {
      const c = (window as any).routing;
      c.inner.scrollTo(10000);
      c.outer.scrollTo(10000);
      c.frame();
      c.wheel(10, 10);
      return c.external;
    }),
  ).toBe(1);
});

test('native textarea receives one wheel callback and chains only after native scrolling', async ({ page }) => {
  await scene(page, 'editor');
  const editor = page.getByRole('textbox', { name: 'Notes' });
  await expect(editor).toBeVisible();
  const state = await page.evaluate(() => {
    const c = (window as any).routing,
      editor = document.querySelector('textarea')!;
    const native = c.wheel(10, 10, {}, editor);
    const before = c.inner.getSnapshot().offset;
    editor.scrollTop = editor.scrollHeight;
    const chained = c.wheel(10, 10, {}, editor);
    return {
      native,
      before,
      chained,
      after: c.inner.getSnapshot().offset,
      calls: c.calls.map((e: any) => e.name),
      over: c.over(10, 10),
    };
  });
  expect(state).toEqual({
    native: false,
    before: 0,
    chained: true,
    after: 40,
    over: true,
    calls: ['editor', 'inner', 'outer', 'editor', 'inner', 'outer'],
  });
});

test('roots isolate hit queries and destroy removes wheel listeners', async ({ page }) => {
  await scene(page, 'overlay');
  await page.evaluate(async () => {
    const c = (window as any).routing;
    c.other = await c.second();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = (window as any).routing,
          r = c.other.surface.getBoundingClientRect();
        return c.other.ui.isPointerOverUI({ clientX: r.left + 10, clientY: r.top + 10 });
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => {
      const c = (window as any).routing,
        r = c.other.surface.getBoundingClientRect();
      const own = c.over(50, 50);
      const foreign = c.root.isPointerOverUI({ clientX: r.left + 10, clientY: r.top + 10 });
      c.calls.length = 0;
      c.destroy();
      c.canvas.dispatchEvent(new WheelEvent('wheel', { clientX: 30, clientY: 30, deltaY: 40 }));
      return { own, foreign, destroyed: c.over(50, 50), calls: c.calls, errors: c.errors };
    }),
  ).toEqual({ own: true, foreign: false, destroyed: false, calls: [], errors: [] });
});

test('query follows canvas position and suspension without dispatching callbacks', async ({ page }) => {
  await scene(page, 'overlay');
  expect(
    await page.evaluate(() => {
      const c = (window as any).routing;
      const stage = document.querySelector<HTMLElement>('#stage')!;
      stage.style.marginLeft = '100px';
      const moved = c.over(50, 50);
      const invalid = c.root.isPointerOverUI({ clientX: NaN, clientY: Infinity });
      c.canvas.style.height = '0px';
      c.frame();
      const hidden = c.over(50, 50);
      c.canvas.style.height = '300px';
      c.frame();
      return { moved, invalid, hidden, restored: c.over(50, 50), calls: c.calls };
    }),
  ).toEqual({ moved: true, invalid: false, hidden: false, restored: true, calls: [] });
});

test('noncancelable wheel still lets handlers override the library default', async ({ page }) => {
  await scene(page, 'prevent');
  expect(
    await page.evaluate(() => {
      const c = (window as any).routing;
      const browserPrevented = c.wheel(10, 10, { cancelable: false });
      return { browserPrevented, offset: c.inner.getSnapshot().offset, ancestorPrevented: c.calls[1].prevented };
    }),
  ).toEqual({ browserPrevented: false, offset: 0, ancestorPrevented: true });
});

test('real textarea wheel scroll stays native and never zooms external controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-webkit', 'Mobile WebKit does not support mouse wheel injection.');
  await scene(page, 'editor');
  const editor = page.getByRole('textbox', { name: 'Notes' });
  await expect(editor).toBeVisible();
  const rect = (await editor.boundingBox())!;
  await page.mouse.move(rect.x + 20, rect.y + 20);
  await page.mouse.wheel(0, 60);
  await expect.poll(() => editor.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => {
      const c = (window as any).routing;
      return { offset: c.inner.getSnapshot().offset, external: c.external, calls: c.calls.map((e: any) => e.name) };
    }),
  ).toEqual({ offset: 0, external: 0, calls: ['editor', 'inner', 'outer'] });
});
