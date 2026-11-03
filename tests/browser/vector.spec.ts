import { expect, test } from '@playwright/test';

test('vector contain and cover preserve source aspect through raster buckets and resizing', async ({ page }) => {
  await page.goto('/tests/browser/vector/');
  await expect(page.locator('output')).toHaveText('contain/300');
  for (const width of [300, 390]) {
    for (const fit of ['contain', 'cover', 'fill']) {
      await page.evaluate(({ fit, width }) => (window as any).vectors.configure(fit, width), { fit, width });
      await expect(page.locator('output')).toHaveText(`${fit}/${width}`);
      await expect.poll(() => page.evaluate(() => (window as any).vectors.sample().loaded)).toBe(true);
      const result = await page.evaluate(() => (window as any).vectors.sample());
      const expectedWidth = fit === 'contain' ? 10 : width / 10;
      const expectedHeight = fit === 'cover' ? width / 10 : 10;
      expect(Math.abs(result.width - expectedWidth), `${fit}/${width}: marker width`).toBeLessThanOrEqual(2);
      expect(Math.abs(result.height - expectedHeight), `${fit}/${width}: marker height`).toBeLessThanOrEqual(2);
    }
  }
  expect(await page.evaluate(() => (window as any).vectors.errors)).toEqual([]);
  await page.evaluate(() => (window as any).vectors.root.destroy());
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
});

test('stable vector identifiers refresh pixels and release old texture storage on invalidation', async ({ page }) => {
  await page.goto('/tests/browser/vector/');
  await expect(page.locator('output')).toHaveText('contain/300');
  await expect.poll(() => page.evaluate(() => (window as any).vectors.sample().loaded)).toBe(true);
  const initialBytes = await page.evaluate(() => (window as any).vectors.sample().frame.textureBytes);
  for (const color of ['#0000ff', '#00ff00', '#0000ff']) {
    expect(await page.evaluate((color) => (window as any).vectors.update(color), color)).toBe(0);
    await expect.poll(() => page.evaluate(() => (window as any).vectors.sample().loaded)).toBe(true);
    expect(await page.evaluate(() => (window as any).vectors.sample().frame.textureBytes)).toBe(initialBytes);
  }
  expect(await page.evaluate(() => (window as any).vectors.errors)).toEqual([]);
  await page.evaluate(() => (window as any).vectors.root.destroy());
});
