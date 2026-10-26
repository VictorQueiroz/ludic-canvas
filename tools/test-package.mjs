import { execFileSync } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run test:package');
const staging = await mkdtemp(join(tmpdir(), 'ludic-package-consumer-'));
const npm = (args, cwd) =>
  execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', staging], root))[0];
  const paths = new Set(packed.files.map((file) => file.path));
  for (const path of [
    'cli/index.mjs',
    'cli/fonts.mjs',
    'assets/fontgen.wasm',
    'font-atlas.schema.json',
    'licenses/FreeType-FTL.txt',
  ])
    if (!paths.has(path)) throw new Error(`Missing packed file: ${path}`);
  const project = join(staging, 'independent project');
  await mkdir(join(project, 'fonts'), { recursive: true });
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({ name: 'ludic-consumer', version: '1.0.0', private: true, type: 'module' }),
  );
  // Normal install, including npm's normal lifecycle behavior.
  npm(['install', join(staging, packed.filename), '--no-audit', '--no-fund'], project);
  const installed = join(project, 'node_modules/ludic-canvas');
  const metadata = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  const bin = join(installed, metadata.bin['ludic-canvas']);
  await access(join(project, 'node_modules/.bin', process.platform === 'win32' ? 'ludic-canvas.cmd' : 'ludic-canvas'));
  const imported = await import(pathToFileURL(join(installed, 'dist/index.js')).href);
  if (typeof imported.createUI !== 'function') throw new Error('Root exports do not resolve');
  await Promise.all(Object.values(imported.defaultAssets).map((url) => access(new URL(url))));
  await copyFile(join(root, 'tests/fixtures/fixture.woff2'), join(project, 'fonts/input.woff2'));
  await writeFile(
    join(project, 'ludic-canvas.fonts.json'),
    JSON.stringify({
      output: 'public/fonts',
      fonts: [{ name: 'interface', source: 'fonts/input.woff2' }],
    }),
  );
  const args = [bin, 'fonts'];
  const environment = { ...process.env, PATH: join(staging, 'no-native-tools') };
  const run = () =>
    execFileSync(process.execPath, args, {
      cwd: project,
      env: environment,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  if (!run().includes('Generated interface')) throw new Error('Packaged CLI did not generate the atlas');
  if (!run().includes('Cached interface')) throw new Error('Packaged CLI did not reuse cached output');
  const metrics = JSON.parse(await readFile(join(project, 'public/fonts/interface.json'), 'utf8'));
  if (!metrics.glyphs.some((glyph) => glyph.unicode === 63)) throw new Error('Generated font has no fallback');
  await writeFile(
    join(project, 'index.html'),
    '<html><body><canvas id="ui" style="width:640px;height:480px"></canvas><script type="module" src="/main.ts"></script></body></html>',
  );
  await writeFile(
    join(project, 'main.ts'),
    `import { createElement } from 'react';
import { createUI, Text } from 'ludic-canvas';
const ui = await createUI({ canvas: document.querySelector<HTMLCanvasElement>('#ui')!,
  fonts: [{ name: 'interface', atlas: '/fonts/interface.png', metrics: '/fonts/interface.json' }] });
ui.render(createElement(Text, null, 'A?'));\n`,
  );
  execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: project,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await access(join(project, 'dist/fonts/interface.png'));
  console.log(
    `Packed consumer verified: normal install, CLI bin, WOFF2 generation, cache and Vite build (${packed.size} package bytes)`,
  );
} catch (error) {
  if (error.stderr) console.error(error.stderr.toString());
  throw error;
} finally {
  await rm(staging, { recursive: true, force: true });
}
