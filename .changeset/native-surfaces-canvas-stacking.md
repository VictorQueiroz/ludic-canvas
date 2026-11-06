---
'ludic-canvas': patch
---

Keep root-owned native scroll and editor surfaces above their canvas when its CSS
z-index changes. This fixes obscured Collection dialog contents and regional
archive rows in Kestrel Survey.
