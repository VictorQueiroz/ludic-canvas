# First interface

A minimal Ludic Canvas application: a full-size canvas, flex layout, text and a
button that updates React state. Click **Add one**, or focus it with Tab and press
Enter or Space.

[Open in StackBlitz](https://stackblitz.com/fork/github/VictorQueiroz/ludic-canvas/tree/main/examples/first-interface?file=src/main.tsx)

Edit `src/main.tsx` to change the text, colors, spacing or counter behavior. The
example uses the default font and compiled layout WASM included in the published
`ludic-canvas@0.6.0` package. No font generation or native build is required.

This example pins Vite 7.3.5 to avoid the Vite 8 Rolldown binding failure in
StackBlitz WebContainers ([upstream report](https://github.com/stackblitz/starters/issues/118)).
Its Vite configuration also preserves the library's relative WASM and font asset
URLs during development while prebundling its React dependencies.

## Run locally

With Node 24 or newer:

```sh
npm ci
npm run dev
```

Run `npm run build` to type-check and create a production build in `dist/`.
This directory can be copied out of the repository and run independently.
