import { createUI, defaultAssets, type AtlasJson, type UIRoot, type FrameProfile } from 'ludic-canvas';
import { version } from '../../package.json';
import { evaluateBudgets, summarize, type PerformanceBudgets } from './report.ts';
import { renderCommitted, workloadElement, workloads, workloadSizes, workloadVersion } from './workloads.tsx';

declare const __LUDIC_REVISION__: string;
export interface BenchmarkOptions {
  signal: AbortSignal;
  hardwareLabel?: string;
  execution?: 'interactive-browser' | 'automated-browser' | 'ci-software-rendering';
  sampleFrames?: number;
  warmupFrames?: number;
  lifecycleCycles?: number;
  budgets?: PerformanceBudgets;
  /** Optional stage measurements. Compare only runs with the same setting. */
  profile?: boolean;
  onProgress?: (message: string) => void;
}
function countNodes(value: unknown): number {
  const node = value as { c?: unknown[] };
  return 1 + (node.c ?? []).reduce<number>((count, child) => count + countNodes(child), 0);
}
function nextFrame(signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      cancelAnimationFrame(id);
      reject(signal.reason ?? new Error('Benchmark stopped'));
    };
    const id = requestAnimationFrame((now) => {
      signal.removeEventListener('abort', abort);
      resolve(now);
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      signal.removeEventListener('abort', abort);
      abort();
    }
  });
}
function integer(value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`Expected an integer from ${min} to ${max}`);
  return value;
}

