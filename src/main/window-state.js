import { readFileSync, writeFileSync } from 'node:fs';

export const DEFAULT_BOUNDS = { width: 1280, height: 720 };
const MIN = { width: 800, height: 450 };
const VISIBLE = { width: 100, height: 50 };

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

const overlap = (a, b) => ({
  width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
});

// Saved window position, kept only if enough of it is still on a screen.
export function sanitizeBounds(saved, workAreas) {
  const maximized = Boolean(saved?.maximized);
  if (!saved || !finite(saved.width) || !finite(saved.height)) return { ...DEFAULT_BOUNDS, maximized };
  const width = Math.max(MIN.width, Math.round(saved.width));
  const height = Math.max(MIN.height, Math.round(saved.height));
  if (!finite(saved.x) || !finite(saved.y)) return { width, height, maximized };
  const rect = { x: Math.round(saved.x), y: Math.round(saved.y), width, height };
  const onScreen = workAreas.some((area) => {
    const o = overlap(rect, area);
    return o.width >= VISIBLE.width && o.height >= VISIBLE.height;
  });
  return onScreen ? { ...rect, maximized } : { width, height, maximized };
}

export function loadWindowState(file, workAreas) {
  try {
    return sanitizeBounds(JSON.parse(readFileSync(file, 'utf8')), workAreas);
  } catch {
    return sanitizeBounds(null, workAreas);
  }
}

// Saves the main window's normal bounds; the small login windows are not resizable
// and are never saved.
export function trackWindowState(win, file) {
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = null;
    if (win.isDestroyed() || !win.isResizable() || win.isFullScreen() || win.isMinimized()) return;
    const bounds = win.getNormalBounds();
    try {
      writeFileSync(file, JSON.stringify({ ...bounds, maximized: win.isMaximized() }));
    } catch {
      // Not being able to remember the window is not worth bothering the user.
    }
  };
  const later = () => {
    if (!timer) timer = setTimeout(save, 500);
  };
  win.on('resize', later);
  win.on('move', later);
  win.on('maximize', later);
  win.on('unmaximize', later);
  win.on('close', save);
}
