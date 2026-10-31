import { test, expect } from '@playwright/test';

test('the shared native example works through the browser host', async ({ page }) => {
  await page.goto('/examples/portable/');
  const add = page.getByRole('button', { name: 'Add one', exact: true });
  await expect(add).toBeEnabled();
  expect(
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas')!;
      canvas.style.marginLeft = '1100px';
      const box = canvas.getBoundingClientRect();
      const ui = (window as any).portableUI;
      const event = new WheelEvent('wheel', { clientX: box.left + 50, clientY: box.top + 140 });
      const result = ui.isPointerOverUI(event);
      canvas.style.marginLeft = '';
      return result;
    }),
  ).toBe(true);
  await add.press('Enter');
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as any).portableUI.inspect())))
    .toContain('Count: 1');
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada');
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as any).portableUI.inspect())))
    .toContain('Hello, Ada.');
  await page.getByRole('button', { name: 'Open dialog' }).press('Enter');
  const close = page.getByRole('button', { name: 'Close dialog' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(close).toHaveCount(0);
  await page.evaluate(() => (window as any).portableUI.destroy());
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveCount(0);
});
