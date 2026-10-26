// One-time owner-authenticated npm setup. Subsequent releases use GitHub OIDC.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script through npm run release:bootstrap');
const npm = (args) => execFileSync(process.execPath, [npmCli, ...args], { stdio: 'inherit' });
try {
  npm(['whoami', '--registry=https://registry.npmjs.org']);
  const response = await fetch('https://registry.npmjs.org/ludic-canvas', { cache: 'no-store' });
  if (response.status === 404) {
    const url = 'https://github.com/VictorQueiroz/ludic-canvas/releases/download/v0.1.0/ludic-canvas-0.1.0.tgz';
    const artifact = await fetch(url);
    if (!artifact.ok) throw new Error(`Could not download the original release: ${artifact.status}`);
    const bytes = Buffer.from(await artifact.arrayBuffer());
    const expected = '5cb9b1d094b7b5f602c056fd21b917998de445b2ec49a652f161860c99a8e616';
    if (createHash('sha256').update(bytes).digest('hex') !== expected)
      throw new Error('Original release checksum mismatch');
    const staging = await mkdtemp(join(tmpdir(), 'ludic-npm-bootstrap-'));
    try {
      const path = join(staging, 'ludic-canvas-0.1.0.tgz');
      await writeFile(path, bytes);
      console.log('Publishing the verified original v0.1.0 release to establish npm package ownership.');
      npm(['publish', path, '--access=public', '--registry=https://registry.npmjs.org']);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  } else if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
  else {
    const metadata = await response.json();
    const repository = metadata.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '');
    if (repository !== 'https://github.com/VictorQueiroz/ludic-canvas')
      throw new Error(
        'The existing npm package points to a different repository; inspect ownership before continuing.',
      );
  }
  npm([
    'trust',
    'github',
    'ludic-canvas',
    '--file',
    'release.yml',
    '--repo',
    'VictorQueiroz/ludic-canvas',
    '--allow-publish',
  ]);
  console.log(
    'npm trusted publishing is configured. Review and merge the Changesets version PR to publish the CLI release.',
  );
} catch (error) {
  console.error(`npm setup is incomplete: ${error.message}`);
  console.error('Complete npm login and any npm browser 2FA requests, then run npm run release:bootstrap again.');
  process.exitCode = 1;
}
