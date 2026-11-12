import { BrowserWindow, WebContentsView } from 'electron';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { buildAuthorizeUrl, classifyAuthUrl, parseRedirect } from './auth-urls.js';
import { roundBounds } from './bounds.js';
import { HIDE_GOOGLE_SCRIPT } from './hide-google.js';
import { createHeightSettler, MEASURE_PAGE_SCRIPT } from './page-height.js';
import { isTwitchUrl } from './navigation.js';

const HOUR = 60 * 60 * 1000;
const SILENT_TIMEOUT = 15000;
const MEASURE_EVERY = 250;

// null when Twitch rejects the token; throws when Twitch cannot be reached.
export async function validateToken(token, fetchImpl) {
  const res = await fetchImpl('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`validate ${res.status}`);
  const body = await res.json();
  return { userId: body.user_id, login: body.login, expiresIn: body.expires_in };
}

const randomState = () => randomBytes(16).toString('hex');

// Calls onCallback(url) once the Twitch flow reaches our redirect URI, and
// onPage(kind) for every Twitch or Google page that gets displayed.
function watchAuthFlow(webContents, { onCallback, onPage }) {
  const onWillGo = (event, legacyUrl) => {
    const url = event?.url ?? legacyUrl;
    if (url && classifyAuthUrl(url) === 'callback') {
      event.preventDefault();
      onCallback(url);
    }
  };
  webContents.on('will-redirect', onWillGo);
  webContents.on('will-navigate', onWillGo);
  webContents.on('did-navigate', (_event, url) => {
    const kind = classifyAuthUrl(url);
    if (kind === 'callback') onCallback(url);
    else if (kind !== 'other') onPage(kind);
  });
  webContents.on('did-navigate-in-page', (_event, url) => {
    if (classifyAuthUrl(url) === 'google-blocked') onPage('google-blocked');
  });
}

export function createAuth({ win, session, clientId, store, fetchImpl }) {
  const events = new EventEmitter();
  let current = null;
  let cancelCurrentLogin = null;
  let loginView = null;

  const remember = (s) => {
    current = s;
    store.save(s);
    return s;
  };

  async function sessionFromToken(token) {
    const info = await validateToken(token, fetchImpl).catch(() => null);
    return info ? remember({ token, userId: info.userId, login: info.login }) : null;
  }

  // Reuses the Twitch cookies of the app session; never shows anything.
  function silentToken() {
    return new Promise((resolve) => {
      const state = randomState();
      const hidden = new BrowserWindow({ show: false, webPreferences: { session } });
      let done = false;
      const finish = (token) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (!hidden.isDestroyed()) hidden.destroy();
        resolve(token);
      };
      const timer = setTimeout(() => finish(null), SILENT_TIMEOUT);
      watchAuthFlow(hidden.webContents, {
        onCallback: (url) => finish(parseRedirect(url, state).token ?? null),
        onPage: () => finish(null),
      });
      hidden.loadURL(buildAuthorizeUrl({ clientId, state })).catch(() => {});
    });
  }

  async function renewSession() {
    if (!clientId) return null;
    const token = await silentToken();
    return token ? sessionFromToken(token) : null;
  }

  async function getSession() {
    const saved = store.load();
    if (!saved) return null;
    try {
      const info = await validateToken(saved.token, fetchImpl);
      if (info) return remember({ token: saved.token, userId: info.userId, login: info.login });
    } catch {
      // Twitch unreachable: keep the saved identity, it will be checked again later.
      current = saved;
      return saved;
    }
    return renewSession();
  }

  function closeLoginView() {
    if (!loginView) return;
    win.contentView.removeChildView(loginView);
    loginView.webContents.close();
    loginView = null;
  }

  function startLogin(bounds) {
    if (!clientId) return Promise.resolve({ error: 'missing-client-id' });
    if (cancelCurrentLogin) cancelCurrentLogin();
    return new Promise((resolve) => {
      const state = randomState();
      const view = new WebContentsView({ webPreferences: { session } });
      view.setBackgroundColor('#18181b');
      loginView = view;
      win.contentView.addChildView(view);
      view.setBounds(roundBounds(bounds));
      view.webContents.setWindowOpenHandler(() => ({
        action: 'allow',
        overrideBrowserWindowOptions: {
          // Not modal: a stuck pop-up must never lock Argos.
          parent: win, modal: false, width: 500, height: 680, autoHideMenuBar: true,
          backgroundColor: '#18181b', webPreferences: { session },
        },
      }));
      // Google's pop-up ends on a refusal page: close it and explain instead.
      view.webContents.on('dom-ready', () => {
        if (isTwitchUrl(view.webContents.getURL())) view.webContents.executeJavaScript(HIDE_GOOGLE_SCRIPT).catch(() => {});
      });
      // Backup if the Google button still shows up (Twitch changed its page).
      // Google's sign-in is a single page app: watch in-page moves too.
      const popups = new Set();
      view.webContents.on('did-create-window', (child) => {
        popups.add(child);
        child.on('closed', () => popups.delete(child));
        const onUrl = (_event, url) => {
          if (classifyAuthUrl(url) !== 'google-blocked' || child.isDestroyed()) return;
          child.close();
          events.emit('stage', 'google-blocked');
        };
        child.webContents.on('did-navigate', onUrl);
        child.webContents.on('did-navigate-in-page', onUrl);
      });
      // The panel follows the height of each Twitch page (sign-in, code, consent).
      const settle = createHeightSettler();
      let measuring = false;
      const measure = setInterval(async () => {
        if (measuring || view.webContents.isDestroyed()) return;
        measuring = true;
        const height = await view.webContents.executeJavaScript(MEASURE_PAGE_SCRIPT).catch(() => 0);
        measuring = false;
        const fitted = settle(height);
        if (fitted && !done) events.emit('contentHeight', fitted);
      }, MEASURE_EVERY);
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        clearInterval(measure);
        for (const popup of popups) if (!popup.isDestroyed()) popup.close();
        cancelCurrentLogin = null;
        closeLoginView();
        resolve(result);
      };
      cancelCurrentLogin = () => finish(null);
      watchAuthFlow(view.webContents, {
        onCallback: async (url) => {
          if (done) return;
          const { token } = parseRedirect(url, state);
          finish(token ? await sessionFromToken(token) : null);
        },
        onPage: (kind) => {
          events.emit('stage', kind);
          if (kind === 'google-blocked') view.webContents.loadURL(buildAuthorizeUrl({ clientId, state })).catch(() => {});
        },
      });
      view.webContents.loadURL(buildAuthorizeUrl({ clientId, state })).catch(() => {});
    });
  }

  function setLoginBounds(bounds) {
    if (loginView) loginView.setBounds(roundBounds(bounds));
  }

  function cancelLogin() {
    if (cancelCurrentLogin) cancelCurrentLogin();
  }

  async function logout() {
    current = null;
    store.clear();
    await session.clearStorageData();
  }

  // Twitch asks apps to validate their tokens every hour.
  setInterval(async () => {
    if (!current) return;
    let info;
    try {
      info = await validateToken(current.token, fetchImpl);
    } catch {
      return;
    }
    if (info) return;
    if (!(await renewSession())) {
      current = null;
      store.clear();
      events.emit('lost');
    }
  }, HOUR);

  return { events, getSession, renewSession, startLogin, setLoginBounds, cancelLogin, logout };
}
