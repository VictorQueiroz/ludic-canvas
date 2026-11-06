# Kestrel dialog stacking — 2026-11-05

Collection's text and controls were obscured by its panel, and Regional archive
painted an empty list despite having accessible option nodes. This was reproduced
on the public `/3d/` documentation page and on clean source
`f7e7347e056ab6105c14ff40870eff6a6e0147ce`, independently of the optional CSS
adapter work. The live page displayed version `0.10.2`; that label does not
identify its deployed source commit or verify an npm artifact.

## Cause and fix

Kestrel positions its UI canvas at CSS `z-index: 1`. The root-created overlay
containing native scroll tiles and semantic/editor surfaces had an automatic
stacking level, so its visible tiles were behind the canvas. The dialog panel and
archive viewport backgrounds were painted on the canvas, covering those tiles.
Native tile contents and accessibility nodes were present, which is why the old
keyboard/geometry contracts did not detect the visual failure.

The browser root now synchronizes its owned overlay to the canvas's computed
z-index during frames. The overlay is appended after the canvas, so matching
stacking levels place its native content above canvas backgrounds. This also
tracks host CSS changes without assigning an arbitrary global z-index.
Caller-supplied accessibility containers retain application-owned stacking.
The canvas, modal state, list data, virtualization, Yoga layout and shared/native
core contracts are unchanged.

## Red-first evidence

Five new Chromium regressions failed before the source fix:

- Collection fill and label pixels at 1280- and 320-pixel widths.
- Regional archive selected-row fill and label pixels at both widths.
- Native scrolling pixels and pointer targets above a canvas whose CSS z-index
  changes through `1`, `9` and `auto`.

The assertions sample the browser-composited screenshot, including the canvas and
DOM layers. Sampling only tile `getImageData`, or checking accessible visibility,
would miss this defect. The dialog checks wait for the intended responsive
controls and rendered pixels; they do not disable animations.

After the source fix the low-level regression passed. The first dialog rerun
still used a running preview with the baseline bundle and failed its four pixel
checks. That attempt was retained; rebuilding the documentation bundle produced
the corrected Collection and archive screenshots. No SDK behavior or assertion
deadline was changed to mask it.

## Validation

The final five contracts pass in all five browser projects: Chromium, Firefox,
WebKit, mobile Chromium and mobile WebKit (**25 passes**, no failures or retries).
The mobile projects provide emulation and DPR coverage, not physical-phone
qualification. Cropped PNGs are decoded in the Node test runner, keeping pixel
inspection independent of browser/GPU readback work. The decoder also detects
zero matching fill pixels in the preserved pre-fix Collection screenshot.

The first high-DPR run used browser-side PNG decoding and timed out despite
having the correct rendered rows. Its trace measured 3,262 ms for screenshot
capture plus 2,096 ms for browser-side decoding, exceeding the unchanged
five-second polling deadline. Moving decoding into Node removed this additional
browser operation; the assertion, fill threshold and timeout were preserved.

Related survey, gallery, scrolling, editor and root-runtime contracts across the
three desktop engines initially produced 146 passes, eight explicit skips and
two Firefox startup failures. Both failures reported `WebGL 1 is unavailable`
before fixture initialization and before the changed frame code could run.
The two affected editor cases and adjacent composition case passed on both
baseline and fixed source in isolated single-worker runs. The original failures
and traces remain recorded; these reruns do not resolve the original environment's
intermittent WebGL availability.

Real pointer clicks in the Play gallery at widths 1470 and 320 opened Collection
and archive, selected KS-0002, scrolled the native list from 0 to 240 pixels and
closed the dialog, with no page errors. Corrected desktop screenshots were also
visually inspected.

The integrated checkout passes build/typechecks, all **152 unit tests** with one
worker, documentation build, public-boundary audit and packed-consumer checks.
An initial parallel unit acquisition had three unchanged CLI/Git-fixture tests
exceed their existing five-second deadlines; those failures are retained. No test
deadline, browser flag or motion setting was changed. New source and documentation
pass formatting and `git diff --check`.

Run the new contracts with:

```sh
npm run test:browser -- --workers=1 \
  -g 'paint above the dialog|positioned canvas layer'
```

PR preparation on November 6 reapplied the isolated fix to default-branch
`c5ced8ec82b8439a53a28545d3e9bcef9d3e50ba` (0.10.2), including the intervening
retained-rendering changes. All 25 targeted browser cases passed without retries;
152 unit tests with one worker, build/typechecks, docs build, public audit,
packed consumers, formatting and package dry run also passed. Earlier acquisition
records above retain their original source and environmental limits.

Local original screenshots, red traces, source checksums and validation logs are
retained under `build/kestrel-investigation/` in the isolated investigation
checkout and copied to the main checkout for review. These acquisitions do not
establish a deployed or published correction. Physical-device and assistive-technology qualification remain
separate from desktop engines and narrow-viewport rendering checks.
