---
'ludic-canvas': minor
---

Add unstyled, controlled Button, Switch, Slider, Tab, Tabs, Dialog and ScrollArea components, plus a root-scoped useUIRoot hook. Tabs support roving focus and disabled-item skipping; sliders support pointer cancellation, snapping and keyboard adjustment. Named dialog, tab-list and scroll-region semantics are mirrored into the accessibility surface. Nested dialogs now restore each scope's own trigger when closed.

Add `ludic-canvas init [directory] --template canvas2d|three`. Each starter includes a licensed font, automatic atlas generation, application-owned simulation/frame loop, responsive sizing and resource teardown. The initializer preserves existing projects and does not install dependencies automatically.
