---
'ludic-canvas': minor
---

Extract platform-independent layout, drawing, input and host contracts into `ludic-canvas/core`. Add a command renderer and headless host, and an experimental `ludic-canvas/native` entry point for the repository's Hermes/Yoga/Skia macOS proof. Existing browser applications keep the WebGL and DOM editor adapters.

Preserve owned-resource cleanup when portable scheduling fails, restore native canvas state after rejected commands, and report native callback/startup errors without allowing JavaScript exceptions to outlive Hermes.
