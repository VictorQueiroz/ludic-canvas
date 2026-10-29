import { editingGuide } from './docs-editing.mjs';
import { typographyGuide } from './docs-typography.mjs';
import { virtualizationGuide } from './docs-virtualization.mjs';
import { performancePage } from './docs-performance.mjs';
import { surveyPage } from './docs-3d.mjs';
import { playPage } from './docs-play.mjs';
import { componentsPage } from './docs-components.mjs';
import { productionGuide, controlRecipes } from './docs-production.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { createCodeRenderer } from './docs-code.mjs';
import { gettingStarted, projectInit, troubleshooting } from './docs-guide.mjs';

const { code, dispose } = await createCodeRenderer();
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
mkdirSync('docs/public', { recursive: true });
writeFileSync('docs/public/font-atlas.schema.json', readFileSync('font-atlas.schema.json'));
const nav = (active) =>
  `<a class="brand" href="/"><span class="mark">lc</span> Ludic Canvas<span class="version">${version}</span></a><nav aria-label="Main navigation"><a ${active === 'home' ? 'aria-current="page"' : ''} href="/">Overview</a><a ${active === 'guide' ? 'aria-current="page"' : ''} href="/guide/">Guide</a><a ${active === 'components' ? 'aria-current="page"' : ''} href="/components/">Components</a><a ${active === 'api' ? 'aria-current="page"' : ''} href="/api/">API reference</a><a ${active === 'play' ? 'aria-current="page"' : ''} href="/play/">Play</a><a ${active === 'performance' ? 'aria-current="page"' : ''} href="/performance/">Performance</a><a href="https://github.com/VictorQueiroz/ludic-canvas">GitHub <span aria-hidden="true">↗</span></a></nav>`;
