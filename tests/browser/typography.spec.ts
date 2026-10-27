import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/typography/');
  await expect(page.locator('#status')).toContainText('"textWidth":40');
});
test('fallback changes Yoga measurement and uses the fallback atlas for glyphs and shadows', async ({ page }) => {
  expect(await page.evaluate(() => (window as any).typography.root.inspect().c[0].c[0].box[2])).toBe(22);
  const pixel = await page.evaluate(() => {
    const { gl, canvas } = (window as any).typography;
    const value = new Uint8Array(4);
    gl.readPixels(30, canvas.height - 43, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, value);
    return [...value];
  });
  expect(pixel).toEqual([255, 255, 255, 255]);
  await page.evaluate(() => (window as any).typography.render(false));
  await expect(page.locator('#status')).toContainText('"textWidth":36');
  await expect(page.locator('#status')).toContainText('"codePoint":937');
  await page.evaluate(() => (window as any).typography.render(true, false));
  await expect(page.locator('#status')).toContainText('"textWidth":40');
  const tree = await page.evaluate(() => (window as any).typography.root.inspect());
  expect(tree.c[0].c[0].box[2]).toBe(24);
  await expect(page.locator('#status')).toContainText('"errors":[]');
});
test('font atlas recovery retains fallback selection and layout', async ({ page }) => {
  await page.evaluate(() => (window as any).typography.contextLoss.loseContext());
  await expect(page.locator('#status')).toContainText('"contextLost":true');
  await page.evaluate(() => (window as any).typography.contextLoss.restoreContext());
  await expect(page.locator('#status')).toContainText('"restored":1');
  await expect(page.locator('#status')).toContainText('"contextLost":false');
  await expect(page.locator('#status')).toContainText('"textWidth":40');
  await expect(page.locator('#status')).toContainText('"diagnostics":[]');
  await expect(page.locator('#status')).toContainText('"errors":[]');
});

test('a throwing diagnostic callback reaches onError and leaves rendering usable', async ({ page }) => {
  const uncaught: string[] = [];
  page.on('pageerror', (error) => uncaught.push(error.message));
  await page.evaluate(() => {
    (window as any).typography.failDiagnosticCallback();
    (window as any).typography.render(false);
  });
  await expect(page.locator('#status')).toContainText('"errors":["Error: Diagnostic callback failed"]');
  await expect(page.locator('#status')).toContainText('"textWidth":36');
  await page.evaluate(() => (window as any).typography.render(true));
  await expect(page.locator('#status')).toContainText('"textWidth":40');
  expect(uncaught).toEqual([]);
});
