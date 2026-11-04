---
'ludic-canvas': patch
---

Keep retained main-view vertices separate from native scroll tile viewports. Use least-recently-used eviction across the existing shared memory budget so tile captures and resizing do not force persistent streaming uploads.
