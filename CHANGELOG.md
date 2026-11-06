# ludic-canvas

## 0.10.3

### Patch Changes

- 58caac9: Keep root-owned native scroll and editor surfaces above their canvas when its CSS
  z-index changes. This fixes obscured Collection dialog contents and regional
  archive rows in Kestrel Survey.

## 0.10.2

### Patch Changes

- 5bc4607: Keep retained main-view vertices separate from native scroll tile viewports. Evict older viewport entries within the existing shared memory budget. Preserve reusable subsets of oversized frames and stream their overflow without repeatedly scanning protected batches.

## 0.10.1

### Patch Changes

- 2db1348: Cache vector-image capability limits per context, retain unchanged UI vertex buffers within a fixed memory budget, and reuse text-style lookup keys. Refresh caches after invalidation and release retained resources with their root.

## 0.10.0

### Minor Changes

- f7e7347: Use browser-native scrolling automatically for supported ScrollArea and VirtualList surfaces. Native momentum moves bounded canvas tiles through the browser compositor while React state, Yoga geometry, resources and application frames remain root-owned.

  Add auto/canvas/native scroll presentation controls, native-mode observation on scroll snapshots, and per-frame native tile/copy diagnostics. Preserve canvas rendering for shared WebGL contexts, native editors, nested/clipped or overlapping content, custom gestures, unlabeled pressables, and surfaces outside native resource or browser extent limits.

  Keep hover-only targets without a native event surface on canvas presentation so their callbacks and styling remain functional; labeled native buttons retain hover support.

  Retain canvas presentation for blocking descendants so covered controls cannot receive clicks through overlays.

  Repaint native tiles when viewport height changes so percentage-sized descendants stay aligned with their native controls.

  Capture the final settled animation state after delayed application frames, then resume reusing static tiles.

  Synchronize browser extents before programmatic/focus/anchor commands, retain native DOM activation and keyboard semantics, and extend fixed-height virtual windows to cover the prepared raster range. Native scrolling does not create another React root, WebGL context, animation loop or font cache.

### Patch Changes

- f7e7347: Keep native control mirrors aligned with Yoga when document button rules set minimum/maximum sizes or transforms. Reset geometry constraints on root-owned invisible buttons, including controls inside native scroll tiles.

  Preserve decoded SVG source dimensions separately from quantized raster texture sizes. Image contain/cover fitting now retains the source aspect ratio across resize and DPR changes; fill remains an explicit stretch. Portable image providers can supply optional logical dimensions while texture sizes and byte accounting remain physical.

  Document stable-identifier SVG replacement with an asset resolver and invalidateImages, with pixel and texture-storage regressions for replacement and teardown.

## 0.9.0

### Minor Changes

- e7cc645: Extract platform-independent layout, drawing, input and host contracts into `ludic-canvas/core`. Add a command renderer and headless host, and an experimental `ludic-canvas/native` entry point for the repository's Hermes/Yoga/Skia macOS proof. Existing browser applications keep the WebGL and DOM editor adapters.

  Preserve owned-resource cleanup when portable scheduling fails, restore native canvas state after rejected commands, and report native callback/startup errors without allowing JavaScript exceptions to outlive Hermes.

  Reconcile native password-field type changes while preserving controlled values and selection, and restore portable keyboard focus when a macOS window becomes key again.

## 0.8.0

### Minor Changes

- 59d1ba8: Add bubbling `onWheel` callbacks and the `UIWheelEvent` type to primitives and native text fields. Wheel input follows the frontmost input surface and its ancestors, so controls and blocking panels prevent wheel input from reaching unrelated surfaces behind them. Built-in nested scrolling and native textarea scrolling remain default actions that callbacks can cancel.

  Add `UIRoot.isPointerOverUI({ clientX, clientY })` for application-owned camera and world input. The query uses painted, clipped geometry and respects disabled controls, pointer-event exclusions, modal isolation and root lifecycle without depending on hover state.

## 0.7.0

### Minor Changes

- 941a337: Add controlled TextInput and TextArea components using persistent root-local native editors over Yoga/WebGL field boxes. Include native selection and editing, composition-aware controlled values, focus/select/blur handles, accessible errors, modal focus and rectangular clipping. Use fields in topmost forms/dialogs; native font rendering is separate from atlas text. Physical keyboard/IME, phone and assistive-technology qualification remain separate from automated browser contracts.

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
