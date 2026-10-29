import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, platform, release, tmpdir, totalmem } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium, expect } from '@playwright/test';
import { verifyArtifact, verifyConsumer } from '../release/verify.mjs';

const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({
  options: {
    seconds: { type: 'string', default: '1800' },
    interval: { type: 'string', default: '60' },
    cycle: { type: 'string', default: '300' },
    output: { type: 'string' },
    headless: { type: 'boolean', default: false },
  },
});
const seconds = Number(values.seconds),
  interval = Number(values.interval),
  cycle = Number(values.cycle);
if (![seconds, interval, cycle].every(Number.isInteger) || seconds < 30 || interval < 5 || cycle < interval)
  throw new Error('Use integer seconds >= 30, interval >= 5, and cycle >= interval');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run qualify:desktop');
const startedAt = new Date().toISOString();
const output = resolve(root, values.output ?? `build/qualification/desktop-${startedAt.replace(/[:.]/g, '-')}.json.gz`);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const npm = (args, cwd) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 300000,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const report = {
  schema: 1,
  startedAt,
  status: 'incomplete',
  requestedSeconds: seconds,
  source: { commit: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')), sdkDiffFromRelease: null },
  acquisitionScriptSha256: digest(await readFile(import.meta.filename)),
  host: { platform: platform(), osRelease: release(), cpu: cpus()[0]?.model, memoryBytes: totalmem() },
  configuration: {
    headed: !values.headless,
    intervalSeconds: interval,
    cycleSeconds: cycle,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    forcedGcAtCheckpoints: true,
    settlingMs: 1000,
    frameBufferLimit: 4096,
    frameColumns: ['rafTimestampMs', 'uiFrameCpuMs', 'rafIntervalMs', 'uiDrawCalls', 'uiImageCacheBytes'],
  },
  coverage: {
    physicalPhones: 'not-run',
    screenReader: 'not-run',
    gpuMemory: 'not-measured',
    leakAttribution: 'not-established',
    performanceBudget: 'not-set',
    fullSurvey: 'not-run',
  },
  instrumentation:
    'A copied standalone consumer exposes mount/destroy and a bounded per-minute frame buffer. Timing wraps ui.frame only; game RAF intervals include world rendering. Heap/DOM counters use CDP after forced GC. RSS includes shared mappings and is not GPU allocation.',
  checkpoints: [],
  errors: [],
};
if (platform() === 'darwin')
  report.host.osVersion = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim();
const save = async () => {
  const bytes = gzipSync(JSON.stringify(report));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  await writeFile(`${output}.sha256`, `${digest(bytes)}  ${output.split(/[\\/]/).at(-1)}\n`);
};
let staging, browser, server;
try {
  staging = await mkdtemp(join(tmpdir(), 'ludic-desktop-qualification-'));
  const source = join(root, 'examples/kestrel-survey');
  const project = join(staging, 'game');
  await cp(source, project, {
    recursive: true,
    filter: (path) =>
      !relative(source, path)
        .split(/[\\/]/)
        .some((part) => ['node_modules', 'dist'].includes(part)),
  });
  const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  const version = manifest.dependencies['ludic-canvas'];
  const lock = JSON.parse(await readFile(join(project, 'package-lock.json'), 'utf8'));
  const metadata = await fetch(`https://registry.npmjs.org/ludic-canvas/${version}`, {
    signal: AbortSignal.timeout(60000),
  }).then((response) => {
    if (!response.ok) throw new Error(`Registry metadata HTTP ${response.status}`);
    return response.json();
  });
  const tarball = await fetch(metadata.dist.tarball, { signal: AbortSignal.timeout(60000) }).then((response) => {
    if (!response.ok) throw new Error(`Registry tarball HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  report.artifact = verifyArtifact(metadata, Buffer.from(tarball), {
    version,
    commit: git('rev-parse', `v${version}^{commit}`),
  });
  verifyConsumer(manifest, lock, report.artifact);
  report.source.sdkDiffFromRelease = git('diff', `v${version}`, '--', 'src') || 'identical';
  report.consumerSource = {
    mainSha256: digest(await readFile(join(project, 'src/main.tsx'))),
    lockSha256: digest(await readFile(join(project, 'package-lock.json'))),
  };
  console.log(npm(['ci', '--no-audit', '--no-fund'], project));
  let main = await readFile(join(project, 'src/main.tsx'), 'utf8');
  const marker = 'const info = ui!.frame(now);';
  if (!main.includes(marker)) throw new Error('Qualification instrumentation marker changed');
  main = main.replace(
    marker,
    `const acquisitionStart = performance.now();\n          ${marker}\n          (window as any).__ludicQualification?.frame(now, performance.now() - acquisitionStart, info.drawCalls, info.textureBytes);`,
  );
  await writeFile(join(project, 'src/main.tsx'), main);
  await writeFile(
    join(project, 'src/standalone.ts'),
    `import './style.css';
import { mountSurvey } from './main.tsx';
let scene: Awaited<ReturnType<typeof mountSurvey>>;
let samples: number[][] = [];
let previous = 0;
let dropped = 0;
let visibility: { at: number; state: string }[] = [];
document.addEventListener('visibilitychange', () => {
  if (visibility.length < 64) visibility.push({ at: performance.now(), state: document.visibilityState });
});
const acquisition = {
  async mount() {
    for (const canvas of document.querySelectorAll('canvas')) canvas.replaceWith(canvas.cloneNode(false));
    document.querySelector<HTMLElement>('#survey-loading')!.hidden = false;
    previous = 0;
    scene = await mountSurvey();
  },
  destroy() { scene?.destroy(); scene = undefined; document.querySelector('#survey-stage')!.removeAttribute('data-ready'); },
  frame(now: number, cpu: number, calls: number, textureBytes: number) {
    if (samples.length < 4096) samples.push([now, cpu, previous ? now - previous : 0, calls, textureBytes]);
    else dropped++;
    previous = now;
  },
  drain() { const result = { frames: samples, droppedFrames: dropped, visibility }; samples = []; dropped = 0; visibility = []; return result; },
};
Object.assign(window, { __ludicQualification: acquisition });
await acquisition.mount();\n`,
  );
  report.instrumentedSource = {
    mainSha256: digest(await readFile(join(project, 'src/main.tsx'))),
    entrySha256: digest(await readFile(join(project, 'src/standalone.ts'))),
  };
  console.log(npm(['run', 'build'], project));
  const { preview } = await import(pathToFileURL(join(project, 'node_modules/vite/dist/node/index.js')).href);
  server = await preview({
    root: project,
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
    logLevel: 'error',
  });
  const address = server.httpServer.address();
  report.server = { mode: 'production-preview', host: 'loopback' };
  browser = await chromium.launch({ channel: 'chrome', headless: values.headless });
  report.browser = {
    name: 'installed Chrome',
    version: browser.version(),
    isolatedProfile: true,
    softwareGpuRequested: false,
  };
  const context = await browser.newContext({ viewport: report.configuration.viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push({ at: new Date().toISOString(), message: error.message }));
  const cdp = await context.newCDPSession(page);
  const browserCdp = await browser.newBrowserCDPSession();
  await cdp.send('HeapProfiler.enable');
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const ready = async () => {
    await expect(page.locator('#survey-stage')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('button', { name: 'Pause survey', exact: true })).toBeAttached();
  };
  await ready();
  report.browser.graphics = await page.locator('#survey-world').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(extension ? extension.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
    };
  });
  if (/swiftshader|llvmpipe|software/i.test(report.browser.graphics.renderer))
    throw new Error('Physical acquisition requires a hardware GPU');
  const checkpoint = async (phase) => {
    const sample = await page.evaluate(() => window.__ludicQualification.drain());
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    const processes = (await browserCdp.send('SystemInfo.getProcessInfo')).processInfo.map((process) => {
      let rssKiB = null;
      try {
        rssKiB = Number(
          execFileSync('ps', ['-p', String(process.id), '-o', 'rss='], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          }).trim(),
        );
      } catch {}
      return { type: process.type, cpuTimeSeconds: process.cpuTime, rssKiB };
    });
    report.checkpoints.push({
      phase,
      at: new Date().toISOString(),
      elapsedMs: performance.now() - acquiredAt,
      heap,
      dom,
      processes,
      mirrors: await page.locator('[data-ludic-canvas="accessibility"]').count(),
      ...sample,
      viewport: page.viewportSize(),
    });
    await save();
    console.log(
      `Checkpoint ${phase}: heap ${Math.round(heap.usedSize / 1024 / 1024)} MiB; ${sample.frames.length} frames`,
    );
  };
  // Use real UI actions to finish the game before the sustained acquisition.
  if (seconds >= 1800) {
    for (const [index, name] of ['Basalt Rise', 'Amber Shelf', 'Echo Spire'].entries()) {
      await page.getByRole('tab', { name: `Select ${name}`, exact: true }).press('Enter');
      await page.getByRole('button', { name: `Navigate to ${name}`, exact: true }).press('Enter');
      const collect = page.getByRole('button', { name: `Collect ${name} sample`, exact: true });
      await expect(collect).toBeEnabled({ timeout: 90000 });
      await collect.press('Enter');
      await expect(page.locator('#survey-stage')).toHaveAttribute('data-samples', String(index + 1), {
        timeout: 15000,
      });
    }
    await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'complete');
    await page.getByRole('button', { name: 'Begin a new survey', exact: true }).press('Enter');
    report.coverage.fullSurvey = 'passed';
  }
  const acquiredAt = performance.now();
  await checkpoint('mounted-baseline');
  let nextCycle = cycle,
    number = 0;
  while (performance.now() - acquiredAt < seconds * 1000) {
    await new Promise((done) =>
      setTimeout(done, Math.min(interval * 1000, seconds * 1000 - (performance.now() - acquiredAt))),
    );
    await page.getByRole('button', { name: 'Pause survey', exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: 'Close panel', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'playing');
    const site = ['Basalt Rise', 'Amber Shelf', 'Echo Spire'][number % 3];
    await page.getByRole('tab', { name: `Select ${site}`, exact: true }).press('Enter');
    const navigate = page.getByRole('button', { name: /^Navigate to / });
    await navigate.press('Enter');
    await checkpoint(`mounted-${++number}`);
    if ((performance.now() - acquiredAt) / 1000 >= nextCycle) {
      const background = await context.newPage();
      await background.bringToFront();
      await new Promise((done) => setTimeout(done, 1000));
      await page.bringToFront();
      await background.close();
      await page.setViewportSize({ width: number % 2 ? 960 : 1280, height: 720 });
      await page.evaluate(() => window.__ludicQualification.destroy());
      await new Promise((done) => setTimeout(done, 1000));
      await checkpoint(`destroyed-${number}`);
      expect(await page.locator('[data-ludic-canvas="accessibility"]').count()).toBe(0);
      await page.evaluate(() => window.__ludicQualification.mount());
      await ready();
      nextCycle += cycle;
    }
    if (report.errors.length) throw new Error('Browser reported an unhandled error; inspect the retained report');
  }
  report.acquiredDurationMs = performance.now() - acquiredAt;
  await page.screenshot({ path: `${output}.png` });
  await writeFile(
    `${output}.png.sha256`,
    `${digest(await readFile(`${output}.png`))}  ${output.split(/[\\/]/).at(-1)}.png\n`,
  );
  await page.evaluate(() => window.__ludicQualification.destroy());
  await new Promise((done) => setTimeout(done, 1000));
  await checkpoint('final-destroyed');
  expect(await page.locator('[data-ludic-canvas="accessibility"]').count()).toBe(0);
  report.status = seconds >= 1800 && !values.headless ? 'partial' : 'smoke-only';
  report.coverage.longSession = seconds >= 1800 ? 'acquired' : 'not-run';
  report.remaining = [
    'Physical phones and screen readers not exercised',
    'GPU allocation and leak attribution not measured',
    'One game on one desktop/browser; no universal performance claim',
  ];
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await save();
  if (browser) await browser.close();
  if (server) await new Promise((done) => server.httpServer.close(done));
  if (staging) await rm(staging, { recursive: true, force: true });
  console.log(`Qualification record: ${output}`);
}
