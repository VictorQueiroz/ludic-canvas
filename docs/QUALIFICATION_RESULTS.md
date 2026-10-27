# Acquired qualification evidence

| Target                                       | Status  | Acquired evidence                                                           | Outstanding work                                               |
| -------------------------------------------- | ------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Desktop Apple M3 / Chrome 156                | Partial | Version 1 UI microbenchmark, 120 samples per workload, five teardown cycles | Full games, 30-minute session, memory traces and accessibility |
| Physical iPhone / Safari                     | Not run | None                                                                        | Complete device protocol                                       |
| Physical Android / Chrome                    | Not run | None                                                                        | Complete device protocol                                       |
| VoiceOver / TalkBack / desktop screen reader | Not run | None                                                                        | Assistive-technology protocol                                  |

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
