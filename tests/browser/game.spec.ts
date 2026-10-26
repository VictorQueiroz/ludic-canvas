import { test, expect } from '@playwright/test';

test('the built game launches, scopes pause input and resumes with keyboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:6174/play/');
  await page.getByRole('button', { name: 'Launch courier', exact: true }).press('Enter');
  await expect(page.locator('#game-ui')).toBeFocused();
  await expect(page.locator('#game-stats')).toContainText('2 MSDF families');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume flight', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Pause flight', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Pause flight', exact: true })).toBeAttached();
  await expect(page.locator('#game-ui')).toBeFocused();
  expect(errors).toEqual([]);
});

test('the built game fits a narrow viewport with both font families', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('http://127.0.0.1:6174/play/');
  await expect(page.getByRole('button', { name: 'Launch courier', exact: true })).toBeAttached();
  await expect(page.locator('#game-stats')).toContainText('2 MSDF families');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const box = await page.locator('#game-ui').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(320);
  expect(box!.height).toBeGreaterThan(0);
});
