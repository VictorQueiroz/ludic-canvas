# Reproducible performance evidence

Open [/performance/](https://libraries.ludic-canvas.victorqueiroz.dev/performance/)
or run `npm run dev` and visit that route. Enter a hardware model, sample count
and optional positive CPU/frame-interval p95 budgets before starting. Keep the
tab foregrounded and download the JSON after completion. A hidden tab, context
loss, abort or renderer error invalidates the run; incomplete runs do not produce
a completed report. Use Stop to cancel and release the root.

## Workload contract, version 1

All workloads use application-driven `ui.frame()`, reduced motion and a DPR cap of 2. They share two independent registrations of the bundled Barlow atlas: an ASCII
primary metric subset and a Latin-1 fallback. This deliberately exercises fallback
texture routing while keeping the fixture small and licensed. No world renderer
runs. Text content and focus targets are deterministic; there is no random input.

| Workload          | Size              | Behavior                                                                     |
| ----------------- | ----------------- | ---------------------------------------------------------------------------- |
| static-hud        | 96 cards          | Nested panels, paired labels and fill bars                                   |
| telemetry         | 48 cards          | Commit new values every six requested frames                                 |
| inventory-scroll  | 400 retained rows | Focus deterministic items to reveal distant rows                             |
| responsive-layout | 96 cards          | Alternate requested canvas width between 360/960 CSS pixels every six frames |

Requested widths are constrained by the container on narrow displays. Record the
actual dimensions and DPR from the report, rather than assuming 960 pixels.
Each workload gets 20 warmup frames and 120 acquired frames by default. Five
create/render/destroy cycles follow; each checks for leftover accessibility
surfaces. Change `workloadVersion` whenever workload contents or measurement
semantics change, and compare only matching versions/configurations.

## Measurements and limits

- `cpuFrameMs` wraps `ui.frame()`: Yoga, host-tree traversal, painting, input mirror
  synchronization and WebGL submission. React commits occur outside this timer.
- `renderToCommitMs` spans `render()` to a layout effect. It includes scheduler
  latency; it is not isolated React execution time. The initial commit is included.
- `frameIntervalMs` contains consecutive acquired requestAnimationFrame timestamp
  differences. It includes intervening work and browser scheduling. For N frame
  samples, there are N-1 intervals. It does not confirm that frames were presented.
- No GPU timer, `gl.finish()`, heap profiler or process-memory acquisition is used.
  CPU timing does not measure asynchronous GPU execution. Zero remaining mirrors
  proves the checked surface was removed, not that every resource was reclaimed.
- `initializationMs` measures root creation with the current browser cache state.
  It excludes initial module download/evaluation and is not a cold-start metric.
- Raw samples are retained in milliseconds. Percentiles use nearest rank. Timing
  precision depends on browser privacy settings and timer resolution.
- A budget is `not-set` unless supplied explicitly before acquisition. Timing
  thresholds are device/workload choices; there is no universal FPS claim.

The report includes package version, repository-source revision, workload version,
user agent, GPU renderer, operator-supplied hardware label, viewport, actual canvas
dimensions, run configuration and execution mode. `-dirty` revisions must be
accompanied by a saved patch and its hash for reproducibility. Repository source
can differ from the registry package carrying the same version number.

Save the original JSON and a SHA-256 checksum, profiler traces and screenshots
with the matching inputs. In a source checkout, `shasum -a 256 report.json` records
the acquired file's hash. Compare traces before attributing stalls to a subsystem.

## Opt-in frame profiles

Pass `profile: true` to `createUI` to obtain `frame.profile` on drawn frames. It
reports wall-clock layout calculation, layout reading/tree traversal, painting/GL
submission and input/accessibility synchronization in milliseconds, plus mounted
nodes, nodes visited for painting and submitted quads. These stages do not isolate
GPU execution, browser rendering or React commits. Suspended frames have no profile.
The feature is root-local and disabled by default; disabled frames do not acquire
stage timestamps or allocate a profile object.

The browser harness accepts `ludicPerformance.run({ profile: true })` and preserves
each frame's profile in the downloaded JSON. Compare matching profiling modes;
instrumentation introduces overhead. Use a browser Performance trace alongside
these coarse stages before selecting a renderer optimization.

## Automated and physical qualification

`npm run test:browser` runs a short, eight-sample structural smoke test per browser
configuration, checks report completeness/cleanup and attaches the JSON to the
browser report. It exercises cancellation and the downloadable evidence file.
CI deliberately leaves timing budgets unset. Software GPU CI and mobile viewport
emulation provide correctness evidence only.

Physical runs also require the workloads in [DEVICE_QUALIFICATION.md](DEVICE_QUALIFICATION.md):
the catalogue, both complete game integrations, touch/keyboard and assistive
technology, background/resume, rotation and a 30-minute session with memory traces.
This microbenchmark supplies none of the absent physical-phone or screen-reader
results. Publish passed, failed, partial and not-run states separately.
