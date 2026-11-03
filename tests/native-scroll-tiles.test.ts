import { expect, it } from 'vitest';
import { planTiles, RASTER_BUDGET, TILE_HEIGHT } from '../docs/native-scroll/tiles.ts';

it('covers fractional scroll positions and both boundaries within a bounded raster budget', () => {
  for (const width of [280, 480])
    for (const dpr of [1, 1.5, 2])
      for (const raw of [-75, 0, 383.75, 5000.5, 100000]) {
        const plan = planTiles(raw, width, 384, 7200, dpr);
        expect(plan.estimatedBytes).toBeLessThanOrEqual(RASTER_BUDGET);
        expect(plan.indices[0]! * TILE_HEIGHT).toBeLessThanOrEqual(plan.offset);
        expect((plan.indices.at(-1)! + 1) * TILE_HEIGHT).toBeGreaterThanOrEqual(plan.offset + 384);
        expect(plan.offset).toBe(Math.max(0, Math.min(raw, 6816)));
      }
});

it('handles content shorter than the viewport and refuses impossible allocations', () => {
  expect(planTiles(99, 320, 384, 120, 2).indices).toEqual([0]);
  expect(() => planTiles(0, 4000, 1000, 7200, 3)).toThrow('budget');
  expect(() => planTiles(NaN, 320, 384, 7200, 1)).toThrow('finite');
  expect(() => planTiles(0, 0, 384, 7200, 1)).toThrow('positive');
});
