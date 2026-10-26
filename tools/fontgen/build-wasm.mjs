import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
execFileSync(
  'cmake',
  [
    '-S',
    resolve(root, 'tools/fontgen/wasm'),
    '-B',
    resolve(root, 'build/fontgen-wasm'),
    `-DCMAKE_TOOLCHAIN_FILE=${resolve(root, 'cmake/toolchains/fontgen-wasi.cmake')}`,
    '-DCMAKE_BUILD_TYPE=Release',
  ],
  { stdio: 'inherit' },
);
execFileSync('cmake', ['--build', resolve(root, 'build/fontgen-wasm'), '-j', '4'], { stdio: 'inherit' });
const bytes = readFileSync(resolve(root, 'assets/fontgen.wasm'));
chmodSync(resolve(root, 'assets/fontgen.wasm'), 0o644);
const toolchain = JSON.parse(readFileSync(resolve(root, '.toolchain/toolchain.json'), 'utf8'));
writeFileSync(
  resolve(root, 'assets/fontgen-provenance.json'),
  JSON.stringify(
    {
      source: 'tools/fontgen/wasm',
      target: 'wasm32-wasip1 command, SIMD, bulk memory, exception handling',
      compiler: toolchain.clangVersion,
      wasiSdk: toolchain.wasiSdk,
      dependencies: {
        freetype: '2.14.3',
        brotli: '1.1.0',
        msdfgen: '1874bcf7d9624ccc85b4bc9a85d78116f690f35b',
        'msdf-atlas-gen': '1.4',
      },
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    },
    null,
    2,
  ) + '\n',
);
