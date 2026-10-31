export const groups = ['verify', 'native-macos', 'browser-tests', 'browser-webkit'];

// Keep this allowlist narrow. Generated pages, assets, examples, workflow changes
// and unknown paths must exercise the complete runtime matrix.
const prose = (path) => /^(?:[^/]+\.md|docs\/[^/]+\.md|\.changeset\/[^/]+\.md)$/.test(path);

export function planChecks(files, { full = false } = {}) {
  const documentationOnly =
    !full && Array.isArray(files) && files.length > 0 && files.every((path) => typeof path === 'string' && prose(path));
  return {
    version: 1,
    scope: documentationOnly ? 'documentation' : 'full',
    reason: documentationOnly
      ? 'Only allowlisted prose changed; package, type, unit, documentation and formatting checks still run.'
      : 'Full verification requested, runtime/unknown paths changed, or change detection was unavailable.',
    required: Object.fromEntries(groups.map((group) => [group, group === 'verify' || !documentationOnly])),
  };
}

export function evaluateChecks(plan, needs) {
  const errors = [];
  const rows = [];
  if (!needs || needs.plan?.result !== 'success') errors.push('The planning job did not succeed.');
  const expected = planChecks(['README.md'], { full: plan?.scope !== 'documentation' });
  if (
    plan?.version !== 1 ||
    !['documentation', 'full'].includes(plan?.scope) ||
    plan?.reason !== expected.reason ||
    !plan?.required ||
    Object.keys(plan.required).length !== groups.length ||
    groups.some((group) => plan.required[group] !== expected.required[group])
  )
    errors.push('The check plan is missing or invalid.');
  for (const group of Object.keys(needs ?? {}))
    if (group !== 'plan' && !groups.includes(group)) errors.push(`Unrecognized dependency: ${group}.`);
  for (const group of groups) {
    const result = needs?.[group]?.result;
    const required = plan?.required?.[group];
    const accepted = result === 'success' || (required === false && result === 'skipped');
    rows.push({ group, required, result: result ?? 'missing', accepted });
    if (!accepted) errors.push(`${group}: ${result ?? 'missing'}${required === false ? '' : ' (required)'}.`);
  }
  return { passed: errors.length === 0, errors, rows };
}

export function summarizeChecks(report) {
  return [
    '## CI result',
    '',
    '| Group | Required | Result |',
    '| --- | --- | --- |',
    ...report.rows.map(({ group, required, result }) => `| ${group} | ${String(required)} | ${result} |`),
    '',
    ...report.errors.map((error) => `- ${error}`),
    '',
    report.passed ? 'All applicable checks passed.' : 'CI did not satisfy the check plan.',
    '',
  ].join('\n');
}
