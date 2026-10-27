import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { generateFontAtlases, initConfig, validateConfig } from '../cli/fonts.mjs';
import { Font, FontBook } from '../src/gfx/font.ts';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directories = [];
const silent = { log() {} };
async function fixture(font = 'fixture.ttf', options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ludic-cli-test-'));
  directories.push(directory);
  const config = {
    output: './out',
    fonts: [{ name: 'interface', source: join(root, 'tests/fixtures', font), ...options }],
  };
  const path = join(directory, 'fonts.json');
  await writeFile(path, JSON.stringify(config));
  return { directory, path, config, output: join(directory, 'out') };
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function pixels(png) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  return inflateSync(Buffer.concat(chunks));
}

describe('packaged font atlas compiler', () => {
  it('bounds expanded alias pairs before writing a large atlas or metrics file', async () => {
    const { path } = await fixture('fixture-kerning-alias-limit.ttf', { charset: '[0xE000, 0xE257]' });
    await expect(generateFontAtlases(path, silent)).rejects.toThrow('262144 expanded kerning pairs');
    // Cold WASI startup on hosted Windows is outside the ordinary unit-test budget.
  }, 30000);
  it('preserves kerning for every Unicode alias of a selected source glyph', async () => {
    const { path, output } = await fixture('fixture-kerning.ttf', { charset: '0x20, 0x3F, 0x41, 0x56, 0xA0' });
    await generateFontAtlases(path, silent);
    const metrics = JSON.parse(await readFile(join(output, 'interface.json'), 'utf8'));
    expect(metrics.kerning).toContainEqual({ unicode1: 65, unicode2: 32, advance: -0.05 });
    expect(metrics.kerning).toContainEqual({ unicode1: 65, unicode2: 160, advance: -0.05 });
    const fonts = new FontBook();
    fonts.add(
      new Font('ui', 0, metrics, { handle: {}, width: metrics.atlas.width, height: metrics.atlas.height, bytes: 0 }),
    );
    expect(fonts.shape('A\u00a0', { font: 'ui', size: 20 }).width).toBe(17);
  });
  it('extracts a known kern-table pair into usable normalized runtime metrics', async () => {
    const { path, output } = await fixture('fixture-kerning.ttf', { charset: '0x20, 0x3F, 0x41, 0x56' });
    await generateFontAtlases(path, silent);
    const metrics = JSON.parse(await readFile(join(output, 'interface.json'), 'utf8'));
    expect(metrics.kerning).toContainEqual({ unicode1: 65, unicode2: 86, advance: -0.1 });
    const fonts = new FontBook();
    fonts.add(
      new Font('ui', 0, metrics, { handle: {}, width: metrics.atlas.width, height: metrics.atlas.height, bytes: 0 }),
    );
    expect(fonts.shape('AV', { font: 'ui', size: 20 }).width).toBe(22);
  });
  it.each(['font-atlas-manifest', 'FONT-ATLAS-MANIFEST', 'Font-Atlas-Manifest'])(
    'rejects the reserved stem %s before changing existing outputs',
    async (name) => {
      const { path, output, config } = await fixture();
      await generateFontAtlases(path, silent);
      const manifest = await readFile(join(output, 'font-atlas-manifest.json'));
      const metrics = await readFile(join(output, 'interface.json'));
      config.fonts[0].name = name;
      await writeFile(path, JSON.stringify(config));
      await expect(generateFontAtlases(path, silent)).rejects.toThrow('reserved');
      expect(await readFile(join(output, 'font-atlas-manifest.json'))).toEqual(manifest);
      expect(await readFile(join(output, 'interface.json'))).toEqual(metrics);
    },
  );

  it.each(['fixture.ttf', 'fixture.otf', 'fixture.woff', 'fixture.woff2', 'fixture-cff.woff', 'fixture-cff.woff2'])(
    'generates usable MTSDF PNG and metrics from %s',
    async (source) => {
      const { path, output } = await fixture(source);
      const result = await generateFontAtlases(path, silent);
      expect(result.fonts[0].cached).toBe(false);
      const metrics = JSON.parse(await readFile(join(output, 'interface.json'), 'utf8'));
      expect(metrics.atlas).toMatchObject({ type: 'mtsdf', yOrigin: 'top', size: 48, distanceRange: 6 });
      expect(metrics.glyphs).toHaveLength(95);
      const png = await readFile(join(output, 'interface.png'));
      expect(png.readUInt32BE(16)).toBe(metrics.atlas.width);
      expect(png.readUInt32BE(20)).toBe(metrics.atlas.height);
      const rows = pixels(png);
      expect(rows.length).toBe((metrics.atlas.width * 4 + 1) * metrics.atlas.height);
      expect(rows.some((byte) => byte > 128)).toBe(true);
      expect(rows.some((byte) => byte === 0)).toBe(true);
      const fonts = new FontBook();
      fonts.add(
        new Font('generated', 0, metrics, {
          handle: {},
          width: metrics.atlas.width,
          height: metrics.atlas.height,
          bytes: 0,
        }),
      );
      const shaped = fonts.shape('A?', { font: 'generated', size: 24 }, 300);
      expect(shaped.glyphs).toHaveLength(2);
      expect(shaped.height).toBeGreaterThan(0);
      for (const glyph of shaped.glyphs) for (const uv of glyph.uv) expect(uv).toBeGreaterThanOrEqual(0);
    },
    20000,
  );

  it('uses portable WASI imports and exports a real command entry point', async () => {
    const module = await WebAssembly.compile(await readFile(join(root, 'assets/fontgen.wasm')));
    expect(WebAssembly.Module.exports(module).map((entry) => entry.name)).toContain('_start');
    expect(WebAssembly.Module.imports(module).every((entry) => entry.module === 'wasi_snapshot_preview1')).toBe(true);
  });

  it('caches unchanged output, detects tampering and forces deterministic regeneration', async () => {
    const { path, output } = await fixture();
    const first = await generateFontAtlases(path, silent);
    const pngPath = join(output, 'interface.png');
    const original = await readFile(pngPath),
      timestamp = (await stat(pngPath)).mtimeMs;
    expect((await generateFontAtlases(path, silent)).fonts[0].cached).toBe(true);
    expect((await stat(pngPath)).mtimeMs).toBe(timestamp);
    await writeFile(pngPath, 'damaged');
    expect((await generateFontAtlases(path, silent)).fonts[0].cached).toBe(false);
    expect(await readFile(pngPath)).toEqual(original);
    const forced = await generateFontAtlases(path, { ...silent, force: true });
    expect(forced.fonts[0].cached).toBe(false);
    expect(forced.fonts[0].atlasHash).toBe(first.fonts[0].atlasHash);
  }, 20000);

  it('resolves paths relative to configuration, including directories with spaces', async () => {
    const { directory, config } = await fixture();
    const folder = join(directory, 'a project');
    await mkdir(folder);
    config.fonts[0].source = '../font with spaces.ttf';
    await writeFile(join(directory, 'font with spaces.ttf'), await readFile(join(root, 'tests/fixtures/fixture.ttf')));
    const path = join(folder, 'fonts.json');
    await writeFile(path, JSON.stringify(config));
    const { stdout } = await exec(process.execPath, [join(root, 'cli/index.mjs'), 'fonts', '--config', path], {
      cwd: tmpdir(),
    });
    expect(stdout).toContain('Generated interface');
    expect((await readFile(join(folder, 'out/interface.png'))).length).toBeGreaterThan(100);
  }, 20000);

  it('applies variable-font axes and rejects unsupported axes', async () => {
    const { path, config } = await fixture('fixture-variable.ttf', { variations: { wght: 400 } });
    const first = await generateFontAtlases(path, silent);
    config.fonts[0].variations.wght = 700;
    await writeFile(path, JSON.stringify(config));
    const second = await generateFontAtlases(path, silent);
    expect(second.fonts[0].atlasHash).not.toBe(first.fonts[0].atlasHash);
    config.fonts[0].variations = { nope: 1 };
    await writeFile(path, JSON.stringify(config));
    await expect(generateFontAtlases(path, silent)).rejects.toThrow('variation axis');
  }, 20000);

  it('leaves existing output unchanged if any configured face fails', async () => {
    const { path, output, config } = await fixture();
    await generateFontAtlases(path, silent);
    const before = await readFile(join(output, 'interface.png'));
    const manifest = await readFile(join(output, 'font-atlas-manifest.json'));
    config.fonts[0].size = 64;
    config.fonts.push({ name: 'missing', source: config.fonts[0].source, characters: 'Ω' });
    await writeFile(path, JSON.stringify(config));
    await expect(generateFontAtlases(path, silent)).rejects.toThrow('U+03A9');
    expect(await readFile(join(output, 'interface.png'))).toEqual(before);
    expect(await readFile(join(output, 'font-atlas-manifest.json'))).toEqual(manifest);
  }, 20000);

  it('reports corrupt input, invalid charsets and invalid configuration', async () => {
    const { path, config, directory } = await fixture();
    config.fonts[0].charset = 'this is not a charset';
    await writeFile(path, JSON.stringify(config));
    await expect(generateFontAtlases(path, silent)).rejects.toThrow('Invalid charset');
    config.fonts[0].charset = '[0x20, 0x7E]';
    config.fonts[0].source = './bad.ttf';
    await writeFile(join(directory, 'bad.ttf'), Buffer.from([0, 1, 0, 0, 0]));
    await writeFile(path, JSON.stringify(config));
    await expect(generateFontAtlases(path, silent)).rejects.toThrow('Could not decode');
    expect(() => validateConfig({ ...config, typo: true }, path)).toThrow('Unknown configuration property');
    expect(() => validateConfig({ ...config, fonts: [{ ...config.fonts[0], name: '../escape' }] }, path)).toThrow(
      'name must contain',
    );
    expect(() => validateConfig({ ...config, fonts: [{ ...config.fonts[0], size: 0 }] }, path)).toThrow('size must be');
    expect(() =>
      validateConfig(
        {
          ...config,
          fonts: [
            { ...config.fonts[0], name: 'UI' },
            { ...config.fonts[0], name: 'ui' },
          ],
        },
        path,
      ),
    ).toThrow('Duplicate font');
  }, 20000);

  it('does not overwrite a source font that aliases an output path', async () => {
    const { path, config, output } = await fixture();
    await mkdir(output);
    const source = join(output, 'interface.png');
    const bytes = await readFile(config.fonts[0].source);
    await writeFile(source, bytes);
    config.fonts[0].source = source;
    await writeFile(path, JSON.stringify(config));
    await expect(generateFontAtlases(path, silent)).rejects.toThrow('would be overwritten');
    expect(await readFile(source)).toEqual(bytes);
  });

  it('recovers from a malformed cache manifest', async () => {
    const { path, output } = await fixture();
    await generateFontAtlases(path, silent);
    await writeFile(join(output, 'font-atlas-manifest.json'), JSON.stringify({ fonts: [null, 'broken'] }));
    expect((await generateFontAtlases(path, silent)).fonts[0].cached).toBe(false);
  });

  it('does not overwrite its configuration when it aliases a generated file', async () => {
    const { path, config, directory } = await fixture();
    config.output = '.';
    const collision = join(directory, 'interface.json');
    const bytes = JSON.stringify(config);
    await writeFile(collision, bytes);
    await expect(generateFontAtlases(collision, silent)).rejects.toThrow('Configuration would be overwritten');
    expect(await readFile(collision, 'utf8')).toBe(bytes);
  });

  it('initializes configuration once and exposes clean CLI errors', async () => {
    const { directory } = await fixture();
    const path = join(directory, 'ludic-canvas.fonts.json');
    await initConfig(path);
    await expect(initConfig(path)).rejects.toThrow('EEXIST');
    const { stdout } = await exec(process.execPath, [join(root, 'cli/index.mjs'), '--help']);
    expect(stdout).toContain('TTF, OTF, WOFF and WOFF2');
    await expect(exec(process.execPath, [join(root, 'cli/index.mjs'), 'fonts', '--config'])).rejects.toMatchObject({
      code: 1,
    });
  });
});
