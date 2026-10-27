import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { encodePng } from './png.mjs';
import { Worker } from 'node:worker_threads';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => {
  throw new Error(message);
};

function keys(value, allowed, where) {
  if (!plainObject(value)) fail(`${where} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`Unknown ${where} property: ${key}`);
}

function number(value, fallback, min, max, where) {
  const result = value ?? fallback;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < min || result > max)
    fail(`${where} must be a number between ${min} and ${max}`);
  return result;
}

export function validateConfig(config, configPath) {
  keys(config, ['$schema', 'output', 'charset', 'fonts'], 'configuration');
  if (typeof config.output !== 'string' || !config.output.trim()) fail('output must be a nonempty directory path');
  if (!Array.isArray(config.fonts) || config.fonts.length === 0) fail('fonts must be a nonempty array');
  if (config.charset !== undefined && (typeof config.charset !== 'string' || !config.charset.trim()))
    fail('charset must be a nonempty msdf-atlas-gen charset expression');
  const names = new Set();
  const fonts = config.fonts.map((font, index) => {
    const where = `fonts[${index}]`;
    keys(font, ['name', 'source', 'size', 'distanceRange', 'charset', 'characters', 'variations'], where);
    if (typeof font.name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(font.name))
      fail(`${where}.name must contain 1–64 letters, digits, hyphens or underscores`);
    if (font.name.toLowerCase() === 'font-atlas-manifest')
      fail(`${where}.name is reserved for the font atlas cache manifest: ${font.name}`);
    if (names.has(font.name.toLowerCase())) fail(`Duplicate font name: ${font.name}`);
    names.add(font.name.toLowerCase());
    if (typeof font.source !== 'string' || !font.source.trim()) fail(`${where}.source must be a font file path`);
    if (font.charset !== undefined && (typeof font.charset !== 'string' || !font.charset.trim()))
      fail(`${where}.charset must be a nonempty charset expression`);
    if (font.characters !== undefined && typeof font.characters !== 'string')
      fail(`${where}.characters must be a string`);
    const variations = font.variations ?? {};
    if (!plainObject(variations)) fail(`${where}.variations must be an object of four-character axis tags and numbers`);
    for (const [tag, value] of Object.entries(variations)) {
      if (!/^[A-Za-z0-9 ]{4}$/.test(tag) || typeof value !== 'number' || !Number.isFinite(value))
        fail(`${where}.variations contains an invalid axis: ${tag}`);
    }
    const characters = [...new Set(['?', ' ', ...Array.from(font.characters ?? '')])]
      .map((char) => `0x${char.codePointAt(0).toString(16)}`)
      .join(', ');
    return {
      name: font.name,
      source: resolve(dirname(configPath), font.source),
      size: number(font.size, 48, 8, 128, `${where}.size`),
      distanceRange: number(font.distanceRange, 6, 1, 32, `${where}.distanceRange`),
      charset: `${font.charset ?? config.charset ?? '[0x20, 0x7E]'}, ${characters}`,
      variations: Object.fromEntries(Object.entries(variations).sort(([a], [b]) => a.localeCompare(b))),
    };
  });
  return { output: resolve(dirname(configPath), config.output), fonts };
}

async function jsonFile(path, optional = false) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (optional) return undefined;
    throw new Error(`Could not read JSON configuration ${path}: ${error.message}`);
  }
}

async function atomicWrite(path, bytes) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function cached(entry, output, inputHash) {
  if (entry?.inputHash !== inputHash || entry.atlas !== `${entry.name}.png` || entry.metrics !== `${entry.name}.json`)
    return false;
  try {
    const [atlas, metrics] = await Promise.all([
      readFile(join(output, `${entry.name}.png`)),
      readFile(join(output, `${entry.name}.json`)),
    ]);
    return digest(atlas) === entry.atlasHash && digest(metrics) === entry.metricsHash;
  } catch {
    return false;
  }
}

async function compileFont(font, fontBytes, module, directory) {
  const work = await mkdtemp(join(directory, 'face-'));
  await writeFile(join(work, 'source.font'), fontBytes);
  await writeFile(join(work, 'charset.txt'), font.charset);
  const args = [
    'ludic-fontgen',
    '/work/source.font',
    '/work/charset.txt',
    '/work/atlas.rgba',
    '/work/metrics.json',
    String(font.size),
    String(font.distanceRange),
    ...Object.entries(font.variations).map(([tag, value]) => `${tag}=${value}`),
  ];
  const worker = new Worker(new URL('./font-worker.mjs', import.meta.url), { workerData: { work, args, module } });
  let exitCode;
  try {
    exitCode = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Font "${font.name}" exceeded the 120-second compiler deadline`)),
        120000,
      );
      worker.once('message', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
      worker.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Font worker exited before returning a result (${code})`));
      });
    });
  } finally {
    await worker.terminate();
  }
  const diagnostic = (await readFile(join(work, 'stderr.txt'), 'utf8')).trim();
  if (exitCode !== 0) fail(`Font "${font.name}" failed${diagnostic ? `: ${diagnostic}` : ` (exit ${exitCode})`}`);
  const metrics = await jsonFile(join(work, 'metrics.json'));
  const kerning = await jsonFile(join(work, 'metrics.json.kerning.json'));
  if (!Array.isArray(kerning) || kerning.length > 262144) fail(`Invalid generated kerning for ${font.name}`);
  metrics.kerning = kerning;
  if (
    metrics.atlas?.type !== 'mtsdf' ||
    metrics.atlas?.yOrigin !== 'top' ||
    !metrics.glyphs?.some((glyph) => glyph.unicode === 63)
  )
    fail(`Invalid generated metrics for ${font.name}`);
  const raw = await readFile(join(work, 'atlas.rgba'));
  const atlas = encodePng(metrics.atlas.width, metrics.atlas.height, raw);
  return { atlas, metrics: Buffer.from(JSON.stringify(metrics) + '\n') };
}

/** Generate project-owned MTSDF atlases with the bundled, offline WASI compiler. */
async function generateUnlocked(
  configFile = 'ludic-canvas.fonts.json',
  { force = false, log = console.log, config: validatedConfig } = {},
) {
  const path = resolve(configFile);
  const config = validatedConfig ?? validateConfig(await jsonFile(path), path);
  const manifestPath = join(config.output, 'font-atlas-manifest.json');
  const previous = await jsonFile(manifestPath, true);
  const wasmBytes = await readFile(new URL('../assets/fontgen.wasm', import.meta.url));
  const generatorHash = digest(wasmBytes);
  const allTargets = new Set([
    manifestPath,
    ...config.fonts.flatMap((font) => [
      join(config.output, `${font.name}.png`),
      join(config.output, `${font.name}.json`),
    ]),
  ]);
  // Check existing symlinks too, before writing any generated output.
  const targetPaths = new Set(
    await Promise.all(
      [...allTargets].map(async (target) => {
        try {
          return await realpath(target);
        } catch {
          return resolve(target);
        }
      }),
    ),
  );
  if (targetPaths.has(await realpath(path))) fail('Configuration would be overwritten by generated output');
  const readInput = async (font) => {
    const source = await realpath(font.source).catch(() => fail(`Font source does not exist: ${font.source}`));
    if (targetPaths.has(source)) fail(`Font source would be overwritten by generated output: ${font.source}`);
    const file = await open(source, 'r');
    let bytes;
    try {
      const size = (await file.stat()).size;
      if (size > 128 * 1024 * 1024) fail(`Font source exceeds 128 MiB: ${font.source}`);
      bytes = Buffer.alloc(size + 1);
      let length = 0;
      while (length < bytes.length) {
        const read = await file.read(bytes, length, bytes.length - length);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (length > size) fail(`Font source changed while reading: ${font.source}`);
      bytes = bytes.subarray(0, length);
    } finally {
      await file.close();
    }
    const magic = bytes.subarray(0, 4).toString('hex');
    if (!['00010000', '4f54544f', '74727565', '774f4646', '774f4632'].includes(magic))
      fail(`Unsupported font data: ${font.source}. Use a single-face outline TTF, OTF, WOFF or WOFF2 file.`);
    return {
      font,
      bytes,
      inputHash: digest(
        Buffer.concat([
          bytes,
          Buffer.from(
            JSON.stringify({
              format: 1,
              name: font.name,
              size: font.size,
              distanceRange: font.distanceRange,
              charset: font.charset,
              variations: font.variations,
              generatorHash,
            }),
          ),
        ]),
      ),
    };
  };
  const staging = await mkdtemp(join(tmpdir(), 'ludic-canvas-fonts-'));
  const results = [];
  let module;
  try {
    for (const font of config.fonts) {
      const { bytes, inputHash } = await readInput(font);
      const prior = Array.isArray(previous?.fonts)
        ? previous.fonts.find((entry) => plainObject(entry) && entry.name === font.name)
        : undefined;
      if (!force && (await cached(prior, config.output, inputHash))) {
        results.push({ entry: prior, cached: true });
        continue;
      }
      module ??= await WebAssembly.compile(wasmBytes);
      const generated = await compileFont(font, bytes, module, staging);
      results.push({
        ...generated,
        cached: false,
        entry: {
          name: font.name,
          atlas: `${font.name}.png`,
          metrics: `${font.name}.json`,
          inputHash,
          atlasHash: digest(generated.atlas),
          metricsHash: digest(generated.metrics),
        },
      });
    }
    // A failed face leaves every existing output unchanged.
    await mkdir(config.output, { recursive: true });
    for (const result of results)
      if (!result.cached) {
        await atomicWrite(join(config.output, result.entry.atlas), result.atlas);
        await atomicWrite(join(config.output, result.entry.metrics), result.metrics);
      }
    const manifest = { version: 1, generatorHash, fonts: results.map((result) => result.entry) };
    const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
    if (JSON.stringify(previous) !== JSON.stringify(manifest)) await atomicWrite(manifestPath, manifestBytes);
    for (const result of results)
      log(
        `${result.cached ? 'Cached' : 'Generated'} ${result.entry.name}: ${result.entry.atlas} + ${result.entry.metrics}`,
      );
    return { output: config.output, fonts: results.map((result) => ({ ...result.entry, cached: result.cached })) };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function initConfig(configFile = 'ludic-canvas.fonts.json') {
  const path = resolve(configFile);
  const sample = {
    $schema: 'https://libraries.ludic-canvas.victorqueiroz.dev/font-atlas.schema.json',
    output: 'public/fonts',
    charset: '[0x20, 0x7E]',
    fonts: [{ name: 'interface', source: 'fonts/Interface.ttf', size: 48, distanceRange: 6 }],
  };
  await writeFile(path, JSON.stringify(sample, null, 2) + '\n', { flag: 'wx' });
  return path;
}

/** Serialize writers to the same output directory; compilation failures preserve existing outputs. */
export async function generateFontAtlases(configFile = 'ludic-canvas.fonts.json', options = {}) {
  const path = resolve(configFile);
  const config = validateConfig(await jsonFile(path), path);
  await mkdir(config.output, { recursive: true });
  const lockPath = join(config.output, '.ludic-canvas-fonts.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      fail(`Font generation already owns ${config.output}. If a process was killed, remove ${lockPath} and retry.`);
    throw error;
  }
  try {
    return await generateUnlocked(path, { ...options, config });
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
