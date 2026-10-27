# ludic-canvas

## 0.6.0

### Minor Changes

- 3f20481: Add opt-in per-root frame profiling with stage timings and mounted, painted and submitted geometry counts. The performance lab can retain raw profiles without changing the default measurement mode.
- 1d8cce4: Add independent typed scroll handles, cached immutable viewport/offset snapshots, subscriptions and coalesced onScroll notifications. Wheel, touch, focus reveal and programmatic commands use the same laid-out extent.
- ce0609f: Add fixed-height VirtualList collections with stable keys, overscan, padding, bounded mounted rows and typed scrolling. Settle scroll-driven React window commits before painting in the existing application frame, with separate profiling for this work.
- 5fdcab0: Add logical virtual-list focus, keyboard/gamepad navigation, controlled selection, prefix search and listbox position semantics. Preserve focus and viewport anchors across data changes, retain pointer targets through scrolling, cancel pending work on teardown and preserve focus when accessibility mirrors reorder.

## 0.5.0

### Minor Changes

- 7bac124: Add ordered `fontFamily` fallback chains, atlas pair kerning and `fontKerning: 'none'`.
  Measurement, wrapping, ellipsis and glyph painting share the selected face and
  baseline metrics. Opt into bounded root-local missing-glyph reports with
  `onFontDiagnostic`. The offline font compiler now extracts legacy kern-table pairs;
  GPOS, bidi and complex-script shaping remain outside this release.

  Add documented browser performance workloads with raw JSON evidence, explicit
  budgets, source/environment metadata and separate CPU submission, commit latency
  and frame-interval measurements. Physical mobile and assistive-technology
  qualification remain separate from automated correctness tests.

### Patch Changes

- 15c3722: Preserve legacy kerning for all requested Unicode aliases of each source glyph,
  including space and non-breaking space. Bound the expanded pair count before
  writing output, and merge complete pairs into the generated atlas metrics.

## 0.4.0

### Minor Changes

- d7b500f: Add unstyled, controlled Button, Switch, Slider, Tab, Tabs, Dialog and ScrollArea components, plus a root-scoped useUIRoot hook. Tabs support roving focus and disabled-item skipping; sliders support pointer cancellation, snapping and keyboard adjustment. Named dialog, tab-list and scroll-region semantics are mirrored into the accessibility surface. Nested dialogs now restore each scope's own trigger when closed.

  Add `ludic-canvas init [directory] --template canvas2d|three`. Each starter includes a licensed font, automatic atlas generation, application-owned simulation/frame loop, responsive sizing and resource teardown. The initializer preserves existing projects and does not install dependencies automatically.

## 0.3.2

### Patch Changes

- 30b3bf0: Reject the reserved font name font-atlas-manifest, including case variants, before generating files. This prevents font metrics from being overwritten by the cache manifest. The configuration schema now documents and rejects the same reserved name.

## 0.3.1

### Patch Changes

- 7310361: Move focus into an animated modal when its first enabled control becomes visible after the initial frame. Preserve deliberate focus changes outside the root while waiting for the enter animation.

## 0.3.0

### Minor Changes

- 5087564: Harden browser rendering and resource ownership with context-loss recovery, abortable initialization, bounded assets, validated font metrics and corrected shared-context alpha/VAO handling. Add modal focus scopes, captured pointer/key events, semantic control state, spatial focus navigation and image invalidation. Fix inherited scale, scroll padding, fractional text wrapping and long-token truncation. Bound font compilation in a worker, serialize output writers, and add cross-browser regression coverage and production integration documentation.

  The layout reactor ABI is now version 2 to expose computed scroll padding. Default assets update automatically; applications supplying a custom layout module must replace it with the module from this package or rebuild their bridge.

## 0.2.0

### Minor Changes

- 81204f7: Add a portable, configuration-driven font atlas CLI. Generate MTSDF PNG atlases and JSON metrics from outline TTF, OTF, WOFF and WOFF2 files using the bundled WASI compiler, with variable-font axes, input/output caching, configuration validation, a JSON schema and useful diagnostics. No native compiler, external executable or network access is required when running the CLI.

  Configure public npm releases through Changesets version pull requests and GitHub Actions trusted publishing.
