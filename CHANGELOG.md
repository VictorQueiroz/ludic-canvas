# ludic-canvas

## 0.3.0

### Minor Changes

- 5087564: Harden browser rendering and resource ownership with context-loss recovery, abortable initialization, bounded assets, validated font metrics and corrected shared-context alpha/VAO handling. Add modal focus scopes, captured pointer/key events, semantic control state, spatial focus navigation and image invalidation. Fix inherited scale, scroll padding, fractional text wrapping and long-token truncation. Bound font compilation in a worker, serialize output writers, and add cross-browser regression coverage and production integration documentation.

  The layout reactor ABI is now version 2 to expose computed scroll padding. Default assets update automatically; applications supplying a custom layout module must replace it with the module from this package or rebuild their bridge.

## 0.2.0

### Minor Changes

- 81204f7: Add a portable, configuration-driven font atlas CLI. Generate MTSDF PNG atlases and JSON metrics from outline TTF, OTF, WOFF and WOFF2 files using the bundled WASI compiler, with variable-font axes, input/output caching, configuration validation, a JSON schema and useful diagnostics. No native compiler, external executable or network access is required when running the CLI.

  Configure public npm releases through Changesets version pull requests and GitHub Actions trusted publishing.
