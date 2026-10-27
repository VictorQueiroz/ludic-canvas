import { lstat, mkdir, open, readFile, readdir, rm, rmdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const sharedFiles = [
  'index.html',
  'tsconfig.json',
  'vite.config.ts',
  'README.md',
  'src/main.tsx',
  'src/Hud.tsx',
  'src/game.ts',
  'src/fonts.ts',
  'src/style.css',
  'fonts/Interface.ttf',
  'fonts/OFL.txt',
];
const templates = ['canvas2d', 'three'];

async function assertEmpty(directory) {
  let entry;
  try {
    entry = await lstat(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (entry.isSymbolicLink()) throw new Error('Project destination must not be a symlink');
  if (!entry.isDirectory() || (await readdir(directory)).length)
    throw new Error('Project destination must be a new or empty directory; existing files are never overwritten');
}

/** Generate only files. Dependency installation remains an explicit application step. */
export async function initProject(directory = 'ludic-game', { template = 'canvas2d' } = {}) {
  if (!templates.includes(template)) throw new Error(`Unknown template ${template}; choose canvas2d or three`);
  if (typeof directory !== 'string' || !directory.trim()) throw new Error('Project directory must not be empty');
  const target = resolve(directory);
  await assertEmpty(target);
  const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const name =
    basename(target)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'ludic-game';
  const pkg = {
    name,
    version: '0.0.0',
    private: true,
    type: 'module',
    engines: { node: '>=24' },
    scripts: {
      'fonts:build': 'ludic-canvas fonts --config ludic-canvas.fonts.json',
      predev: 'npm run fonts:build',
      dev: 'vite',
      prebuild: 'npm run fonts:build',
      build: 'tsc --noEmit && vite build',
      preview: 'vite preview',
    },
    dependencies: { 'ludic-canvas': `^${metadata.version}`, react: metadata.peerDependencies.react },
    devDependencies: {
      '@types/react': metadata.devDependencies['@types/react'],
      typescript: metadata.devDependencies.typescript,
      vite: metadata.devDependencies.vite,
    },
  };
  if (template === 'three') {
    pkg.dependencies.three = metadata.devDependencies.three;
    pkg.devDependencies['@types/three'] = metadata.devDependencies['@types/three'];
  }
  const files = new Map(
    await Promise.all(
      sharedFiles.map(async (file) => [file, await readFile(new URL(`./templates/shared/${file}`, import.meta.url))]),
    ),
  );
  files.set('src/world.ts', await readFile(new URL(`./templates/${template}/world.ts`, import.meta.url)));
  files.set('package.json', JSON.stringify(pkg, null, 2) + '\n');
  files.set(
    'ludic-canvas.fonts.json',
    JSON.stringify(
      {
        $schema: 'https://libraries.ludic-canvas.victorqueiroz.dev/font-atlas.schema.json',
        output: 'src/fonts/generated',
        charset: '[0x20, 0x7E], [0xA0, 0xFF]',
        fonts: [{ name: 'interface', source: 'fonts/Interface.ttf', size: 48, distanceRange: 6 }],
      },
      null,
      2,
    ) + '\n',
  );
  files.set('.gitignore', 'node_modules/\ndist/\nsrc/fonts/generated/\n.env*\n.DS_Store\n');
  let createdTarget = false,
    lock,
    success = false;
  const written = [],
    directories = [];
  try {
    await mkdir(dirname(target), { recursive: true });
    try {
      await mkdir(target);
      createdTarget = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    await assertEmpty(target);
    try {
      lock = await open(join(target, '.ludic-init.lock'), 'wx');
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error('Another initializer is using this project directory');
      throw error;
    }
    if ((await readdir(target)).some((file) => file !== '.ludic-init.lock'))
      throw new Error('Project destination must remain empty during initialization');
    for (const relative of ['fonts', 'src', 'src/fonts']) {
      const path = join(target, relative);
      await mkdir(path);
      directories.push(path);
    }
    for (const [relative, contents] of files) {
      const path = join(target, relative);
      const file = await open(path, 'wx');
      written.push(path);
      try {
        await file.writeFile(contents);
      } finally {
        await file.close();
      }
    }
    success = true;
    return { directory: target, template, files: files.size };
  } finally {
    if (!success) {
      for (const path of written.reverse()) await rm(path).catch(() => {});
      for (const path of directories.reverse()) await rmdir(path).catch(() => {});
    }
    if (lock) {
      await lock.close();
      await rm(join(target, '.ludic-init.lock'));
    }
    if (!success && createdTarget) await rmdir(target).catch(() => {});
  }
}
