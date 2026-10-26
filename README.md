# Ludic Canvas

React interfaces for browser games, powered by Yoga WebAssembly layout and WebGL rendering.

[Documentation](https://libraries.ludic-canvas.victorqueiroz.dev) · [Guide](https://libraries.ludic-canvas.victorqueiroz.dev/guide/) · [API reference](https://libraries.ludic-canvas.victorqueiroz.dev/api/)

Compose HUDs, menus and inventories with four typed primitives: **View**, **Text**, **Image** and **Line**. Use React state, effects and context while the renderer computes flexbox layout in WebAssembly and paints batched GPU primitives with crisp MSDF text.

## Install

The npm package includes JavaScript, TypeScript declarations, a precompiled Yoga reactor, a default OFL font atlas, the portable font atlas compiler and license notices.

```sh
npm install ludic-canvas@^0.2.0 react@19.3.1
```

Releases use the Changesets version-PR workflow described in [docs/RELEASING.md](docs/RELEASING.md).

## Font atlas CLI (0.2.0+)

The package includes a portable CLI:

```sh
npx ludic-canvas fonts --init
# Set the font source paths in ludic-canvas.fonts.json
npx ludic-canvas fonts --config ludic-canvas.fonts.json
```

```json
{
  "$schema": "https://libraries.ludic-canvas.victorqueiroz.dev/font-atlas.schema.json",
  "output": "public/fonts",
  "fonts": [
    {
      "name": "interface",
      "source": "fonts/Interface.woff2",
      "size": 48,
      "distanceRange": 6
    }
  ]
}
```

Inputs are single-face outline **TTF, OTF, WOFF and WOFF2** fonts, including variable
fonts configured with axis tags such as `"variations": { "wght": 600 }`.
Paths are relative to the configuration file. The CLI generates an MTSDF PNG,
JSON metrics and a cache manifest. Register the PNG/JSON through `createUI({ fonts })`.
No native compiler, external executable or network connection is needed after installation.

Add the CLI command to your project's `predev` and `prebuild` scripts to generate
only when inputs change. Use `--force` to rebuild. See the
[font CLI guide](https://libraries.ludic-canvas.victorqueiroz.dev/guide/#font-cli)
for character coverage, variable fonts and diagnostics.

## First interface

Give the canvas a nonzero CSS width and height inside a positioned parent. Then use automatic JSX compilation:

```tsx
import { createUI, View, Text } from 'ludic-canvas';

const ui = await createUI({ canvas });

ui.render(
  <View style={{ padding: 24, gap: 12 }}>
    <Text style={{ fontSize: 28 }}>Ready to play</Text>
    <View
      label="Start game"
      onPress={() => startGame()}
      style={{ padding: 16, background: '#526dff', borderRadius: 8 }}
    >
      <Text>Start game</Text>
    </View>
  </View>,
);

// On scene teardown:
ui.destroy();
```

## Playable integration example

[Orbital Relay](https://libraries.ludic-canvas.victorqueiroz.dev/play/) is a small courier game with a Canvas 2D world and a transparent Ludic Canvas HUD. It includes cargo collection and delivery, collisions, boost, pause and replay, a responsive manifest, and keyboard/touch controls.

The [example source](examples/orbital-relay) uses only public library exports. Its interface and mission modules each define a font family and a CLI configuration. The application root composes both `FontSource` values, keeps simulation state outside React, and drives `ui.frame(now)` from the game loop.

```sh
npm run fonts:game    # regenerate Oxanium and Space Mono atlases
npm run dev           # open /play/ or play inside the homepage
```

## Architecture

```text
React components and hooks
          ↓
Retained host tree + input
          ↓
Yoga 3.2.1 layout in WebAssembly
          ↓
Painter, animation and hit testing
          ↓
WebGL 1 batches + MSDF font atlases
```

The library owns layout, rendering, animation and input. Your application owns game state, simulation, persistence, audio and assets. Supply image URLs or a resolver, register font atlases, and customize theme tokens. No game schema, asset catalog or ECS is bundled.

Automatic drawing starts by default. For a game-owned loop, pass `autoStart: false` and call `ui.frame(now)` after the game renders. A transparent overlay canvas works independently of the game's renderer. Advanced WebGL 1 integrations may supply a shared context; the UI changes GL state and the engine must reset its state cache before its next pass.

## Development

Node 24 or newer:

```sh
npm ci
npm run dev           # documentation and interactive examples
npm run check         # types, real WASM/React tests, docs, distribution audit
npm run format:check
npx playwright install --with-deps
npm run test:browser  # Chromium, Firefox, WebKit and mobile emulation
npm pack              # installable release tarball
```

The documentation uses Vite and static HTML for crawlable guides and an API reference generated from emitted TypeScript declarations. Its live examples consume the built package's public exports.

Rebuild the optional native tools:

```sh
npm run toolchain -- --llvm /path/to/llvm
npm run wasm
npm run fontgen:wasm
npm run fonts:example
```

Yoga uses C++23, CMake 3.28+, raw Clang/LLVM and wasm-ld, with SHA-256-pinned Yoga and WASI toolchain downloads. Emscripten is not used. The portable font compiler builds pinned msdf-atlas-gen, FreeType and Brotli sources into a WASI command. Consumers run the included compiler with Node and do not need native tools.

## Publishing

Run `npm run changeset` for publishable behavior changes. Merges to `main` open or
update a version PR. Merging the version PR publishes through npm OIDC, with
provenance, after Linux/macOS/Windows checks pass. The workflow creates tags and
GitHub releases and skips versions already present on npm.

See [docs/RELEASING.md](docs/RELEASING.md) for the one-time npm ownership and trusted
publisher setup. No npm token is stored in GitHub secrets.

## Compatibility and scope

Ludic Canvas targets desktop and mobile browser games. React 19.3.1 is the tested peer version; react-reconciler 0.34.0 is pinned because its host API is unstable. The browser needs WebGL 1, WebAssembly SIMD/bulk-memory, createImageBitmap and Pointer Events.

The runtime supports captured pointer/key events, vertical wheel/touch scrolling, scoped hotkeys, modal focus scopes, spatial focus navigation, DOM control semantics, polite live announcements, text scaling and reduced motion. The mirror is a limited accessibility aid rather than a complete semantic document.

Text uses pre-baked glyphs and greedy wrapping. Complex-script shaping, kerning, editable canvas text, shared WebGL 2 contexts and native engine bindings are not implemented. Up to four font atlases are supported per root. See the [production review](PRODUCTION.md) and [support matrix](https://libraries.ludic-canvas.victorqueiroz.dev/guide/#production) for tested scope, release gates and remaining limits.

## License

MIT © Victor Queiroz. The bundled font uses the SIL Open Font License. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [licenses/](licenses/).

## 3D example project

[Play Kestrel Survey](https://libraries.ludic-canvas.victorqueiroz.dev/3d/) or run the [independent example project](examples/kestrel-survey). It combines a procedural Three.js world with a fully custom Ludic Canvas interface: projected site labels, mission cards, telemetry, minimap, camera controls, modal menus and a mobile site picker.

```sh
cd examples/kestrel-survey
npm install
npm run dev
```
