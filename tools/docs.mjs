import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const escape = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const code = (s) => `<pre><code>${escape(s.trim())}</code></pre>`;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const nav = (active) =>
  `<a class="brand" href="/"><span class="mark">lc</span> Ludic Canvas<span class="version">${version}</span></a><nav aria-label="Main navigation"><a ${active === 'home' ? 'aria-current="page"' : ''} href="/">Overview</a><a ${active === 'guide' ? 'aria-current="page"' : ''} href="/guide/">Guide</a><a ${active === 'api' ? 'aria-current="page"' : ''} href="/api/">API reference</a><a href="https://github.com/VictorQueiroz/ludic-canvas">GitHub <span aria-hidden="true">↗</span></a></nav>`;
const layout = (title, active, content, aside = '') =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Ludic Canvas</title><meta name="description" content="Build React interfaces for browser games with Yoga WebAssembly layout and WebGL rendering. Guides, interactive examples and a generated TypeScript API reference."><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="canonical" href="https://libraries.ludic-canvas.victorqueiroz.dev/${active === 'home' ? '' : active + '/'}"><link rel="stylesheet" href="/style.css"></head><body><a class="skip" href="#main">Skip to content</a><header>${nav(active)}</header>${aside ? `<div class="document-layout"><aside aria-label="On this page">${aside}</aside>` : ''}<main id="main" class="${active === 'home' ? 'home' : 'document'}">${content}</main>${aside ? '</div>' : ''}<footer><span>Made by <a href="https://github.com/VictorQueiroz">Victor Queiroz</a></span><span>MIT licensed · React 19 · WebGL 1 · Yoga WASM</span></footer>${active === 'home' ? '<script type="module" src="/main.tsx"></script>' : ''}</body></html>`;
const quickstart = `import { createUI, View, Text } from 'ludic-canvas';

const ui = await createUI({ canvas });
ui.render(
  <View style={{ padding: 24, gap: 12 }}>
    <Text style={{ fontSize: 28 }}>Ready to play</Text>
    <View onPress={() => startGame()} label="Start game"
      style={{ padding: 16, background: '#526dff', borderRadius: 8 }}>
      <Text>Start game</Text>
    </View>
  </View>,
);

