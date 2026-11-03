import { useLayoutEffect } from 'react';
import { createUI, Image, type ImageStyleProp } from '../../../src/index.ts';

const canvas = document.querySelector('canvas')!;
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
const errors: string[] = [];
let color = '#00ff00';
const source = () =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ff0000"/><rect x="45" y="45" width="10" height="10" fill="${color}"/></svg>`,
  );
const root = await createUI({
  canvas,
  context: gl,
  manageCanvasSize: true,
  autoStart: false,
  maxDpr: 2,
  assets: (id) => (id === 'diagram' ? { kind: 'vector', url: source() } : undefined),
  onError: (error) => errors.push(String(error)),
});
function Scene({ fit, width }: { fit: ImageStyleProp['fit']; width: number }) {
  useLayoutEffect(() => {
    document.querySelector('output')!.textContent = `${fit}/${width}`;
  }, [fit, width]);
  return <Image src="diagram" style={{ width: '100%', height: 100, fit }} />;
}
const configure = (fit: ImageStyleProp['fit'], width = 300) => {
  canvas.style.width = `${width}px`;
  root.render(<Scene fit={fit} width={width} />);
};
const sample = () => {
  const frame = root.frame();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let left = canvas.width,
    right = -1,
    top = canvas.height,
    bottom = -1;
  const channel = color === '#00ff00' ? 1 : 2;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const at = (y * canvas.width + x) * 4;
      // Classify marker hue, including filtered edges; opaque-color thresholds
      // shrink a small marker when a quantized raster is magnified by cover.
      if (
        pixels[at + channel]! > pixels[at]! &&
        pixels[at + channel]! > pixels[at + (channel === 1 ? 2 : 1)]! &&
        pixels[at + 3]! > 0
      ) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  return { loaded: right >= 0, width: (right - left + 1) / frame.dpr, height: (bottom - top + 1) / frame.dpr, frame };
};
Object.assign(window, {
  vectors: {
    root,
    configure,
    sample,
    errors,
    update: (next: string) => {
      color = next;
      root.invalidateImages(['diagram']);
      return root.frame().textureBytes;
    },
  },
});
configure('contain');
