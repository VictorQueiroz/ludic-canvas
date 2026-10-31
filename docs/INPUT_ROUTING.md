# Wheel and world input

The 0.8 implementation adds `onWheel`/`UIWheelEvent` and
`UIRoot.isPointerOverUI({ clientX, clientY })`. The maintained guide is generated
from [tools/docs-input.mjs](../tools/docs-input.mjs); the
[map-and-sidebar source](../examples/input-routing) demonstrates UI-tree and
external-camera ownership using public exports. Application camera behavior and
frame loops remain outside the library.

Wheel dispatch uses the frontmost input surface and its ancestor path. It does
not search through a button, disabled control or blocking panel for a wheel
handler or scroller in an unrelated sibling. An unhandled wheel still permits
the nearest eligible ancestor's built-in scrolling, including chaining at scroll
boundaries. Native textarea scrolling runs before that Yoga default. Cancellation
and propagation are separate operations.

The root query uses the same clipped, transformed surface geometry. Disabled
controls reserve input; decorative boxes do not. `block` declares panel occupancy,
`pointerEvents` controls eligibility, and a modal reserves the root's entire
canvas. The query is root-local, has no hover prerequisite and does not dispatch
events, draw, or indicate pointer capture ownership. It returns false before
painting, outside the canvas, while suspended and after destruction.

## Local evidence — 2026-10-31

Developed from `67f95b21d10d1d91a893494517a6014ef149c305` on macOS 26.6.2,
Node 26.12.1 and Playwright 1.64.1. CI uses the repository's Node 24 configuration.
SDK source-tree SHA-256: `617acf0ae21841d91d324fbd7454bb4919fe74ed2cec8c6b933dcd9b00bbcaba`
(sorted `src/**/*.ts`/`*.tsx` paths and bytes, each followed by a NUL byte).

The baseline contract failed before implementation: the wheel callback did not
run and the public root query was absent. Initial traces and subsequent logs are
retained locally in `/tmp/ludic-input-routing-2026-10-31/`.

The final focused command passed **62 tests with 3 explicit skips**, no failures
and no retries, across Chromium, Firefox, WebKit and the two mobile-emulated
configurations:

```sh
npm run test:browser -- tests/browser/input.spec.ts \
  tests/browser/input-example.spec.ts --workers=1 --max-failures=1
```

Coverage includes wheel input without pointer movement, delta units/modifiers,
transformed coordinates, cancellation/bubbling, blocking/disabled overlays,
clipping and pointer exclusions, nested scroll boundaries, native textarea
callbacks and real scrolling, multiple roots, canvas movement/suspension,
teardown and both live integration arrangements. The three skips are actual
mouse-wheel injection on mobile WebKit; synthetic routing contracts still run
there. This is browser correctness evidence, not physical-phone qualification.

Earlier qualification attempts are retained separately:

- A documentation build rejected the new snippet language `ts`; the generator
  accepts `typescript`. This stopped server startup before browser tests.
- Firefox rendered the final sidebar row correctly, but a test compared its
  lower edge with a hard-coded position. The assertion now compares the actual
  row and Reset button geometry.
- A later screenshot-only assertion expected document scroll position zero
  after interaction; Chromium reported 46. Screenshots are now acquired before
  interaction. The cause of that page scroll position was not established, and
  the camera/scroll routing assertions were retained.

No SDK behavior, browser ports, test deadlines or motion settings were changed
to resolve those test/acquisition failures. Final desktop and mobile-emulated
screenshots are retained with the passing input artifacts. Full release gates
and publication/deployment identities are recorded in the session handoff.

`npm run check` passed the build, typecheck, 105 unit tests, generated site,
public-boundary audit and independent packed consumers, including a build of the
new map/sidebar example against the tarball. Formatting, whitespace checks and
`npm pack --dry-run` passed. The local tarball still carries 0.7.0 metadata;
it is implementation evidence, not a registry publication.