// When leaving the scene:
ui.destroy();`;
const installation = `npm install https://github.com/VictorQueiroz/ludic-canvas/releases/download/v${version}/ludic-canvas-${version}.tgz react@19.3.1`;
const home = `<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="status-dot"></span> An interface layer for your next world</p><h1>React in.<br><span>Game UI out.</span></h1><p class="lead">Build menus, inventories and HUDs with familiar components. Let Yoga handle layout and WebGL handle the pixels.</p><div class="actions"><a class="button primary" href="/guide/">Start building <span>→</span></a><a class="button secondary" href="/api/">Explore the API</a></div><p class="hero-note">TypeScript first. Engine independent. Yours to style.</p></div><div class="hero-system" aria-label="Architecture: React components flow into Yoga WASM layout, then WebGL rendering"><div class="orbit"></div><div class="system-title">THE RENDERING PIPELINE <span>01—03</span></div><div class="pipeline-step"><span class="step-number">01</span><div><strong>Compose</strong><span>React components & hooks</span></div><b>tsx</b></div><div class="pipeline-wire"></div><div class="pipeline-step"><span class="step-number">02</span><div><strong>Arrange</strong><span>Yoga flexbox in WebAssembly</span></div><b>wasm</b></div><div class="pipeline-wire"></div><div class="pipeline-step"><span class="step-number">03</span><div><strong>Draw</strong><span>Batched primitives & MSDF text</span></div><b>gl</b></div><div class="system-foot"><span>Retained tree</span><span>One canvas. Your loop.</span></div></div></section><div class="feature-strip"><span><b>04</b> typed primitives</span><span><b>CSS-like</b> flex layout</span><span><b>MSDF</b> crisp text</span><span><b>DOM</b> keyboard mirror</span></div><section class="playground" id="playground"><div class="section-heading"><div><p class="eyebrow">A working interface, not a screenshot</p><h2>Give it a try.</h2></div><p>Every panel below is rendered by the library.<br>Click the canvas, or Tab into its controls.</p></div><div class="demo-shell"><div class="demo-toolbar"><div role="group" aria-label="Example"><button class="example-tab active" data-example="hud" aria-pressed="true">Tactical HUD</button><button class="example-tab" data-example="menu" aria-pressed="false">Pause menu</button><button class="example-tab" data-example="inventory" aria-pressed="false">Inventory</button></div><span class="demo-indicator"><span class="status-dot"></span> LIVE WEBGL</span></div><div class="canvas-wrap"><canvas id="demo" aria-label="Interactive UI example"></canvas><p id="demo-status" role="status">Loading the renderer…</p></div><div class="demo-bottom"><span>React → Yoga → WebGL</span><label><input id="motion" type="checkbox"> Reduce motion</label><span id="frame-stats">Initializing</span></div></div></section><section class="principles"><article><span class="card-number">01 / COMPOSITION</span><h3>The React you know.</h3><p>State, effects, context and reusable components. Four primitives become the building blocks of your visual language.</p></article><article><span class="card-number">02 / CONTROL</span><h3>Make it your own.</h3><p>Supply image URLs or an asset catalog. Register your own font atlases, change theme tokens, and drive frames from your game loop.</p></article><article><span class="card-number">03 / INTEGRATION</span><h3>A small boundary.</h3><p>Your simulation owns game state. The interface reads snapshots and calls actions. Use a transparent canvas overlay or draw into a WebGL 1 context.</p></article></section><section class="start-section"><div><p class="eyebrow">From a canvas to an interface</p><h2>A few lines.<br>A world of possibilities.</h2><p>Start with the included font and layout module. Add your game’s identity through composition, assets and style.</p><a class="text-link" href="/guide/">Read the integration guide →</a></div>${code(quickstart)}</section><section class="scope-note"><h3>A focused first release.</h3><p>Version ${version} targets browser games with React 19.3.1 and WebGL 1. It supports menus, HUDs and inventories. Text uses pre-baked glyph atlases and greedy wrapping; complex-script shaping, editable text, controller navigation and native engine bindings are future work. The accessibility mirror covers pressable controls and live announcements, not full document semantics.</p></section>`;
const guideSections = [
  [
    'start',
    'Getting started',
    `<p>Ludic Canvas is an ESM TypeScript library for browser game interfaces. It uses React 19.3.1, a custom reconciler, Yoga 3.2.1 compiled with raw Clang/LLVM, and WebGL 1. Consumers use the included compiled assets; CMake and LLVM are only needed to rebuild the native module.</p><h3>Install the release package</h3>${code(installation)}<p>This URL installs the GitHub release tarball, including JavaScript, TypeScript declarations, the layout module and a default font atlas. No npm registry release is required. Use a bundler such as Vite with its automatic React JSX transform.</p><h3>Give the canvas a size</h3>${code(`<div style="position:relative;width:100%;height:480px">
  <canvas id="ui" style="display:block;width:100%;height:100%"></canvas>
</div>`)}<p>The root measures CSS dimensions. The canvas parent should contain only the game view and its UI overlay; an accessibility mirror is positioned relative to it. Avoid CSS transforms that scale or rotate the canvas. If you manage a different layout, supply your own aligned <code>accessibilityContainer</code>.</p>${code(`const canvas = document.querySelector<HTMLCanvasElement>('#ui')!;
${quickstart}`)}`,
  ],
  [
    'architecture',
    'Architecture',
    `<div class="architecture-line"><b>React</b><span>→</span><b>Retained nodes</b><span>→</span><b>Yoga WASM</b><span>→</span><b>WebGL</b></div><p>The React reconciler owns a retained host tree. Each host node owns a Yoga layout node. After layout, boxes are read in one batch from WebAssembly memory. The painter traverses the tree, animates visual values and sends primitive quads to a WebGL batch. Pointer input hit-tests the most recently painted frame. A separate DOM mirror provides keyboard controls.</p><p>The package owns UI infrastructure. Applications own domain models, state, persistence, audio, scene effects and asset catalogs. Feed immutable view data into components and pass actions back to the simulation. The library has no game-state schema or ECS dependency.</p><p>The native layout ABI is versioned and checked at load. The custom React host config is kept internal and paired with an exact supported React version because <a href="https://github.com/facebook/react/tree/main/packages/react-reconciler">react-reconciler has an unstable API</a>.</p>`,
  ],
  [
    'primitives',
    'Compose primitives',
    `<p><code>View</code> lays out and paints panels, gradients, borders, glows and fill meters. <code>Text</code> measures and draws MSDF glyphs. <code>Image</code> loads raster images or rasterizes SVGs with cover/contain/fill fitting. <code>Line</code> draws solid or marching dashed connections.</p>${code(`<View style={{ flexDirection: 'row', gap: 16, padding: 20 }}>
  <Image src="portrait" style={{ width: 72, height: 72, borderRadius: 12 }} />
  <View style={{ flex: 1, gap: 8 }}>
    <Text style={{ fontSize: 24 }}>Pilot</Text>
    <View fill={0.7} fillColor="#72dfbb" transition={200}
      style={{ height: 8, background: '#243247', borderRadius: 4 }} />
  </View>
</View>`)}<p>Use ordinary React components and hooks to compose buttons, panels and screens. Host refs expose internal nodes and are not part of the supported public API. Plain strings belong inside <code>Text</code>. Images are referenced through their <code>src</code> property.</p>`,
  ],
  [
    'layout',
    'Layout & styling',
    `<p>Layout follows Yoga flexbox, rather than browser CSS. Dimensions accept numbers in CSS pixels, percentage strings and <code>'auto'</code>. Supported properties include flex direction, alignment, wrapping, grow/shrink, absolute positioning, min/max size, margin, padding and gap. The default direction is a column. See <a href="/api/#LayoutStyle">LayoutStyle</a> for the complete supported surface.</p><p>Colors currently accept hexadecimal strings (<code>#rgb</code>, <code>#rrggbb</code>, <code>#rrggbbaa</code>) and <code>rgb()</code>/<code>rgba()</code>. Named colors and CSS variables are not supported. Text style is set on each Text node and does not inherit from View. There is no browser cascade.</p><p>Use <code>overflow: 'hidden'</code> for rectangular scissor clipping and <code>overflow: 'scroll'</code> for vertical wheel/touch scrolling. Border radius rounds a node's own background and images; child clipping remains rectangular. Visual transforms and scissor clips have limited nesting support, so use layout for interactive positioning. <code>zIndex</code> controls sibling paint order.</p><p><code>onLayout</code> is queued after layout and reports the local box in CSS pixels. Avoid feedback loops that continuously resize the same node. <code>transition</code> and <code>enter</code> durations are milliseconds; line animation speed uses pixels per second.</p>`,
  ],
  [
    'assets',
    'Images & fonts',
    `${code(`const ui = await createUI({
  canvas,
  assets: {
    portrait: { url: '/images/pilot.webp' },
    emblem: { url: '/images/emblem.svg', kind: 'vector', width: 128, height: 128 },
  },
  fonts: [
    { name: 'interface', atlas: '/fonts/interface.png', metrics: '/fonts/interface.json' },
  ],
});
await ui.preloadImages(['portrait', 'emblem']);`)}<p>Omit <code>assets</code> to use image URLs directly. Alternatively pass a resolver function that maps an identifier to image metadata. Unknown catalog identifiers render no image; explicit preloading rejects unknown identifiers. Failed requests call <code>onError</code> and cause preloads to reject. Failed cache entries stay failed until you recreate the root. Assets must be immutable for a root's lifetime. Fetches and decoded uploads are root-owned and disposed when it is destroyed.</p><p>Register one to four MSDF/MTSDF font faces; the first face is the default. Choose a face with <code>fontFamily</code>. Each atlas needs a fallback question-mark glyph. Atlas JSON must use top-origin coordinates and the msdf-atlas-gen metrics schema. Glyphs absent from the atlas fall back to <code>?</code>. The included face covers Latin-1 and selected punctuation. There is no kerning, bidi, ligature shaping or emoji fallback in this release.</p><p>Run <code>npm run fonts</code> in the repository to build the pinned msdf-atlas-gen tool and bake <code>tools/fontgen/faces.json</code>. Font baking requires CMake, a native C++ compiler, FreeType and libpng. It is separate from the browser and documentation build. Font licenses remain with their fonts.</p><p>The texture budget is a soft LRU budget. Recently visible textures remain resident even if they exceed it. SVGs are quantized and rasterized at the requested pixel size. Cross-origin image and font URLs require CORS headers.</p>`,
  ],
  [
    'integration',
    'Game-loop integration',
    `${code(`const ui = await createUI({ canvas: overlayCanvas, autoStart: false });
ui.render(<Hud snapshot={game.snapshot()} onPause={() => game.pause()} />);

function tick(now: number) {
  game.update(now);
  game.draw();
  ui.frame(now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);`)}<p>A transparent overlay canvas is the simplest integration with any browser rendering engine: give the world and UI separate canvases in the same positioned container. For shared rendering, pass a WebGL 1 <code>context</code> and call <code>frame()</code> after the game pass. Canvas dimensions remain engine-owned by default when a context is supplied.</p><p>The UI binds the default framebuffer and changes viewport, buffers, shaders, texture bindings, vertex attributes, blending and depth/cull/scissor state. It does not snapshot or restore the engine's GL state. Reset or invalidate your engine's state cache before its next draw. Shared WebGL 2 contexts and rendering to an engine framebuffer are not supported. An overlay canvas is the supported route for engines using WebGL 2, WebGPU or other renderers.</p><p>New React renders commit asynchronously. Re-render after game state changes; do not re-render solely to advance animations. Call <code>stop()</code> to pause automatic frames and <code>destroy()</code> when leaving a scene. Destroying is idempotent and allows the same canvas to be mounted again.</p>`,
  ],
  [
    'input',
    'Input & accessibility',
    `<p>Use <code>onPress</code>, <code>onHover</code>, <code>hoverStyle</code>, <code>pressStyle</code>, <code>disabled</code> and <code>hotkey</code> on primitives. Give every pressable a meaningful <code>label</code>; descendant text supplies a fallback. Pointer input, vertical wheel scrolling and touch drags are supported. Canvas hotkeys activate only while that canvas or one of its mirrored controls has focus, so roots do not steal each other's keys.</p><p>Each painted pressable is mirrored by an invisible DOM button in paint order. Tab moves between buttons and Enter/Space activates them; focus is drawn in the canvas. Canvas focus itself enables scoped hotkeys. Set <code>announce</code> on Text to publish its changed content to a polite live region.</p><p>This is a limited control mirror, not complete accessibility semantics. It does not expose all static canvas text as a document, trap focus in modals, support editable text or provide gamepad navigation. Validate the complete interface with keyboard users and assistive technology. Provide a separate DOM interface where richer semantics are needed.</p><p>Reduced motion initially follows the browser preference; <code>setReducedMotion(true)</code> disables enter transitions, tweens, hover interpolation, glow pulses, breathing and marching-line motion. <code>setTextScale()</code> changes both text measurement and drawing. Dynamic system preference changes require the application to call the setter.</p>`,
  ],
  [
    'build',
    'Build, verify & contribute',
    `${code(`git clone https://github.com/VictorQueiroz/ludic-canvas.git
cd ludic-canvas
npm ci
npm run dev
npm run check

# Optional: rebuild Yoga with raw Clang/LLVM (no Emscripten)
npm run toolchain -- --llvm /path/to/llvm
npm run wasm

# Build the distributable package
npm pack`)}<p>Node 24 or newer is required for repository tooling. The native build needs CMake 3.28+, LLVM with wasm32 and wasm-ld. The bootstrap downloads SHA-256-pinned WASI sysroot and compiler-rt inputs. Yoga sources are pinned by version and hash. The committed layout module lets consumers and Vercel build without the native toolchain.</p><p>The public repository uses a fresh history and contains the library, generic examples, font notices and reproducible build sources. The API reference is generated from emitted TypeScript declarations during every documentation build. Run <code>npm run check</code> before a release. The Vercel project builds <code>npm run docs:build</code> and serves <code>site/</code> from the repository root.</p><p>Compatibility: React 19.3.1 is the tested peer version; react-reconciler 0.34.0 is pinned. Browser requirements include WebAssembly SIMD/bulk-memory, WebGL 1, createImageBitmap and Pointer Events. Browser integration tests cover the development browser; native engine bindings and wider device certification are outside this release.</p>`,
  ],
];
const guide =
  `<p class="eyebrow">DOCUMENTATION / VERSION ${version}</p><h1>Build the interface.<br>Keep your engine.</h1><p class="lead">A practical guide from the first component to a game-driven rendering loop.</p>` +
  guideSections.map(([id, title, body]) => `<section id="${id}"><h2>${title}</h2>${body}</section>`).join('');
const publicNames = new Set();
for (const match of readFileSync('dist/index.d.ts', 'utf8').matchAll(/\{([^}]+)\}/g))
  for (const name of match[1].split(',')) if (name.trim()) publicNames.add(name.trim().replace(/^type\s+/, ''));
