# Browser-native scrolling prototype

The first milestone evaluates browser-composited canvas tiles before adding a
public `scrollMode` property. It does not change the SDK or publish a package.
Open `/native-scroll/` on the documentation site preview. The page compares:

- Browser-native overflow containing rendered canvas tiles and native item buttons.
- The existing canvas `ScrollArea`, including its current touch-drag behavior.
- An ordinary DOM overflow container with HTML buttons.

All three show 100 fixed-height records. The two canvas versions use the same
React components, Yoga geometry, fonts and WebGL renderer. The DOM reference
uses system fonts. Selection state is independent for each comparison.

## Rendering and ownership

One offscreen WebGL root paints a 384-CSS-pixel tile at a time. The prototype
waits for the requested React commit, draws the frame, and immediately copies
its pixels with Canvas 2D `drawImage`. Those visible canvas tiles are actual
children of the native overflow container. Browser scrolling moves their pixels;
JavaScript does not reposition the tiles for each scroll event.

Tile captures are serialized. The staging subtree uses a visual translation,
so it does not bake a ScrollArea scrollbar into every tile. Yoga supplies content
height and item button boxes. The native scroll container owns its raw offset;
the diagnostic logical offset is clamped without writing that clamp back during
elastic overscroll. The existing `ScrollHandle` controls only the canvas reference.
The experiment does not yet implement a native ScrollHandle adapter.

Only visible tiles plus at most one overscan tile per side are retained. A
16 MiB budget includes estimated RGBA bytes for the staging canvas and retained
tile canvases at a DPR capped at two. Width and DPR changes invalidate the cache.
This is not a measurement of browser heap, GPU allocations, compositor copies or
reclamation. `drawImage` can synchronize internally; no zero-copy claim is made.
Reports separate React scene-commit latency, frame-call time and copy-call time.

DOM buttons deliberately own input in the native prototype. Their boxes move
inside the same scroll hierarchy as the pixels. This verifies the presentation
approach, not arbitrary canvas hit testing or an SDK native-scrolling backend.
All 100 Yoga rows and all 100 native buttons remain mounted. Virtualization,
nested scrollers, native editors, arbitrary transforms/overlap and shared engine
contexts are subsequent milestones.

Each experiment owns its roots, cache, listeners, pending capture, resize
observer and scheduled work. Duplicate container initialization is rejected.
Stopping, page exit, initialization failure and context loss release its
resources. Pausing drawing deliberately leaves native scrolling active; a fast
fling can outrun the prepared cache and expose unpainted content while paused.

## Software evidence — 2026-11-03

The prototype starts from repository source `c3917f1`, package metadata 0.9.0.
This is checkout source, not a newly published npm artifact.

The initial browser attempt failed with `Unexpected Yoga list geometry` because
capture preceded React's initial concurrent commit. The fix waits for a layout
effect for the requested scene and serializes captures. No SDK scheduling,
browser deadlines, motion settings or browser ports were changed. The original
console error was retained locally; that attempt's Playwright trace was not
retained across the subsequent run.

After the fix, the focused Chromium/mobile-Chromium run passed seven tests with
one explicit skip. Firefox, macOS WebKit and mobile-WebKit emulation passed nine
tests with three explicit skips. There were no retries in either final run.
The skips are for trusted touch-drag injection, implemented only in mobile
Chromium through CDP. Browser tests verify painted nontransparent pixels,
movement without another application paint, distant tile windows, selection
after scrolling, resize, budget bounds and teardown. The mobile Chromium gesture
test verifies native panning without row activation, followed by a successful tap.
These checks do not establish physical iPhone momentum, bounce or presentation.

A combined rerun after ownership/cleanup changes again passed 16 tests with four
explicit skips. Diagnostic-download checks then passed on all five browser
projects, including the JSON source identity and raw copy samples. Package
validation passed 142 unit tests plus type, documentation, public audit and
packed-consumer gates. Mobile-width inspection at 390 CSS pixels found no
horizontal page overflow. No physical scrolling or timing result is inferred
from these software checks.

## Hosted preview

[Draft PR 38](https://github.com/VictorQueiroz/ludic-canvas/pull/38) contains the
prototype. The [phone comparison preview](https://ludic-canvas-258jgah6d-victorqueiroz.vercel.app/native-scroll/)
is Vercel deployment `dpl_CwjQuPNjYPM66LwssFNQK1fvgGZ5`, READY, from Git source
`d3876aa9e3f491fb83fc8b53761e175a4bee8404`. That immutable deployment remains
the target for the initial phone comparison, even if later documentation-only
commits produce another preview.

Hosted browser checks confirmed startup, a distant jump, selection of Item 85,
bounded tile storage and no console errors. The embedded revision is
`d3876aa9e3f491fb83fc8b53761e175a4bee8404-dirty`; build-time working-tree changes
have not been attributed. Deployment identity and Vercel Git metadata identify
this artifact; it is not described as a clean-build or physical-device result.

## Physical iPhone evaluation — pending

Use the exact preview revision and record the phone model, iOS version and Chrome
and Safari versions. Compare all three lists with ordinary dragging, fast flicks,
direction reversal, tapping to stop momentum, and selecting after stopping.
Check top/bottom overscroll and page-versus-panel scrolling.

Use **Pause drawing** to inspect movement over already-painted tiles, then resume.
Use **Block JavaScript in 1 second** and flick a list: it schedules an intentional
250 ms main-thread block. Observe visible movement and blank tile exposure on
the device; JavaScript diagnostics cannot prove presentation during the block.
Rotate the phone and repeat scrolling. Download diagnostics before using
**Stop experiment** to check cleanup. Reports contain source identity, browser information, offsets, cache
estimates and the last 512 copy samples. Keep observed phone behavior separate
from those call timings.

The next decision is whether copy cost, tile coverage and physical scrolling
feel justify integrating a browser scroll adapter with ScrollHandle and
VirtualList. No public API/default change is implied by this experiment.
