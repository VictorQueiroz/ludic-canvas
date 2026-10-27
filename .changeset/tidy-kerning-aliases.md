---
'ludic-canvas': patch
---

Preserve legacy kerning for all requested Unicode aliases of each source glyph,
including space and non-breaking space. Bound the expanded pair count before
writing output, and merge complete pairs into the generated atlas metrics.