const entries = [];
for (const file of ['root', 'primitives', 'assets', 'defaults', 'runtime/types', 'gfx/font']) {
  const source = readFileSync(`dist/${file}.d.ts`, 'utf8');
  const matches = [...source.matchAll(/^(?:export )?(?:declare )?(?:interface|type|const|function)\s+(\w+)/gm)];
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index],
      next = matches[index + 1];
    if (!publicNames.has(match[1])) continue;
    let end = next?.index ?? source.length;
    const nextDoc = source.lastIndexOf('/**', end);
    if (nextDoc > match.index && /^\/\*\*[\s\S]*?\*\/\s*$/.test(source.slice(nextDoc, end))) end = nextDoc;
    let start = match.index;
    const previousDoc = source.lastIndexOf('/**', start);
    if (previousDoc >= 0 && /^\/\*\*[\s\S]*?\*\/\s*$/.test(source.slice(previousDoc, start))) start = previousDoc;
    let declaration = source
      .slice(start, end)
      .trim()
      .replace(/export \{\};\s*$/, '')
      .replace(/^export type \{[^}]*\} from [^;]+;\s*$/gm, '')
      .trim();
    if (match[1] === 'AtlasJson')
      declaration = 'interface Bounds { left: number; top: number; right: number; bottom: number; }\n\n' + declaration;
    entries.push({ name: match[1], declaration });
  }
}
for (const name of publicNames)
  if (!entries.some((entry) => entry.name === name)) throw new Error(`Undocumented public export: ${name}`);
