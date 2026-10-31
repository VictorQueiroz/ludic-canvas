import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { planChecks, evaluateChecks, summarizeChecks } from './policy.mjs';

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
function summary(value) {
  console.log(value);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, value);
}

if (process.argv[2] === 'plan') {
  if (!['true', 'false'].includes(process.env.CI_FULL)) throw new Error('CI_FULL must be true or false');
  const full = process.env.CI_FULL === 'true' || process.env.GITHUB_EVENT_NAME !== 'pull_request';
  let files;
  if (!full) {
    try {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      const base = event.pull_request?.base?.sha;
      const head = event.pull_request?.head?.sha;
      if (![base, head].every((sha) => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha)))
        throw new Error('Missing PR base/head revisions');
      // Include both sides of renames and deleted paths. Read the whole PR diff,
      // not only its final commit, and never interpolate filenames into a shell.
      files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      })
        .split('\0')
        .filter(Boolean);
    } catch (error) {
      console.log(`Change detection unavailable; selecting the full suite: ${error.message}`);
    }
  }
  const plan = planChecks(files, { full });
  output('plan', JSON.stringify(plan));
  for (const [group, required] of Object.entries(plan.required)) output(group, String(required));
  summary(`## CI plan\n\nScope: **${plan.scope}**\n\n${plan.reason}\n`);
} else if (process.argv[2] === 'report') {
  let needs, plan;
  try {
    needs = JSON.parse(process.env.CI_NEEDS);
    plan = JSON.parse(needs.plan?.outputs?.plan);
  } catch {
    // Invalid/missing metadata must produce a failed gate and a useful summary.
  }
  const report = evaluateChecks(plan, needs);
  summary(summarizeChecks(report));
  if (report.passed) output('passed', 'true');
  else process.exitCode = 1;
} else {
  throw new Error('Expected plan or report');
}
