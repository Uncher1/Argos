// Window size and behavior for each screen: the welcome card (login), the
// Twitch sign-in panel (auth) and the streams (main).
// The sign-in panel starts at this height, then takes the height of the Twitch page.
const AUTH = { width: 480, height: 600 };
const MAIN = { width: 1280, height: 720, minWidth: 800, minHeight: 450 };
const SCREEN_MARGIN = 40;

export function windowModeSpec(mode, size, workArea) {
  const maxW = workArea.width - SCREEN_MARGIN;
  const maxH = workArea.height - SCREEN_MARGIN;
  const fit = (w, h) => ({ width: Math.round(Math.min(w, maxW)), height: Math.round(Math.min(h, maxH)) });
  if (mode === 'login') return { ...fit(size.width, size.height), resizable: false, minWidth: 1, minHeight: 1 };
  if (mode === 'auth') return { ...fit(AUTH.width, AUTH.height), resizable: false, minWidth: 1, minHeight: 1 };
  return { ...fit(MAIN.width, MAIN.height), resizable: true, minWidth: MAIN.minWidth, minHeight: MAIN.minHeight };
}

// New bounds for the given height, around the same vertical center and
// inside the screen.
export function fitHeightBounds(bounds, height, workArea) {
  const h = Math.round(Math.min(height, workArea.height - SCREEN_MARGIN));
  const centered = Math.round(bounds.y + (bounds.height - h) / 2);
  const y = Math.max(workArea.y, Math.min(centered, workArea.y + workArea.height - h));
  return { x: bounds.x, y, width: bounds.width, height: h };
}
