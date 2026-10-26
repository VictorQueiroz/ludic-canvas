import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = resolve(process.argv[2] ?? resolve(root, 'tools/fontgen/faces.json'));
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const build = resolve(root, 'build/fontgen');
const tool = resolve(build, 'bin/msdf-atlas-gen');
if (!existsSync(tool)) {
  execFileSync('cmake', ['-S', resolve(root, 'tools/fontgen'), '-B', build, '-DCMAKE_BUILD_TYPE=Release'], {
    stdio: 'inherit',
  });
  execFileSync('cmake', ['--build', build, '-j', '4'], { stdio: 'inherit' });
}
const output = resolve(dirname(configPath), config.output);
mkdirSync(output, { recursive: true });
const charset = resolve(build, 'charset.txt');
writeFileSync(charset, config.charset);
for (const face of config.faces) {
  execFileSync(
    tool,
    [
      face.variable ? '-varfont' : '-font',
      resolve(dirname(configPath), face.source),
      '-charset',
      charset,
      '-type',
      'mtsdf',
      '-format',
      'png',
      '-imageout',
      resolve(output, face.name + '.png'),
      '-json',
      resolve(output, face.name + '.json'),
      '-size',
      String(face.size),
      '-pxrange',
      String(face.pxrange),
      '-yorigin',
      'top',
      '-pots',
    ],
    { stdio: 'inherit' },
  );
}