/** UI-only browser microbenchmark; no gl.finish(), GPU timers or inferred hardware certification. */
export async function runBenchmark(canvas: HTMLCanvasElement, options: BenchmarkOptions) {
  const sampleFrames = integer(options.sampleFrames ?? 120, 2, 3600);
  const warmupFrames = integer(options.warmupFrames ?? 20, 1, 300);
  const lifecycleCycles = integer(options.lifecycleCycles ?? 5, 1, 50);
  const budgets = options.budgets ?? {};
  evaluateBudgets([0], [0], budgets);
  const signal = options.signal;
  signal.throwIfAborted();
  const parent = canvas.parentElement!;
  const previousWidth = canvas.style.width;
  const metrics = (await (await fetch(defaultAssets.fontMetrics, { signal })).json()) as AtlasJson;
  const ascii: AtlasJson = {
    ...metrics,
    glyphs: metrics.glyphs.filter((glyph) => glyph.unicode <= 126),
    kerning: metrics.kerning?.filter((pair) => pair.unicode1 <= 126 && pair.unicode2 <= 126),
  };
  const fonts = [
    { name: 'interface', atlas: defaultAssets.fontAtlas, metrics: ascii },
    { name: 'latin', atlas: defaultAssets.fontAtlas, metrics },
  ];
  const errors: string[] = [];
  const diagnostics: unknown[] = [];
  const roots = new Set<UIRoot>();
  const create = async () => {
    const root = await createUI({
      canvas,
      fonts,
      autoStart: false,
      profile: options.profile ?? false,
      signal,
      maxDpr: 2,
      reducedMotion: true,
      onError: (error) => errors.push(String(error)),
      onFontDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    roots.add(root);
    return root;
  };
  const destroy = (root: UIRoot) => {
    root.destroy();
    roots.delete(root);
  };
  const check = () => {
    signal.throwIfAborted();
    if (document.visibilityState !== 'visible')
      throw new Error('Keep this tab visible; background runs are not comparable');
    if (errors.length) throw new Error(`Renderer errors: ${errors.join('; ')}`);
  };
  try {
    check();
    canvas.style.width = '960px';
    const initializedAt = performance.now();
    const root = await create();
    const initializationMs = performance.now() - initializedAt;
    const gl = canvas.getContext('webgl')!;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const environment = {
      hardwareLabel: options.hardwareLabel?.trim() || 'not-recorded',
      execution: options.execution ?? 'interactive-browser',
      userAgent: navigator.userAgent,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio: devicePixelRatio,
      gpu: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
      viewport: { width: innerWidth, height: innerHeight },
    };
    const results = [];
    for (const workload of workloads) {
      check();
      options.onProgress?.(`Running ${workload}`);
      canvas.style.width = '960px';
      const commitMs = [await renderCommitted(root, workloadElement(workload), signal)];
      const cpuFrameMs: number[] = [],
        frameIntervalMs: number[] = [],
        drawCalls: number[] = [];
      const dimensions: { width: number; height: number; dpr: number }[] = [];
      const profiles: FrameProfile[] = [];
      let previous = 0;
      const startedAt = performance.now();
      for (let i = -warmupFrames; i < sampleFrames; i++) {
        check();
        if (workload === 'telemetry' && i % 6 === 0) {
          const elapsed = await renderCommitted(root, workloadElement(workload, i + warmupFrames), signal);
          if (i >= 0) commitMs.push(elapsed);
        }
        if (workload === 'responsive-layout')
          canvas.style.width = Math.floor((i + warmupFrames) / 6) % 2 ? '360px' : '960px';
        const now = await nextFrame(signal);
        check();
        const start = performance.now();
        const frame = root.frame(now);
        const elapsed = performance.now() - start;
        if (frame.contextLost) throw new Error('Context lost; repeat after recovery');
        if (workload === 'inventory-scroll' && i % 6 === 0) {
          if (!root.focus(`bench-item-${((i + warmupFrames) * 37) % workloadSizes[workload]}`))
            throw new Error('Inventory focus/scroll workload could not reach its target');
        }
        if (i >= 0) {
          cpuFrameMs.push(elapsed);
          drawCalls.push(frame.drawCalls);
          dimensions.push({ width: frame.cssWidth, height: frame.cssHeight, dpr: frame.dpr });
          if (frame.profile) profiles.push(frame.profile);
          if (previous) frameIntervalMs.push(now - previous);
          previous = now;
        }
      }
      results.push({
        workload,
        items: workloadSizes[workload],
        nodes: countNodes(root.inspect()),
        durationMs: performance.now() - startedAt,
        cpuFrameMs: { summary: summarize(cpuFrameMs), samples: cpuFrameMs },
        frameIntervalMs: { summary: summarize(frameIntervalMs), samples: frameIntervalMs },
        renderToCommitMs: { summary: summarize(commitMs), samples: commitMs },
        maxDrawCalls: Math.max(...drawCalls),
        dimensions,
        ...(options.profile ? { profiles } : {}),
        budget: evaluateBudgets(cpuFrameMs, frameIntervalMs, budgets),
      });
    }
    destroy(root);
    const lifecycle = [];
    for (let cycle = 0; cycle < lifecycleCycles; cycle++) {
      check();
      options.onProgress?.(`Scene teardown ${cycle + 1}/${lifecycleCycles}`);
      const start = performance.now();
      const scene = await create();
      const initializeMs = performance.now() - start;
      await renderCommitted(scene, workloadElement('static-hud'), signal);
      if (scene.frame(await nextFrame(signal)).contextLost) throw new Error('Context lost during lifecycle workload');
      const nodes = countNodes(scene.inspect());
      const teardownAt = performance.now();
      destroy(scene);
      const destroyMs = performance.now() - teardownAt;
      const remainingMirrors = parent.querySelectorAll('[data-ludic-canvas="accessibility"]').length;
      if (remainingMirrors) throw new Error('Scene teardown left an accessibility surface attached');
      lifecycle.push({ cycle, initializeMs, destroyMs, nodes, remainingMirrors });
    }
    check();
    return {
      schemaVersion: 1,
      workloadVersion,
      libraryVersion: version,
      distribution: 'repository-source',
      revision: __LUDIC_REVISION__,
      timestamp: new Date().toISOString(),
      qualification: 'microbenchmark-only',
      configuration: {
        sampleFrames,
        warmupFrames,
        lifecycleCycles,
        maxDpr: 2,
        budgets,
        profile: options.profile ?? false,
        fonts: 'Two copies of bundled Barlow: ASCII primary and Latin-1 fallback',
        worldRenderer: 'none',
        cacheState: 'uncontrolled-browser-cache',
        telemetryUpdateEveryFrames: 6,
      },
      measurementNotes: {
        cpuFrameMs:
          'CPU elapsed around ui.frame(); includes Yoga, paint, input mirror and GL submission, excludes GPU execution and React commit.',
        renderToCommitMs: 'Wall-clock scheduling latency through useLayoutEffect; not isolated React CPU time.',
        frameIntervalMs:
          'requestAnimationFrame timestamp intervals; includes browser scheduling and intervening work, not GPU timings or presentation confirmation.',
        memory: 'No heap, browser-process or GPU-memory measurement is acquired by this harness.',
        lifecycle: 'Remaining accessibility surfaces only; zero mirrors does not prove absence of leaks.',
      },
      environment,
      initializationMs,
      results,
      lifecycle,
      errors,
      diagnostics,
    };
  } finally {
    for (const root of roots) root.destroy();
    canvas.style.width = previousWidth;
  }
}
export type BenchmarkReport = Awaited<ReturnType<typeof runBenchmark>>;
