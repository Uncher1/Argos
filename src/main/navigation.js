import { APP_ORIGIN } from './app-url.js';

export function isAppUrl(url) {
  return url.startsWith(`${APP_ORIGIN}/`);
}

// Links opened from the page (Twitch player, search results) go to the
// user's browser; anything that is not a web page is refused.
export function externalTarget(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.origin === APP_ORIGIN) return null;
  return parsed.toString();
}

// The Twitch page panel may only show Twitch itself.
export function isTwitchUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'twitch.tv' || hostname.endsWith('.twitch.tv'));
  } catch {
    return false;
  }
}

// Web pages get nothing by default (camera, microphone, location, notifications...),
// only what the Twitch players and pages harmlessly need.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write', 'storage-access', 'top-level-storage-access']);

export function isAllowedPermission(permission) {
  return ALLOWED_PERMISSIONS.has(permission);
}

// Frames inside the Twitch page (ads, embeds) are left alone; the page itself
// is blocked when it tries to leave Twitch. Nothing is ever opened on its own.
export function blocksPanelNavigation({ url, isMainFrame }) {
  return isMainFrame !== false && !isTwitchUrl(url);
}
