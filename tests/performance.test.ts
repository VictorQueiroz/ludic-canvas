import { describe, expect, it } from 'vitest';
import { evaluateBudgets, summarize } from '../docs/performance/report.ts';
import { collectionOffset } from '../docs/performance/collections.tsx';

describe('performance evidence', () => {
  it('uses bounded deterministic pixel motion and the same distant-jump schedule for matched collections', () => {
    for (const max of [0, 100, 15480, 159480]) {
      const offsets = Array.from({ length: 120 }, (_, frame) => collectionOffset(frame, max));
      expect(offsets.every((offset) => offset >= 0 && offset <= max)).toBe(true);
      expect(offsets[0]).toBe(0);
      expect(offsets[30]).toBe(max / 2);
      expect(collectionOffset(120, max)).toBe(0);
    }
    expect(collectionOffset(1, 15480)).toBe(12);
    expect(collectionOffset(1, 159480)).toBe(12);
  });
  it('reports nearest-rank distributions without mutating or rounding acquired samples', () => {
    const samples = [100, 0.125, 4, 2, 1];
    expect(summarize(samples)).toEqual({ count: 5, min: 0.125, median: 2, p95: 100, max: 100, mean: 21.425 });
    expect(samples).toEqual([100, 0.125, 4, 2, 1]);
    expect(() => summarize([])).toThrow('nonempty');
    expect(() => summarize([NaN])).toThrow('finite');
  });
  it('requires explicit budgets and keeps frame cadence separate from CPU submission', () => {
    expect(evaluateBudgets([1, 2], [16, 40], {})).toEqual({ status: 'not-set', checks: [] });
    const result = evaluateBudgets([1, 2], [16, 40], { cpuFrameP95Ms: 3, frameIntervalP95Ms: 20 });
    expect(result.status).toBe('failed');
    expect(result.checks.map((check) => check.passed)).toEqual([true, false]);
    expect(() => evaluateBudgets([1], [16], { cpuFrameP95Ms: 0 })).toThrow('positive');
  });
});
