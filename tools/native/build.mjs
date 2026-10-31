import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access, copyFile, cp, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, dirname } from 'node:path';
import { build } from 'vite';
import dependencies from './dependencies.json' with { type: 'json' };

const root = fileURLToPath(new URL('../..', import.meta.url));
const cache = join(root, '.toolchain/native');
const output = join(root, 'build/native');
const jobs = process.env.LUDIC_NATIVE_JOBS ?? '2';
if (!/^[1-9][0-9]?$/.test(jobs)) throw new Error('LUDIC_NATIVE_JOBS must be a positive integer below 100');
if (process.platform !== 'darwin') throw new Error('The first native proof host requires macOS and Xcode');
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
const exists = async (path) =>
  access(path).then(
    () => true,
    () => false,
  );
async function run(command, args, cwd = root) {
  console.log(`[native] ${command} ${args.join(' ')}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}
async function source(name) {
  const dep = dependencies[name],
    archive = join(cache, `${name}.tar.gz`),
    directory = join(cache, `${name}-${dep.revision}`);
  if (!(await exists(archive))) {
    const response = await fetch(dep.url);
    if (!response.ok) throw new Error(`${dep.url}: ${response.status}`);
    await writeFile(archive, new Uint8Array(await response.arrayBuffer()));
  }
  if (
    createHash('sha256')
      .update(await readFile(archive))
      .digest('hex') !== dep.sha256
  )
    throw new Error(`${name} source archive checksum mismatch`);
  if (!(await exists(directory))) await run('tar', ['-xzf', archive, '-C', cache]);
  return directory;
}
const hermes = await source('hermes'),
  skia = await source('skia');
await source('yoga');
const hermesBuild = join(cache, 'hermes-build');
await run('cmake', [
  '-S',
  hermes,
  '-B',
  hermesBuild,
  '-G',
  'Ninja',
  '-DCMAKE_BUILD_TYPE=Release',
  '-DCMAKE_OSX_DEPLOYMENT_TARGET=26.0',
  '-DHERMES_ENABLE_TEST_SUITE=OFF',
  '-DHERMES_ENABLE_DEBUGGER=OFF',
  '-DHERMES_ENABLE_INTL=OFF',
  '-DHERMES_ENABLE_NAPI=OFF',
  '-DHERMES_ENABLE_CORE_EXTENSIONS=OFF',
  '-DHERMES_ENABLE_CONTRIB_EXTENSIONS=OFF',
  '-DHERMESVM_ALLOW_JIT=0',
  '-DHERMESVM_INTERNAL_JAVASCRIPT_NATIVE=OFF',
]);
await run('cmake', ['--build', hermesBuild, '--target', 'hermes', 'hermesvm_a', '-j', jobs]);
if (!(await exists(join(skia, 'bin/gn')))) await run('python3', ['bin/fetch-gn'], skia);
const skiaArgs = [
  'is_debug=false',
  'is_official_build=true',
  'skia_use_metal=true',
  'skia_use_gl=false',
  'skia_enable_ganesh=true',
  'skia_enable_graphite=false',
  'skia_enable_pdf=false',
  'skia_enable_skottie=false',
  'skia_enable_svg=false',
  'skia_use_icu=false',
  'skia_use_harfbuzz=false',
  'skia_use_freetype=false',
  'skia_use_fontconfig=false',
  'skia_use_libpng_decode=false',
  'skia_use_libpng_encode=false',
  'skia_use_libjpeg_turbo_decode=false',
  'skia_use_libjpeg_turbo_encode=false',
  'skia_use_libwebp_decode=false',
  'skia_use_libwebp_encode=false',
  'skia_use_wuffs=false',
  'skia_use_zlib=false',
  'skia_use_expat=false',
  'skia_use_dng_sdk=false',
  'skia_use_piex=false',
  'skia_use_partition_alloc=false',
];
await run(join(skia, 'bin/gn'), ['gen', 'out/ludic', `--args=${skiaArgs.join(' ')}`], skia);
await run('ninja', ['-C', 'out/ludic', '-j', jobs, 'skia'], skia);
await run('cmake', [
  '-S',
  join(root, 'native/portable'),
  '-B',
  join(output, 'app'),
  '-G',
  'Ninja',
  '-DCMAKE_BUILD_TYPE=Release',
]);
await run('cmake', ['--build', join(output, 'app'), '-j', jobs]);
const bundle = join(output, 'bundle');
await mkdir(bundle, { recursive: true });
const entryIndex = process.argv.indexOf('--entry');
if (entryIndex >= 0 && !process.argv[entryIndex + 1]) throw new Error('--entry requires a path');
const entry =
  entryIndex >= 0 ? resolve(root, process.argv[entryIndex + 1]) : join(root, 'examples/portable/native.tsx');
await build({
  configFile: false,
  root,
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  resolve: {
    alias: [
      { find: /^ludic-canvas$/, replacement: join(root, 'src/core.ts') },
      { find: /^ludic-canvas\/core$/, replacement: join(root, 'src/core.ts') },
      { find: /^ludic-canvas\/native$/, replacement: join(root, 'src/native.ts') },
    ],
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    target: 'es2020',
    outDir: bundle,
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
    lib: { entry, name: 'LudicApp', formats: ['iife'], fileName: () => 'app.js' },
  },
});
await run(join(hermesBuild, 'bin/hermes'), [
  '-O',
  '-emit-binary',
  '-out',
  join(bundle, 'app.hbc'),
  join(bundle, 'app.js'),
]);
const resources = join(output, 'app/ludic-native.app/Contents/Resources');
await mkdir(resources, { recursive: true });
const assetsIndex = process.argv.indexOf('--assets');
if (assetsIndex >= 0) {
  if (!process.argv[assetsIndex + 1]) throw new Error('--assets requires a directory');
  await cp(resolve(root, process.argv[assetsIndex + 1]), resources, { recursive: true });
}
for (const name of ['default-font.png', 'default-font.json'])
  await copyFile(join(root, 'assets', name), join(resources, name));
await copyFile(join(bundle, 'app.hbc'), join(resources, 'app.hbc'));
// Include upstream and bundled third-party notices with this standalone application.
await cp(join(root, 'licenses'), join(resources, 'licenses/ludic'), { recursive: true });
await copyFile(join(root, 'LICENSE'), join(resources, 'licenses/Ludic-MIT.txt'));
for (const [name, directory] of [
  ['hermes', hermes],
  ['skia', skia],
]) {
  for (const file of await readdir(directory, { recursive: true })) {
    if (!/(^|\/)(LICENSE[^/]*|COPYING[^/]*|NOTICE[^/]*)$/i.test(file) || file.startsWith('out/')) continue;
    const destination = join(resources, 'licenses', name, file);
    if (!(await stat(join(directory, file))).isFile()) continue;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(directory, file), destination);
  }
}
await writeFile(
  join(resources, 'native-build.json'),
  JSON.stringify(
    {
      dependencies,
      entry: relative(root, entry),
      hermesBytecode: 'compiler and runtime built from the same pinned revision',
      renderer: 'Skia Ganesh Metal',
    },
    null,
    2,
  ) + '\n',
);
console.log(`Native application: ${join(output, 'app/ludic-native.app')}`);
