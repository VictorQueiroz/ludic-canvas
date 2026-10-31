import { test, expect } from '@playwright/test';

for (const mode of ['ui', 'external']) {
  test(`map example routes ${mode} wheel input and blocks sidebar zoom`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-webkit', 'Mobile WebKit does not support mouse wheel injection.');
    await page.goto('http://127.0.0.1:6174/input/');
    const stage = page.locator(`#map-${mode}`);
    await expect(stage.getByRole('button', { name: 'Reset map zoom' })).toBeEnabled();
    await expect(page.locator('#map-external').getByRole('button', { name: 'Reset map zoom' })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`map-${mode}.png`), fullPage: true });
    await stage.scrollIntoViewIfNeeded();
    const rect = (await stage.boundingBox())!;
    const status = page.locator(`#zoom-${mode}`);
    await page.mouse.move(rect.x + 50, rect.y + 100);
    await page.mouse.wheel(0, 100);
    await expect(status).not.toHaveText('Map zoom: 1.00×');
    const zoom = await status.textContent();
    const list = stage.getByRole('region', { name: 'Map waypoints' });
    await expect(list).toBeAttached();
    await page.mouse.move(rect.x + rect.width - 50, rect.y + 75);
    await page.mouse.wheel(0, 10000);
    // Wait for the last row to reach the clipped list viewport before testing its boundary.
    await expect
      .poll(async () => {
        const row = (await stage.getByRole('button', { name: 'Waypoint 12', exact: true }).boundingBox())!;
        const reset = (await stage.getByRole('button', { name: 'Reset map zoom' }).boundingBox())!;
        return row.y + row.height <= reset.y;
      })
      .toBe(true);
    await page.mouse.wheel(0, 100);
    await expect(status).toHaveText(zoom!);
    await stage.getByRole('button', { name: 'Reset map zoom' }).press('Enter');
    await expect(status).toHaveText('Map zoom: 1.00×');
  });
}
