# Ludic Canvas roadmap

## 0.4 — shared controls and project adoption

The scope is reusable interaction behavior, application-owned visual design and
a reproducible path from npm to a running browser game.

- Controlled Button, Switch, Slider, Tab/Tabs, Dialog and ScrollArea components.
- A root-scoped React hook; no global active root or shared game state.
- Both playable games consuming the controls with their own visual designs.
- An interactive catalogue with independent roots, disabled controls, text scaling,
  reduced motion, tab navigation, nested dialogs and focus-driven scrolling.
- `ludic-canvas init` Canvas2D and Three.js starters, a licensed font and a complete
  build-time atlas pipeline, application loop, sizing and resource teardown.
- Generated-project installation and production builds against the release
  tarball on Linux, macOS and Windows; browser contracts on five configurations.
- Generated API reference and practical setup/control documentation.

Shipping this milestone does not remove the production boundaries documented in
[PRODUCTION.md](PRODUCTION.md).

## Dedicated typography milestone

MSDF/MTSDF provides glyph rendering. Layout and OpenType shaping require their
own contracts and fixtures. This work follows the adoption release.

1. Baseline implemented: atlas pair kerning, ordered fontFamily chains, shared
   measurement/painting resolution, per-line fallback metrics, ellipsis and bounded
   missing-glyph diagnostics. The CLI extracts legacy kern-table pairs, not GPOS.
   The four-atlas limit remains. Regression fixtures cover em normalization,
   wrapping, cache replacement, cross-face boundaries and fallback atlas painting.
2. Design bidi, grapheme-aware line breaking and complex-script shaping together.
   Establish the glyph-ID/atlas contract needed by contextual substitutions and
   ligatures before choosing a shaping dependency. Keep atlas generation offline.
3. Provide a native text-input bridge for editing, IME composition, mobile
   keyboards, selection and clipboard. Align its focus, sizing, transforms and
   clipping with the canvas; preserve native editing semantics.
4. Qualify Latin kerning, combining marks, Arabic/RTL, an Indic script and mixed
   direction strings using licensed fixtures and known expected glyph/layout
   results. Verify wrapping, selection, fallback and accessibility separately.

Completion means tested text behavior and documented script coverage. A new
font atlas alone is not evidence of shaping support. The four-atlas limit stays
in force until a separately tested batching/resource design replaces it.

## Physical-device and assistive-technology qualification

Use [docs/DEVICE_QUALIFICATION.md](docs/DEVICE_QUALIFICATION.md). Record the exact
commit, installed package, hardware, browser/OS, workload and acquired measurements.
Run the component catalogue and both games, including long sessions and teardown.
Publish actual device results, unresolved findings and support limits together.

This is an ongoing qualification track. Mobile browser emulation and software
GPU CI cannot supply physical-device performance or screen-reader results.

The [performance lab](https://libraries.ludic-canvas.victorqueiroz.dev/performance/)
and [measurement method](docs/PERFORMANCE.md) provide deterministic HUD, telemetry,
scrolling, resize and teardown workloads with raw JSON. A completed microbenchmark
does not complete this qualification track. Native text entry, semantic document
coverage, shaping and the proposed declarative React adapter remain future work.
