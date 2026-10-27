# Browser production review

Ludic Canvas targets desktop and mobile browser HUDs and menus. It is a low-level interface renderer; it is not an all-widget toolkit or a complete international text engine. The supported boundary and integration recipes are published in the [guide](https://libraries.ludic-canvas.victorqueiroz.dev/guide/#production).

## Review scope

The review covered public API contracts, React reconciliation and node ownership, Yoga measurement, layout and scroll extents, text placement and font generation, WebGL allocation and shared-context state, asynchronous assets, input and focus, the accessibility mirror, the playable example, package consumers, documentation and release automation. A separate static security review of baseline commit `0e9dc6211f88ab3007d860bc702728ac750292cb` found no reportable vulnerabilities within first-party source/configuration scope. That result does not certify third-party parsers, shipped native binary equivalence or future changes. The dependency advisory check also returned no known advisories at review time.

The reference workload included four-face typography, responsive nested panels, narrative scrollers, selectable cards, image portraits, animated meters, connected map nodes, modal overlays and scene teardown. Public examples remain independent of any particular game.

## Corrections

| Area                  | Previous gap                                                                                                | Result                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GPU recovery          | Lost contexts required recreating the entire interface                                                      | Suspend controls and drawing; rebuild fonts/batch, reload images and retain React state                                       |
| Shared graphics state | Asynchronous uploads could change bindings/flip state; inherited VAOs and instancing state could corrupt UI | Restore upload state, isolate the batch VAO, reset attribute divisors, use explicit premultiplication and correct clear alpha |
| Canvas sizing         | CSS and backing-buffer aspect ratios could diverge                                                          | Layout/input use CSS dimensions; viewport/scissor map to physical pixels                                                      |
| Focus and modals      | Pointer blocking did not isolate hotkeys or Tab                                                             | Explicit modal subtrees, focus trapping/restoration, disabled background mirror controls                                      |
| Pointer routing       | Disabled controls could click through; pointer identities were not tracked                                  | Occlusion checks, primary pointer capture/cancel, bubbling events, scroll chaining and cleanup                                |
| Custom controls       | Press-only API limited widget composition                                                                   | Pointer/key events, semantic state, stable focus identifiers and spatial navigation actions                                   |
| Layout                | Parent scale did not propagate; percent padding could corrupt scroll extents                                | Inherited transforms and numeric padding resolution; own text is clipped when requested                                       |
| Text                  | Unvalidated metrics, fractional-width cache collisions, long-token overflow                                 | Metrics/dimension validation, normalized units/CRLF, long-token breaks, optional ellipsis and bounded per-root caches         |
| Asset lifecycle       | Unlimited fetch sizes/concurrency; stale failures and over-budget idle textures                             | Bounded streams/load pool/dimensions, explicit invalidation, periodic LRU eviction and abort cleanup                          |
| Font CLI              | Source size checked after reading; synchronous compiler could hang the main thread                          | Bounded sequential source reads, worker deadline and output-directory writer lock                                             |
| Multiple roots        | Process-wide node IDs and parent-style restoration races                                                    | Root-local IDs/resources and DOM-surface ownership/refcount cleanup                                                           |
| Validation            | Node tests and bundler builds did not exercise a browser renderer                                           | Chromium/Firefox/WebKit and mobile-emulation contracts, pixel checks and stress batching                                      |

## Release gates

- `npm run check`: package build, strict types, regression tests, docs generation/build, public-boundary audit, packed-package installation and both Vite consumers.
- `npm run format:check` and `npm pack --dry-run` on Linux, macOS and Windows.
- `npm run test:browser`: browser rendering/input/lifecycle contracts on five Playwright projects. Reports and failure traces are retained by CI. Software rendering validates correctness, not physical GPU performance.
- Changesets version PR merged only after checks; trusted npm publication with provenance after that merge.
- Application qualification on physical target devices, real assistive technology and representative long-running scenes before a game release.

## Remaining boundaries

- React 19.3.1, WebGL 1 and browser WebAssembly are the supported runtime contract. Use a separate overlay canvas with WebGL 2 engines.
- At most four font atlases per root. No kerning, bidi, complex-script/ligature shaping, editable canvas text, emoji fallback or full static-text accessibility tree. Use native DOM text/editing for those requirements.
- Axis-aligned positive scale/translation and rectangular clips. No rotation/skew, arbitrary shaders, stencil masks or rounded clipping of child content.
- The optional controlled components cover buttons, switches, horizontal sliders, tabs, dialogs and vertical scroll areas. The interactive catalogue demonstrates independent roots and custom skins. No built-in virtualized lists, engine adapters or controller polling are included. Applications own control values and can route controller input through root focus/navigation methods.
- GPU image budgets are soft, browser decoding can temporarily allocate additional memory, and the font compiler's individually renamed outputs are not a filesystem-wide transaction.
- Mobile viewport/touch emulation is not physical iOS/Android certification. No universal FPS, memory, accessibility or all-games readiness guarantee is implied by the automated suite.

## Adoption milestone

The 0.4 work adds reusable controlled components, a root-scoped React hook,
semantic dialog/tab-list/scroll groups and a project initializer. Both games use
the shared components while retaining their visual designs. Nested dialogs keep
a return-focus target for each scope. Regression coverage includes independent
root state/focus, keyboard navigation, disabled pointer activation and mobile
layout. The package-consumer gate generates both Canvas2D and Three.js projects,
installs their own dependencies and builds them against the packed library.

Typography and hardware qualification remain separate work, with explicit
acceptance criteria in [ROADMAP.md](ROADMAP.md) and
[the device protocol](docs/DEVICE_QUALIFICATION.md).
