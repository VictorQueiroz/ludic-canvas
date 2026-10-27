# Acquired qualification evidence

| Target                                       | Status  | Acquired evidence                                                                           | Outstanding work                                               |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Desktop Apple M3 / Chrome 156                | Partial | Original UI microbenchmark plus three matched collection runs and a diagnostic Chrome trace | Full games, 30-minute session, memory traces and accessibility |
| Physical iPhone / Safari                     | Not run | None                                                                                        | Complete device protocol                                       |
| Physical Android / Chrome                    | Not run | None                                                                                        | Complete device protocol                                       |
| VoiceOver / TalkBack / desktop screen reader | Not run | None                                                                                        | Assistive-technology protocol                                  |

## Automated browser coverage and platform limits

Release CI runs Chromium and Firefox on Linux, and desktop/mobile-emulated WebKit
on macOS. Playwright documents the native macOS port as its
[closest target to Safari](https://playwright.dev/docs/browsers#webkit); its patched
WebKit is still not branded Safari or a physical iPhone.

The Linux WPE WebKit port is **not qualified** by this release. In
[run 40540120683](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40540120683),
the multi-root test stalled inside the second asynchronous
`WebAssembly.instantiate()` call on both attempts. Context acquisition and module
fetch completed; font decoding and texture upload had not started. Another
multi-root case completed in the same job. The underlying cause is unresolved;
moving Safari-oriented coverage to native macOS does not establish a fix for
Linux WPE. No SDK fallback or relaxed startup deadline was added for this result.

The first native macOS candidate run passed with one gameplay retry after the
Three.js world reported context loss. In
[run 40545033065](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40545033065),
the archive contract failed twice immediately after resizing. The test did not
wait for the responsive React update before pressing an action shared by both
layouts. The final snapshot showed the compact HUD with the canvas focused and
no dialog, consistent with the target being replaced during the press rather
than a context-loss state. The test now waits for the compact
site picker and removal of the desktop tabs before pressing Collection. This
changes the test's readiness contract, not SDK rendering or startup deadlines.

## Desktop microbenchmark, 2026-10-27

- Source: [865feaa5d5a32bcf6d71902e03b08456692025ea](https://github.com/VictorQueiroz/ludic-canvas/commit/865feaa5d5a32bcf6d71902e03b08456692025ea), clean repository-source build carrying 0.4.0 metadata before the release version bump.
- Acquired at 2026-10-27T05:00:54.088Z using the visible performance-lab UI.
- Hardware: Mac15,12, Apple M3, eight GPU cores, 8 GB memory, macOS 26.6.2.
- Browser: Chrome 156.0.0.0; reported renderer: ANGLE Metal Renderer, Apple M3.
- Browser viewport: 1710 × 930 CSS pixels; DPR 2. Actual canvas dimensions are retained per sample.
- Configuration: workload version 1, 20 warmup frames, 120 acquired frames and 119 intervals per workload, five teardown cycles, reduced motion, no world renderer.
- Interactive desktop session; background applications, extensions and browser cache were uncontrolled. No before/after comparison was acquired. Timing budgets were unset before acquisition.

| Workload          | Nodes | CPU frame-call median (ms) | CPU frame-call p95 (ms) | RAF interval p95 (ms) |
| ----------------- | ----- | -------------------------- | ----------------------- | --------------------- |
| static-hud        | 388   | 2.7                        | 9.5                     | 17.5                  |
| telemetry         | 196   | 2.1                        | 8.4                     | 17.4                  |
| inventory-scroll  | 1202  | 12.4                       | 26.9                    | 34.0                  |
| responsive-layout | 388   | 3.3                        | 9.6                     | 17.4                  |

Values in this table are rounded; the original JSON retains every sample. CPU
time wraps `ui.frame()` and excludes React commit scheduling and asynchronous GPU
execution. Initial root creation took 496.9 ms with the existing browser cache.
All five teardown cycles removed the checked accessibility surface. There were
zero reported renderer errors and zero missing-glyph diagnostics.

The inventory CPU p95 exceeds a 60 Hz frame period (16.67 ms) in this workload.
This supports profiling large collections and evaluating virtualization next.
It does not identify which subsystem dominates, establish a regression against a
previous release, or prove a memory-leak result. No performance acceptance budget
was set, so the report's budget status is `not-set`.

Original [JSON evidence](public/performance/desktop-m3-chrome-2026-10-27.json),
also [served by the website](https://libraries.ludic-canvas.victorqueiroz.dev/performance/desktop-m3-chrome-2026-10-27.json).
SHA-256: `ff6e670c64e6579295b6a89bcd39fa52f52e7e35786ec83fe340d7a70e8c5d5f`.
The acquired file is 76,892 bytes and is preserved without reformatting.

Use [PERFORMANCE.md](PERFORMANCE.md) to repeat the microbenchmark and
[DEVICE_QUALIFICATION.md](DEVICE_QUALIFICATION.md) for the remaining device,
game-session, memory and assistive-technology work.

## Matched collection acquisition, 2026-10-27

Clean source [802b0d72292480e5ae71b026189b1c393996d901](https://github.com/VictorQueiroz/ludic-canvas/commit/802b0d72292480e5ae71b026189b1c393996d901)
carried 0.5.0 metadata before the release bump. These are repository-source
measurements, not measurements of published npm 0.5.0. The verified Mac15,12 /
Apple M3 / 8 GB machine ran macOS 26.6.2 and installed Chrome 156 with ANGLE Metal,
in an isolated headed browser profile. Viewport: 1710 × 930; workload canvas:
960 × 540 CSS pixels at DPR 2.

Three unprofiled acquisitions used collections-1, 20 warmup frames, 120 acquired
frames per workload, 119 RAF intervals and five teardown cycles. Workload order
alternated forward/reverse/forward. Each supplied a 4 ms CPU frame-call p95 budget.

| Workload      | Nodes at completion | Run 1 p95 ms | Run 2 p95 ms | Run 3 p95 ms | Budget |
| ------------- | ------------------: | -----------: | -----------: | -----------: | ------ |
| retained-400  |                1202 |          4.8 |          5.0 |          4.7 | Failed |
| virtual-400   |                  60 |          2.2 |          3.4 |          2.7 | Passed |
| retained-4000 |               12002 |         54.5 |         49.9 |         49.4 | Failed |
| virtual-4000  |                  60 |          3.5 |          3.3 |          2.7 | Passed |
| virtual-40000 |                  60 |          2.6 |          3.1 |          2.5 | Passed |

The separate profiled/traced diagnostic recorded 51–63 mounted nodes for every
virtualized size. The retained 4,000-row diagnostic averaged 20.8 ms in
paint/submission and 23.9 ms in input/mirror synchronization. These coarse
wall-clock segments include diagnostic overhead; they are not isolated JavaScript
or GPU times. The trace contains 55,353 events and 1,286 CPU profile chunks.
Windowing reduced the retained-node work sufficiently to meet this collection
budget; no additional renderer rewrite was required for this reference result.

All scroll commands settled to their recorded offsets. Runs reported no errors
or font diagnostics, and each checked teardown removed its accessibility surface.
This does not prove leak freedom. Initial item/index memory remains linear; heap,
process/GPU memory, presentation and complete game timing were not measured.
Background applications and browser/process caches were uncontrolled. The 40,000
item probe has no retained comparator, and the original focus-driven workload v1
is not directly comparable with collections-1.

Original evidence: [run 1](public/performance/collections-m3-chrome-2026-10-27/run-1.json),
[run 2](public/performance/collections-m3-chrome-2026-10-27/run-2.json),
[run 3](public/performance/collections-m3-chrome-2026-10-27/run-3.json),
[diagnostic](public/performance/collections-m3-chrome-2026-10-27/diagnostic.json),
[Chrome trace](public/performance/collections-m3-chrome-2026-10-27/diagnostic.trace.json.gz).
Each file has a sibling `.sha256`; the [acquisition notes](public/performance/collections-m3-chrome-2026-10-27/README.md)
record the configuration and interpretation limits.
