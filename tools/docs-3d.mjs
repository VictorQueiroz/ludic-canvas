export function surveyPage(code) {
  return `<div class="game-heading"><div><p class="eyebrow"><span class="status-dot"></span> THREE.JS + LUDIC CANVAS / PLAYABLE 3D EXAMPLE</p><h1>Kestrel Survey</h1><p>Read an unfamiliar world. Pilot a small rover across a procedural desert, visit three mineral sites, and complete your field collection.</p></div><a class="text-link" href="https://github.com/VictorQueiroz/ludic-canvas/tree/main/examples/kestrel-survey">Get the example project ↗</a></div>
<section class="survey-frame" aria-label="Kestrel Survey 3D game"><div id="survey-stage"><canvas id="survey-world" aria-hidden="true"></canvas><canvas id="survey-ui" aria-label="Kestrel Survey interface. Navigate to three survey sites and collect their samples. Use W A S D to drive, Shift to boost, E to sample, and Escape to pause."></canvas><p id="survey-loading" role="status">Preparing the desert and two MSDF font families...</p></div><div class="survey-status"><span>3D WORLD + A FULLY CUSTOM CANVAS UI</span><span id="survey-stats">Initializing two independent renderers</span></div></section>
<section class="game-notes"><article><h2>Two renderers. One game loop.</h2><p>Three.js owns the perspective camera, terrain, rover, lights, shadows and raycasting. Ludic Canvas draws every game panel, button, map, meter, modal and projected site label on a transparent overlay. The 3D engine uses WebGL 2; the UI has its own WebGL 1 context.</p></article><article><h2>Custom means composed.</h2><p>This interface is built from View, Text and Line primitives, with Oxanium and Space Mono defined in separate feature modules. The camera slider supports pointer and keyboard input. Pause, settings, field notes and the mobile site picker use modal focus scopes.</p></article><article><h2>A complete starting point.</h2><p>The example has its own package.json, Vite configuration, fonts, source files and instructions. The simulation is independent of React and Three.js. Copy it into a new directory and build a game around your own state and art.</p></article></section>
<section class="survey-integration"><h2>Run it as an independent project.</h2>${code(
    `git clone https://github.com/VictorQueiroz/ludic-canvas.git
cd ludic-canvas/examples/kestrel-survey
npm install
npm run dev

# Production build
npm run build`,
    'bash',
    'Terminal',
  )}<p>Node 24+ and a browser with WebGL 2 are required. After copying this example folder elsewhere, the same commands install the published <code>ludic-canvas</code> package. No parent repository files are needed. Its standalone build is verified against the package tarball in CI.</p>
<h2>The integration boundary.</h2>${code(
    `const world = createSurveyWorld(worldCanvas); // Three.js / WebGL 2
const ui = await createUI({
  canvas: overlayCanvas,
  autoStart: false,
  fonts: [displayFont, telemetryFont],
});
ui.render(<SurveyHud game={game} width={width} height={height} onGround={pickGround} />);

function frame(now: number) {
  advanceSurvey(game, deltaSeconds); // Bounded simulation steps on slow frames
  world.draw(game.read(), width, height, deltaSeconds);
  game.publish(world.project()); // World coordinates -> CSS-pixel labels
  ui.frame(now);
  requestAnimationFrame(frame);
}
// Scene teardown: cancel frames, disconnect observers, ui.destroy(), world.dispose().`,
    'tsx',
    'Application-owned loop (abridged)',
  )}<p>The complete implementation handles resize, focus, visibility, context recovery, reduced motion and teardown. Three.js is an example dependency and is not added to the Ludic Canvas runtime. Camera projection and gameplay remain application code.</p><p><a href="/3d-licenses.txt">Third-party licenses and font notices</a></p></section>`;
}
