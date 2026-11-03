---
'ludic-canvas': patch
---

Keep native control mirrors aligned with Yoga when document button rules set minimum/maximum sizes or transforms. Reset geometry constraints on root-owned invisible buttons, including controls inside native scroll tiles.

Preserve decoded SVG source dimensions separately from quantized raster texture sizes. Image contain/cover fitting now retains the source aspect ratio across resize and DPR changes; fill remains an explicit stretch. Portable image providers can supply optional logical dimensions while texture sizes and byte accounting remain physical.

Document stable-identifier SVG replacement with an asset resolver and invalidateImages, with pixel and texture-storage regressions for replacement and teardown.
