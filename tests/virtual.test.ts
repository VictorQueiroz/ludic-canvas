import { expect, it } from 'vitest';
import { fixedRange, offsetForIndex } from '../src/virtual/range.ts';
import { createVirtualListHandle } from '../src/index.ts';

it('collection handles reject operations before a collection is mounted', async () => {
  const handle = createVirtualListHandle();
  expect(handle.scrollToIndex(0)).toBe(false);
  expect(await handle.focusIndex(0)).toBe(false);
  expect(await handle.focusKey('missing')).toBe(false);
  expect(handle.scroll.getSnapshot().connected).toBe(false);
});

it('bounds mounted ranges by the viewport, including boundaries and empty/hidden lists', () => {
  for (const count of [400, 4000, 40000]) {
    const range = fixedRange({ count, itemHeight: 36, gap: 4, padding: 12, viewport: 240, offset: 1000, overscan: 2 });
    expect(range.end - range.start).toBeLessThanOrEqual(11);
    expect(range.start).toBe(22);
    expect(range.totalHeight).toBe(count * 40 - 4 + 24);
  }
  expect(fixedRange({ count: 0, itemHeight: 40, viewport: 240, offset: 100, overscan: 2 })).toMatchObject({
    start: 0,
    end: 0,
    offset: 0,
  });
  expect(fixedRange({ count: 10, itemHeight: 40, viewport: 0, offset: 0, overscan: 2 })).toMatchObject({
    start: 0,
    end: 0,
  });
  expect(fixedRange({ count: 10, itemHeight: 40, viewport: 80, offset: -100, overscan: 0 })).toMatchObject({
    start: 0,
    end: 2,
    offset: 0,
  });
  expect(fixedRange({ count: 10, itemHeight: 40, viewport: 80, offset: 10000, overscan: 0 })).toMatchObject({
    start: 8,
    end: 10,
    offset: 320,
  });
});
it('aligns distant items and preserves the offset of already visible rows', () => {
  const options = { count: 100, itemHeight: 40, viewport: 200, offset: 400, index: 12 };
  expect(offsetForIndex({ ...options, align: 'auto' })).toBe(400);
  expect(offsetForIndex({ ...options, align: 'start' })).toBe(480);
  expect(offsetForIndex({ ...options, index: 99, align: 'start' })).toBe(3800);
  expect(offsetForIndex({ ...options, index: 0, align: 'end' })).toBe(0);
  expect(offsetForIndex({ ...options, index: 50, align: 'center' })).toBe(1920);
  expect(() => offsetForIndex({ ...options, index: 100 })).toThrow('index');
});
it('rejects invalid geometry instead of allocating or passing NaN into Yoga', () => {
  const valid = { count: 100, itemHeight: 40, viewport: 200, offset: 0, overscan: 2 };
  for (const patch of [
    { count: -1 },
    { count: 1.5 },
    { itemHeight: 0 },
    { itemHeight: Infinity },
    { viewport: NaN },
    { gap: -1 },
    { overscan: 1.5 },
  ]) {
    expect(() => fixedRange({ ...valid, ...patch })).toThrow();
  }
});