const api = `<p class="eyebrow">REFERENCE / GENERATED FROM TYPESCRIPT</p><h1>The public API.</h1><p class="lead">Exact signatures, types and property documentation for version ${version}.</p><p>Generated from package declarations. Optional properties use <code>?</code>. Dimensions use CSS pixels unless stated otherwise. Import these symbols from <code>ludic-canvas</code>. ReactNode and ComponentType refer to the standard React types. FontName is a string identifying one of your registered faces. Internal renderer, layout and GPU classes are intentionally private.</p>${entries.map(({ name, declaration }) => `<section id="${name}" class="api-entry"><h2>${name}<a class="anchor" href="#${name}" aria-label="Link to ${name}">#</a></h2>${code(declaration)}</section>`).join('')}`;
for (const [path, html] of [
  ['docs/index.html', layout('React interfaces for browser games', 'home', home)],
  [
    'docs/guide/index.html',
    layout(
      'Guide',
      'guide',
      guide,
      '<span class="aside-title">IN THIS GUIDE</span>' +
        guideSections.map(([id, title]) => `<a href="#${id}">${title}</a>`).join(''),
    ),
  ],
  [
    'docs/api/index.html',
    layout(
      'API reference',
      'api',
      api,
      '<span class="aside-title">PUBLIC EXPORTS</span>' +
        entries.map(({ name }) => `<a href="#${name}">${name}</a>`).join(''),
    ),
  ],
]) {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  writeFileSync(path, html + '\n');
}
writeFileSync(
  'docs/public/robots.txt',
  'User-agent: *\nAllow: /\nSitemap: https://libraries.ludic-canvas.victorqueiroz.dev/sitemap.xml\n',
);
writeFileSync(
  'docs/public/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    ['', 'guide/', 'api/']
      .map((path) => `<url><loc>https://libraries.ludic-canvas.victorqueiroz.dev/${path}</loc></url>`)
      .join('') +
    '</urlset>\n',
);
writeFileSync(
  'docs/public/llms.txt',
  `# Ludic Canvas\n\nReact UI for browser games, using Yoga WASM and WebGL 1.\n\n- [Guide](https://libraries.ludic-canvas.victorqueiroz.dev/guide/)\n- [API](https://libraries.ludic-canvas.victorqueiroz.dev/api/)\n- [Source](https://github.com/VictorQueiroz/ludic-canvas)\n`,
);
console.log(`Generated documentation for ${entries.length} public exports`);