const routes = {
  home: { path: '', main: 'home', script: '/main.tsx' },
  guide: { path: 'guide/' },
  api: { path: 'api/' },
  components: {
    path: 'components/',
    main: 'components-document',
    styles: ['/components/style.css'],
    script: '/components/main.tsx',
  },
  performance: {
    path: 'performance/',
    main: 'performance-document',
    styles: ['/performance/style.css'],
    script: '/performance/main.ts',
  },
  play: { path: 'play/', main: 'play-document', styles: ['/play/gallery.css'], script: '/play/gallery.ts' },
  orbital: {
    path: 'play/orbital-relay/',
    main: 'game-document',
    styles: ['/play/game.css'],
    script: '/play/main.tsx',
    game: true,
    nav: 'play',
  },
  '3d': {
    path: '3d/',
    main: 'game-document survey-document',
    styles: ['/play/game.css', '/3d/scene.css'],
    script: '/3d/main.ts',
    game: true,
    nav: 'play',
  },
};
const layout = (title, active, content, aside = '') => {
  const route = routes[active];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Ludic Canvas</title><meta name="description" content="Build React interfaces for browser games with Yoga WebAssembly layout and WebGL rendering. Guides, interactive examples and a generated TypeScript API reference."><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="canonical" href="https://libraries.ludic-canvas.victorqueiroz.dev/${route.path}"><link rel="stylesheet" href="/style.css">${(route.styles ?? []).map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body class="${route.game ? 'game-page' : ''}"><a class="skip" href="#main">Skip to content</a><header>${nav(route.nav ?? active)}</header>${aside ? `<div class="document-layout"><aside aria-label="On this page"><details class="page-toc" open><summary>On this page</summary><div>${aside}</div></details></aside>` : ''}<main id="main" class="${route.main ?? 'document'}">${content}</main>${aside ? '</div>' : ''}<footer><span>Made by <a href="https://github.com/VictorQueiroz">Victor Queiroz</a></span><span>MIT licensed · React 19 · WebGL 1 · Yoga WASM</span></footer><script type="module" src="/enhance.ts"></script>${route.script ? `<script type="module" src="${route.script}"></script>` : ''}</body></html>`;
};
const quickstart = `import { createUI, View, Text } from 'ludic-canvas';

const ui = await createUI({ canvas });
ui.render(
  <View style={{ padding: 24, gap: 12 }}>
    <Text style={{ fontSize: 28 }}>Ready to play</Text>
    <View onPress={() => console.log('Start game')} label="Start game"
      style={{ padding: 16, background: '#526dff', borderRadius: 8 }}>
      <Text>Start game</Text>
    </View>
  </View>,
);

// Call ui.destroy() when this scene leaves.`;
const surveyCallout =
  '<section class="three-example-callout"><div><p class="eyebrow">NEW / THREE.JS + LUDIC CANVAS</p><h3>A small rover. A whole new dimension.</h3><p>Explore Kestrel Survey: a procedural 3D world with a completely custom interface.</p></div><a class="button secondary" href="/play/?example=kestrel-survey">Play the 3D example →</a></section>';
const gameShowcase =
  '<section class="game-showcase" id="game"><div class="section-heading"><div><p class="eyebrow">A complete game. A small integration.</p><h2>Your cargo. Your call.</h2></div><p>Fly a courier through a drifting debris belt.<br>Every HUD panel, label and control uses Ludic Canvas.</p></div><div class="game-embed"><iframe src="/play/orbital-relay/?embed=1" title="Orbital Relay: a playable Ludic Canvas mini game" loading="lazy"></iframe></div><div class="game-showcase-foot"><p>Canvas 2D world + WebGL UI. Two font families. Responsive panels.</p><a class="text-link" href="/play/">Open the game &amp; integration notes →</a></div></section>';
const home = `<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="status-dot"></span> An interface layer for your next world</p><h1>React in.<br><span>Game UI out.</span></h1><p class="lead">Build menus, inventories and HUDs with familiar components. Let Yoga handle layout and WebGL handle the pixels.</p><div class="actions"><a class="button primary" href="/guide/">Start building <span>→</span></a><a class="button secondary" href="/api/">Explore the API</a></div><p class="hero-note">TypeScript first. Engine independent. Yours to style.</p></div><div class="hero-system" aria-label="Architecture: React components flow into Yoga WASM layout, then WebGL rendering"><div class="orbit"></div><div class="system-title">THE RENDERING PIPELINE <span>01—03</span></div><div class="pipeline-step"><span class="step-number">01</span><div><strong>Compose</strong><span>React components & hooks</span></div><b>tsx</b></div><div class="pipeline-wire"></div><div class="pipeline-step"><span class="step-number">02</span><div><strong>Arrange</strong><span>Yoga flexbox in WebAssembly</span></div><b>wasm</b></div><div class="pipeline-wire"></div><div class="pipeline-step"><span class="step-number">03</span><div><strong>Draw</strong><span>Batched primitives & MSDF text</span></div><b>gl</b></div><div class="system-foot"><span>Retained tree</span><span>One canvas. Your loop.</span></div></div></section><div class="feature-strip"><span><b>04</b> typed primitives</span><span><b>CSS-like</b> flex layout</span><span><b>MSDF</b> crisp text</span><span><b>DOM</b> keyboard mirror</span></div>${gameShowcase}${surveyCallout}<section class="playground" id="playground"><div class="section-heading"><div><p class="eyebrow">A working interface, not a screenshot</p><h2>Give it a try.</h2></div><p>Every panel below is rendered by the library.<br>Click the canvas, or Tab into its controls.</p></div><div class="demo-shell"><div class="demo-toolbar"><div role="group" aria-label="Example"><button class="example-tab active" data-example="hud" aria-pressed="true">Tactical HUD</button><button class="example-tab" data-example="menu" aria-pressed="false">Pause menu</button><button class="example-tab" data-example="inventory" aria-pressed="false">Inventory</button></div><span class="demo-indicator"><span class="status-dot"></span> LIVE WEBGL</span></div><div class="canvas-wrap"><canvas id="demo" aria-label="Interactive UI example"></canvas><p id="demo-status" role="status">Loading the renderer…</p></div><div class="demo-bottom"><span>React → Yoga → WebGL</span><label><input id="motion" type="checkbox"> Reduce motion</label><span id="frame-stats">Initializing</span></div></div></section><section class="principles"><article><span class="card-number">01 / COMPOSITION</span><h3>The React you know.</h3><p>State, effects, context and reusable components. Four primitives become the building blocks of your visual language.</p></article><article><span class="card-number">02 / CONTROL</span><h3>Make it your own.</h3><p>Supply image URLs or an asset catalog. Register your own font atlases, change theme tokens, and drive frames from your game loop.</p></article><article><span class="card-number">03 / INTEGRATION</span><h3>A small boundary.</h3><p>Your simulation owns game state. The interface reads snapshots and calls actions. Use a transparent canvas overlay or draw into a WebGL 1 context.</p></article></section><section class="start-section"><div><p class="eyebrow">From a canvas to an interface</p><h2>A few lines.<br>A world of possibilities.</h2><p>Start with the included font and layout module. Add your game’s identity through composition, assets and style.</p><a class="text-link" href="/guide/">Read the integration guide →</a></div>${code(quickstart)}</section><section class="scope-note"><h3>A focused browser interface layer.</h3><p>Version ${version} targets browser games with React 19.3.1 and WebGL 1. It supports menus, HUDs and inventories. Text uses pre-baked glyph atlases and greedy wrapping; complex-script shaping, editable canvas text and native engine bindings remain outside the current renderer. Controller adapters can use the root’s focus navigation methods. The accessibility mirror covers pressable controls and live announcements, not full document semantics. Read the <a href="/guide/#production">production support matrix</a> before choosing it for a project.</p></section>`;
const guideSections = [
  ['project-init', 'Generate a game project', projectInit(code, version)],
  ['start', 'Your first interface', gettingStarted(code, version)],
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
    `<p>Layout follows Yoga flexbox, rather than browser CSS. Dimensions accept numbers in CSS pixels, percentage strings and <code>'auto'</code>. Supported properties include flex direction, alignment, wrapping, grow/shrink, absolute positioning, min/max size, margin, padding and gap. The default direction is a column. See <a href="/api/#LayoutStyle">LayoutStyle</a> for the complete supported surface.</p><p>Colors currently accept hexadecimal strings (<code>#rgb</code>, <code>#rrggbb</code>, <code>#rrggbbaa</code>) and <code>rgb()</code>/<code>rgba()</code>. Named colors and CSS variables are not supported. Text style is set on each Text node and does not inherit from View. There is no browser cascade.</p><p>Use <code>overflow: 'hidden'</code> for rectangular scissor clipping and <code>overflow: 'scroll'</code> for vertical wheel/touch scrolling. Border radius rounds a node's own background and images; child clipping remains rectangular. Scale and translation propagate through descendants; visual transforms do not reflow Yoga layout. Clips remain axis-aligned. <code>zIndex</code> controls sibling paint order.</p><p><code>onLayout</code> is queued after layout and reports the local box in CSS pixels. Avoid feedback loops that continuously resize the same node. <code>transition</code> and <code>enter</code> durations are milliseconds; line animation speed uses pixels per second.</p>`,
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
await ui.preloadImages(['portrait', 'emblem']);`)}<p>Omit <code>assets</code> to use image URLs directly. Alternatively pass a resolver function that maps an identifier to image metadata. Unknown catalog identifiers render no image; explicit preloading rejects unknown identifiers. Failed requests call <code>onError</code> and cause preloads to reject. Clear failed or changed entries with <code>invalidateImages(ids)</code> before retrying or loading replacement content. Fetches and decoded uploads are root-owned and disposed when it is destroyed.</p>${typographyGuide(code)}<p>Generate custom atlases with the <a href="#font-cli">packaged font CLI</a>. It uses the bundled WASI compiler and works without CMake, FreeType installation, native executables or network access. Font licenses remain with their fonts. Native tools are needed only to rebuild the compiler itself.</p><p>The texture budget is a soft LRU budget. Recently visible textures remain resident even if they exceed it. SVGs are quantized and rasterized at the requested pixel size. Cross-origin image and font URLs require CORS headers.</p>`,
  ],
  [
    'font-cli',
    'Font atlas CLI',
    `${version === '0.1.0' ? '<p><strong>Upcoming in 0.2.0:</strong> the published 0.1.0 GitHub package does not include this CLI. The implementation is on main and its minor Changesets release is pending. To use it before publication, clone the repository, run npm ci and npm pack, and install that local tarball.</p>' : ''}
<p>The installed package exposes <code>ludic-canvas fonts</code>. Node 24+ runs a bundled, offline WebAssembly compiler containing FreeType, Brotli and msdf-atlas-gen. TTF, OpenType CFF/OTF, WOFF and WOFF2 outline fonts are supported; collections and bitmap-only fonts are outside this release.</p>
<h3>1. Create a configuration</h3>${code('npx ludic-canvas fonts --init', 'bash', 'Terminal')}
<p>Edit <code>ludic-canvas.fonts.json</code> and set your font paths. Every path is relative to this configuration file.</p>${code(
      JSON.stringify(
        {
          $schema: 'https://libraries.ludic-canvas.victorqueiroz.dev/font-atlas.schema.json',
          output: 'public/fonts',
          charset: '[0x20, 0x7E]',
          fonts: [
            { name: 'interface', source: 'fonts/Interface.woff2', size: 48, distanceRange: 6, characters: 'áéíóúçãõ…' },
          ],
        },
        null,
        2,
      ),
      'json',
      'ludic-canvas.fonts.json',
    )}
<h3>2. Generate and register</h3>${code('npx ludic-canvas fonts --config ludic-canvas.fonts.json', 'bash', 'Terminal')}
<p>This creates <code>interface.png</code>, <code>interface.json</code> and <code>font-atlas-manifest.json</code>. The manifest stores content hashes for caching and uses relative output names. The font name <code>font-atlas-manifest</code> is reserved, including case variants, to prevent a filename collision. Register the generated files through the existing fonts option:</p>${code(`const ui = await createUI({
  canvas,
  fonts: [{ name: 'interface', atlas: '/fonts/interface.png', metrics: '/fonts/interface.json' }],
});`)}
<p>For deployments under a URL prefix, include your application's base path in those URLs. The source TTF/OTF/WOFF files are not needed by the browser.</p>
<h3>3. Integrate with development and builds</h3>${code(
      JSON.stringify(
        {
          scripts: {
            'fonts:build': 'ludic-canvas fonts --config ludic-canvas.fonts.json',
            predev: 'npm run fonts:build',
            dev: 'vite',
            prebuild: 'npm run fonts:build',
            build: 'vite build',
          },
        },
        null,
        2,
      ),
      'json',
      'package.json',
    )}
<p>Unchanged sources, configuration and compiler bytes reuse cached output. Modified or damaged PNG/JSON files are regenerated. <code>--force</code> always regenerates. A failure in any face leaves existing output files unchanged; successful generations replace the configured files but do not delete old fonts removed from configuration.</p>
<h3>Configuration reference</h3>
<p><code>size</code> is atlas pixels per em (8–128, default 48), independent of runtime fontSize. <code>distanceRange</code> is the distance range in atlas pixels (1–32, default 6). <code>charset</code> uses msdf-atlas-gen expressions, such as <code>[0x20, 0x7E], [0xA0, 0xFF]</code>. A font-level charset overrides the configuration default. <code>characters</code> adds literal Unicode characters. Space and <code>?</code> are always included. Missing requested characters fail with their Unicode codepoints; runtime text outside the generated set uses the fallback.</p>
<p>Variable fonts accept four-character axis tags: <code>"variations": { "wght": 600 }</code>. Unknown axes and values outside the font's axis range fail. Each face name must contain 1–64 ASCII letters, digits, hyphens or underscores and be unique ignoring case. The compiler supports at most 16,384 requested codepoints and an 8192×8192 atlas; choose the character coverage your interface needs.</p>
<p>The <a href="/font-atlas.schema.json">JSON schema</a> is also exported as <code>ludic-canvas/font-atlas.schema.json</code> for editors. <code>--help</code> and <code>--version</code> need no compilation. Node currently emits its standard WASI experimental-feature warning during generation; a successful command still exits with status 0.</p>`,
  ],
  [
    'integration',
    'Game-loop integration',
    `<p>Place the game world and UI in the same positioned parent. The game owns the world canvas; Ludic Canvas draws a transparent overlay.</p>${code(
      `<div style="position:relative;width:100%;height:480px">
  <canvas id="world" aria-hidden="true"
    style="display:block;width:100%;height:100%"></canvas>
  <canvas id="ui" aria-label="Game interface"
    style="position:absolute;inset:0;width:100%;height:100%"></canvas>
</div>`,
      'html',
      'index.html',
    )}<p>The loop below assumes your application provides <code>game</code> and <code>Hud</code>. Adapt it to your engine, or explore the <a href="/play/">complete courier example</a>.</p>${code(
      `const overlayCanvas = document.querySelector<HTMLCanvasElement>('#ui')!;
const ui = await createUI({ canvas: overlayCanvas, autoStart: false });
ui.render(<Hud snapshot={game.snapshot()} onPause={() => game.pause()} />);

function tick(now: number) {
  game.update(now);
  game.draw();
  ui.frame(now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);`,
      'tsx',
      'Game-loop recipe',
    )}<p>A transparent overlay canvas is the simplest integration with any browser rendering engine: give the world and UI separate canvases in the same positioned container. For shared rendering, pass a WebGL 1 <code>context</code> and call <code>frame()</code> after the game pass. Canvas dimensions remain engine-owned by default when a context is supplied.</p><p>The UI binds the default framebuffer and changes viewport, buffers, shaders, texture bindings, vertex attributes, blending and depth/cull/scissor state. It does not snapshot or restore the engine's GL state. Reset or invalidate your engine's state cache before its next draw. Shared WebGL 2 contexts and rendering to an engine framebuffer are not supported. An overlay canvas is the supported route for engines using WebGL 2, WebGPU or other renderers.</p><p>New React renders commit asynchronously. Re-render after game state changes; do not re-render solely to advance animations. Call <code>stop()</code> to pause automatic frames and <code>destroy()</code> when leaving a scene. Destroying is idempotent and allows the same canvas to be mounted again.</p>`,
  ],
  ['text-entry', 'Native text entry', editingGuide(code, version)],
  [
    'input',
    'Input & accessibility',
    `<p>Use <code>onPress</code>, <code>onHover</code>, <code>hoverStyle</code>, <code>pressStyle</code>, <code>disabled</code> and <code>hotkey</code> on primitives. Give every pressable a meaningful <code>label</code>; descendant text supplies a fallback. Pointer input, vertical wheel scrolling and touch drags are supported. Canvas hotkeys activate only while that canvas or one of its mirrored controls has focus, so roots do not steal each other's keys.</p><p>Each painted pressable is mirrored by an invisible DOM button in paint order. Tab moves between buttons and Enter/Space activates them; focus is drawn in the canvas. Canvas focus itself enables scoped hotkeys. Set <code>announce</code> on Text to publish its changed content to a polite live region.</p><p>This is a limited control mirror, not complete accessibility semantics. It does not expose all static canvas text as a document. Native text fields are described in <a href="#text-entry">Native text entry</a>. Modal focus scopes and controller action methods are described in <a href="#controls">Controls, modals &amp; controllers</a>. Validate the complete interface with keyboard users and assistive technology. Provide a separate DOM interface where richer semantics are needed.</p><p>Reduced motion initially follows the browser preference; <code>setReducedMotion(true)</code> disables enter transitions, tweens, hover interpolation, glow pulses, breathing and marching-line motion. <code>setTextScale()</code> changes both text measurement and drawing. Dynamic system preference changes require the application to call the setter.</p>`,
  ],
  ['controls', 'Controls, modals & controllers', controlRecipes(code)],
  ['virtualization', 'Large collections & performance', virtualizationGuide(code)],
  ['production', 'Production support & limits', productionGuide(code)],
  ['troubleshooting', 'Troubleshooting', troubleshooting],
  [
    'build',
    'Build, verify & contribute',
    `${code(
      `git clone https://github.com/VictorQueiroz/ludic-canvas.git
cd ludic-canvas
npm ci
npm run dev
npm run check

# Optional: rebuild Yoga with raw Clang/LLVM (no Emscripten)
npm run toolchain -- --llvm /path/to/llvm
npm run wasm
npm run fontgen:wasm

# Build the distributable package
npm pack`,
      'bash',
      'Terminal',
    )}<p>Node 24 or newer is required for repository tooling. The native build needs CMake 3.28+, LLVM with wasm32 and wasm-ld. The bootstrap downloads SHA-256-pinned WASI sysroot and compiler-rt inputs. Yoga sources are pinned by version and hash. The committed layout module lets consumers and Vercel build without the native toolchain.</p><p>The public repository uses a fresh history and contains the library, generic examples, font notices and reproducible build sources. The API reference is generated from emitted TypeScript declarations during every documentation build. Run <code>npm run check</code> before a release. The Vercel project builds <code>npm run docs:build</code> and serves <code>site/</code> from the repository root.</p><p>Compatibility: React 19.3.1 is the tested peer version; react-reconciler 0.34.0 is pinned. Browser requirements include WebAssembly SIMD/bulk-memory, WebGL 1, createImageBitmap and Pointer Events. CI exercises Chromium, Firefox and WebKit with desktop and mobile-emulated viewports. Physical device certification remains application-owned; see <a href="#production">Production support &amp; limits</a>.</p>`,
  ],
];
const guide =
  `<p class="eyebrow">DOCUMENTATION / VERSION ${version}</p><h1>Build the interface.<br>Keep your engine.</h1><p class="lead">A practical guide from the first component to a game-driven rendering loop.</p><div class="learning-path" aria-label="Choose a starting point"><a href="#project-init"><span>01 / START HERE</span><strong>Generate your project</strong><small>A Canvas2D or Three.js world, fonts and controlled HUD.</small></a><a href="#start"><span>02 / EXISTING PROJECT</span><strong>Mount your first UI</strong><small>A complete manual setup and working counter.</small></a><a href="/components/"><span>03 / COMPOSE CONTROLS</span><strong>Make it your own</strong><small>One set of behaviors, two visual identities.</small></a><a href="/play/"><span>04 / PLAY THE EXAMPLES</span><strong>See complete integrations</strong><small>2D and 3D games with their own custom interfaces.</small></a></div>` +
  guideSections.map(([id, title, body]) => `<section id="${id}"><h2>${title}</h2>${body}</section>`).join('');
const publicNames = new Set();
for (const match of readFileSync('dist/index.d.ts', 'utf8').matchAll(/\{([^}]+)\}/g))
  for (const name of match[1].split(',')) if (name.trim()) publicNames.add(name.trim().replace(/^type\s+/, ''));
const entries = [];
for (const file of [
  'root',
  'context',
  'controls',
  'primitives',
  'assets',
  'defaults',
  'runtime/types',
  'runtime/profile',
  'scroll',
  'virtual-list',
  'text-input',
  'virtual/range',
  'gfx/font',
  'resources',
]) {
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
const api = `<p class="eyebrow">REFERENCE / GENERATED FROM TYPESCRIPT</p><h1>The public API.</h1><p class="lead">Exact signatures, types and property documentation for version ${version}.</p><p>Generated from package declarations. Optional properties use <code>?</code>. Dimensions use CSS pixels unless stated otherwise. Import these symbols from <code>ludic-canvas</code>. ReactNode and ComponentType refer to the standard React types. FontName is a string identifying one of your registered faces. Internal renderer, layout and GPU classes are intentionally private.</p>${entries.map(({ name, declaration }) => `<section id="${name}" class="api-entry"><h2>${name}<a class="anchor" href="#${name}" aria-label="Link to ${name}">#</a></h2>${code(declaration, 'typescript', name)}</section>`).join('')}`;
const play =
  '<div class="game-heading"><div><p class="eyebrow"><span class="status-dot"></span> PLAYABLE INTEGRATION EXAMPLE</p><h1>Orbital Relay</h1><p>Collect three cargo pods, cross the debris belt, and deliver them to Relay. Select a beacon to fly there. Boost to cross faster. Dock to repair.</p></div><a class="text-link" href="https://github.com/VictorQueiroz/ludic-canvas/tree/main/examples/orbital-relay">Explore the source ↗</a></div><section class="game-frame" aria-label="Orbital Relay mini game"><div class="game-toolbar"><div><span class="status-dot"></span><span>LIVE GAME / LUDIC CANVAS UI</span></div><div><label><input id="game-motion" type="checkbox"> Reduce motion</label><button id="game-size" type="button" aria-pressed="false">Compact layout</button></div></div><div id="game-stage"><canvas id="game-world" aria-hidden="true"></canvas><canvas id="game-ui" aria-label="Orbital Relay game interface. Select Launch courier to begin. Use Tab and Enter for controls, 1 to 4 for destinations, B to boost, and Escape to pause."></canvas><p id="game-loading" role="status">Loading game and two MSDF font atlases...</p></div><div class="game-toolbar"><span>YOUR WORLD + YOUR REACT COMPONENTS</span><span id="game-stats">Initializing renderer</span></div></section><section class="game-notes" aria-label="How the integration works"><article><h2>One game loop. Two canvases.</h2><p>The application owns flight, cargo, collisions, and the Canvas 2D world. A transparent Ludic Canvas overlay owns the React HUD. The loop advances the simulation, draws the world, then calls <code>ui.frame(now)</code>. React reads snapshots at 10 Hz; the ship keeps moving at the display refresh rate.</p></article><article><h2>Two fonts. Separate modules.</h2><p>The interface module defines Oxanium for headings and controls. The mission module defines Space Mono for telemetry and cargo. Each has its own font configuration and generated atlas. The root combines their <code>FontSource</code> exports. Run <code>npm run fonts:game</code> to regenerate both with the bundled CLI.</p></article><article><h2>Resize the mission.</h2><p>Try Compact layout or resize your window. Nested flex rows, progress bars and tabbed cargo panels become a narrow HUD with an on-demand manifest. <code>ResizeObserver</code> gives the game camera and UI the same dimensions. Pause menus block background controls, and Tab/Enter use the library\'s accessibility mirror.</p></article></section>';
for (const [path, html] of [
  ['docs/components/index.html', layout('Components', 'components', componentsPage(code, version))],
  ['docs/play/index.html', layout('Play', 'play', playPage(code))],
  ['docs/play/orbital-relay/index.html', layout('Orbital Relay', 'orbital', play)],
  ['docs/3d/index.html', layout('Kestrel Survey', '3d', surveyPage(code))],
  ['docs/performance/index.html', layout('Performance', 'performance', performancePage())],
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
    ['', 'guide/', 'components/', 'api/', 'performance/', 'play/', 'play/orbital-relay/', '3d/']
      .map((path) => `<url><loc>https://libraries.ludic-canvas.victorqueiroz.dev/${path}</loc></url>`)
      .join('') +
    '</urlset>\n',
);
writeFileSync(
  'docs/public/llms.txt',
  `# Ludic Canvas\n\nReact UI for browser games, using Yoga WASM and WebGL 1.\n\n- [Guide](https://libraries.ludic-canvas.victorqueiroz.dev/guide/)\n- [Components](https://libraries.ludic-canvas.victorqueiroz.dev/components/)\n- [API](https://libraries.ludic-canvas.victorqueiroz.dev/api/)\n- [Performance](https://libraries.ludic-canvas.victorqueiroz.dev/performance/)\n- [Playable example](https://libraries.ludic-canvas.victorqueiroz.dev/play/)\n- [Source](https://github.com/VictorQueiroz/ludic-canvas)\n`,
);
dispose();
console.log(`Generated documentation for ${entries.length} public exports`);
