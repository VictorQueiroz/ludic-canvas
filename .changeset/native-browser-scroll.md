---
'ludic-canvas': minor
---

Use browser-native scrolling automatically for supported ScrollArea and VirtualList surfaces. Native momentum moves bounded canvas tiles through the browser compositor while React state, Yoga geometry, resources and application frames remain root-owned.

Add auto/canvas/native scroll presentation controls, native-mode observation on scroll snapshots, and per-frame native tile/copy diagnostics. Preserve canvas rendering for shared WebGL contexts, native editors, nested/clipped or overlapping content, custom gestures, unlabeled pressables, and surfaces outside native resource or browser extent limits.

Synchronize browser extents before programmatic/focus/anchor commands, retain native DOM activation and keyboard semantics, and extend fixed-height virtual windows to cover the prepared raster range. Native scrolling does not create another React root, WebGL context, animation loop or font cache.
