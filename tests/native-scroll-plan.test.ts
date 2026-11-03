import { expect, it } from 'vitest';
import { planNativeTiles, NATIVE_SCROLL_BUDGET } from '../src/browser/native-scroll-plan.ts';

it('covers fractional offsets and preserves bounded overscan at both ends', () => {
  for (const offset of [-40, 0, 239.75, 5001.5, 100000]) {
    const plan = planNativeTiles(320, 240, 8000, offset, 2, 240, NATIVE_SCROLL_BUDGET)!;
    const at = Math.max(0, Math.min(offset, 7760));
    expect(plan.start).toBeLessThanOrEqual(at);
    expect(plan.end).toBeGreaterThanOrEqual(at + 240);
    expect(plan.indices.length).toBeLessThanOrEqual(4);
    expect(plan.bytes).toBeLessThanOrEqual(NATIVE_SCROLL_BUDGET);
  }
});

it('rejects invalid geometry and surfaces without room for compositor coverage', () => {
  expect(planNativeTiles(320, 240, 8000, 0, 2, 240, 100)).toBeUndefined();
  expect(planNativeTiles(320, 240, 200, 0, 2, 240, NATIVE_SCROLL_BUDGET)).toBeUndefined();
  expect(planNativeTiles(NaN, 240, 8000, 0, 2, 240, NATIVE_SCROLL_BUDGET)).toBeUndefined();
  expect(planNativeTiles(320, 240, 8000, 0, 2, 0, NATIVE_SCROLL_BUDGET)).toBeUndefined();
});
