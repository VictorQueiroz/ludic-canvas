import { describe, expect, it } from 'vitest';
import { evaluateBudgets, summarize } from '../docs/performance/report.ts';

describe('performance evidence', () => {
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
