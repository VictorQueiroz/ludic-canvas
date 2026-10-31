# Portability qualification — 2026-10-31

This record covers the first portable-core/browser/macOS milestone. It is local
implementation evidence, not a published native-platform support declaration.
The checkout started clean at `ec57f473f5e88d88689f76a26b558e4a70102dc2`; work is
on `feat/portable-runtime`, with a pending minor changeset. The local package
still has 0.8.0 metadata. Registry and deployed artifacts were not replaced by
this work.

## Environment and identities

Apple silicon macOS 26.6.2 (25G83), Xcode 27.0 (27A266a), Node 24.22.1 for final
checks, TypeScript 7.0.2 and Playwright 1.64.1. Early development commands used
Node 26.12.1; the completed package/browser/native build commands used Node 24.
Native compiler jobs were limited to two. The standalone host and Hermes were
built with an explicit macOS 26 deployment target.

SHA-256 identities for the original milestone in commit `177a8d9`:

| Input/artifact                                      | SHA-256                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| SDK `src/**/*.ts` and `src/**/*.tsx`                | `98c706ed566941e41db6aacae2330df4e261d1afde9ce07ec9075f610df009f2` |
| `native/portable/**` plus `native/layout/style.hpp` | `d947430d4f1205cd1a7b1a5866ac1a159f791b010d1a3f89a50e6afb91266c2d` |
| Rebuilt `assets/layout.wasm`                        | `b36584a43e798679d242a07d031047a8d53f62860d5ac47751992c226ba4b021` |
| Local macOS executable                              | `8bad6628b93276d0caa6f3dce90275fd82b828b9fa1aed59ce99006859139d42` |
| Packaged `app.hbc`                                  | `0f617719e3fce3399a768ad0d7f211d32395c5e55bf3a8dd1f25f96631e2f78b` |

Source-set digests concatenate sorted repository-relative paths, NUL, file bytes
and NUL. Dependency source pins/checksums are recorded separately in
[`tools/native/dependencies.json`](../tools/native/dependencies.json). Hermes
compiler and runtime share the same revision; bytecode compatibility is not
assumed across revisions.

## Acquired results

| Check                                                  | Result                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                        | Passed build, both typechecks, 111 unit tests, docs build, public-boundary audit and independent packed consumers.                                                                                                                             |
| Portable ambient environment                           | Core and native entries typecheck with ECMAScript libs plus the small embedding declarations; no DOM or Node ambient types.                                                                                                                    |
| `npm run test:browser -- --workers=1 --max-failures=1` | 387 passed, 13 explicitly skipped, no retries in the final complete run; 6.8 minutes.                                                                                                                                                          |
| `npm run native:build`                                 | Standalone `.app` built with Hermes bytecode, native Yoga, Skia/Metal, bundled assets and license notices.                                                                                                                                     |
| `npm run native:test`                                  | All eight command operations passed raster pixel checks. Nine behavioral checks passed in each of Hermes/native Yoga and Node/WASM Yoga. Both acquired layout trees matched exactly. Native layout contexts/nodes were zero after destruction. |
| macOS host smoke test                                  | Pointer and accessibility activation, controlled native editing, select-all, undo, modal Tab/Escape, focus return, window zoom/restore, wheel scrolling and close/quit passed.                                                                 |
| Application quit without an application shutdown hook  | Exit code 0; native counters before VM shutdown were `layouts=0 nodes=0 surfaces=0`.                                                                                                                                                           |

Formatting and whitespace checks (`npm run format:check` and `git diff --check`) passed.

The 13 browser skips retain the existing matrix boundaries: clipboard acquisition
outside Chromium, touch-only cases in desktop configurations and the existing
mobile-WebKit wheel-injection exclusions. No additional exclusion, longer test
deadline, motion change or server-port change was introduced to pass this run.
The shared example adds one browser contract per configuration.

The native behavior comparison checks actual React commits, commands, pointer
occupancy, independent roots, modal focus/isolation, controlled edits, resize and
teardown. The two returned layout trees cover initial 720×640 at scale 2 and
resized 480×400 at scale 1. This is a bounded fixture, not proof of every Yoga
configuration or pixel equivalence between Skia and WebGL.

Native UI actions were acquired through computer automation against the actual
AppKit window. A coordinate click changed Count from 0 to 1. Typing Ada changed
the greeting; Undo restored Explorer. The accessibility tree reported Close
dialog as focused, retained it through Tab, and reported Open dialog after Escape.
Screenshots showed layout resizing and clipped waypoint scrolling. Closing the
window exited cleanly; a separate Command-Q run checked zero native ownership
counters before the VM was destroyed. No VoiceOver session or real IME was used.

