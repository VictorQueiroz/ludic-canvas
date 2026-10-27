# Contributing

Start in this repository's Git root and verify that `origin` points to
`VictorQueiroz/ludic-canvas`. Use `.nvmrc` and the Node support in `package.json`;
CI uses Node 24. Native compilation is optional for ordinary TypeScript work:
the repository includes the layout reactor and portable font compiler.

```sh
npm ci
npm run dev
```

Keep unrelated changes intact. An isolated worktree is useful when another task
is active in the checkout. Use only servers, temporary directories and processes
created for your task when cleaning up.

## Source map

| Area                          | Maintained source                                                  |
| ----------------------------- | ------------------------------------------------------------------ |
| Public API and renderer       | `src/`, with exports in `src/index.ts`                             |
| Yoga bridge and binary builds | `src/wasm/`, `native/`, `tools/toolchain/`, `CMakeLists.txt`       |
| Font and initializer CLI      | `cli/`, `tools/fontgen/`, `font-atlas.schema.json`                 |
| Guide and page generation     | `tools/docs*.mjs`                                                  |
| API reference                 | Emitted `dist/*.d.ts`, consumed by `tools/docs.mjs`                |
| Interactive website           | `docs/`, including the play gallery and performance lab            |
| Independent 3D consumer       | `examples/kestrel-survey/`                                         |
| Release verification          | `tools/release/verify.mjs`, [release procedure](docs/RELEASING.md) |

The library owns composition, layout, rendering and interaction. Application
models, engine adapters, art and persistence stay outside it. Examples consume
public exports; the website aliases those exports to the current checkout.
The independent example's manifest and lockfile select its registry package.

## Documentation changes

Edit `tools/docs*.mjs` for guide/page content and `src/` for public API comments or
types. Then regenerate and inspect the resulting tracked HTML:

```sh
npm run build
npm run docs:generate
npm run docs:build
```

Edit Markdown documents directly. Link substantial procedures from `AGENTS.md`
instead of keeping parallel copies. Update [ROADMAP.md](ROADMAP.md) when a
milestone ships, and keep acquired evidence separate from future plans.

Original files under `docs/public/performance/` are immutable acquisition records.
Keep their original bytes and sibling checksums; run formatting on authored
Markdown and source files rather than raw reports. A corrected analysis can
reference the original record without rewriting it.

## Validation

Choose focused checks while developing. For a runtime regression, first acquire
a failing unit/browser contract that observes the affected behavior. Verify the
fix and related ownership, focus or cleanup paths. A documentation-only edit does
not require new runtime tests or another hardware benchmark.

The release gates are:

```sh
npm run check
npm run format:check
npm pack --dry-run
npm run test:browser
```

`check` builds the package, checks types, runs unit regressions, builds the
website, audits public/distribution boundaries and verifies packed consumers.
The packed-consumer test deliberately substitutes the local tarball. Use
`npm run verify:release` to test the committed consumer against an actual npm
publication; the two checks establish different facts.

For a focused browser test, install the required engine and select its project:

```sh
npx playwright install chromium
npm run test:browser -- --project=chromium --workers=1 -g 'regional archive'
```

See [the check workflow](.github/workflows/check.yml) for the current matrix and
deadlines. Linux Chromium/Firefox jobs use a digest-pinned official Playwright
image with browsers, native dependencies and Xvfb. Update its version and digest
together with `@playwright/test`. Safari-oriented WebKit jobs use native macOS;
the Linux WPE result remains a separate qualification limit. Native-focus tests
run with one worker per isolated browser job.

### Browser readiness and failure triage

- Wait for semantic evidence that the target layout or modal has committed.
  The archive contract waits for the compact site picker and removal of desktop
  tabs before pressing Collection. The label alone exists in both layouts.
- Keep entrance/motion coverage explicit. A reduced-motion scene-switching test
  does not establish animated startup correctness.
- Identify the failing phase: CI image/dependency setup, test `beforeEach`, module
  fetch/instantiation, atlas decode/upload, React/layout commit or interaction.
  Preserve the initial error, screenshot, browser/OS and exact source revision.
- Use the retained Playwright trace and narrowly scoped diagnostics before
  choosing a fix. A world-context-loss state, an unresolved WASM promise and a
  missing control after resize require different investigations.
- Record passes after retry as such. Document changes to ports, timing or test
  conditions and retain unresolved causes; a successful alternative environment
  does not establish a fix in the original one.

### Performance and device evidence

Use [PERFORMANCE.md](docs/PERFORMANCE.md) for matched workloads, profiling modes,
budgets, source identity and original reports. Use
[DEVICE_QUALIFICATION.md](docs/DEVICE_QUALIFICATION.md) for physical phones,
assistive technology and long sessions. Record acquired results in
[QUALIFICATION_RESULTS.md](docs/QUALIFICATION_RESULTS.md).

The reference collection budget is device/workload-specific. Keep unprofiled
acceptance runs separate from traced diagnostics. UI frame-call time does not
measure asynchronous GPU execution or complete-game performance; teardown mirror
counts do not establish memory reclamation. Retain passed, failed, partial and
not-run states separately.

## Releases and handoff

Follow [RELEASING.md](docs/RELEASING.md) for changesets, trusted publishing,
registry verification and deployment identity. Publication follows the user's
requested scope; documentation or a skill does not grant release authorization.

Before handing work over, update the dated [session handoff](docs/SESSION_HANDOFF.md)
with verified state, evidence links and outstanding work. Keep changing versions,
SHAs, deployments and measurements there or in their evidence records; keep
permanent rules focused on stable contracts.
