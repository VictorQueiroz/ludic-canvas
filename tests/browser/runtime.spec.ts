import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error('Browser page error:', error.message));
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

test('a startup modal returns focus to the canvas when no prior control exists', async ({ page }) => {
  await scenario(page, 'modal');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).press('Enter');
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('b');
  await count(page, 1);
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
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as any).contract.root.inspect())))
    .toContain('Below 1');
  await page.locator('#loss').click();
  await expect(page.locator('#status')).toContainText('"contextLost":true');
  await page.locator('#restore').click();
  await expect(page.locator('#status')).toContainText('"restored":1');
  await expect(page.locator('#status')).toContainText('"contextLost":false');
  await count(page, 1);
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as any).contract.root.inspect())))
    .toContain('Below 1');
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

test('engine-owned backing dimensions keep CSS layout and pointer coordinates', async ({ page }) => {
  await page.locator('#size').click();
  await expect(page.locator('#status')).toContainText('"height":240');
  await scenario(page, 'scale');
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box!.x + 80, box!.y + 80);
  await count(page, 1);
  await expect(page.locator('#status')).toContainText('"cssHeight":360');
});

test('UI frames preserve the engine VAO and its element buffer', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { root, gl } = (window as any).contract;
    const ext = gl.getExtension('OES_vertex_array_object');
    if (!ext) throw new Error('VAO extension unavailable');
    const vao = ext.createVertexArrayOES(),
      indices = gl.createBuffer();
    ext.bindVertexArrayOES(vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]), gl.STATIC_DRAW);
    root.frame();
    const same =
      gl.getParameter(ext.VERTEX_ARRAY_BINDING_OES) === vao &&
      gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) === indices;
    ext.bindVertexArrayOES(null);
    ext.deleteVertexArrayOES(vao);
    gl.deleteBuffer(indices);
    return same;
  });
  expect(result).toBe(true);
});

test('separate roots own cancellation, parent styles and duplicate-mount guards', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).contract,
      parent = document.querySelector('#stage')! as HTMLElement;
    let duplicate = false;
    try {
      await api.createUI({ canvas: api.canvas });
    } catch (error) {
      duplicate = String(error).includes('already');
    }
    const second = document.createElement('canvas');
    parent.appendChild(second);
    const lifetime = new AbortController();
    const other = await api.createUI({ canvas: second, signal: lifetime.signal, autoStart: false });
    api.root.destroy();
    const remains = parent.style.position === 'relative';
    lifetime.abort();
    const restored = parent.style.position === '';
    const mirrors = parent.querySelectorAll('[data-ludic-canvas]').length;
    second.remove();
    return { duplicate, remains, restored, mirrors };
  });
  expect(result).toEqual({ duplicate: true, remains: true, restored: true, mirrors: 0 });
});

test('touch input activates a control once', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch project only');
  const box = await page.locator('canvas').boundingBox();
  await page.touchscreen.tap(box!.x + 40, box!.y + 30);
  await count(page, 1);
});

test('secondary pointers and cancellation cannot trigger a primary press', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box!.x + 40, box!.y + 30);
  await page.mouse.down();
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!,
      box = canvas.getBoundingClientRect();
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 99,
          pointerType: 'touch',
          isPrimary: false,
          button: 0,
          buttons: 1,
          clientX: box.left + 40,
          clientY: box.top + 30,
        }),
      );
  });
  await page.mouse.up();
  await count(page, 1);
  await page.evaluate(() =>
    document.querySelector('canvas')!.addEventListener(
      'pointerdown',
      (e) => {
        (window as any).cancelId = e.pointerId;
      },
      { once: true },
    ),
  );
  await page.mouse.down();
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    canvas.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: (window as any).cancelId, pointerType: 'mouse', isPrimary: true }),
    );
  });
  await page.mouse.up();
  await count(page, 1);
  await expect(page.locator('#status')).toContainText('"errors":0');
});
