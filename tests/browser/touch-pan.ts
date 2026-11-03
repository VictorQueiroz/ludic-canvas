import { expect, type Locator, type Page } from '@playwright/test';

/** Trusted touch input with a stationary release, equivalent to a pan without a fling. */
export async function panTouch(page: Page, target: Locator, distance = 220) {
  await target.scrollIntoViewIfNeeded();
  await (await target.elementHandle())!.waitForElementState('stable');
  const box = (await target.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: Math.min(box.y + box.height * 0.8, page.viewportSize()!.height - 12) };
  expect(
    await target.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), point),
  ).toBe(true);
  await target.evaluate((element) => {
    element.addEventListener(
      'touchstart',
      (event) => element.setAttribute('data-test-touch-trusted', String(event.isTrusted)),
      { once: true, passive: true },
    );
  });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await expect(target).toHaveAttribute('data-test-touch-trusted', 'true');
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: point.x, y: point.y - (distance * step) / 6, id: 1 }],
      });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    }
    // Hold the finger still before release so the following tap tests activation,
    // independently of momentum. Physical momentum remains device qualification.
    await page.waitForTimeout(200);
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await target.evaluate((element) => element.removeAttribute('data-test-touch-trusted'));
  }
}
