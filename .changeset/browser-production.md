---
'ludic-canvas': minor
---

Harden browser rendering and resource ownership with context-loss recovery, abortable initialization, bounded assets, validated font metrics and corrected shared-context alpha/VAO handling. Add modal focus scopes, captured pointer/key events, semantic control state, spatial focus navigation and image invalidation. Fix inherited scale, scroll padding, fractional text wrapping and long-token truncation. Bound font compilation in a worker, serialize output writers, and add cross-browser regression coverage and production integration documentation.

The layout reactor ABI is now version 2 to expose computed scroll padding. Default assets update automatically; applications supplying a custom layout module must replace it with the module from this package or rebuild their bridge.
