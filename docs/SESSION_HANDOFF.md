# Session handoff — 2026-10-29

This is a dated evidence snapshot, not a live release dashboard. Start in the
`ludic-canvas` checkout, read [AGENTS.md](../AGENTS.md) and
[CONTRIBUTING.md](../CONTRIBUTING.md), then refresh Git status/origin/main, npm
dist-tags and the canonical deployment before making current-state claims.
Preserve unrelated edits and original acquisition bytes/checksums.

## Package, delivery and deployment

- Published package: [ludic-canvas 0.6.0](https://www.npmjs.com/package/ludic-canvas/v/0.6.0).
  Registry latest remained 0.6.0 during this session.
- Release tag and npm `gitHead`:
  [327cc48f280d393241f2772cdca6370c06d76a4a](https://github.com/VictorQueiroz/ludic-canvas/commit/327cc48f280d393241f2772cdca6370c06d76a4a).
  The actual 821,884-byte registry tarball matched its SHA-512 integrity and tag.
  Provenance was inspected as metadata, not independently signature-validated.
- Delivery is tracked in [PR 28](https://github.com/VictorQueiroz/ludic-canvas/pull/28).
  This milestone changes examples, documentation and verification tooling; SDK
  `src/` is identical to 0.6.0 and no npm release is required.
- Before publication of this PR, the canonical alias was verified on Vercel as
  READY, production, source `39424d09d5e2dea90f01a431721a92899f742d1f`.
  The preview for `7195d99c7a7317835c0d38dba6efa93807fff3fe` was READY and its
  guide served the StackBlitz link. Refresh the canonical alias after merge;
  this pre-publication snapshot does not claim the preview was production.
- Canonical site: <https://libraries.ludic-canvas.victorqueiroz.dev>.
  Existing Git integration owns preview/production deployment; no new pipeline
  or authentication setup was introduced.

Routine releases use Changesets version PRs and GitHub OIDC. Read
[RELEASING.md](RELEASING.md); repeat login/bootstrap only when owner setup actually
needs repair. Use `npm run verify:release` for publication verification.

## Consumer integration

The [minimal counter](../examples/first-interface) pins Vite 7.3.5 and published
npm 0.6.0. Use the fresh
[StackBlitz fork](https://stackblitz.com/fork/github/VictorQueiroz/ludic-canvas/tree/main/examples/first-interface?file=src/main.tsx)
after publication to main; old imported snapshots can remain stale.
[INTEGRATION.md](INTEGRATION.md) records the asset/prebundle configuration and the
Vite 8 Rolldown WASI failure observed in WebContainers.

[CI run 40855210387](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40855210387)
passed all jobs at source `7195d99`: 105 unit tests plus package/type/docs/CLI
checks on Linux/macOS/Windows, existing browser contracts, four independent
packed consumers on Chromium/Firefox/native macOS WebKit, and registry consumers
on Chromium. Every consumer exercises development startup, actual binary
WASM/font acquisition, interaction, production build and preview. CI rendering
is correctness evidence; it is not physical-phone or hardware timing evidence.

A clean-checkout sample type collision was fixed by using `vite.config.mjs` for
its separate Vite 7 toolchain. Firefox consumers use the existing headed
Xvfb/Mesa setup after headless CI could not acquire WebGL. SDK startup deadlines
and runtime behavior were not changed.

## Desktop acquisition

The operator narrowed this campaign to desktop and explicitly left VoiceOver
pending. The complete three-site Kestrel Survey passed using the pinned registry
artifact on Apple M3 / 8 GiB / macOS 26.6.2 / installed Chrome 156.0.8078.73 /
ANGLE Metal. Clean acquisition source was `7195d99`; its SDK matches the release.

The active session acquired 1,803.099 seconds, thirty mounted intervals, six
resize/destroy/remount cycles and final destruction. There were zero unhandled
browser errors, zero dropped frame samples and zero mirrors after all seven
checked destructions. Post-destroy heap increased from 6.325 to 7.112 MiB and
DOM nodes from 38 to 44, while listeners stayed at 28. No retaining-path
attribution was acquired, so leak freedom is not established.

[Original reports, checksums, screenshot and acquisition notes](public/performance/desktop-session-m3-chrome-2026-10-29/README.md)
include the interrupted ENOSPC attempt and the completed active session. Preserve
their bytes. The recorder now guards disk headroom and stages checkpoint writes;
an injected partial-write/ENOSPC regression preserves the previous report.

Playwright tab activation produced no hidden/visible events, so actual
background/resume remains unqualified. The recorder now labels that coverage
from observed events. Read [QUALIFICATION_RESULTS.md](QUALIFICATION_RESULTS.md)
and [DEVICE_QUALIFICATION.md](DEVICE_QUALIFICATION.md) before further acquisition.

Historical matched collection results and diagnostic trace remain under
[collections-m3-chrome-2026-10-27](public/performance/collections-m3-chrome-2026-10-27/README.md).
Their measured source `802b0d7` also matches SDK 0.6.0. Use
[PERFORMANCE.md](PERFORMANCE.md) before comparing workloads or timing claims.

## Outstanding work and next bounded task

Physical iPhone/Android are deferred; VoiceOver remains pending by request.
Actual tab background/recovery, OS suspend/resume, complete Orbital Relay and
catalogue hardware coverage, GPU allocations and the observed post-destroy
heap/node growth are unqualified. A useful next desktop diagnostic is a separate
repeated teardown acquisition with heap snapshots and retaining paths, preserving
this run as the original observation rather than attributing the growth by guess.

Linux WPE intermittently stalled in a second `WebAssembly.instantiate()` in the
historical qualification run. Native macOS WebKit coverage does not fix or qualify
that port. Earlier context-loss retries and the responsive-control test race
remain documented in the qualification record.

Shaping/bidi/graphemes, native text entry, variable-height collections and
interactive grids remain design work. The acquired collection budget was met by
windowing; select further optimizations from a relevant profile.
