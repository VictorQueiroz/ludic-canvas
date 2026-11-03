/** Prototype raster budget: RGBA estimates, not measured browser/GPU allocations. */
export const TILE_HEIGHT = 384;
export const RASTER_BUDGET = 16 * 1024 * 1024;

export interface TileWindow {
  offset: number;
  indices: number[];
  tileBytes: number;
  estimatedBytes: number;
}

export function planTiles(
  rawOffset: number,
  width: number,
  viewportHeight: number,
  contentHeight: number,
  dpr: number,
): TileWindow {
  if (![rawOffset, width, viewportHeight, contentHeight, dpr].every(Number.isFinite))
    throw new Error('Tile geometry must be finite');
  if (width <= 0 || viewportHeight <= 0 || contentHeight <= 0 || dpr <= 0)
    throw new Error('Tile dimensions must be positive');
  const offset = Math.max(0, Math.min(rawOffset, Math.max(0, contentHeight - viewportHeight)));
  const tileBytes = Math.ceil(width * dpr) * Math.ceil(TILE_HEIGHT * dpr) * 4;
  // Reserve one full tile for the shared WebGL staging surface.
  const capacity = Math.floor(RASTER_BUDGET / tileBytes) - 1;
  const count = Math.ceil(contentHeight / TILE_HEIGHT);
  let first = Math.floor(offset / TILE_HEIGHT);
  let last = Math.min(count - 1, Math.ceil((offset + viewportHeight) / TILE_HEIGHT) - 1);
  if (capacity < last - first + 1) throw new Error('Visible tiles exceed the prototype raster budget');
  // At most one tile of overscan on each side, within the fixed budget.
  if (first > 0 && last - first + 1 < capacity) first--;
  if (last < count - 1 && last - first + 1 < capacity) last++;
  const indices = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return { offset, indices, tileBytes, estimatedBytes: (indices.length + 1) * tileBytes };
}
