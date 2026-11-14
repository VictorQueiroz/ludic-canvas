import { expect, test, type Page } from '@playwright/test';

async function point(page: Page, id = 'one', x = 35, y = 76) {
  const box = await page.locator(`#${id}`).boundingBox();
  return { x: box!.x + x, y: box!.y + y };
}
async function selected(page: Page) {
  return page.evaluate(() => getSelection()?.toString() ?? '');
}
async function textPoint(page: Page, name: string, x = 10) {
  const geometry = await page.evaluate((name) => (window as any).selectionDemo.boxes[`one:${name}`], name);
  return point(page, 'one', geometry.x + x, geometry.y + Math.min(10, geometry.height / 2));
}
test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/selection/');
  await page.waitForFunction(() => (window as any).selectionDemo?.ready);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    for (const root of (window as any).selectionDemo?.roots ?? []) root.destroy();
  });
});

test('rendered text supports word, paragraph, directional drag and copy', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse gestures are qualified on desktop; touch has a separate contract.');
  const p = await point(page);
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(() => selected(page)).toBe('Alpha');
  const copy = await page.evaluate(() => {
    const data = new DataTransfer();
    const event = new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true });
    document.querySelector('canvas')!.dispatchEvent(event);
    return { text: data.getData('text/plain'), prevented: event.defaultPrevented };
  });
  expect(copy).toEqual({ text: 'Alpha', prevented: true });
  await page.keyboard.press('Escape');
  await page.mouse.click(p.x + 35, p.y, { clickCount: 3 });
  await expect.poll(() => selected(page)).toContain('Alpha bravo charlie.');
  await page.keyboard.press('Escape');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 170, p.y, { steps: 12 });
  await expect.poll(() => selected(page)).not.toBe('');
  await page.mouse.move(p.x - 9, p.y, { steps: 12 });
  await page.mouse.up();
  expect((await selected(page)).length).toBeLessThan(8);
});

test('select all is root-local, excludes controls and opt-outs, and cleans up', async ({ page }) => {
  await page.locator('#one').focus();
  await page.keyboard.press('ControlOrMeta+a');
  const text = await selected(page);
  expect(text).toContain('Selectable canvas text');
  expect(text.match(/Selectable canvas text/g)).toHaveLength(1);
  expect(text).not.toContain('This note opts out');
  expect(text).not.toContain('Native editing');
  expect(text).not.toContain('Replace the first paragraph');
  await page.evaluate(() => (window as any).selectionDemo.roots[0].destroy());
  await expect.poll(() => selected(page)).toBe('');
  expect(await page.locator('[data-ludic-text-selection]').count()).toBe(1);
  await page.locator('#two').focus();
  await page.keyboard.press('ControlOrMeta+a');
  expect(await selected(page)).toContain('Alpha');
});

test('native editors retain their own select-all and clipboard behavior', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: 'one editor', exact: true });
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+a');
  expect(await editor.evaluate((e: HTMLInputElement) => e.value.slice(e.selectionStart!, e.selectionEnd!))).toBe(
    'Native editing keeps its own selection',
  );
});

test('Shift click extends across Text elements and selection policies are respected', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Uses mouse gestures.');
  const start = await textPoint(page, 'first', 1),
    end = await textPoint(page, 'second', 60);
  await page.mouse.click(start.x, start.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(end.x, end.y);
  await page.keyboard.up('Shift');
  await expect.poll(() => selected(page)).toContain('across these words.\nA second');
  const none = await textPoint(page, 'none');
  await page.mouse.dblclick(none.x, none.y);
  expect(await selected(page)).toBe('');
  const all = await textPoint(page, 'all');
  await page.mouse.click(all.x, all.y);
  await expect.poll(() => selected(page)).toBe('Select this whole reference: LC-2048');
});

test('replacing selected content cancels stale ranges and context menus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Uses mouse gestures.');
  const p = await textPoint(page, 'first');
  await page.mouse.dblclick(p.x, p.y);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.getByRole('menu', { name: 'Text selection' })).toBeVisible();
  await page
    .getByRole('button', { name: 'one replace text', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect.poll(() => selected(page)).toBe('');
  await expect(page.getByRole('menu', { name: 'Text selection' })).toHaveCount(0);
});

test('dragging at a scroll edge advances only the owning root', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Uses mouse selection; touch panning is covered separately.');
  const geometry = await page.evaluate(() => (window as any).selectionDemo.boxes['one:scroll']);
  const start = await point(page, 'one', geometry.x + 30, geometry.y + 20);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + geometry.height, { steps: 8 });
  await expect
    .poll(() => page.evaluate(() => (window as any).selectionDemo.scrolls.one.getSnapshot().offset))
    .toBeGreaterThan(0);
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).selectionDemo.scrolls.two.getSnapshot().offset)).toBe(0);
  expect(await selected(page)).toContain('Log');
});

test('long press creates root-owned touch handles and cancellation releases them', async ({ page, browserName }) => {
  test.skip(
    browserName !== 'chromium',
    'Trusted touch injection uses Chromium CDP; other engines require device qualification.',
  );
  const p = await textPoint(page, 'first');
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 19 }] });
    await expect(page.locator('[data-ludic-selection-handle]')).toHaveCount(2);
    await expect(page.getByRole('menuitem', { name: 'Copy', exact: true })).toBeVisible();
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  await page.evaluate(() => (window as any).selectionDemo.roots[0].destroy());
  await expect(page.locator('[data-ludic-selection-handle]')).toHaveCount(0);
  await expect(page.locator('[data-ludic-selection-menu]')).toHaveCount(0);
});

test('native scroll tiles retain selection and selectable text occupies UI input', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Uses mouse gestures.');
  await page.goto('/tests/browser/selection/?scroll=native');
  await page.waitForFunction(
    () =>
      (window as any).selectionDemo?.ready && (window as any).selectionDemo.scrolls.one.getSnapshot().mode === 'native',
  );
  const geometry = await page.evaluate(() => (window as any).selectionDemo.boxes['one:scroll']);
  const p = await point(page, 'one', geometry.x + 25, geometry.y + 20);
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(() => selected(page)).toBe('Log');
  await page.evaluate(() => (window as any).selectionDemo.scrolls.one.scrollTo(70));
  await expect.poll(() => page.evaluate(() => (window as any).selectionDemo.scrolls.one.getSnapshot().offset)).toBe(70);
  expect(await selected(page)).toBe('Log');
  const first = await textPoint(page, 'first');
  expect(
    await page.evaluate(
      (p) => (window as any).selectionDemo.roots[0].isPointerOverUI({ clientX: p.x, clientY: p.y }),
      first,
    ),
  ).toBe(true);
});

test('browser Copy command writes the selected text to the clipboard', async ({ page, browserName, context }) => {
  test.skip(browserName !== 'chromium', 'Clipboard permission automation is Chromium-specific.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#one').focus();
  await page.keyboard.press('ControlOrMeta+a');
  const text = await selected(page);
  await page.keyboard.press('ControlOrMeta+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(text);
});
