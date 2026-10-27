import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initProject } from '../cli/init.mjs';
import { generateFontAtlases } from '../cli/fonts.mjs';

const directories = [];
async function temporary() {
  const path = await mkdtemp(join(tmpdir(), 'ludic-init-test-'));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('project initializer', () => {
  it.each(['canvas2d', 'three'])(
    'creates a self-contained %s project with a usable font pipeline',
    async (template) => {
      const directory = join(await temporary(), 'My Game');
      await initProject(directory, { template });
      const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      expect(pkg.name).toBe('my-game');
      expect(pkg.private).toBe(true);
      expect(pkg.dependencies['ludic-canvas']).toMatch(/^\^0\./);
      expect(pkg.scripts.predev).toBe('npm run fonts:build');
      expect(pkg.scripts.prebuild).toBe('npm run fonts:build');
      expect(Boolean(pkg.dependencies.three)).toBe(template === 'three');
      const config = JSON.parse(await readFile(join(directory, 'ludic-canvas.fonts.json'), 'utf8'));
      expect(config.fonts[0].source).toBe('fonts/Interface.ttf');
      expect((await readFile(join(directory, config.fonts[0].source))).length).toBeGreaterThan(10000);
      expect(await readFile(join(directory, 'fonts/OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE');
      await generateFontAtlases(join(directory, 'ludic-canvas.fonts.json'), { log() {} });
      const metrics = JSON.parse(await readFile(join(directory, config.output, 'interface.json'), 'utf8'));
      expect(metrics.glyphs.some((glyph) => glyph.unicode === 63)).toBe(true);
      expect(await readdir(directory)).not.toContain('.ludic-init.lock');
    },
  );

  it('preserves an existing project and does not add partial files', async () => {
    const directory = await temporary();
    const original = '{"name":"keep-me"}\n';
    await writeFile(join(directory, 'package.json'), original);
    await expect(initProject(directory)).rejects.toThrow('empty');
    expect(await readFile(join(directory, 'package.json'), 'utf8')).toBe(original);
    expect(await readdir(directory)).toEqual(['package.json']);
  });

  it('validates the template before creating the target or its parents', async () => {
    const base = await temporary();
    await expect(initProject(join(base, 'nested/game'), { template: '../invalid' })).rejects.toThrow('template');
    expect(await readdir(base)).toEqual([]);
  });

  it('accepts an existing empty directory and serializes competing initializers', async () => {
    const directory = join(await temporary(), 'game');
    await mkdir(directory);
    const results = await Promise.allSettled([initProject(directory), initProject(directory)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).private).toBe(true);
    expect(await readdir(directory)).not.toContain('.ludic-init.lock');
  });

  it.skipIf(process.platform === 'win32')('rejects a symlink destination without writing through it', async () => {
    const base = await temporary();
    const target = join(base, 'real');
    await mkdir(target);
    await symlink(target, join(base, 'linked'));
    await expect(initProject(join(base, 'linked'))).rejects.toThrow('symlink');
    expect(await readdir(target)).toEqual([]);
  });
});
