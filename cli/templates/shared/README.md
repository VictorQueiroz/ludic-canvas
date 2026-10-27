# Your Ludic Canvas game

Use Node 24 or newer:

```sh
npm install
npm run dev
```

`npm run build` produces `dist/`; `npm run preview` serves that production build.

The game draws its world on one canvas and Ludic Canvas draws a transparent HUD
on another. `src/game.ts` owns simulation state, `src/world.ts` draws the world,
and `src/Hud.tsx` composes controlled UI components. One application-owned loop
advances the simulation, draws the world and calls `ui.frame(now)`.

The bundled Barlow Condensed SemiBold font is licensed under the SIL Open Font
License in `fonts/OFL.txt`. Replace `fonts/Interface.ttf` and edit
`ludic-canvas.fonts.json` to use your own licensed TTF, OTF, WOFF or WOFF2 font.
Font atlases are built before development and production builds; unchanged inputs
reuse cached files. Generated files are imported through Vite so deployments
under a URL prefix keep working. Font sources are not sent to the browser.

ResizeObserver aligns both canvases. The UI caps its device-pixel ratio at two;
the world applies the same cap. Hot module replacement and page teardown release
the frame loop, observers, UI root and graphics resources. Browser back/forward
cache keeps the suspended page intact.

Controls are unstyled: change the HUD's colors, layout and contents freely. The
slider owns pointer and keyboard mechanics, while its value remains in the game.
Use `ui.destroy()` when replacing the scene in your own game.

Read the [guide](https://libraries.ludic-canvas.victorqueiroz.dev/guide/),
[component catalogue](https://libraries.ludic-canvas.victorqueiroz.dev/components/)
and [support boundaries](https://libraries.ludic-canvas.victorqueiroz.dev/guide/#production).
