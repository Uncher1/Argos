import { WebContentsView } from 'electron';
import { roundBounds } from './bounds.js';
import { blocksPanelNavigation, externalTarget } from './navigation.js';
import { twitchChannelUrl } from './twitch-page-url.js';

// A channel's real Twitch page, shown inside Argos so the user can press
// Twitch's own Follow button (apps can no longer follow through the API).
export function createTwitchPage({ win, session, openExternal }) {
  let view = null;

  function close() {
    if (!view) return;
    win.contentView.removeChildView(view);
    view.webContents.close();
    view = null;
  }

  function open(login, bounds) {
    const url = twitchChannelUrl(login);
    if (!url) return false;
    close();
    view = new WebContentsView({ webPreferences: { session } });
    view.setBackgroundColor('#0e0e10');
    view.webContents.setAudioMuted(true);
    view.webContents.setWindowOpenHandler(({ url: target }) => {
      const external = externalTarget(target);
      if (external) openExternal(external);
      return { action: 'deny' };
    });
    // The panel stays on Twitch. Leaving it is blocked, never redirected to the
    // browser on its own (links clicked open there through the handler above).
    const stayOnTwitch = (event, legacyUrl, _legacyInPlace, legacyIsMainFrame) => {
      const url = event.url ?? legacyUrl;
      const isMainFrame = event.isMainFrame ?? legacyIsMainFrame;
      if (blocksPanelNavigation({ url, isMainFrame })) event.preventDefault();
    };
    view.webContents.on('will-navigate', stayOnTwitch);
    view.webContents.on('will-redirect', stayOnTwitch);
    win.contentView.addChildView(view);
    view.setBounds(roundBounds(bounds));
    view.webContents.loadURL(url).catch(() => {});
    return true;
  }

  return {
    open,
    close,
    setBounds(bounds) {
      if (view) view.setBounds(roundBounds(bounds));
    },
  };
}
