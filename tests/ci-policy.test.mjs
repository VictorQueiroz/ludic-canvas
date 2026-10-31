import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { planChecks, evaluateChecks } from '../tools/ci/policy.mjs';

const script = resolve('tools/ci/run.mjs');
const results = (plan) => ({
  plan: { result: 'success', outputs: { plan: JSON.stringify(plan) } },
  ...Object.fromEntries(
    Object.entries(plan.required).map(([group, required]) => [group, { result: required ? 'success' : 'skipped' }]),
  ),
});

describe('CI applicability', () => {
  it('keeps package verification for prose-only changes and explains the exclusions', () => {
    expect(planChecks(['README.md', 'docs/PORTABILITY.md', '.changeset/change.md'])).toMatchObject({
      scope: 'documentation',
      required: { verify: true, 'native-macos': false, 'browser-tests': false, 'browser-webkit': false },
    });
  });
  it.each([
    'src/index.ts',
    'native/portable/macos.mm',
    'package-lock.json',
    '.github/workflows/check.yml',
    'tools/ci/policy.mjs',
    'docs/main.tsx',
    'docs/index.html',
    'docs/public/performance/report.json',
    'new-unknown-file',
  ])('requires the full matrix for %s even alongside prose', (path) => {
    expect(planChecks(['README.md', path]).required).toEqual({
      verify: true,
      'native-macos': true,
      'browser-tests': true,
      'browser-webkit': true,
    });
  });
  it('defaults to full verification for missing, empty or invalid changes', () => {
    for (const files of [undefined, null, [], ['README.md', null]]) expect(planChecks(files).scope).toBe('full');
  });
  it('runs every group when full verification is requested, including prose-only releases', () => {
    expect(planChecks(['README.md'], { full: true }).scope).toBe('full');
  });
});

describe('required CI summaries', () => {
  it('passes after every required group succeeds', () => {
    const plan = planChecks(['src/core.ts']);
    expect(evaluateChecks(plan, results(plan)).passed).toBe(true);
  });
  it('accepts only planned exclusions and reports their skipped state', () => {
    const plan = planChecks(['README.md']);
    const report = evaluateChecks(plan, results(plan));
    expect(report.passed).toBe(true);
    expect(report.rows.find((row) => row.group === 'native-macos')).toMatchObject({
      required: false,
      result: 'skipped',
    });
  });
  it.each(['failure', 'cancelled', 'skipped', undefined])('blocks a required result of %s', (result) => {
    const plan = planChecks(['src/core.ts']);
    const needs = results(plan);
    needs['browser-tests'] = { result };
    expect(evaluateChecks(plan, needs).passed).toBe(false);
  });
  it.each(['failure', 'cancelled', undefined])('does not conceal optional work reporting %s', (result) => {
    const plan = planChecks(['README.md']);
    const needs = results(plan);
    needs['native-macos'] = { result };
    expect(evaluateChecks(plan, needs).passed).toBe(false);
  });
  it('blocks missing planning output and planning failures or cancellations', () => {
    const plan = planChecks(['README.md']);
    expect(evaluateChecks(undefined, results(plan)).passed).toBe(false);
    for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
      const needs = results(plan);
      needs.plan = { result };
      expect(evaluateChecks(plan, needs).passed).toBe(false);
    }
  });
  it('rejects plans that omit checks, invent a scope, or mark required work optional', () => {
    const plan = planChecks(['src/core.ts']);
    for (const invalid of [
      { ...plan, version: 2 },
      { ...plan, scope: 'skip-everything' },
      { ...plan, reason: '' },
      { ...plan, required: {} },
      { ...plan, required: { ...plan.required, verify: false } },
      { ...plan, required: { ...plan.required, 'native-macos': false } },
    ])
      expect(evaluateChecks(invalid, results(plan)).passed).toBe(false);
  });
  it('fails when a new dependency has no policy instead of silently ignoring it', () => {
    const plan = planChecks(['src/core.ts']);
    expect(evaluateChecks(plan, { ...results(plan), additional: { result: 'failure' } }).passed).toBe(false);
  });
});

function fixture(callback) {
  const directory = mkdtempSync(join(tmpdir(), 'ludic-ci-'));
  const output = join(directory, 'outputs');
  const summary = join(directory, 'summary');
  const eventPath = join(directory, 'event.json');
  const run = (command, env = {}) => {
    writeFileSync(output, '');
    writeFileSync(summary, '');
    const result = spawnSync(process.execPath, [script, command], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'pull_request',
        CI_FULL: 'false',
        ...env,
      },
    });
    return { ...result, output: readFileSync(output, 'utf8'), summary: readFileSync(summary, 'utf8') };
  };
  try {
    callback({ directory, eventPath, run });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it('reports planned skips successfully but exits nonzero without a success output for failed work', () => {
  fixture(({ run }) => {
    const plan = planChecks(['README.md']);
    const needs = results(plan);
    const passed = run('report', { CI_NEEDS: JSON.stringify(needs) });
    expect(passed.status).toBe(0);
    expect(passed.output).toBe('passed=true\n');
    expect(passed.summary).toContain('| native-macos | false | skipped |');
    needs.verify.result = 'skipped';
    const failed = run('report', { CI_NEEDS: JSON.stringify(needs) });
    expect(failed.status).toBe(1);
    expect(failed.output).toBe('');
    expect(failed.summary).toContain('verify: skipped (required)');
    expect(run('report', { CI_NEEDS: '{broken' }).status).toBe(1);
  });
});

it('detects the whole PR diff, including source renamed into a prose path and deleted source', () => {
  fixture(({ directory, eventPath, run }) => {
    const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
    git('init', '-q');
    mkdirSync(join(directory, 'src'));
    writeFileSync(join(directory, 'src/runtime.ts'), 'export const value = 1;\n');
    git('add', 'src/runtime.ts');
    const commit = () => {
      git('add', '-u');
      git('add', 'README.md');
      git(
        '-c',
        'user.name=CI test',
        '-c',
        'user.email=ci@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-qm',
        'fixture',
      );
      return git('rev-parse', 'HEAD');
    };
    writeFileSync(join(directory, 'README.md'), 'Before\n');
    const base = commit();
    const getPlan = (head, env) => {
      writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: head } } }));
      const result = run('plan', env);
      expect(result.status).toBe(0);
      return JSON.parse(
        result.output
          .split('\n')
          .find((line) => line.startsWith('plan='))
          .slice(5),
      );
    };
    writeFileSync(join(directory, 'README.md'), 'Prose only\n');
    const proseHead = commit();
    expect(getPlan(proseHead).scope).toBe('documentation');
    expect(getPlan(proseHead, { GITHUB_EVENT_NAME: 'push' }).scope).toBe('full');
    expect(getPlan(proseHead, { CI_FULL: 'true' }).scope).toBe('full');
    rmSync(join(directory, 'README.md'));
    git('mv', 'src/runtime.ts', 'README.md');
    const renamed = commit();
    expect(getPlan(renamed).scope).toBe('full');
    writeFileSync(join(directory, 'README.md'), 'Later prose commit\n');
    expect(getPlan(commit()).scope).toBe('full');
    git('reset', '--hard', proseHead);
    git('rm', 'src/runtime.ts');
    expect(getPlan(commit()).scope).toBe('full');
  });
});

it('selects the full suite when comparison metadata is unavailable', () => {
  fixture(({ run }) => {
    const result = run('plan');
    expect(result.status).toBe(0);
    expect(result.output).toContain('"scope":"full"');
    expect(run('plan', { CI_FULL: 'invalid' }).status).toBe(1);
  });
});
