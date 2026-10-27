import { readFileSync } from 'node:fs';

export function projectInit(code, version) {
  const pending = Number(version.split('.')[1]) < 4;
  return `${pending ? '<p><strong>New in 0.4.0:</strong> publication is pending. Until then, build a package tarball from main to try the initializer.</p>' : ''}<p>Node 24+ and npm are enough. The initializer creates a new Vite + TypeScript project with a world canvas, a transparent Ludic Canvas HUD, controlled buttons and a slider, a licensed font and a configured font pipeline.</p>${code(
    `npx ludic-canvas@latest init my-game --template canvas2d
cd my-game
npm install
npm run dev`,
    'bash',
    'Create a Canvas2D game',
  )}
<p>Choose <code>--template three</code> for a Three.js world. Both templates use one application-owned loop and separate world/UI canvases. The default directory is <code>ludic-game</code>; the default template is <code>canvas2d</code>. Existing non-empty directories and symlink destinations are rejected. The initializer generates files; you choose when to install dependencies.</p>
<div class="table-scroll"><table><thead><tr><th>File</th><th>Responsibility</th></tr></thead><tbody><tr><td><code>src/main.tsx</code></td><td>Root creation, sizing, the frame loop, HMR and teardown.</td></tr><tr><td><code>src/game.ts</code></td><td>Application-owned simulation and immutable UI snapshots.</td></tr><tr><td><code>src/world.ts</code></td><td>Canvas2D or Three.js drawing and resource disposal.</td></tr><tr><td><code>src/Hud.tsx</code></td><td>Styled components using the public controls.</td></tr><tr><td><code>ludic-canvas.fonts.json</code></td><td>Font source, character coverage and generated output paths.</td></tr><tr><td><code>fonts/Interface.ttf</code></td><td>Bundled Barlow Condensed SemiBold; license in <code>fonts/OFL.txt</code>.</td></tr></tbody></table></div>
<p>Open Vite's local address. A moving world appears behind the HUD. Pause, resume and reset it, and change simulation speed using pointer or keyboard. <code>npm run build</code> generates fonts, checks TypeScript and creates <code>dist/</code>. The production base is relative, and the atlas/metrics use imported asset URLs for deployments under a URL prefix.</p><p>Replace the font with your own licensed TTF/OTF/WOFF/WOFF2 file and edit the configuration. <code>predev</code> and <code>prebuild</code> regenerate only when inputs change. See the <a href="#font-cli">font CLI reference</a> and <a href="/components/">component catalogue</a>. Already have a game? Use the manual canvas setup below.</p>`;
}

export function gettingStarted(code, version) {
  return `<p>Start with Node 24+, npm, and a browser with WebGL and WebAssembly enabled. The package includes its layout module and a default font; your first interface needs no font generation or native toolchain.</p>
<h3>1. Create a project</h3><p>Use Vite's React + TypeScript template, then install Ludic Canvas and its supported React version. Keep React DOM on the same version as React in the template.</p>${code(
    `npm create vite@latest my-game-ui -- --template react-ts
cd my-game-ui
npm install ludic-canvas@^${version} react@19.3.1 react-dom@19.3.1`,
    'bash',
    'Terminal',
  )}
<p>Already have a Vite project with automatic React JSX compilation? Install the package and React 19.3.1, then adapt the canvas setup below to your scene. The <code>react-ts</code> template already includes JSX and TypeScript configuration.</p>
<h3>2. Replace the entry file</h3><p>Replace all of <code>src/main.tsx</code> with this complete example. Keep the template's <code>index.html</code> and <code>vite.config.ts</code>. The code creates a sized canvas and mounts the custom renderer with <code>ui.render()</code>.</p>${code(readFileSync('examples/starter/main.tsx', 'utf8'), 'tsx', 'src/main.tsx')}
<h3>3. Run it</h3>${code('npm run dev', 'bash', 'Terminal')}
<div class="doc-callout"><strong>What you should see</strong><p>Open the local address printed by Vite. A dark screen shows “Your first game UI”, a score of 0, and a “Collect a coin” button. Click it or use Tab and Enter: the score should increase. If the canvas stays blank, start with <a href="#troubleshooting">troubleshooting</a>.</p></div>
<p>Check the production bundle with <code>npm run build</code>. The starter source is <a href="https://github.com/VictorQueiroz/ludic-canvas/blob/main/examples/starter/main.tsx">included in the repository</a> and built against an installed package during CI. Custom fonts, game-loop control and shared rendering can come after this first screen.</p>
<p><code>createUI()</code> starts drawing automatically. Leave <code>destroy()</code> for scene teardown; calling it immediately after <code>render()</code> removes the interface. Each canvas needs a nonzero CSS size and a positioned parent for its accessibility mirror.</p>
<a class="next-step" href="#primitives">Next: compose your own components →</a>`;
}

export const troubleshooting = `<p>Check the browser console and the Network panel first. The symptom usually points to a small setup issue.</p>
<div class="table-scroll"><table><thead><tr><th>Symptom</th><th>What to check</th></tr></thead><tbody>
<tr><td>Blank canvas</td><td>Give the canvas and parent a nonzero CSS width and height. Await <code>createUI()</code>, call <code>ui.render()</code>, and leave the root mounted. With <code>autoStart: false</code>, call <code>ui.frame(now)</code> in your loop.</td></tr>
<tr><td>UI disappears immediately</td><td>Call <code>ui.destroy()</code> only when the scene unmounts. It releases the React tree, listeners, layout and GPU resources.</td></tr>
<tr><td>JSX errors or an invalid hook call</td><td>Use a <code>.tsx</code> file with automatic React JSX compilation. Match React to <code>19.3.1</code> and check <code>npm ls react</code> for duplicate copies. Mount this component tree through <code>ui.render()</code>.</td></tr>
<tr><td>Missing WASM, atlas or image</td><td>Look for failed requests. Serve the application through your bundler rather than opening an HTML file directly. Check the deployment base path; cross-origin URLs need CORS headers.</td></tr>
<tr><td>Text shows question marks</td><td>The active atlas lacks those glyphs. Add the characters or Unicode ranges to the font configuration, regenerate, and select the registered <code>fontFamily</code>. See <a href="#font-cli">the font guide</a> for coverage and shaping limits.</td></tr>
<tr><td>Styles do not inherit or match CSS</td><td>Set text styles on each <code>Text</code>. Layout follows Yoga flexbox, with no CSS cascade or media queries. Use <code>onLayout</code> or a viewport observer to choose a responsive composition.</td></tr>
<tr><td>UI does not reflect game state</td><td>React renders commit asynchronously. Re-render after state changes, or subscribe with a hook as in <a href="/play/">Orbital Relay</a>. Calling <code>frame()</code> advances drawing; it does not fetch new game state.</td></tr>
<tr><td>WebGL is unavailable</td><td>Check that the browser/device permits WebGL, and pass failures through <code>onError</code>. Use a separate UI canvas alongside a WebGL 2 or WebGPU game; shared contexts currently require WebGL 1.</td></tr>
</tbody></table></div>
<p>Still stuck? <a href="https://github.com/VictorQueiroz/ludic-canvas/issues/new">Open an issue</a> with the package version, browser/OS, console error and a small reproduction. The <a href="/api/">API reference</a> lists exact supported properties.</p>`;
