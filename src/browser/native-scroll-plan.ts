export const NATIVE_SCROLL_BUDGET = 16 * 1024 * 1024;

export interface NativeTilePlan {
  indices: number[];
  start: number;
  end: number;
  tileHeight: number;
  bytes: number;
}

/** Pure planning: full visible coverage plus bounded compositor overscan. */
export function planNativeTiles(
  width: number,
  viewport: number,
  content: number,
  offset: number,
  dpr: number,
  tileHeight: number,
  budget: number,
): NativeTilePlan | undefined {
  if (
    ![width, viewport, content, offset, dpr, tileHeight, budget].every(Number.isFinite) ||
    width <= 0 ||
    viewport <= 0 ||
    content <= viewport ||
    dpr <= 0 ||
    tileHeight < 1 ||
    budget <= 0
  )
    return;
  const at = Math.max(0, Math.min(offset, content - viewport));
  const bytes = Math.ceil(width * dpr) * Math.ceil(tileHeight * dpr) * 4;
  const capacity = Math.floor(budget / bytes);
  const count = Math.ceil(content / tileHeight);
  let first = Math.floor(at / tileHeight);
  let last = Math.min(count - 1, Math.ceil((at + viewport) / tileHeight) - 1);
  if (capacity < Math.min(count, last - first + 2)) return;
  if (first > 0 && last - first + 1 < capacity) first--;
  if (last < count - 1 && last - first + 1 < capacity) last++;
  return {
    indices: Array.from({ length: last - first + 1 }, (_, i) => first + i),
    start: first * tileHeight,
    end: Math.min(content, (last + 1) * tileHeight),
    tileHeight,
    bytes: (last - first + 1) * bytes,
  };
}
