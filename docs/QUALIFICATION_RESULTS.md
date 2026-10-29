# Acquired qualification evidence

| Target                                       | Status  | Acquired evidence                                                                                                                   | Outstanding work                                                                                       |
| -------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Desktop Apple M3 / Chrome 156                | Partial | UI/collection benchmarks, diagnostic trace, complete 3D survey and 30-minute active game session with heap/DOM/process observations | Other game/catalogue hardware coverage, actual background/resume, memory attribution and accessibility |
| Physical iPhone / Safari                     | Not run | None                                                                                                                                | Complete device protocol                                                                               |
| Physical Android / Chrome                    | Not run | None                                                                                                                                | Complete device protocol                                                                               |
| VoiceOver / TalkBack / desktop screen reader | Not run | None                                                                                                                                | Assistive-technology protocol                                                                          |

## Automated browser coverage and platform limits

Release CI runs Chromium and Firefox on Linux, and desktop/mobile-emulated WebKit
on macOS. Linux browser jobs use the version-matched official Playwright Noble
image, pinned by digest, with software rendering; CI timing is not hardware
performance evidence. Playwright documents the native macOS port as its
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

## Consumer integration, 2026-10-29

[Source 7195d99](https://github.com/VictorQueiroz/ludic-canvas/commit/7195d99c7a7317835c0d38dba6efa93807fff3fe)
passed [all CI jobs](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40855210387).
Independent copies of the minimal counter, packaged Canvas2D/Three.js starters
and Kestrel Survey passed development startup, binary WASM/font acquisition,
interaction, production build and preview. Packed consumers ran on Chromium,
Firefox and native macOS WebKit; the pinned npm 0.6.0 consumers also ran on
Chromium. Root package/type/documentation/CLI checks passed on Linux, macOS and
Windows. These remain software correctness checks with the platform limits above.

Two integration failures were corrected before that passing revision. A clean
checkout selected root Vite 8 types for the separate Vite 7 sample's TypeScript
configuration; making that configuration `.mjs` keeps the independent toolchains
separate. The initial headless Linux Firefox consumer could not acquire WebGL 1;
the consumer job now uses the established headed Xvfb/Mesa environment. No SDK
fallback or longer startup deadline was added. The StackBlitz example keeps Vite
7.3.5 because the Vite 8 Rolldown WASI binding failed in WebContainers. See
[the supported consumer configurations](INTEGRATION.md).

## Desktop game session, 2026-10-29

The pinned registry 0.6.0 Kestrel Survey completed all three sites, then acquired
1,803.099 seconds on Apple M3 / 8 GiB / macOS 26.6.2 / installed Chrome
156.0.8078.73 with the Metal hardware renderer. Acquisition source
`7195d99c7a7317835c0d38dba6efa93807fff3fe` was clean and its SDK matches the
release. Thirty mounted intervals, six resize/destroy/remount cycles and final
destruction reported zero unhandled errors, zero dropped frame samples and zero
mirrors after all seven destructions.

Post-destruction used JS heap increased from 6.325 to 7.112 MiB and DOM-node
counts from 38 to 44; listener counts stayed at 28. The retaining paths and cause
were not acquired. This does not establish leak freedom. CPU frame-call p95 was
2.3 ms over 106,526 mounted samples; RAF interval p95 was 18.3 ms. Diagnostics,
forced GC and uncontrolled system activity affect timing; no acceptance budget
was set. Raw process RSS is separate from GPU allocations.

Tab activation produced no hidden/visible events under Playwright focus
emulation, so actual background/resume remains unqualified. The desktop result
is **partial**. Physical phones are outside the current desktop-only scope and
VoiceOver was explicitly left pending by the operator. Full Orbital Relay and
catalogue hardware coverage, OS suspend/resume, GPU memory and memory-growth
attribution remain open.

The [original report, checksums, screenshot and acquisition notes](public/performance/desktop-session-m3-chrome-2026-10-29/README.md)
also preserve the first attempt interrupted by `ENOSPC` at its last valid
7.315-minute checkpoint and the subsequent storage-preflight refusal. The
completed attempt is a new acquisition; the interrupted bytes were not repaired
or relabeled.

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

The SDK files under `src/` in released
[v0.6.0](https://github.com/VictorQueiroz/ludic-canvas/tree/v0.6.0/src) are identical
to that measured source revision (`git diff 802b0d7 v0.6.0 -- src` is empty).
Release metadata and documentation changed after acquisition; the published npm
artifact was not separately benchmarked.

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

## Native editing release — 2026-10-29

TextInput/TextArea ship in 0.7.0. The [release verification record](RELEASE_0_7_0.md)
retains source/artifact identity, full five-project CI, the WebKit diagnostic
callback retry, initial npm 404 availability responses, independent registry
consumer checks and deployed component interaction. These are browser/software
and distribution checks. They do not complete real IME, phone-keyboard,
screen-reader, long-session memory or hardware performance qualification.

The complete additional local suite stopped at the existing 320-pixel survey
case before compact controls appeared. Its isolated attempt failed earlier at
the survey ready marker. Both traces were retained. Passing CI on the same SDK
does not establish a fix in that local environment. No SDK, test deadline, motion
or port change was made to accommodate those outcomes.
