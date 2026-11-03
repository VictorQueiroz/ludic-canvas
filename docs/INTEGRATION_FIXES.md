# Control and vector integration fixes — release preparation

Two independently reproduced SDK defects are included in the pending 0.10.0
release alongside native scrolling. The examples and regressions use generic
controls and generated SVGs; application content and adapters stay outside the
library.

## Native control geometry

Ordinary document-wide button rules could change a transparent control mirror's
minimum/maximum size and transform. A 320×40 Yoga box reproduced as a displaced
240×80 DOM rectangle under those rules. This could misalign focus bounds and the
native click target even though the canvas pixels were correct.

Root-owned buttons now reset document geometry constraints before applying their Yoga box,
opacity and pointer mode. Existing button identity, role/state attributes and
native activation remain intact. The regression checks both canvas and native
scroll presentation, including a click at the far edge of the restored target.
Native editors retain their existing independent geometry/font and editing
contracts; this fix does not replace their browser editing behavior.

## Logical vector aspect

The vector cache independently rounds raster dimensions to reuse texture buckets.
Previously, Image fitting used that physical texture aspect. A square SVG marker
stretched to three times its intended width in a wide `contain` destination.

SVG textures now retain their decoded intrinsic dimensions. `contain` and `cover`
use those logical dimensions when available; `fill` intentionally stretches.
Texture width/height and byte budgets remain physical. Portable image providers
can supply both positive finite `logicalWidth`/`logicalHeight` values; resources
without a valid pair keep physical-dimension fitting. SVGs should specify their
intrinsic dimensions for predictable browser decoding. ImageAsset width/height
continue to be raster/preload hints.

Browser SVG decoding also differed at a destination with another aspect: the
diagnostic's marker rasterized as 38×12 pixels in Chromium and 12×12 in Firefox.
A bounded source canvas now rasterizes at the SVG's aspect before resampling into
the cache bucket. Both temporary canvases are cleared after upload; the extra
source canvas fits within the bucket dimensions. GPU bucket sizes, load
concurrency and resource limits are unchanged. This does not measure CPU/GPU
memory reclamation or imply a zero-copy path.

Browser regressions inspect marker pixels through contain/cover/fill, multiple
sizes and desktop/mobile DPR. A portable command regression checks fitted
geometry independently of the physical resource dimensions and byte count.

## Changing resources and follow-ups

The existing asset resolver plus `invalidateImages([id])` already supports
replacing a diagram under a stable identifier. The generated guide now shows
this recipe. A browser regression alternates source content and verifies changed
pixels, released old texture bytes, bounded replacement storage and root teardown.
This remains asynchronous deletion/reupload, rather than an update-in-place GPU
resource or a guarantee of uninterrupted pixels while loading.

Application CSS layout/selector adaptation, numeric draft state, custom slider
skins, SVG serialization, game input and native surface composition remain owned
by applications. Separate API/design work is needed for per-edge border painting,
resting canvas editor presentation, general overlay portals, true in-place vector
updates and optional optical font alignment. Those capabilities are not implied
by the two defect fixes or by browser device emulation.

## Reproduction and qualification

The initial Chromium run failed both new defect contracts; the stable-identifier
replacement contract already passed. Its traces are retained locally under
`/tmp/ludic-integration-evidence/before/` and its log at
`/tmp/ludic-integration-before.log`.

An intermediate vector pixel probe used a shared context's default 300×150
drawing buffer against a 300×100 CSS canvas. The fixture now explicitly requests
managed canvas sizing, matching the raster/DPR contract it is testing. Marker
classification includes filtered edge hues instead of requiring opaque source
colors. A separate early fixture-readiness failure was corrected by waiting for
the committed scene. No SDK deadlines, motion settings or browser ports changed.
Intermediate traces were preserved alongside the initial failures.

A broad CSS reset was also rejected during review: it overrode inherited
visibility while a native scroll surface was suspended. A failing context-loss
regression now checks that the control itself is hidden. The final reset covers
only geometry and animation constraints, preserving inherited visibility.

The first complete sweep was interrupted after 371 passes, 14 explicit skips
and one catalogue sequencing failure (one active case interrupted, 128 not run).
Its trace showed the next root receiving Enter before the previous Escape/close
commit had restored focus. The catalogue test now waits for dialog removal and
returned focus. A fresh complete sweep validates the final reset and test order;
partial-run passes are not substituted for that final sweep.

Final candidate validation passes 145 unit tests, the complete browser sweep
(494 passed, 21 explicit skips, no retries), 12 independent packed consumers,
package/type/docs/format checks and native build/contracts. The source checkpoint
remained unchanged during that final sweep. Details are recorded in
[the release preparation](NATIVE_SCROLL_RELEASE.md).
The user has authorized PR delivery, with prototype PR 38 merged before this
integration. Refresh the actual PR checks/reviews before treating it as merged.
