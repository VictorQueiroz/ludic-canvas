# Ludic Canvas roadmap

Completed releases and planned work are tracked separately. See
[CHANGELOG.md](CHANGELOG.md) for individual changes and
[PRODUCTION.md](PRODUCTION.md) for the supported boundary.

## Completed: 0.4 — shared controls and project adoption

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

## Completed: 0.5 — typography baseline and measurement lab

- Ordered font fallback chains and atlas pair kerning shared by measurement,
  wrapping, ellipsis and painting; per-face baseline metrics.
- Bounded, opt-in root-local missing-glyph diagnostics and legacy kern-table
  extraction, including requested Unicode aliases. GPOS and shaping remain open.
- Versioned UI workloads with raw CPU frame-call, commit latency and RAF samples,
  explicit operator budgets, source/environment metadata and cleanup checks.

## Completed: 0.6 — profiled scrolling and fixed-height virtualization

- Opt-in per-root stage profiles and mounted/painted/submitted geometry counts.
- Typed scroll handles with immutable snapshots, subscriptions and queued commands.
- Fixed-height `VirtualList` listboxes with bounded mounted windows, stable keys,
  logical keyboard/gamepad focus, controlled selection and accessibility metadata.
- Focus/viewport anchors, modal focus return, retained pointer targets and teardown.
- A responsive 4,000-record archive in the 3D example, plus matched retained/windowed
  workloads and original M3 acquisition reports and diagnostic trace.
- Published-package verification of the standalone example and portable font CLI.

The [collection contract](docs/VIRTUALIZATION.md) excludes variable-height rows and
interactive grids. The [qualification record](docs/QUALIFICATION_RESULTS.md)
documents the acquired reference result and its limits; this milestone does not
complete device, accessibility or memory qualification.

## In progress: reliable integration and desktop qualification

- A minimal independent counter with a fresh StackBlitz fork and pinned Vite 7
  configuration; see [the integration guide](docs/INTEGRATION.md).
- Independent packed/registry consumer checks for real development startup,
  binary WASM/font acquisition, interaction and production preview. Packed
  consumers cover Chromium, Firefox and native macOS WebKit in CI.
- A reproducible installed-Chrome desktop acquisition that verifies the npm
  artifact, completes the 3D survey and records scene lifecycle, frame, heap,
  DOM/listener and process observations during a 30-minute session.

The current campaign is desktop-only; physical phones are deferred and VoiceOver
is explicitly pending. Record acquired outcomes and interruptions in
[the qualification record](docs/QUALIFICATION_RESULTS.md). This work changes
integration examples and verification tooling; it does not require a new SDK
runtime release.

## Next: remaining device and assistive-technology qualification

Use [docs/DEVICE_QUALIFICATION.md](docs/DEVICE_QUALIFICATION.md). Record the exact
commit, installed package, hardware, browser/OS, workload and acquired measurements.
Run the component catalogue and both games, including long sessions and teardown.
Publish actual device results, unresolved findings and support limits together.

Physical iPhone/Android and real screen readers remain outstanding. A desktop
30-minute active Kestrel session is acquired; actual background/resume, other
game/catalogue hardware coverage, GPU allocations and the observed post-destroy
heap/node growth still need qualification. Investigate the documented Linux WPE
startup stall independently of native macOS WebKit coverage. Mobile emulation and software-GPU CI
provide correctness evidence, not physical-device certification.

## 0.7 — native text entry

- Controlled TextInput and TextArea with root-local native editors, synchronous
  value reconciliation, deferred composition resets and stable focus/select/blur
  handles. Yoga positions fields; WebGL decorates them; browser fonts draw text.
- Modal focus/isolation, rectangular clipping, inherited transforms/opacity,
  accessible error descriptions, suspension and teardown.
- The catalogue's Edit profile dialog demonstrates both fields in independent
  roots. Fields require topmost form/dialog surfaces; arbitrary canvas/DOM
  interleaving is outside this implementation.

See [the editing contract and verification record](docs/NATIVE_EDITING.md).
The 0.7 source implements this contract; publication identity is recorded in the
[session handoff](docs/SESSION_HANDOFF.md). Real IME, physical phone keyboards and
screen readers remain separate qualification work.

## 0.8 — wheel and world input

- Bubbling `onWheel` handlers with browser delta units and modifier keys.
- Frontmost-surface routing, disabled/panel blockers, nested scroll defaults and
  native textarea chaining.
- Root-local `isPointerOverUI` queries for external cameras without cached hover
  state, respecting painted geometry, modal isolation and teardown.
- A map-and-sidebar example for both UI-tree and external-camera arrangements.

See [the input verification record](docs/INPUT_ROUTING.md). Publication identity
is recorded separately in the [session handoff](docs/SESSION_HANDOFF.md).

## Planned: shaping and remaining native editing qualification

MSDF/MTSDF provides glyph rendering. Layout and OpenType shaping require their
own contracts and fixtures. The 0.5 baseline supplies rendering and pair kerning;
the following text-system work remains separate.

1. Design bidi, grapheme-aware line breaking and complex-script shaping together.
   Establish the glyph-ID/atlas contract needed by contextual substitutions and
   ligatures before choosing a shaping dependency. Keep atlas generation offline.
2. Qualify the native text-input bridge with actual IME composition, physical
   mobile keyboards, selection/clipboard and assistive technology. Retain exact
   browser/device/script evidence separately from synthetic event tests.
3. Qualify Latin kerning, combining marks, Arabic/RTL, an Indic script and mixed
   direction strings using licensed fixtures and known expected glyph/layout
   results. Verify wrapping, selection, fallback and accessibility separately.

Completion means tested text behavior and documented script coverage. A new
font atlas alone is not evidence of shaping support. The four-atlas limit stays
in force until a separately tested batching/resource design replaces it.

## Future collection and integration design

Variable-height collections, interactive grids/trees, richer semantic document
coverage and a declarative root adapter require explicit interaction and lifecycle
contracts before implementation. Prioritize them against real game requirements
and acquired profiles. The matched 0.6 collection result met its reference budget
through windowing; it does not establish a need for another renderer rewrite.
