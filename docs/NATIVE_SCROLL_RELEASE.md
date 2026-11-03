# Native browser scrolling release preparation — 2026-11-03

The standard browser SDK now integrates the canvas-tile presentation evaluated
in [the prototype](NATIVE_SCROLL_PROTOTYPE.md). The user reported that the native
canvas tile looked good and requested release preparation. That is qualitative
acceptance of the prototype; the device, OS and browser versions were not
specified. It does not establish a timing, physical-device matrix or long-session
memory result.

The candidate also incorporates [control-geometry and vector-aspect fixes](INTEGRATION_FIXES.md)
from independently reproduced integration feedback. It documents and tests the
existing stable-identifier vector replacement API. These additions retain the
planned 0.10.0 minor release; their fresh validation supersedes earlier local
check results where source changed.

## Source and delivery state

The candidate was prepared as a working-tree change on
`feat/native-scroll-prototype`, based on
`a6fd0eaf1fa56f160f2f9107ff4d6567cab6a092`. Package metadata remains 0.9.0;
the minor changeset proposes 0.10.0 through the normal Changesets workflow.
After the readiness report, the user authorized delivery on
`feat/native-scroll-release`: create its PR, complete Codex review and merge
prototype PR 38 first, then review and merge the release integration. This record
does not establish a new npm publication or production deployment.

