import { test, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import type { Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const npmCli = process.env.npm_execpath!;
let staging: string;
let artifact: string;
let identity: Record<string, unknown>;
const npm = (args: string[], cwd: string) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

test.beforeAll(async () => {
  if (!npmCli) throw new Error('Run through npm run test:consumer');
  staging = await mkdtemp(join(tmpdir(), 'ludic-browser-consumer-'));
  // Registry runs retain npm's integrity-locked artifact; source runs install
  // the actual release tarball, never a workspace alias or symlink.
  artifact = process.env.LUDIC_CONSUMER_PACKAGE ?? '';
  if (artifact === 'registry') {
    artifact = JSON.parse(await readFile(join(root, 'examples/first-interface/package.json'), 'utf8')).dependencies[
      'ludic-canvas'
    ];
  }
  if (!artifact) {
    const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', staging], root))[0];
    artifact = join(staging, packed.filename);
    identity = {
      kind: 'packed',
      version: packed.version,
      integrity: `sha512-${createHash('sha512')
        .update(await readFile(artifact))
        .digest('base64')}`,
    };
  } else {
    if (!/^\d+\.\d+\.\d+$/.test(artifact)) throw new Error('Registry consumer requires an exact version');
    const response = await fetch(`https://registry.npmjs.org/ludic-canvas/${artifact}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Registry metadata HTTP ${response.status}`);
    const metadata = await response.json();
    identity = {
      kind: 'registry',
      version: metadata.version,
      integrity: metadata.dist.integrity,
      gitHead: metadata.gitHead,
    };
  }
  identity.checkout = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
});

test.afterAll(async () => {
  if (staging) await rm(staging, { recursive: true, force: true });
});

async function port() {
  const socket = createServer();
  await new Promise<void>((done) => socket.listen(0, '127.0.0.1', done));
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No available consumer port');
  await new Promise<void>((done, reject) => socket.close((error) => (error ? reject(error) : done())));
  return address.port;
}

async function serve(project: string, script: 'dev' | 'preview', action: (url: string) => Promise<void>) {
  const assigned = await port();
  const child = spawn(
    process.execPath,
    [npmCli, 'run', script, '--', '--host', '127.0.0.1', '--port', String(assigned), '--strictPort'],
    { cwd: project, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let log = '';
  child.stdout.on('data', (chunk) => (log += chunk));
  child.stderr.on('data', (chunk) => (log += chunk));
  const url = `http://127.0.0.1:${assigned}/`;
  try {
    await expect
      .poll(
        async () => {
          if (child.exitCode !== null) throw new Error(`${script} exited before startup:\n${log}`);
          return fetch(url, { signal: AbortSignal.timeout(1000) }).then(
            (response) => response.ok,
            () => false,
          );
        },
        { timeout: 60000, message: `${script} must start through its normal npm lifecycle` },
      )
      .toBe(true);
    await action(url);
  } finally {
    if (child.pid) {
      if (process.platform === 'win32') {
        try {
          execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {}
      } else {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {}
      }
      if (child.exitCode === null) await new Promise<void>((done) => child.once('exit', () => done()));
    }
    await test.info().attach(`${script}-server.log`, { body: log, contentType: 'text/plain' });
  }
}

async function check(page: Page, url: string, kind: string) {
  const errors: string[] = [];
  const assets: { url: string; status: number; type: string; magic: number[] }[] = [];
  const pending: Promise<void>[] = [];
  const onError = (error: Error) => errors.push(error.message);
  const onResponse = (response: import('@playwright/test').Response) => {
    // Vite also serves JS URL-export wrappers at *.png?import. Only inspect
    // bytes fetched by the renderer, not modules that name those assets.
    if (response.request().resourceType() === 'script') return;
    if (!/\.(wasm|png)(?:\?|$)/.test(response.url())) return;
    pending.push(
      response.body().then((bytes) => {
        assets.push({
          url: response.url(),
          status: response.status(),
          type: response.headers()['content-type'] ?? '',
          magic: [...bytes.subarray(0, 4)],
        });
      }),
    );
  };
  page.on('pageerror', onError);
  page.on('response', onResponse);
  try {
    await page.goto(url);
    if (kind === 'first-interface') {
      const add = page.getByRole('button', { name: /^Add one \(count \d+\)$/ });
      await expect(add).toBeAttached();
      await expect(add).toHaveAccessibleName('Add one (count 0)');
      // Mirror controls intentionally reject pointer events; click their actual
      // canvas coordinates so this exercises the renderer's hit testing.
      const box = await add.boundingBox();
      if (!box || !box.width || !box.height) throw new Error('Counter has no painted hit target');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(add).toHaveAccessibleName('Add one (count 1)');
      await add.press('Enter');
      await expect(add).toHaveAccessibleName('Add one (count 2)');
      await expect(add).toBeFocused();
      await expect(page.locator('#status')).toBeHidden();
    } else if (kind === 'kestrel-survey') {
      await expect(page.locator('#survey-stage')).toHaveAttribute('data-ready', 'true');
      await page.getByRole('button', { name: 'Pause survey', exact: true }).press('Enter');
      await expect(page.getByRole('button', { name: 'Close panel', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'playing');
    } else {
      await expect(page.locator('#loading')).toHaveCount(0);
      await page.getByRole('button', { name: 'Pause world', exact: true }).press('Enter');
      const resume = page.getByRole('button', { name: 'Resume world', exact: true });
      await expect(resume).toBeAttached();
      await resume.press('Enter');
      await expect(page.getByRole('button', { name: 'Pause world', exact: true })).toBeAttached();
    }
    await Promise.all(pending);
    const wasm = assets.filter((asset) => /\.wasm(?:\?|$)/.test(asset.url));
    const fonts = assets.filter((asset) => /\.png(?:\?|$)/.test(asset.url));
    expect(wasm.length, 'layout WASM must be acquired').toBeGreaterThan(0);
    expect(fonts.length, 'at least one font atlas must be acquired').toBeGreaterThan(0);
    for (const asset of wasm) {
      expect(asset.status).toBe(200);
      expect(asset.type).toContain('application/wasm');
      expect(asset.magic, 'HTML fallback must never masquerade as WASM').toEqual([0, 97, 115, 109]);
    }
    for (const asset of fonts) {
      expect(asset.status).toBe(200);
      expect(asset.magic).toEqual([137, 80, 78, 71]);
    }
    expect(errors).toEqual([]);
  } finally {
    page.off('pageerror', onError);
    page.off('response', onResponse);
    await test.info().attach('runtime-assets.json', {
      body: JSON.stringify({ kind, url, artifact: identity, assets, errors }, null, 2),
      contentType: 'application/json',
    });
  }
}

for (const kind of ['first-interface', 'canvas2d', 'three', 'kestrel-survey']) {
  test(`${kind}: independent npm consumer starts in development and production`, async ({ page }) => {
    const project = join(staging, kind);
    if (kind === 'first-interface' || kind === 'kestrel-survey') {
      const source = join(root, 'examples', kind);
      await cp(source, project, {
        recursive: true,
        filter: (path) =>
          !relative(source, path)
            .split(/[\\/]/)
            .some((part) => ['node_modules', 'dist'].includes(part)),
      });
    } else {
      // Install only the package into a bootstrap folder, then execute its real CLI.
      const bootstrap = join(staging, `${kind}-cli`);
      npm(
        [
          'install',
          '--prefix',
          bootstrap,
          identity.kind === 'registry' ? `ludic-canvas@${artifact}` : artifact,
          '--no-audit',
          '--no-fund',
        ],
        staging,
      );
      execFileSync(process.execPath, [
        join(bootstrap, 'node_modules/ludic-canvas/cli/index.mjs'),
        'init',
        project,
        '--template',
        kind,
      ]);
    }
    const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
    manifest.dependencies['ludic-canvas'] = artifact;
    await writeFile(join(project, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    npm(['install', '--no-audit', '--no-fund'], project);
    const lock = JSON.parse(await readFile(join(project, 'package-lock.json'), 'utf8'));
    expect(lock.packages['node_modules/ludic-canvas'].integrity).toBe(identity.integrity);
    await serve(project, 'dev', (url) => check(page, url, kind));
    npm(['run', 'build'], project);
    await serve(project, 'preview', (url) => check(page, url, kind));
  });
}
