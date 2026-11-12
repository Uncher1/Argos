export const roundBounds = (b) => ({
  x: Math.round(b.x),
  y: Math.round(b.y),
  width: Math.max(1, Math.round(b.width)),
  height: Math.max(1, Math.round(b.height)),
});
