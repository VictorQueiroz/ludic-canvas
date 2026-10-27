import { expect, test } from '@playwright/test';

test('frame profiling is opt-in and reports finite stage times and retained/submitted counts', async ({ page }) => {
  await page.goto('/tests/browser/');
  await expect(page.getByRole('button', { name: 'Below', exact: true })).toBeAttached();
  expect(await page.evaluate(() => (window as any).contract.state.profile)).toBeUndefined();
  await page.goto('/tests/browser/?profile');
  await expect(page.getByRole('button', { name: 'Below', exact: true })).toBeAttached();
  const frame = await page.evaluate(() => (window as any).contract.state);
  expect(frame.profile).toBeDefined();
  const { layoutMs, readLayoutMs, paintMs, inputMs, totalMs, mountedNodes, paintedNodes, submittedQuads } =
    frame.profile;
  for (const value of [layoutMs, readLayoutMs, paintMs, inputMs, totalMs]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
  expect(totalMs).toBeGreaterThanOrEqual(layoutMs + readLayoutMs + paintMs + inputMs - 0.001);
  expect(mountedNodes).toBeGreaterThan(4);
  expect(paintedNodes).toBeGreaterThan(4);
  expect(paintedNodes).toBeLessThanOrEqual(mountedNodes);
  expect(submittedQuads).toBeGreaterThan(0);
});
