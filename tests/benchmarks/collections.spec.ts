import { expect, test, type CDPSession } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { BenchmarkReport } from '../../docs/performance/runner.ts';

async function save(path: string, data: string | Buffer) {
  await writeFile(path, data);
  await writeFile(path + '.sha256', `${createHash('sha256').update(data).digest('hex')}  ${path.split('/').at(-1)}\n`);
}
async function finishTrace(client: CDPSession, path: string) {
  const completed = new Promise<{ stream?: string; dataLossOccurred: boolean }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Trace flush exceeded 15 seconds')), 15000);
    client.once('Tracing.tracingComplete', (event) => {
      clearTimeout(timeout);
      resolve(event);
    });
  });
  await client.send('Tracing.end');
  const event = await completed;
  if (!event.stream || event.dataLossOccurred) throw new Error('Incomplete Chrome trace');
  const chunks: Buffer[] = [];
  try {
    for (;;) {
      const chunk = await client.send('IO.read', { handle: event.stream, size: 1024 * 1024 });
      chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
      if (chunk.eof) break;
    }
  } finally {
    await client.send('IO.close', { handle: event.stream });
  }
  await save(path, Buffer.concat(chunks));
}

test('acquire repeated hardware collection runs and an optional diagnostic trace', async ({ page }, testInfo) => {
  const hardwareLabel = process.env.LUDIC_BENCHMARK_LABEL;
  if (!hardwareLabel)
    throw new Error('Set LUDIC_BENCHMARK_LABEL to the verified hardware/OS model before acquiring evidence');
  const repetitions = Number(process.env.LUDIC_BENCHMARK_RUNS ?? 3);
  const sampleFrames = Number(process.env.LUDIC_BENCHMARK_FRAMES ?? 120);
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) throw new Error('Use 1 to 10 repetitions');
  const directory = join('build/benchmarks', new Date().toISOString().replaceAll(':', '-'));
  await mkdir(directory, { recursive: true });
  await page.goto('http://127.0.0.1:6176/performance/');
  await page.waitForFunction(() => !!(window as any).ludicPerformance);
  const run = async (index: number, profile: boolean) => {
    const report: BenchmarkReport = await page.evaluate(
      async (options) => (window as any).ludicPerformance.run(options),
      {
        suite: 'collections-v1',
        hardwareLabel,
        execution: 'automated-browser',
        sampleFrames,
        warmupFrames: 20,
        lifecycleCycles: 5,
        profile,
        order: index % 2 ? 'reverse' : 'forward',
        budgets: { cpuFrameP95Ms: 4 },
      },
    );
    const name = profile ? 'diagnostic' : `run-${index + 1}`;
    const acquired = {
      ...report,
      acquisition: {
        browser: 'installed Chrome, isolated Playwright context, headed',
        tracing: profile && process.env.LUDIC_BENCHMARK_TRACE === '1',
        timingAcceptance: profile ? 'diagnostic-only' : 'operator-supplied-budget',
      },
    };
    await save(join(directory, name + '.json'), JSON.stringify(acquired, null, 2) + '\n');
    expect(report.revision).not.toMatch(/dirty|unrecorded/);
    expect(report.environment.gpu).not.toMatch(/SwiftShader|llvmpipe|software/i);
    expect(report.errors).toEqual([]);
    expect(report.lifecycle.every((cycle) => cycle.remainingMirrors === 0)).toBe(true);
    console.log(
      JSON.stringify({
        artifact: join(directory, name + '.json'),
        gpu: report.environment.gpu,
        results: report.results.map((result) => ({
          workload: result.workload,
          nodes: result.nodes,
          p95: result.cpuFrameMs.summary.p95,
          budget: result.budget.status,
        })),
      }),
    );
  };
  for (let index = 0; index < repetitions; index++) await run(index, false);
  if (process.env.LUDIC_BENCHMARK_TRACE === '1') {
    const client = await page.context().newCDPSession(page);
    await client.send('Tracing.start', {
      transferMode: 'ReturnAsStream',
      streamFormat: 'json',
      streamCompression: 'gzip',
      traceConfig: {
        recordMode: 'recordContinuously',
        includedCategories: ['devtools.timeline', 'v8', 'blink.user_timing', 'disabled-by-default-v8.cpu_profiler'],
      },
    });
    try {
      await run(0, true);
    } finally {
      await finishTrace(client, join(directory, 'diagnostic.trace.json.gz'));
      await client.detach();
    }
  }
  await page.screenshot({ path: join(directory, 'results.png') });
  await testInfo.attach('acquisition-directory', { body: directory, contentType: 'text/plain' });
});
