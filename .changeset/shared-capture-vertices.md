---
'ludic-canvas': patch
---

Keep retained main-view vertices separate from native scroll tile viewports. Evict older viewport entries within the existing shared memory budget. Preserve reusable subsets of oversized frames and stream their overflow without repeatedly scanning protected batches.
