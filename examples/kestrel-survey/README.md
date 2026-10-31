# Kestrel Survey

A complete 3D example project using **Three.js** for the world and **Ludic Canvas** for a fully custom interface. Pilot a rover across a procedural desert, collect samples at three mineral sites, and complete the survey.

[Play the hosted example](https://libraries.ludic-canvas.victorqueiroz.dev/play/?example=kestrel-survey).

## Run independently

This directory is a self-contained Vite project. It can be copied outside the library repository without changing imports or asset paths.

```sh
npm install
npm run dev

# Type-check and build a production site
npm run build
npm run preview
```

Node 24+ is required. The browser must support WebGL 2 for Three.js and WebGL 1 for Ludic Canvas. The project installs the published `ludic-canvas@0.8.0` package, including the regional archive's virtualization API. The repository's documentation build uses the current library checkout instead; CI also copies this project into a temporary directory and builds it against the packed library.

## Play

Choose a survey site, then select **Navigate to site**. Autopilot drives the rover there. Within 2.5 metres, **Collect sample** becomes available. Collect all three samples to finish. On mobile, use the **Sites** drawer to choose a destination.

| Input                     | Action                                     |
| ------------------------- | ------------------------------------------ |
| W, A, S, D                | Drive manually; cancels autopilot          |
| Shift + movement          | Boost; uses more battery                   |
| E                         | Collect a nearby selected sample           |
| 1, 2, 3                   | Select a site                              |
| Escape                    | Pause, resume, or close a panel            |
| Click/tap exposed terrain | Set a world-space navigation waypoint      |
| Camera controls           | Orbit, switch to overview, and adjust zoom |
| Tab / Enter / Space       | Navigate and activate interface controls   |

Power recharges while stationary. Settings include reduced motion and a low-power rendering mode that disables shadows and dust and caps the world's pixel ratio at 1.

## What belongs to each layer

- `src/game.ts`: deterministic application state, movement, navigation, battery, sampling and completion. No React, Three.js, DOM or singleton.
- `src/world.ts`: procedural terrain, geometry, rover, lighting, shadows, camera, terrain picking and projected landmark coordinates.
- `src/main.tsx`: renderer setup, feature-owned font composition, observers, focus/keyboard routing, the game loop and teardown.
- `src/ui/Hud.tsx`: entirely custom `View`, `Text` and `Line` components. Mission cards, projected labels, minimap, rover schematic, meters, buttons, camera slider, settings, pause and completion panels all use Ludic Canvas.
- `src/ui/fonts.ts` and `src/telemetry/fonts.ts`: independent font definitions composed at the application root.

The two canvases share a positioned container and CSS dimensions. Three.js renders a WebGL 2 world first. A transparent Ludic Canvas WebGL 1 canvas renders the interface afterward. They do not share graphics contexts. Camera projection converts 3D positions to CSS-pixel labels; pointer coordinates travel in the other direction through a Three.js raycast. Blocking HUD panels keep their clicks out of the world input surface.

The world draws at display refresh rate; immutable React snapshots and projected label positions publish approximately 14 times per second. A single application-owned loop advances both layers. Simulation updates use steps of at most 50 ms and catch up at most 250 ms per foreground frame. Visibility changes pause the simulation; focus loss clears held keys. Context restoration is handled separately by each renderer. Leaving the scene removes listeners and observers and disposes UI, geometries, materials, shadow resources and the renderer.

This is a small navigation/sampling game with kinematic movement, not a physics simulation. The world is procedural and has no downloaded models or textures.

## Fonts

Oxanium 600 supplies interface type. Space Mono supplies telemetry. Both use prebuilt MTSDF atlases with their original SIL Open Font Licenses. Source URLs and SHA-256 hashes are recorded in `font-provenance.json`.

```sh
# Optional: regenerate both feature-owned font atlases
npm run fonts
```

The bundled font compiler runs during development. Runtime text uses the generated PNG/JSON files; source fonts and native build tools are unnecessary in the browser.

License notices for the standalone production build are included in `public/third-party-notices.txt`.

The visual design remains in this example. Its styled buttons, camera slider,
switches, site tabs and modal panels compose the library's controlled components;
the game owns every value and action. See the [component catalogue](https://libraries.ludic-canvas.victorqueiroz.dev/components/)
for the shared interaction contracts.
