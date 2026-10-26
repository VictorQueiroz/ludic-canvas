import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/');
  await expect(page.locator('#status')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Below', exact: true })).toBeVisible();
});
async function scenario(page: import('@playwright/test').Page, name: string) {
  await page.locator('#scenario').selectOption(name);
  await expect(page.locator('#status')).toContainText(`"scenario":"${name}"`);
}
async function count(page: import('@playwright/test').Page, n: number) {
  await expect(page.locator('#status')).toContainText(`"count":${n},`);
}

test('disabled controls block pointer click-through', async ({ page }) => {
  await scenario(page, 'disabled');
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box!.x + 40, box!.y + 30);
  await count(page, 0);
  await expect(page.locator('#status')).toContainText('"errors":0');
});
test('modal isolates hotkeys, traps Tab and restores focus', async ({ page }) => {
  await page.getByRole('button', { name: 'Below', exact: true }).focus();
  await scenario(page, 'modal');
  const close = page.getByRole('button', { name: 'Close dialog', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('b');
  await count(page, 0);
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Other action', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Below', exact: true })).toBeFocused();
  await page.keyboard.press('b');
  await count(page, 1);
});
test('pointer capture and keyboard semantics support a slider', async ({ page }) => {
  await scenario(page, 'pointer');
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box!.x + 30, box!.y + 100);
  await page.mouse.down();
  await page.mouse.move(box!.x + 90, box!.y + 100);
  await page.mouse.up();
  const slider = page.getByRole('slider', { name: 'Volume' });
  await expect(slider).toHaveAttribute('aria-valuenow', '80');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '81');
});
test('scale propagates to child drawing and hit testing', async ({ page }) => {
  await scenario(page, 'scale');
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box!.x + 80, box!.y + 80);
  await count(page, 1);
  const pixel = await page.evaluate(() => {
    const c = (window as any).contract;
    const out = new Uint8Array(4);
    c.gl.readPixels(80, c.canvas.height - 81, 1, 1, c.gl.RGBA, c.gl.UNSIGNED_BYTE, out);
    return [...out];
  });
  expect(pixel).toEqual([255, 0, 0, 255]);
});
test('focus reveals offscreen scroll items and percentage padding stays finite', async ({ page }) => {
  await scenario(page, 'scroll');
  await expect(page.getByRole('button', { name: 'Item 11', exact: true })).toBeAttached();
  expect(await page.evaluate(() => (window as any).contract.root.focus('item-11'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Item 11', exact: true })).toBeFocused();
  await expect
    .poll(async () => page.getByRole('button', { name: 'Item 11', exact: true }).boundingBox())
    .not.toBeNull();
  await page.keyboard.press('Enter');
  await count(page, 11);
});
test('context loss rebuilds GPU resources and preserves React state', async ({ page }) => {
  await page.getByRole('button', { name: 'Below', exact: true }).focus();
  await page.keyboard.press('Enter');
  await count(page, 1);
  await page.locator('#loss').click();
  await expect(page.locator('#status')).toContainText('"contextLost":true');
  await page.locator('#restore').click();
  await expect(page.locator('#status')).toContainText('"restored":1');
  await expect(page.locator('#status')).toContainText('"contextLost":false');
  await count(page, 1);
  await expect(page.locator('#status')).toContainText('"errors":0');
});
test('transparent images use premultiplied alpha without inherited flip state', async ({ page }) => {
  await page.evaluate(() => {
    const gl = (window as any).contract.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  });
  await scenario(page, 'image');
  await expect.poll(() => page.evaluate(() => (window as any).contract.root.frame().textureBytes)).toBeGreaterThan(0);
  const pixels = await page.evaluate(() => {
    const { gl, canvas } = (window as any).contract;
    return [90, 170].map((y) => {
      const out = new Uint8Array(4);
      gl.readPixels(50, canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return [...out];
    });
  });
  expect(pixels[0]![0]).toBeGreaterThanOrEqual(135);
  expect(pixels[0]![0]).toBeLessThanOrEqual(137);
  expect(pixels[0]![1]).toBeGreaterThanOrEqual(15);
  expect(pixels[1]).toEqual([0, 255, 0, 255]);
});
test('hidden canvas suspends controls, destroy removes mirrors and permits remount', async ({ page }) => {
  await page.locator('#hidden').click();
  await expect(page.getByRole('button', { name: 'Below', exact: true })).toBeDisabled();
  await page.locator('#hidden').click();
  await expect(page.getByRole('button', { name: 'Below', exact: true })).toBeEnabled();
  await page.locator('#destroy').click();
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
  await page.locator('#recreate').click();
  await expect(page.getByRole('button', { name: 'Below', exact: true })).toBeAttached();
});
test('large HUD stays within the batch draw-call budget', async ({ page }) => {
  await scenario(page, 'stress');
  await expect.poll(() => page.evaluate(() => (window as any).contract.root.frame().drawCalls)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).contract.root.frame().drawCalls)).toBeLessThan(8);
  await expect(page.locator('#status')).toContainText('"errors":0');
});
