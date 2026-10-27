export interface RangeOptions {
  count: number;
  itemHeight: number;
  viewport: number;
  offset: number;
  gap?: number;
  padding?: number;
  overscan?: number;
}
export type ScrollAlignment = 'auto' | 'start' | 'center' | 'end';
function nonnegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and nonnegative`);
}
export function fixedRange({ count, itemHeight, viewport, offset, gap = 0, padding = 0, overscan = 2 }: RangeOptions) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('item count must be a nonnegative safe integer');
  if (!Number.isFinite(itemHeight) || itemHeight <= 0) throw new Error('itemHeight must be positive and finite');
  nonnegative(viewport, 'viewport');
  nonnegative(gap, 'gap');
  nonnegative(padding, 'padding');
  if (!Number.isFinite(offset)) throw new Error('offset must be finite');
  if (!Number.isSafeInteger(overscan) || overscan < 0) throw new Error('overscan must be a nonnegative safe integer');
  const pitch = itemHeight + gap;
  const totalHeight = (count ? count * pitch - gap : 0) + padding * 2;
  if (!Number.isFinite(totalHeight)) throw new Error('Collection extent must be finite');
  offset = Math.max(0, Math.min(offset, Math.max(0, totalHeight - viewport)));
  if (!count || !viewport) return { start: 0, end: 0, totalHeight, offset };
  const start = Math.max(0, Math.min(count, Math.floor((offset - padding) / pitch)) - overscan);
  const end = Math.min(count, Math.max(0, Math.ceil((offset + viewport - padding) / pitch)) + overscan);
  return { start, end, totalHeight, offset };
}
export function offsetForIndex(options: RangeOptions & { index: number; align?: ScrollAlignment }) {
  const { index, itemHeight, viewport, gap = 0, padding = 0, align = 'auto' } = options;
  const range = fixedRange(options);
  if (!Number.isSafeInteger(index) || index < 0 || index >= options.count)
    throw new Error('Item index is out of range');
  const top = padding + index * (itemHeight + gap),
    bottom = top + itemHeight;
  let offset: number;
  if (align === 'start') offset = top;
  else if (align === 'end') offset = bottom - viewport;
  else if (align === 'center') offset = top - (viewport - itemHeight) / 2;
  else if (align === 'auto')
    offset = top < range.offset ? top : bottom > range.offset + viewport ? bottom - viewport : range.offset;
  else throw new Error('Unknown scroll alignment');
  return Math.max(0, Math.min(offset, Math.max(0, range.totalHeight - viewport)));
}
