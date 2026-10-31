import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { deepStrictEqual, strictEqual, match } from 'node:assert';
import { build } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url)),
  output = join(root, 'build/native/contracts');
execFileSync(join(root, 'build/native/app/ludic-renderer-test'), [], { stdio: 'inherit' });
const failedStartup = spawnSync(
  join(root, 'build/native/app/ludic-contract'),
  [join(root, 'tests/native/runtime-error.js')],
  { encoding: 'utf8', timeout: 20000 },
);
if (failedStartup.error) throw failedStartup.error;
strictEqual(failedStartup.signal, null, 'JS startup errors must not crash during runtime destruction');
strictEqual(failedStartup.status, 1);
match(failedStartup.stderr, /expected native startup failure/);
console.log('Hermes startup error: reported without a runtime-lifetime crash.');
for (const target of ['hermes', 'wasm'])
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    oxc: { jsx: { runtime: 'automatic' } },
    resolve: { alias: { 'ludic-canvas': join(root, 'src/core.ts') } },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      target: 'es2020',
      outDir: output,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: join(root, `tests/native/${target}.ts`),
        formats: [target === 'hermes' ? 'iife' : 'es'],
        name: 'Contract',
        fileName: () => `${target}.js`,
      },
    },
  });
const compiler = join(root, '.toolchain/native/hermes-build/bin/hermes');
execFileSync(compiler, ['-O', '-emit-binary', '-out', join(output, 'contract.hbc'), join(output, 'hermes.js')], {
  stdio: 'inherit',
});
const native = JSON.parse(
  execFileSync(join(root, 'build/native/app/ludic-contract'), [join(output, 'contract.hbc')], {
    encoding: 'utf8',
    timeout: 20000,
  }),
);
const { run } = await import(pathToFileURL(join(output, 'wasm.js')));
const wasm = JSON.parse(JSON.stringify(await run(new Uint8Array(await readFile(join(root, 'assets/layout.wasm'))))));
deepStrictEqual(native, wasm);
await writeFile(join(output, 'result.json'), JSON.stringify({ result: 'passed', native, wasm }, null, 2) + '\n');
console.log(
  `Native Hermes/Yoga and Node/WASM: ${native.checks} behavioral checks each; both layout trees match exactly; native contexts and nodes released.`,
);
