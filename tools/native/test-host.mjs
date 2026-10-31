// Requires a logged-in macOS GUI session. Kept separate from headless native CI.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { strictEqual, match } from 'node:assert';

const root = fileURLToPath(new URL('../..', import.meta.url));
const binary = join(root, 'build/native/app/ludic-native.app/Contents/MacOS/ludic-native');
const output = join(root, 'build/native/host-contracts');
await mkdir(output, { recursive: true });
const controls = spawnSync(join(root, 'build/native/app/ludic-host-test'), [], {
  encoding: 'utf8',
  timeout: 15000,
});
await writeFile(join(output, 'host-controls.log'), `${controls.stdout ?? ''}${controls.stderr ?? ''}`);
if (controls.error) throw controls.error;
strictEqual(controls.signal, null, 'AppKit control contracts crashed');
strictEqual(controls.status, 0, `AppKit control contracts failed: ${controls.stderr}`);
match(controls.stdout, /AppKit editor replacement and window focus contracts passed/);
for (const [fixture, expected] of [
  ['host-dispose-error', 'expected error after surface disposal'],
  ['host-startup-error', 'expected host startup failure with live resources'],
]) {
  const result = spawnSync(binary, [join(root, `tests/native/${fixture}.js`), '--test'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  await writeFile(join(output, `${fixture}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.error) throw result.error;
  strictEqual(result.signal, null, `${fixture}: native host crashed`);
  strictEqual(result.status, 1, `${fixture}: expected a reported application error`);
  match(result.stderr, new RegExp(expected));
  match(result.stdout, /Native host cleanup: layouts=0 nodes=0 surfaces=0/);
  if (fixture === 'host-dispose-error') match(result.stdout, /Reentrant surface disposal recovered/);
}
console.log(
  'AppKit controls: password toggles preserve controlled values, focus and selection; window notifications restore focus.',
);
console.log('AppKit error recovery: callback disposal and startup failure released native resources without crashing.');