## Development failures and corrections

- The first core contract failed because no portable entry existed. Focused
  browser input/editing regressions subsequently passed after extraction.
- Native compilation exposed mismatches with current pinned Skia signatures,
  missing transitive Hermes link libraries and Objective-C++ capture/property
  errors. These were corrected against the downloaded headers and a real build.
  DeepWiki examples were not treated as authoritative API signatures.
- Rebuilding the unchanged WASM layout ABI with the shared style header produced
  a 90,214-byte reactor with four imports. The previous exact-import assertion
  expected three additional WASI functions absent from the rebuilt output. The
  committed import expectation now matches the rebuilt artifact; all behavioral
  layout tests and native/WASM comparison pass. No new host import was added.
- A newly reproduced offset-canvas test showed browser WheelEvent `x/y` aliases
  being mistaken for root-local coordinates. Client coordinates now take
  precedence, and the regression passes in all five browser configurations.
- The first complete browser attempt stopped in catalogue initialization.
  Its trace showed `Illegal invocation` in a queued layout callback: bare browser
  scheduling functions were invoked with the adapter as receiver. Wrapping those
  calls in the browser adapter fixed the demonstrated failure.
- The next attempt passed 36 cases before the new example test attempted to click
  the deliberately noninteractive accessibility mirror. That test now uses its
  keyboard activation contract; no SDK behavior was changed for this test error.
- Native select-all initially lacked an Edit menu. Standard responder-chain menu
  commands now provide select-all, cut/copy/paste and undo/redo. Logical canvas
  focus is exposed through the host's focused accessibility element.

Logs and retained initial traces are local under `build/native/`, including
`final-check.log`, `browser-all.log`, `final-build.log`, `final-native-tests.log`,
`contracts/result.json`, `quit-teardown.log`, `wheel-origin-failure/`,
`browser-scheduler-failure/` and `browser-example-test-failure/`. They are ignored
build artifacts, not npm package contents. The compiler's warning about the
`performance` global is expected for this standalone bundle: the embedding
installs it before evaluation, and runtime execution is verified above.

## Compatibility follow-up

A review after `177a8d9` found a browser wheel-unit regression in the extracted
adapter: it read `deltaX/Y/Z` before `deltaMode`. The previous implementation
read the mode first. For trusted line-based events, Gecko can select converted
pixel deltas when a delta is accessed before the mode; this changes callback
values and the library's default scroll distance. See the
[Gecko implementation](https://github.com/mozilla-firefox/firefox/blob/main/dom/events/WheelEvent.cpp)
and [MDN's unit warning](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode).

The adapter again reads the mode first. A browser regression models Gecko's
access-dependent event getters and asserts the observable callback units and
values. Before the fix it failed with mode 0 and deltas 80/120/160 instead of
mode 1 and deltas 2/3/4. Ordinary constructed WheelEvents bypass Gecko's
conversion, which explains why the original synthetic unit-preservation test
passed. This fixture is a controlled reproduction, not physical wheel-device
qualification.

The follow-up input, input-example and portable-example suites passed across
all five browser configurations: 72 passed, three existing mobile-WebKit wheel
injection skips, no retries (1.5 minutes). Both TypeScript checks, focused
formatting and whitespace checks passed. The original 387-test browser result
above remains evidence for `177a8d9`; this follow-up reran the affected paths.

The updated SDK source-set digest is
`fc5232e5a898c7a22d8684513a64fccc7598f3afa0d6f72127edc01d2237dbfc`.
Native sources and artifacts are unchanged. The failing trace is retained in
`build/native/wheel-unit-regression-failure/`, with before/after logs in
`build/native/wheel-unit-regression-before.log` and
`build/native/wheel-unit-regression-after.log`.

## Limits

The macOS proof remains experimental. It is not signed/notarized distribution
or an app-store build. Android, iOS, Windows, Linux, Intel Macs and older macOS
were not compiled or tested. Native editor parity gaps are listed in
[PORTABILITY.md](PORTABILITY.md); real IME, assistive technology, suspension,
device loss, long sessions and GPU memory reclamation remain unqualified.
Zero root counters establish ownership cleanup, not total process/GPU memory
reclamation. Raster checks and the Metal window smoke test do not establish
native performance, frame pacing or complete renderer equivalence.
