# Repository guidance

Use [CONTRIBUTING.md](CONTRIBUTING.md) for development, documentation and test
procedures. Use [docs/RELEASING.md](docs/RELEASING.md) when a release or publication
verification is requested. [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md) is a
dated starting point; refresh its mutable state before relying on it.

## Boundaries and architecture

- Confirm the Git root and origin before editing. Preserve unrelated work; use
  an isolated worktree when another task is active in the checkout.
- Keep the public repository independent of private source applications. Their
  names, identifiers, content and assets do not belong in its code, documentation,
  examples, commits or release messages.
- React owns composition, Yoga WebAssembly owns layout and WebGL owns drawing.
  Applications own game state and the simulation/frame loop. Keep resources,
  focus, scrolling and subscriptions root-local; avoid a global active root.
- Generate font atlases offline with the packaged CLI. Preserve the documented
  font/resource limits until a separately tested design changes them.
- Edit guide sources in `tools/docs*.mjs` and public TypeScript declarations in
  `src/`; regenerate the tracked HTML. Read `docs/public/performance/` as acquired
  evidence: preserve original bytes and checksums, including historical results.

## Changes and evidence

- For applicable bug fixes, reproduce the failing contract before changing it.
  Test observable behavior, including ownership and teardown where affected.
- Browser interactions should wait for the intended rendered state. After a
  responsive update, a matching label can still identify a control being replaced.
  See the readiness and failure-triage procedures in CONTRIBUTING.md.
- Inspect the failing phase and trace before changing SDK behavior, test
  deadlines, motion settings or browser ports. Record retries, exclusions and
  unresolved causes in the qualification evidence.
- Run checks appropriate to the change and the release gates when releasing.
  Reuse evidence for unchanged source; avoid repeating hardware acquisition for
  metadata/documentation-only edits. Keep the CI image version aligned with the
  Playwright dependency.
- Report source revision, published artifact and deployed revision separately.
  CPU frame-call timing, software-GPU CI, mobile emulation and mirror cleanup
  have the limits documented in [docs/PERFORMANCE.md](docs/PERFORMANCE.md) and
  [docs/QUALIFICATION_RESULTS.md](docs/QUALIFICATION_RESULTS.md).
- Add a changeset for changes to published behavior. Repository-only guidance
  and verification tooling do not need a package version bump. Follow the
  existing Changesets/OIDC workflow for authorized publication.
