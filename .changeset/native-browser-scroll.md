---
'ludic-canvas': minor
---

Use browser-native scrolling automatically for supported ScrollArea and VirtualList surfaces. Native momentum moves bounded canvas tiles through the browser compositor while React state, Yoga geometry, resources and application frames remain root-owned.

Add auto/canvas/native scroll presentation controls, native-mode observation on scroll snapshots, and per-frame native tile/copy diagnostics. Preserve canvas rendering for shared WebGL contexts, native editors, nested/clipped or overlapping content, custom gestures, unlabeled pressables, and surfaces outside native resource or browser extent limits.

Keep hover-only targets without a native event surface on canvas presentation so their callbacks and styling remain functional; labeled native buttons retain hover support.

Retain canvas presentation for blocking descendants so covered controls cannot receive clicks through overlays.

Repaint native tiles when viewport height changes so percentage-sized descendants stay aligned with their native controls.

Capture the final settled animation state after delayed application frames, then resume reusing static tiles.

Synchronize browser extents before programmatic/focus/anchor commands, retain native DOM activation and keyboard semantics, and extend fixed-height virtual windows to cover the prepared raster range. Native scrolling does not create another React root, WebGL context, animation loop or font cache.
