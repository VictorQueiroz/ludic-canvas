# Session handoff — 2026-10-27

This is a dated evidence snapshot, not a live release dashboard. Start in the
`ludic-canvas` checkout, read [AGENTS.md](../AGENTS.md) and
[CONTRIBUTING.md](../CONTRIBUTING.md), then refresh Git status/origin/main, npm
dist-tags and the canonical deployment before making current-state claims.
Preserve unrelated working-tree changes.

## Verified release and deployment

- Published package: [ludic-canvas 0.6.0](https://www.npmjs.com/package/ludic-canvas/v/0.6.0).
- Release tag and npm `gitHead`:
  [327cc48f280d393241f2772cdca6370c06d76a4a](https://github.com/VictorQueiroz/ludic-canvas/commit/327cc48f280d393241f2772cdca6370c06d76a4a).
- The standalone example pin and qualification follow-up were merged at
  [23544ec50f714c544f3979585f4572ff33b31b6a](https://github.com/VictorQueiroz/ludic-canvas/commit/23544ec50f714c544f3979585f4572ff33b31b6a).
  Its [final checks](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40551620876)
  passed. This is the last deployment revision verified by the release session;
  later documentation/tooling commits supersede it.
- Canonical site: <https://libraries.ludic-canvas.victorqueiroz.dev>.
  Vercel reported the follow-up deployment READY with that alias and source SHA.
  Guide, API, Play, performance and 3D pages returned 200 with version 0.6.0.
- The actual 821,884-byte registry tarball matched its SHA-512 integrity and tag.
  A fresh independent copy of the committed 3D example passed `npm ci`, public API
  imports, both font-generation commands and its production build. Registry
  provenance metadata was present; this was not independent signature validation.

Routine releases use Changesets version PRs and GitHub OIDC. Read
[RELEASING.md](RELEASING.md); repeat login/bootstrap only when owner setup actually
needs repair. Source tooling now exposes `npm run verify:release` so publication
verification does not depend on an ignored one-off script.

## Delivered contracts

0.4 added controlled components, root-scoped hooks and Canvas2D/Three.js starters.
0.5 added font fallback/kerning and measurement fixtures. 0.6 added root-local
profiles and scrolling, fixed-height virtual listboxes, logical focus/selection
and a responsive 4,000-record game archive. See [ROADMAP.md](../ROADMAP.md),
[SCROLLING.md](SCROLLING.md) and [VIRTUALIZATION.md](VIRTUALIZATION.md).

## Performance evidence

- Acquisition source:
  [802b0d72292480e5ae71b026189b1c393996d901](https://github.com/VictorQueiroz/ludic-canvas/commit/802b0d72292480e5ae71b026189b1c393996d901).
  Its SDK `src/` matches v0.6.0; package-version metadata at acquisition was 0.5.0.
- Three matched M3/Chrome runs measured 4,000-row CPU frame-call p95 at
  49.4–54.5 ms retained and 2.7–3.5 ms virtualized. All virtualized cases met the
  supplied 4 ms reference budget. A separate diagnostic recorded 51–63 mounted nodes.
- Original reports, checksums and trace are tracked under
  [public/performance/collections-m3-chrome-2026-10-27](public/performance/collections-m3-chrome-2026-10-27/README.md).
  Preserve their bytes. Read [PERFORMANCE.md](PERFORMANCE.md) before comparison or
  another acquisition and [QUALIFICATION_RESULTS.md](QUALIFICATION_RESULTS.md) for limits.

## Outstanding work and next bounded task

Physical iPhone/Android, real screen readers, complete-game hardware timing and a
30-minute session with actual heap/process/GPU observations remain unqualified.
Start the next qualification task by selecting one available physical target and
running its catalogue/game protocol, recording missing probes explicitly. Hardware
access is needed to acquire physical-device evidence; emulation cannot fill it.

Linux WPE intermittently stalled in a second `WebAssembly.instantiate()`. Native
macOS WebKit coverage does not fix or qualify that port. A world-context-loss retry
and the responsive-control test race are retained in the qualification record.

Shaping/bidi/graphemes, native text entry, variable-height collections and
interactive grids remain design work. The acquired collection budget was met by
windowing; select further optimizations from a new relevant profile.
