# Orbital Relay

A small, playable integration example: collect three cargo pods and deliver them
to Relay while avoiding drifting debris. Select a beacon or use keys 1–4 to plot
a course, B to boost, and Escape to pause. Tab and Enter work through the library's
accessible controls. Touch players use the same on-screen buttons.

Run `npm run dev` from the repository root and open `/play/`. The homepage embeds
the same page, so the example has one implementation. Try **Compact layout** or
resize the browser to switch from a side-by-side manifest to a narrow HUD with
an on-demand cargo panel.

## Integration boundary

- `game.ts` owns the simulation and exposes an instance with snapshots/actions.
  It has no renderer or browser dependency. Each game instance is independent.
- `world.ts` draws the world with Canvas 2D. It does not draw interface text.
- `ui/Hud.tsx` composes all game text, buttons, progress bars, mission panels,
  inventory slots and modals from the public `ludic-canvas` exports.
- `main.tsx` creates the game and UI, observes the viewport, and calls
  `game.tick(delta)`, `world.draw(...)`, then `ui.frame(now)` in one animation loop.
  React receives snapshots at 10 Hz. World movement runs at display refresh rate.
- `layout.ts` shares the available map rectangle between the camera and markers.
  Nested panels and controls use Yoga flexbox. UI resize preserves the flight.

Paused overlays disable background actions. The run also pauses when the page is
hidden or the embedded game leaves the viewport. Scene teardown disconnects
observers, removes listeners, cancels the loop and destroys the UI root.

## Fonts owned by separate features

The interface module exports **Oxanium** as `interfaceFont` from `ui/fonts.ts`.
The mission module exports **Space Mono** as `telemetryFont` from
`missions/fonts.ts`. Their configurations and generated atlases live beside their
respective feature modules. Text selects its face explicitly; there is no style
cascade from a parent View or a process-wide font registry.

The application composes them once:

```ts
const ui = await createUI({
  canvas,
  autoStart: false,
  fonts: [interfaceFont, telemetryFont],
});
```

Run `npm run fonts:game` to generate both MTSDF PNG/JSON pairs using the bundled
font CLI. Inputs and generated outputs are committed, so the website build needs
no font service or native compiler. Atlas caches verify the input and output hashes.

Both fonts are distributed under the SIL Open Font License, with each complete
license next to its source. `font-provenance.json` records the pinned Google Fonts
commit, original URLs and SHA-256 hashes. The game art is drawn procedurally or
defined in the original `ui/emblem.svg`.
