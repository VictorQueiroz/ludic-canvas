// A bounded-lifetime worker keeps synchronous WASI execution off the CLI thread.
import { parentPort, workerData } from 'node:worker_threads';
import { openSync, closeSync } from 'node:fs';
import { WASI } from 'node:wasi';
const { work, args, module } = workerData;
const stderr = openSync(`${work}/stderr.txt`, 'w');
try {
  const wasi = new WASI({ version: 'preview1', returnOnExit: true, args, preopens: { '/work': work }, stderr });
  const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
  const code = wasi.start(instance);
  closeSync(stderr);
  parentPort.postMessage(code);
} catch (error) {
  closeSync(stderr);
  throw error;
}
