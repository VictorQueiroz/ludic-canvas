# Physical device qualification

Status: this protocol is ready to run; a physical iOS/Android and assistive
technology qualification campaign has not been completed. Do not interpret
automated browser results or the component catalogue's draw counters as device
certification or GPU timing measurements.

Start reproducible acquisition at [/performance/](https://libraries.ludic-canvas.victorqueiroz.dev/performance/)
using [PERFORMANCE.md](PERFORMANCE.md). Retain its downloaded JSON alongside this
protocol's game, long-session and assistive-technology evidence. The lab does not
acquire heap/GPU memory or complete any absent physical-phone qualification.

[QUALIFICATION_RESULTS.md](QUALIFICATION_RESULTS.md) records the acquired desktop
microbenchmark and the physical-phone, long-session and screen-reader work still
outstanding. A partial result must not be promoted to a full device pass.

## Targets

| Target                      | Required evidence                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------- |
| iPhone / Safari             | Hardware model, iOS/Safari version, touch, viewport changes, resume and VoiceOver   |
| Android / Chrome            | Hardware model, Android/Chrome version, touch, memory pressure, resume and TalkBack |
| Desktop integrated graphics | CPU/GPU, OS/browser versions, keyboard, high DPI, resizing and a 30-minute session  |
| Desktop screen reader       | Browser, reader/version, spoken labels, states, focus order and modal isolation     |

Record each target as **not run**, **passed**, **failed** or **partial**. A partial
result must identify the missing workload or evidence. Do not fill absent results
from emulation or infer results from another browser using the same engine.

## Workloads

1. Open `/components/`. Exercise both roots independently: slider drag and
   cancellation, keyboard endpoints, disabled activation, tabs, nested dialogs,
   focus restoration and scrolling to the final inventory control. Repeat with
   larger text and reduced motion. Check spoken labels and checked/selected/value
   announcements, including whether background controls are excluded from a modal.
2. Play Orbital Relay from launch to delivery/replay. Test pause/resume, compact
   layout, cargo tabs and the manifest. Repeat resizing and scene switching.
3. Play Kestrel Survey through three samples and restart. Test camera controls,
   settings, modal site selection and terrain input around blocking panels.
4. Leave a representative game active for 30 minutes. Include repeated scene
   mount/unmount and background/resume cycles. Inspect listener, node, texture and
   heap growth after cleanup and a settled period; retain profiler evidence.
5. Test rotation, browser chrome expansion, device text preferences, high DPI,
   context loss/recovery where available, and failure to acquire WebGL. Record
   unavailable probes rather than treating them as successful.

## Measurements

### Desktop acquisition

The reproducible desktop runner uses an isolated installed-Chrome profile and a
fresh independent Kestrel Survey consumer of its pinned npm release:

```sh
npm run qualify:desktop -- --output build/qualification/desktop.json.gz
```

It verifies the registry artifact's integrity/release source, builds the consumer,
completes the three-site game through its controls, then acquires a 30-minute
session. Each minute exercises pause/resume and navigation. Every five minutes
it backgrounds the tab briefly, resizes the desktop viewport, destroys the scene,
checks mirror cleanup and mounts a fresh scene. The game keeps its normal world
renderer and motion settings. Tab hiding is not OS suspend/resume.

The copied application is instrumented with a bounded frame buffer around
`ui.frame()` and an explicit mount/destroy bridge. The report records original and
instrumented source hashes, the acquisition script hash, source revision, package
integrity, hardware renderer, browser, viewport and settings. Unhandled errors
stop the acquisition. Short runs (`--seconds 30 --interval 5 --cycle 10`) only
validate the harness; they are recorded as `smoke-only`.

Checkpoints drain the frame buffer, force JavaScript GC, then acquire CDP heap and
DOM/listener counters plus OS-reported process RSS. Raw samples and any dropped
frame count are retained in gzip JSON with a SHA-256 checksum and screenshot.
GC and diagnostic acquisition affect timing. RSS contains shared mappings;
neither it nor the image-cache counter measures GPU allocations. A plateau in
these observations is not proof of leak freedom. No timing budget is assumed.
Physical-phone and screen-reader coverage remains separate.

### Interpretation

Capture cold/warm startup, frame interval distributions, CPU time in layout/UI
submission, draw calls, uploaded texture bytes and browser-reported memory where
available. Report the sample duration, sample count, median/p95 and any long
frames. Describe the world renderer and scene size so the workload is reproducible.

Time around `ui.frame()` measures CPU elapsed time for layout and command
submission; it does not measure asynchronous GPU execution. Root `textureBytes`
reports the image cache, not total application/driver memory. Heap snapshots,
browser process memory and GPU allocations must be labeled separately.

Set performance budgets for an explicit device/workload before calling a result
acceptable. Retain the raw trace/JSON and screenshots with a checksum. Separate
measured behavior from a proposed explanation of stalls or growth.

## Result record

For each acquired result, save:

- Exact commit, npm version/integrity and deployment URL.
- Date, operator, hardware/OS/browser/reader versions and viewport/DPR.
- Workload, duration, settings and reproduction steps.
- Raw evidence paths/checksums, metrics and observed failures.
- Final status, remaining gaps and regression links.

The current accessibility mirror describes controls, named groups and live
announcements. It does not expose a complete static-text document or provide text
editing. Record these boundaries explicitly during assistive-technology testing.

## Virtualized collection cases

Exercise the 4,000-record regional archive in the 3D example and the collection
benchmark with both motion settings and increased text scale/explicit row heights.
Verify fast scrolling and distant jumps, disabled-item skipping, Home/End and
paging, controlled selection, modal focus return, item reorder/deletion and
viewport anchors. Confirm that screen readers announce logical position/size
while only a bounded set of options exists. Test native touch scrolling, rotation
and background/resume on physical phones. Record a 30-minute session and actual
heap/process/GPU observations separately; a zero-mirror teardown check proves none
of those memory properties.
