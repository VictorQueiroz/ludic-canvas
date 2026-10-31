export function parseColor(input: string | undefined, alpha = 1): [number, number, number, number] {
  if (!input || input === 'transparent') return [0, 0, 0, 0];
  let r = 0,
    g = 0,
    b = 0,
    a = 1;
  if (input.startsWith('#')) {
    const hex = input.slice(1);
    const v = parseInt(hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex.slice(0, 6), 16);
    r = ((v >> 16) & 255) / 255;
    g = ((v >> 8) & 255) / 255;
    b = (v & 255) / 255;
    if (hex.length === 8) a = parseInt(hex.slice(6), 16) / 255;
  } else {
    const m = /rgba?\(([^)]+)\)/.exec(input);
    if (m) {
      const parts = m[1]!.split(',').map((s) => parseFloat(s));
      [r, g, b] = [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
      a = parts[3] ?? 1;
    }
  }
  a *= alpha;
  return [r * a, g * a, b * a, a];
}