Prototype PR 38 has since merged as `d3751b1`, with clean Codex review of `dffa243`
and all 12 hosted CI jobs passing. [PR 39](https://github.com/VictorQueiroz/ludic-canvas/pull/39)
now carries the integration rebased onto that main commit. Its SDK touch
regression uses the parent's explicit trusted-touch helper after Linux CI
returned zero offset for both high-level synthesized-pan cases. Current-head
CI and Codex review remain required for PR 39; earlier local results below
retain their original source scope.

After the rebase and SDK gesture-harness update, the combined local prototype,
SDK scrolling and vector matrix passed 107 tests with eight explicit capability
skips. `npm run check` also passed on the rebased candidate with 145 unit tests.
The SDK source is unchanged from the fully qualified preparation;
the parent follow-up changes the experiment lifecycle and verification input.

Codex review of PR 39 identified hover-only targets whose callbacks were hidden
by native overflow without a matching DOM event surface. A failing-before
regression observed an empty callback log when hovering such a view. Automatic
mode now retains canvas presentation for those targets, while labeled native
buttons still deliver hover enter/leave callbacks. The focused regression runs
both paths across all five browser projects. Initial observation wiring in the
test fixture was corrected before acquiring the actual empty-log reproduction.

The initial PR 39 Mac verification also timed out in the unchanged Git-diff
policy fixture at its existing five-second limit. Browser/native jobs passed.
The follow-up leaves that fixture and its deadlines unchanged and requires a
fresh complete hosted check result before merge.

[Prototype PR 38](https://github.com/VictorQueiroz/ludic-canvas/pull/38) and the
[immutable comparison preview](https://ludic-canvas-258jgah6d-victorqueiroz.vercel.app/native-scroll/)
still describe the earlier prototype. Its deployment source is `d3876aa` with
an embedded dirty marker, as recorded in the prototype evidence. Neither is
evidence of a deployed standard SDK integration. Hosted checks/review must run
on the eventual implementation commit before merging; publication follows the
separate version PR and [release gates](RELEASING.md).

## Published behavior prepared

- Browser roots default to `auto`: supported ScrollArea/VirtualList surfaces use
  actual DOM overflow containing rendered canvas tiles. `canvas` explicitly
  preserves the existing path; `native` requires a supported overflowing surface.
- The same mounted tree, WebGL context, fonts and image store paint tiles.
  There is no extra React root, WebGL context or SDK animation loop. A portable
  presentation contract keeps browser globals outside the shared runtime.
- The existing semantic controls move with the pixels and own native clicks,
  focus and keyboard activation. Custom pointer/wheel gestures, editors,
  nested/clipped or overlapping layouts, scaled surfaces, shared engine contexts,
  unlabeled pressables and excessive extents/budgets use canvas in auto mode.
- ScrollHandle commands, focus reveal and VirtualList anchoring share the native
  offset. Browser extent changes precede commands. Snapshots sample the latest
  application frame and remain clamped without echoing elastic overscroll.
- VirtualList extends its mounted window to cover bounded tile overscan. The
  estimated root-local RGBA tile budget defaults to 16 MiB. Frame counters include
  native replay/copies and distinguish estimated raster bytes from image textures.

See [SCROLLING.md](SCROLLING.md) for the maintained support contract and
[VIRTUALIZATION.md](VIRTUALIZATION.md) for collection behavior. The original
comparison's canvas reference and historical performance workloads explicitly
select canvas mode. Their existing acquired reports/checksums remain untouched.

## Reproduction, corrections and validation

The first SDK browser contract failed because eligible surfaces had no native
presentation. Local failing-before evidence is retained under
`/tmp/ludic-native-release-evidence/before/`. Subsequent development caught:

- Old virtual-list assertions assumed one canvas and a smaller mounted window.
  The historical fixture now explicitly selects canvas; dedicated native tests
  assert a bounded raster window and distant jumps in a single application frame.
- A real anchor regression clamped commands to the old DOM extent. The regression
  reproduced before the fix and now updates the extent before applying the anchor.
- An initial press pixel probe sampled text rather than the background. A refined
  reduced-motion probe then reproduced a real cache-invalidation bug: instant
  interaction changes did not repaint tiles. The cache key now includes interaction
  state. Text-scale changes invalidate static tiles; time-driven effects refresh.
- Firefox exposed fractional large offsets and asynchronous fixture readiness.
  Native anchor assertions allow less than one CSS pixel of browser rounding;
  error assertions wait for setup. No SDK offsets are rounded to satisfy tests.
- The complete browser sweep reached 452 passes, 21 explicit skips and 27 failures:
  25 catalogue selectors matched tile canvases as well as the root, and two
  Firefox map checks assumed one huge wheel event reached the bottom. Selectors
  now identify the root canvas; map tests scroll until the last row reaches the
  viewport. A diagnostic measured 135 CSS pixels per 10,000-unit Firefox wheel
  event in that scene. Initial failure traces and the diagnostic log are retained
  separately; this is not a timing benchmark or a universal wheel conversion.

The affected catalogue/map/native contracts are rerun on all five projects,
with the native fixture now capped at DPR 2 to exercise mobile raster scaling.
Unchanged passing cases reuse the complete sweep's evidence.

Failure traces and logs were preserved locally under
`/tmp/ludic-native-release-evidence/` and `/tmp/ludic-native-release-*.log`.
No test deadlines, browser ports or existing motion coverage were weakened.
Reduced motion is an explicit additional cache regression case.

Earlier native-scroll-only local results:

| Check                                          | Result                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                | Passed: build, both type targets, 144 unit tests in 22 files, generated docs/build, public audit and packed consumers                               |
| `npm run format:check`                         | Passed                                                                                                                                              |
| `npm pack --dry-run`                           | Passed; 139 package files, no hook/development-only files                                                                                           |
| Browser matrix                                 | All 500 cases covered: 479 passed, 21 explicitly skipped, no retries; see split-run accounting below                                                |
| `npm run test:consumer`                        | 12 passed: four independent packed consumers in Chromium, Firefox and WebKit, development and production                                            |
| `npm run native:build` / `npm run native:test` | Passed: Skia pixels/recovery, Hermes startup-error handling, nine behavioral checks per runtime, matching layout trees and native ownership release |
| Changesets status                              | Confirmed one minor release, 0.9.0 → 0.10.0; no version files changed                                                                               |

The complete browser sweep initially had the 27 test-assumption failures described
above. The affected 105-case matrix then passed 99 with six explicit skips,
including all formerly failing cases and the native fixture at DPR 2. The other
395 cases retain 380 passes and 15 explicit skips from the complete sweep;
their source was unchanged. This is combined evidence, not a claim that the
initial sweep exited successfully. Skips cover unavailable clipboard/wheel/touch
injection in specific projects. Physical touch behavior is not inferred from them.

Visual inspection confirmed the SDK fixture's painted rows, the catalogue's
native inventory and the generated guide without horizontal overflow. Local
screenshots are retained under `/tmp/ludic-native-release-evidence/visual/`.
The remaining Vite chunk-size and Hermes `performance` fallback diagnostics are
existing warnings; the final checks did not fail on them. Local macOS evidence
does not replace the forthcoming hosted Linux/macOS/Windows release matrix.

## Latest candidate with integration fixes

The current candidate includes the control/vector fixes and browser normalization
in [the integration record](INTEGRATION_FIXES.md). Fresh package checks pass 145
unit tests in 22 files, both type targets, documentation generation/build, the
public audit and packed consumers. Native build/contracts and `npm pack --dry-run`
also pass. Changesets confirms the combined minor/patch changesets still select
0.10.0. The earlier table is historical evidence for the scrolling-only candidate.

The new geometry/vector/replacement matrix passed all 15 cases across five
projects. A separate 15-case matrix passed the final geometry reset, context-loss
visibility and catalogue readiness guards. The complete final browser sweep then
passed **494 tests with 21 explicit skips**, without retries or exclusions beyond
the existing capability skips. All **12 independent packed-consumer checks** also
passed on the final candidate, in development and production across three engines.
Earlier interaction passes and the interrupted sweep are not substituted for
this fresh complete result.

`npm run check`, `npm run format:check` and `npm pack --dry-run` pass on the final
candidate (145 unit tests, 139 package files). Native build/contracts pass for
the shared fitting change; the final browser-only geometry refinement leaves
that portable/native source unchanged. Current logs are retained locally as
`/tmp/ludic-integration-check-final.log`, `/tmp/ludic-integration-browser-final.log`,
`/tmp/ludic-integration-consumers-final.log` and `/tmp/ludic-integration-native-*.log`.
The source checkpoint includes 238 runtime/test/tool/example/package files;
their bytes stayed unchanged during the final sweep. Its manifest and generic
SVG visual evidence are under `/tmp/ludic-integration-evidence/`.

The candidate passed local preparation and is authorized for PR delivery.
Hosted checks/review must validate the pushed commits before their ordered merges.
The preceding artifact/physical-device qualifications remain separate.

## Qualification limits and remaining delivery

Software browser tests verify rendering, commands, native movement of prepared
pixels without application frames, virtual windows, input cancellation, state/focus
preservation, root isolation, context recovery, fallback and cleanup. Mobile
emulation and injected touch do not qualify physical iPhone momentum/bounce.
Copy-call timing does not establish GPU completion or compositor presentation;
tile estimates exclude browser/GPU overhead. A paused application or long task
can exhaust prepared content during a fast fling. Screen-reader and long-session
phone qualification remain separate application/device work.

For the authorized delivery: validate the exact pushed head in CI,
complete Codex review and address/react/resolve any conversations, merge the
implementation, then follow the Changesets version PR and OIDC publication.
Verify the actual npm artifact and canonical deployment independently before
claiming 0.10.0 is published/live. Only this checkout is registered as a worktree;
no dangling worktree was found during preparation.
