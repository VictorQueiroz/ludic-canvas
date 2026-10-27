export function playPage(code) {
  return `<div class="play-heading"><p class="eyebrow"><span class="status-dot"></span> PLAYABLE EXAMPLES</p><h1>Choose your next world.</h1><p class="lead">Two small games. Two rendering engines. Every in-game interface is built with Ludic Canvas.</p></div>
<div class="play-layout"><nav class="game-picker" aria-label="Choose a playable example">
<button class="game-card" type="button" data-game="orbital-relay" data-src="/play/orbital-relay/?embed=1" data-page="/play/orbital-relay/" data-title="Orbital Relay" data-renderer="Canvas 2D world + WebGL UI" aria-pressed="true" aria-controls="selected-example"><span class="game-thumbnail"><img src="/examples/orbital-relay.png" alt="" width="1710" height="834"><span class="game-kind">2D / SPACE COURIER</span></span><span class="game-card-copy"><strong>Orbital Relay</strong><span>Collect cargo. Cross the debris belt. Find your way home.</span><span class="game-card-action">Select example <span aria-hidden="true">→</span></span></span></button>
<button class="game-card" type="button" data-game="kestrel-survey" data-src="/3d/?embed=1" data-page="/3d/" data-title="Kestrel Survey" data-renderer="Three.js world + WebGL UI" aria-pressed="false" aria-controls="selected-example"><span class="game-thumbnail"><img src="/examples/kestrel-survey.png" alt="" width="1214" height="760"><span class="game-kind">3D / FIELD EXPLORATION</span></span><span class="game-card-copy"><strong>Kestrel Survey</strong><span>Pilot a rover. Read the terrain. Bring three samples back.</span><span class="game-card-action">Select example <span aria-hidden="true">→</span></span></span></button>
<p class="game-picker-note">Switching examples starts a new session.</p></nav>
<section class="example-viewer" aria-labelledby="selected-example"><div class="example-viewer-heading"><div><p id="selected-renderer" class="eyebrow">Canvas 2D world + WebGL UI</p><h2 id="selected-example">Orbital Relay</h2></div><a id="open-example" class="text-link" href="/play/orbital-relay/" target="_blank" rel="noopener">Open separately <span aria-hidden="true">↗</span></a></div><iframe id="example-player" title="Play Orbital Relay" allow="fullscreen" allowfullscreen></iframe><p id="example-announcement" class="example-announcement" role="status" aria-live="polite">Orbital Relay selected.</p></section></div>
<noscript><p>Open <a href="/play/orbital-relay/">Orbital Relay</a> or <a href="/3d/">Kestrel Survey</a> separately. JavaScript is required to play.</p></noscript>
<section class="example-integration" data-integration="orbital-relay" aria-labelledby="orbital-integration"><p class="eyebrow">INSIDE THE EXAMPLE / 2D</p><h2 id="orbital-integration">How Orbital Relay uses Ludic Canvas.</h2><div class="integration-grid"><article><h3>The game owns the world.</h3><p>The application draws the ship, cargo, beacons and debris with Canvas 2D. A transparent WebGL 1 canvas sits above it. Ludic Canvas owns the HUD, manifest, cargo tabs and pause menu.</p></article><article><h3>State flows in. Actions flow out.</h3><p>React reads immutable simulation snapshots at 10 Hz. Components call game actions to select a destination, boost or pause. Oxanium and Space Mono come from separate interface and mission modules; the UI root combines their generated MSDF atlases.</p></article><article><h3>One application-owned loop.</h3><p>The loop advances the simulation, draws the world and calls <code>ui.frame(now)</code>. <code>ResizeObserver</code> keeps both canvases aligned. Modal scopes isolate pause input, and scene teardown destroys the UI root and removes observers and listeners.</p></article></div>${code(
    `const ui = await createUI({
  canvas: overlayCanvas,
  autoStart: false,
  fonts: [interfaceFont, telemetryFont],
});
ui.render(<Hud game={game} width={width} height={height} />);

function frame(now: number) {
  game.tick(deltaSeconds);
  world.draw(game, width, height, reducedMotion); // Application-owned Canvas 2D
  // The game model publishes immutable snapshots at 10 Hz.
  ui.frame(now);
  requestAnimationFrame(frame);
}`,
    'tsx',
    '2D integration (abridged)',
  )}<p><a class="text-link" href="https://github.com/VictorQueiroz/ludic-canvas/tree/main/examples/orbital-relay">Explore the Orbital Relay source ↗</a></p></section>
<section class="example-integration" data-integration="kestrel-survey" aria-labelledby="kestrel-integration" hidden><p class="eyebrow">INSIDE THE EXAMPLE / 3D</p><h2 id="kestrel-integration">How Kestrel Survey uses Ludic Canvas.</h2><div class="integration-grid"><article><h3>Separate renderers, shared dimensions.</h3><p>Three.js owns the WebGL 2 scene, rover, terrain, camera and shadows. Ludic Canvas draws the complete custom interface in a transparent WebGL 1 overlay. Both renderers receive the same CSS dimensions; they use separate graphics contexts.</p></article><article><h3>Connect the world to the HUD.</h3><p>Three.js projects site positions into CSS-pixel coordinates for canvas labels. Terrain clicks travel through the UI input surface to a Three.js raycast. Blocking panels keep their clicks out of world navigation. Camera sliders and modal menus use the library's pointer and keyboard semantics. Collection → Regional archive opens a 4,000-record VirtualList with logical focus, application-owned selection and responsive rows; the three live samples remain a short ordinary list.</p></article><article><h3>Keep ownership explicit.</h3><p>A plain game model owns navigation and sampling. React reads snapshots at approximately 14 Hz. Feature modules define two MSDF font families, composed at <code>createUI</code>. One loop advances bounded simulation steps, draws Three.js and frames the UI. Each renderer handles its context recovery and disposal.</p></article></div>${code(
    `const world = createSurveyWorld(worldCanvas); // Three.js / WebGL 2
const ui = await createUI({
  canvas: overlayCanvas,
  autoStart: false,
  fonts: [displayFont, telemetryFont],
});
ui.render(<SurveyHud game={game} width={width} height={height}
  onGround={(x, y) => {
    const hit = world.pick(x, y); // CSS pixels -> terrain raycast
    if (hit) game.driveTo(hit.x, hit.z);
  }} />);

function frame(now: number) {
  advanceSurvey(game, deltaSeconds);
  world.draw(game.read(), width, height, deltaSeconds);
  game.publish(world.project()); // 3D positions -> CSS-pixel labels
  ui.frame(now);
  requestAnimationFrame(frame);
}`,
    'tsx',
    '3D integration (abridged)',
  )}<p><a class="text-link" href="https://github.com/VictorQueiroz/ludic-canvas/tree/main/examples/kestrel-survey">Get the standalone Kestrel Survey project ↗</a></p></section>
<p class="gallery-boundary">The gallery runs one example at a time in an iframe so each preview owns its game session. The iframe is a website preview choice. In your game, mount Ludic Canvas directly beside your renderer, as the example source shows.</p>`;
}
