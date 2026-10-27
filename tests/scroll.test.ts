import { expect, it } from 'vitest';
import { createScrollHandle } from '../src/index.ts';

it('creates independent immutable scroll stores and rejects invalid commands', () => {
  const a = createScrollHandle(),
    b = createScrollHandle();
  expect(a.getSnapshot()).toBe(a.getSnapshot());
  expect(a.getSnapshot().connected).toBe(false);
  expect(Object.isFrozen(a.getSnapshot())).toBe(true);
  expect(a.getSnapshot()).not.toBe(b.getSnapshot());
  expect(() => a.scrollTo(NaN)).toThrow('finite');
  expect(() => a.scrollBy(Infinity)).toThrow('finite');
});
