---
'ludic-canvas': minor
---

Add bubbling `onWheel` callbacks and the `UIWheelEvent` type to primitives and native text fields. Wheel input follows the frontmost input surface and its ancestors, so controls and blocking panels prevent wheel input from reaching unrelated surfaces behind them. Built-in nested scrolling and native textarea scrolling remain default actions that callbacks can cancel.

Add `UIRoot.isPointerOverUI({ clientX, clientY })` for application-owned camera and world input. The query uses painted, clipped geometry and respects disabled controls, pointer-event exclusions, modal isolation and root lifecycle without depending on hover state.
