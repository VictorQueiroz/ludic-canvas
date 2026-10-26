# Ludic Canvas

React interfaces for browser games, powered by Yoga WebAssembly layout and WebGL rendering.

[Documentation](https://libraries.ludic-canvas.victorqueiroz.dev) · [Guide](https://libraries.ludic-canvas.victorqueiroz.dev/guide/) · [API reference](https://libraries.ludic-canvas.victorqueiroz.dev/api/)

Compose HUDs, menus and inventories with four typed primitives: **View**, **Text**, **Image** and **Line**. Use React state, effects and context while the renderer computes flexbox layout in WebAssembly and paints batched GPU primitives with crisp MSDF text.

## Install

The GitHub release includes JavaScript, TypeScript declarations, a precompiled Yoga reactor, a default OFL font atlas and license notices.

```sh
npm install https://github.com/VictorQueiroz/ludic-canvas/releases/download/v0.1.0/ludic-canvas-0.1.0.tgz react@19.3.1
```

The package is distributed through GitHub Releases. It is not currently published to the npm registry.

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
npm pack              # installable release tarball
```

The documentation uses Vite and static HTML for crawlable guides and an API reference generated from emitted TypeScript declarations. Its live examples consume the built package's public exports.

Rebuild the optional native tools:

```sh
npm run toolchain -- --llvm /path/to/llvm
npm run wasm
npm run fonts
```

Yoga uses C++23, CMake 3.28+, raw Clang/LLVM and wasm-ld, with SHA-256-pinned Yoga and WASI toolchain downloads. Emscripten is not used. The font tool builds pinned msdf-atlas-gen sources against FreeType and libpng. Consumers do not need these tools.

## Compatibility and scope

Version 0.1 targets browser games. React 19.3.1 is the tested peer version; react-reconciler 0.34.0 is pinned because its host API is unstable. The browser needs WebGL 1, WebAssembly SIMD/bulk-memory, createImageBitmap and Pointer Events.

The first release supports pointer input, vertical wheel/touch scrolling, scoped hotkeys, DOM button mirrors for keyboard access, polite live announcements, text scaling and reduced motion. The mirror is a limited accessibility aid rather than a complete semantic document.

Text uses pre-baked glyphs and greedy wrapping. Complex-script shaping, kerning, editable text, controller navigation, shared WebGL 2 contexts and native engine bindings are not implemented. Up to four font atlases are supported per root. See the guide for clipping, transform and shared-context limitations.

## License

MIT © Victor Queiroz. The bundled font uses the SIL Open Font License. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [licenses/](licenses/).
