# Physical device qualification

Status: this protocol is ready to run; a physical iOS/Android and assistive
technology qualification campaign has not been completed. Do not interpret
automated browser results or the component catalogue's draw counters as device
certification or GPU timing measurements.

Start reproducible acquisition at [/performance/](https://libraries.ludic-canvas.victorqueiroz.dev/performance/)
using [PERFORMANCE.md](PERFORMANCE.md). Retain its downloaded JSON alongside this
protocol's game, long-session and assistive-technology evidence. The lab does not
acquire heap/GPU memory or complete any absent physical-phone qualification.

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
