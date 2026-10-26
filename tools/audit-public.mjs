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
  'assets/default-font.png',
  'assets/default-font.json',
  'LICENSE',
  'licenses/Yoga-MIT.txt',
  'licenses/Barlow-OFL.txt',
  'site/index.html',
  'site/guide/index.html',
  'site/api/index.html',
]) {
  if (!existsSync(file)) throw new Error('Missing distribution file: ' + file);
}
const exports = WebAssembly.Module.exports(new WebAssembly.Module(readFileSync('assets/layout.wasm')));
if (!exports.some((item) => item.name === 'lcl_abi_version')) throw new Error('Layout ABI missing');
console.log('Public library boundaries, distribution assets and documentation verified');
