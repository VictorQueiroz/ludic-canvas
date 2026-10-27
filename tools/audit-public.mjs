import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
for (const dir of ['src', 'dist']) {
  for (const file of walk(dir)) {
    const source = readFileSync(file, 'utf8');
    if (/from\s+['"][^'"]*(?:\/domain\/|\/application\/|\/screens\/|\/content\/)/.test(source))
      throw new Error('Application dependency in library: ' + file);
  }
}
for (const file of [
  'dist/index.js',
  'dist/index.d.ts',
  'assets/layout.wasm',
  'assets/fontgen.wasm',
  'assets/fontgen-provenance.json',
  'cli/index.mjs',
  'cli/init.mjs',
  'cli/templates/shared/fonts/Interface.ttf',
  'font-atlas.schema.json',
  'licenses/FreeType-FTL.txt',
  'licenses/Brotli-MIT.txt',
  'site/font-atlas.schema.json',
  'assets/default-font.png',
  'assets/default-font.json',
  'LICENSE',
  'licenses/Yoga-MIT.txt',
  'licenses/Barlow-OFL.txt',
  'site/index.html',
  'site/guide/index.html',
  'site/api/index.html',
  'site/components/index.html',
  'site/performance/index.html',
  'site/performance/desktop-m3-chrome-2026-10-27.json',
  'site/performance/desktop-m3-chrome-2026-10-27.sha256',
  'site/play/index.html',
  'site/play/orbital-relay/index.html',
  'site/examples/orbital-relay.png',
  'site/examples/kestrel-survey.png',
  'site/3d/index.html',
]) {
  if (!existsSync(file)) throw new Error('Missing distribution file: ' + file);
}
const exports = WebAssembly.Module.exports(new WebAssembly.Module(readFileSync('assets/layout.wasm')));
for (const [template, source] of [
  ['cli/templates/shared/fonts/Interface.ttf', 'tools/fontgen/fonts/BarlowCondensed-SemiBold.ttf'],
  ['cli/templates/shared/fonts/OFL.txt', 'licenses/Barlow-OFL.txt'],
]) {
  if (!readFileSync(template).equals(readFileSync(source)))
    throw new Error('Initializer font provenance mismatch: ' + template);
}
if (!exports.some((item) => item.name === 'lcl_abi_version')) throw new Error('Layout ABI missing');
const fontgen = new WebAssembly.Module(readFileSync('assets/fontgen.wasm'));
if (!WebAssembly.Module.exports(fontgen).some((item) => item.name === '_start'))
  throw new Error('Font compiler entry point missing');
console.log('Public library boundaries, distribution assets and documentation verified');
