import { runBenchmark, type BenchmarkOptions, type BenchmarkReport } from './runner.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#performance-canvas')!;
const form = document.querySelector<HTMLFormElement>('#performance-options')!;
const status = document.querySelector<HTMLOutputElement>('#performance-status')!;
const start = document.querySelector<HTMLButtonElement>('#performance-start')!;
const stop = document.querySelector<HTMLButtonElement>('#performance-stop')!;
const download = document.querySelector<HTMLAnchorElement>('#performance-download')!;
const summary = document.querySelector<HTMLElement>('#performance-results')!;
const raw = document.querySelector<HTMLElement>('#performance-json')!;
let active: AbortController | undefined;
let report: BenchmarkReport | undefined;
let url = '';

function budget(name: string) {
  const value = (form.elements.namedItem(name) as HTMLInputElement).value;
  return value.trim() ? Number(value) : undefined;
}
async function run(overrides: Omit<Partial<BenchmarkOptions>, 'signal'> = {}) {
  if (active) throw new Error('A benchmark is already running');
  const lifetime = (active = new AbortController());
  start.disabled = true;
  stop.disabled = false;
  download.hidden = true;
  summary.replaceChildren();
  raw.textContent = '';
  report = undefined;
  if (url) {
    URL.revokeObjectURL(url);
    url = '';
  }
  const hidden = () => {
    if (document.visibilityState !== 'visible')
      lifetime.abort(new Error('Tab became hidden; repeat with the tab visible'));
  };
  document.addEventListener('visibilitychange', hidden);
  try {
    const budgets = {} as NonNullable<BenchmarkOptions['budgets']>;
    const cpu = budget('cpu'),
      interval = budget('interval');
    if (cpu !== undefined) budgets.cpuFrameP95Ms = cpu;
    if (interval !== undefined) budgets.frameIntervalP95Ms = interval;
    report = await runBenchmark(canvas, {
      hardwareLabel: (form.elements.namedItem('hardware') as HTMLInputElement).value,
      sampleFrames: Number((form.elements.namedItem('frames') as HTMLInputElement).value),
      budgets,
      ...overrides,
      signal: lifetime.signal,
      onProgress(message) {
        status.textContent = message;
      },
    });
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const label of ['Workload', 'Nodes', 'CPU frame p95', 'Interval p95', 'Draw calls (max)', 'Budget']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      head.appendChild(th);
    }
    const body = table.createTBody();
    for (const result of report.results) {
      const row = body.insertRow();
      for (const value of [
        result.workload,
        result.nodes,
        `${result.cpuFrameMs.summary.p95.toFixed(2)} ms`,
        `${result.frameIntervalMs.summary.p95.toFixed(2)} ms`,
        result.maxDrawCalls,
        result.budget.status,
      ])
        row.insertCell().textContent = String(value);
    }
    summary.appendChild(table);
    const json = JSON.stringify(report, null, 2);
    raw.textContent = json;
    url = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
    download.href = url;
    download.download = `ludic-canvas-performance-${Date.now()}.json`;
    download.hidden = false;
    status.textContent = `Complete: ${report.results.length} workloads and ${report.lifecycle.length} teardown cycles. Qualification: microbenchmark only.`;
    return report;
  } catch (error) {
    status.textContent = `Incomplete: ${error instanceof Error ? error.message : String(error)}. No completed report was produced.`;
    throw error;
  } finally {
    document.removeEventListener('visibilitychange', hidden);
    active = undefined;
    start.disabled = false;
    stop.disabled = true;
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void run().catch(() => {});
});
stop.addEventListener('click', () => active?.abort(new Error('Stopped by operator')));
addEventListener(
  'pagehide',
  () => {
    active?.abort(new Error('Page closed'));
    if (url) URL.revokeObjectURL(url);
  },
  { once: true },
);
// The same entry point serves interactive acquisition and the CI structural smoke test.
Object.assign(window, {
  ludicPerformance: {
    run,
    get report() {
      return report;
    },
  },
});
