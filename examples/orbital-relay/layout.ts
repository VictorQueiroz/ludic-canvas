/** CSS-pixel viewport shared by the game camera and its canvas UI markers. */
export function gameLayout(width: number, height: number) {
  const compact = width < 760;
  const padding = compact ? 12 : 22;
  const top = compact ? 112 : 154;
  const bottom = compact ? 140 : 105;
  const side = compact ? 0 : 264;
  return {
    compact,
    padding,
    arena: {
      x: padding + side,
      y: top,
      width: Math.max(1, width - padding * 2 - side),
      height: Math.max(1, height - top - bottom),
    },
  };
}
