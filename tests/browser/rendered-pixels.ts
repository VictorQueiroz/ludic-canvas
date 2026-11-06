import type { Page } from '@playwright/test';
import { inflateSync } from 'node:zlib';

/** Browser screenshots use non-interlaced, 8-bit RGB/RGBA PNGs. Decode in Node
 * so reading pixels does not add another browser/GPU operation to the check. */
function decodeScreenshot(png: Buffer) {
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error('Expected a PNG screenshot');
  let width = 0,
    height = 0,
    channels = 0;
  const chunks: Buffer[] = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = data[9] === 2 ? 3 : data[9] === 6 ? 4 : 0;
      if (data[8] !== 8 || !channels || data[10] !== 0 || data[11] !== 0 || data[12] !== 0)
        throw new Error('Unsupported screenshot PNG format');
    } else if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  if (!width || !height || !channels) throw new Error('Missing screenshot dimensions');
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw new Error('Incomplete screenshot PNG');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    if (filter > 4) throw new Error('Unsupported screenshot row filter');
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? pixels[index - channels]! : 0;
      const above = y ? pixels[index - stride]! : 0;
      const corner = y && x >= channels ? pixels[index - stride - channels]! : 0;
      const p = left + above - corner;
      const a = Math.abs(p - left),
        b = Math.abs(p - above),
        c = Math.abs(p - corner);
      const prediction =
        filter === 1
          ? left
          : filter === 2
            ? above
            : filter === 3
              ? Math.floor((left + above) / 2)
              : filter === 4
                ? a <= b && a <= c
                  ? left
                  : b <= c
                    ? above
                    : corner
                : 0;
      pixels[index] = (raw[y * (stride + 1) + x + 1]! + prediction) & 255;
    }
  }
  return { width, height, channels, pixels };
}

/** Sample the browser's composite, including DOM tiles and canvas stacking. */
export async function renderedColors(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  colors: readonly (readonly number[])[],
) {
  const png = await page.screenshot({ clip, scale: 'css' });
  const { width, height, channels, pixels } = decodeScreenshot(png);
  const counts = colors.map(() => 0);
  let light = 0;
  for (let i = 0; i < pixels.length; i += channels) {
    for (const [index, color] of colors.entries())
      if (color.every((value, channel) => Math.abs(value - pixels[i + channel]!) <= 3)) counts[index]!++;
    if (pixels[i]! > 170 && pixels[i + 1]! > 170 && pixels[i + 2]! > 150) light++;
  }
  return { counts, light, pixels: width * height };
}
