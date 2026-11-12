// The top band (window buttons, "Suivis en live" tab) shows when the cursor
// comes near the top edge of the window and hides once it moves away.
// The cursor is polled from the main process because draggable regions do
// not receive mouse events on Windows.
export function nextTopBandVisible(visible, cursor, bounds, revealPx = 64, keepPx = 110) {
  const inside = cursor.x >= bounds.x && cursor.x < bounds.x + bounds.width
    && cursor.y >= bounds.y && cursor.y < bounds.y + bounds.height;
  if (!inside) return false;
  const fromTop = cursor.y - bounds.y;
  return fromTop < (visible ? keepPx : revealPx);
}

export function watchTopBand({ win, screen, onChange, intervalMs = 100 }) {
  let visible = false;
  const timer = setInterval(() => {
    if (win.isDestroyed() || win.isMinimized()) return;
    const next = nextTopBandVisible(visible, screen.getCursorScreenPoint(), win.getContentBounds());
    if (next !== visible) {
      visible = next;
      onChange(visible);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
