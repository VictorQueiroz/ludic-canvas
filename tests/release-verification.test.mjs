import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyArtifact, verifyConsumer, verifyPage } from '../tools/release/verify.mjs';

const version = '0.6.0';
const commit = 'a'.repeat(40);
const bytes = Buffer.from('published artifact');
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const metadata = () => ({
  name: 'ludic-canvas',
  version,
  gitHead: commit,
  dist: { integrity, attestations: { provenance: { predicateType: 'https://slsa.dev/provenance/v1' } } },
});
const manifest = () => ({ dependencies: { 'ludic-canvas': version } });
const lock = () => ({ packages: { 'node_modules/ludic-canvas': { version, integrity } } });

describe('published artifact identity', () => {
  it('accepts matching bytes and release source while labeling provenance as metadata only', () => {
    expect(verifyArtifact(metadata(), bytes, { version, commit })).toMatchObject({
      version,
      gitHead: commit,
      integrity,
      bytes: bytes.length,
      provenanceVerification: 'metadata-only',
    });
  });
  it('rejects altered tarball bytes', () => {
    expect(() => verifyArtifact(metadata(), Buffer.from('altered'), { version, commit })).toThrow(/integrity/i);
  });
  it('rejects another source commit even when the bytes match the registry digest', () => {
    expect(() => verifyArtifact({ ...metadata(), gitHead: 'b'.repeat(40) }, bytes, { version, commit })).toThrow(
      /gitHead/i,
    );
  });
  it('rejects a different published version', () => {
    expect(() => verifyArtifact({ ...metadata(), version: '0.5.0' }, bytes, { version, commit })).toThrow(/version/i);
  });
  it('requires the provenance metadata expected from the trusted release workflow', () => {
    const missing = metadata();
    delete missing.dist.attestations;
    expect(() => verifyArtifact(missing, bytes, { version, commit })).toThrow(/provenance/i);
  });
});

describe('committed registry consumer', () => {
  it('accepts a matching exact manifest and integrity-locked dependency', () => {
    expect(() => verifyConsumer(manifest(), lock(), { version, integrity })).not.toThrow();
  });
  it('rejects a stale manifest even if the lock points to the requested release', () => {
    expect(() => verifyConsumer({ dependencies: { 'ludic-canvas': '0.4.0' } }, lock(), { version, integrity })).toThrow(
      /manifest/i,
    );
  });
  it('rejects a lock that would install different bytes', () => {
    const different = lock();
    different.packages['node_modules/ludic-canvas'].integrity = 'sha512-different';
    expect(() => verifyConsumer(manifest(), different, { version, integrity })).toThrow(/lock/i);
  });
});

it('requires the site version badge, rather than an incidental mention of the requested release', () => {
  expect(() => verifyPage('<header><span class="version">0.5.0</span></header><p>0.6.0 changes</p>', version)).toThrow(
    /version/i,
  );
  expect(() => verifyPage('<header><span class="version">0.6.0</span></header>', version)).not.toThrow();
});
