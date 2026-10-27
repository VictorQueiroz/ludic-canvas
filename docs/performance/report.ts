/** Nearest-rank percentiles. Raw samples remain in each downloadable report. */
export function summarize(samples: readonly number[]) {
  if (!samples.length || samples.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error('Provide nonempty, finite, nonnegative measurement samples');
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
  return {
    count: samples.length,
    min: sorted[0]!,
    median: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1)!,
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
  };
}

export interface PerformanceBudgets {
  cpuFrameP95Ms?: number;
  frameIntervalP95Ms?: number;
}
export function evaluateBudgets(cpu: readonly number[], intervals: readonly number[], budgets: PerformanceBudgets) {
  const checks = Object.entries(budgets).map(([metric, limit]) => {
    if (!Number.isFinite(limit) || limit <= 0) throw new Error('Performance budgets must be positive finite numbers');
    const measured = summarize(metric === 'cpuFrameP95Ms' ? cpu : intervals).p95;
    return { metric, limit, measured, passed: measured <= limit };
  });
  return { status: checks.length ? (checks.every((check) => check.passed) ? 'passed' : 'failed') : 'not-set', checks };
}
