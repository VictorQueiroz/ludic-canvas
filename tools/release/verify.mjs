import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function verifyArtifact(metadata, bytes, { version, commit }) {
  if (metadata.name !== 'ludic-canvas' || metadata.version !== version)
    throw new Error('Registry package name/version differs from the requested release');
  if (metadata.gitHead !== commit) throw new Error('Registry gitHead differs from the release tag');
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (metadata.dist?.integrity !== integrity) throw new Error('Registry tarball integrity mismatch');
  if (!metadata.dist.attestations?.provenance) throw new Error('Expected release provenance metadata is missing');
  return {
    version,
    gitHead: commit,
    integrity,
    bytes: bytes.length,
    attestations: metadata.dist.attestations,
    provenanceVerification: 'metadata-only',
  };
}

export function verifyConsumer(manifest, lock, { version, integrity }) {
  if (manifest.dependencies?.['ludic-canvas'] !== version)
    throw new Error(`Example manifest must pin ludic-canvas exactly to ${version}`);
  const dependency = lock.packages?.['node_modules/ludic-canvas'];
  if (dependency?.version !== version || dependency.integrity !== integrity)
    throw new Error('Example lock does not select the verified registry artifact');
}

export function verifyPage(html, version) {
  const badges = [...html.matchAll(/<span\b[^>]*\bclass=(["'])([^"']*)\1[^>]*>\s*([^<]*)<\/span>/gi)];
  const badge = badges.find((match) => match[2].split(/\s+/).includes('version'));
  if (badge?.[3].trim() !== version) throw new Error(`Website version badge does not match ${version}`);
}

async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}

async function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      site: { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(`Usage: npm run verify:release -- --version X.Y.Z [--site https://public-site/] [--output report.json]

Verify a registry artifact against local tag vX.Y.Z, then install the committed
standalone example in a temporary directory and run its font CLI and build.
--site checks public page versions; verify deployment source/READY separately.
This command does not publish. Run through npm using the repository's Node version.`);
    return;
  }
  const version = values.version;
  if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version))
    throw new Error('Provide an exact release with --version X.Y.Z');
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run through npm run verify:release');
  let site;
  if (values.site) {
    site = new URL(values.site);
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.search || site.hash)
      throw new Error('--site must be a public HTTP(S) base URL without credentials, query or fragment');
    if (!site.pathname.endsWith('/')) site.pathname += '/';
  }
  const startedAt = new Date().toISOString();
  const output = resolve(
    root,
    values.output ?? `build/verification/${version}/${startedAt.replace(/[:.]/g, '-')}.json`,
  );
  const report = { version, startedAt, status: 'incomplete', steps: [] };
  const step = async (name, action) => {
    const record = { name, status: 'incomplete' };
    report.steps.push(record);
    try {
      const result = await action();
      record.status = 'passed';
      console.log(`Verified ${name}`);
      return result;
    } catch (error) {
      record.status = 'failed';
      record.error = error.message;
      throw error;
    }
  };
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30000 }).trim();
  try {
    const commit = await step('release tag', async () => {
      try {
        return git(['rev-parse', '--verify', `refs/tags/v${version}^{commit}`]);
      } catch {
        throw new Error(`Missing local release tag v${version}; fetch that tag before verification`);
      }
    });
    report.releaseTag = `v${version}`;
    report.checkout = { commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']).length > 0 };
    const metadata = await step('registry metadata', async () => {
      const metadata = await (
        await request(`https://registry.npmjs.org/ludic-canvas/${encodeURIComponent(version)}`)
      ).json();
      if (metadata.name !== 'ludic-canvas' || metadata.version !== version || metadata.gitHead !== commit)
        throw new Error('Registry package version/gitHead does not match the requested release tag');
      return metadata;
    });
    report.artifact = await step('tarball identity', async () => {
      const bytes = Buffer.from(await (await request(metadata.dist.tarball)).arrayBuffer());
      return verifyArtifact(metadata, bytes, { version, commit });
    });
    report.consumer = await step('independent registry consumer', async () => {
      const example = join(root, 'examples/kestrel-survey');
      const before = await Promise.all(
        ['package.json', 'package-lock.json'].map((path) => readFile(join(example, path))),
      );
      verifyConsumer(JSON.parse(before[0]), JSON.parse(before[1]), report.artifact);
      const staging = await mkdtemp(join(tmpdir(), 'ludic-registry-verification-'));
      const npm = (args, cwd) => {
        try {
          return execFileSync(process.execPath, [npmCli, ...args], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 300000,
            maxBuffer: 16 * 1024 * 1024,
          });
        } catch (error) {
          if (error.stderr) console.error(error.stderr.toString());
          throw new Error(`Consumer npm ${args.join(' ')} failed`, { cause: error });
        }
      };
      try {
        const project = join(staging, 'standalone game');
        await cp(example, project, {
          recursive: true,
          filter: (source) =>
            !relative(example, source)
              .split(/[\\/]/)
              .some((part) => ['node_modules', 'dist', 'font-atlas-manifest.json'].includes(part)),
        });
        console.log(npm(['ci', '--no-audit', '--no-fund'], project));
        const installed = join(project, 'node_modules/ludic-canvas');
        const installedPackage = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
        if (installedPackage.version !== version) throw new Error('Installed package version differs from the release');
        const api = await import(pathToFileURL(join(installed, 'dist/index.js')).href);
        if (typeof api.createUI !== 'function') throw new Error('Published root API does not resolve');
        await Promise.all(Object.values(api.defaultAssets).map((url) => access(new URL(url))));
        console.log(npm(['run', 'fonts'], project));
        console.log(npm(['run', 'build'], project));
        for (const [index, path] of ['package.json', 'package-lock.json'].entries())
          if (!before[index].equals(await readFile(join(project, path))))
            throw new Error(`Consumer verification changed ${path}`);
        await access(join(project, 'dist/index.html'));
        return {
          example: 'examples/kestrel-survey',
          installedVersion: installedPackage.version,
          exports: Object.keys(api).sort(),
        };
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    });
    if (site) {
      report.site = await step('public site versions', async () => {
        const pages = await Promise.all(
          ['', 'guide/', 'api/', 'play/', 'performance/', '3d/'].map(async (path) => {
            const url = new URL(path, site);
            const response = await request(url);
            if (new URL(response.url).origin !== site.origin)
              throw new Error('Public site redirected to another origin');
            verifyPage(await response.text(), version);
            return { url: url.href, status: response.status, version };
          }),
        );
        return { pages, deploymentSourceVerified: false };
      });
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Verification report: ${output}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
