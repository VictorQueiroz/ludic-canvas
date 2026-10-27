import { useLayoutEffect } from 'react';
import { createUI, View, Text, type AtlasJson, type FontDiagnostic } from '../../../src/index.ts';

const canvas = document.querySelector('canvas')!;
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
const contextLoss = gl.getExtension('WEBGL_lose_context')!;
function metrics(codes: number[], fallback = false): AtlasJson {
  return {
    atlas: { type: 'mtsdf', yOrigin: 'top', width: 16, height: 16, size: 32, distanceRange: fallback ? 8 : 4 },
    metrics: { emSize: 1, lineHeight: 1, ascender: -0.8, descender: 0.2 },
    glyphs: codes.map((unicode) => ({
      unicode,
      advance: unicode === 32 ? 0.25 : unicode === 0x3a9 ? 0.8 : 0.6,
      ...(unicode === 32
        ? {}
        : {
            planeBounds: { left: 0, top: -0.8, right: 0.6, bottom: 0.2 },
            atlasBounds: { left: fallback ? 8 : 0, top: 0, right: fallback ? 16 : 8, bottom: 16 },
          }),
    })),
    kerning: fallback ? [] : [{ unicode1: 65, unicode2: 86, advance: -0.1 }],
  };
}
function atlas(fallback: boolean) {
  const image = document.createElement('canvas');
  image.width = image.height = 16;
  const ctx = image.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, fallback ? 16 : 8, 16);
  return image.toDataURL();
}
const diagnostics: FontDiagnostic[] = [];
const errors: string[] = [];
let failDiagnostic = false;
let restored = 0,
  width = 0,
  committed = false;
const root = await createUI({
  canvas,
  context: gl,
  manageCanvasSize: true,
  maxDpr: 1,
  autoStart: false,
  fonts: [
    { name: 'primary', atlas: atlas(false), metrics: metrics([32, 63, 65, 86]) },
    { name: 'symbols', atlas: atlas(true), metrics: metrics([32, 63, 0x3a9], true) },
  ],
  onFontDiagnostic: (diagnostic) => {
    diagnostics.push(diagnostic);
    if (failDiagnostic) throw new Error('Diagnostic callback failed');
  },
  onError: (error) => errors.push(String(error)),
  onContextRestored: () => restored++,
});
function App({ fallback, kerning }: { fallback: boolean; kerning: boolean }) {
  useLayoutEffect(() => {
    committed = true;
  }, [fallback, kerning]);
  return (
    <View style={{ flex: 1, padding: 12, background: '#001020' }}>
      <Text style={{ fontSize: 20, alignSelf: 'flex-start', fontKerning: kerning ? 'normal' : 'none' }}>AV</Text>
      <Text
        style={{
          fontSize: 20,
          color: '#ffffff',
          fontFamily: fallback ? ['primary', 'symbols'] : 'primary',
          alignSelf: 'flex-start',
          shadow: true,
        }}
        onLayout={(box) => {
          width = box.width;
        }}
      >
        AΩV
      </Text>
    </View>
  );
}
function render(fallback = true, kerning = true) {
  committed = false;
  root.render(<App fallback={fallback} kerning={kerning} />);
}
let raf = 0;
function tick(now: number) {
  const frame = root.frame(now);
  document.querySelector('#status')!.textContent = JSON.stringify({
    committed,
    textWidth: width,
    restored,
    errors,
    diagnostics,
    ...frame,
  });
  raf = requestAnimationFrame(tick);
}
render();
raf = requestAnimationFrame(tick);
addEventListener(
  'pagehide',
  () => {
    cancelAnimationFrame(raf);
    root.destroy();
  },
  { once: true },
);
Object.assign(window, {
  typography: {
    root,
    canvas,
    gl,
    contextLoss,
    render,
    failDiagnosticCallback: () => {
      failDiagnostic = true;
    },
  },
});
