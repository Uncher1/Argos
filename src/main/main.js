import { app, BrowserWindow, ipcMain, Menu, net, safeStorage, screen, session, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSupported, localeTag, matchLanguage } from '../renderer/i18n/languages.js';
import { createAuth } from './auth.js';
import { loadConfig } from './config.js';
import { shareTwitchCookies } from './cookies.js';
import { APP_URL } from './app-url.js';
import { externalTarget, isAllowedPermission, isAppUrl } from './navigation.js';
import { isTwitchDocument, withoutPasskeys } from './passkeys.js';
import { contentTypeFor, resolveStaticPath } from './static-files.js';
import { loadSettings, saveSettings } from './settings.js';
import { createTokenStore } from './token-store.js';
import { createTwitchPage } from './twitch-page.js';
import { watchTopBand } from './top-band.js';
import { keepTwitchLanguage } from './twitch-language.js';
import { chromeUserAgent } from './user-agent.js';
import { fitHeightBounds, windowModeSpec } from './window-mode.js';
import { loadWindowState, trackWindowState } from './window-state.js';

export const PARTITION = 'persist:argos';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..');
const rendererRoot = join(appRoot, 'src', 'renderer');
// Demo mode (npm run demo): simulated sign-in and sample channels, see dev/demo.js.
const DEMO = process.argv.includes('--demo');

// The language chosen at first launch. Pages also get it as the browser
// language (navigator.language), which can only be set before start-up.
const settingsFile = join(app.getPath('userData'), 'settings.json');
const settings = loadSettings(settingsFile);
if (settings.language) app.commandLine.appendSwitch('lang', localeTag(settings.language));

// Serves the renderer on http://localhost/ so the Twitch player accepts parent=localhost.
function registerLocalhost(ses) {
  ses.protocol.handle('http', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'localhost') {
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    }
    const filePath = DEMO && url.pathname.startsWith('/dev/')
      ? resolveStaticPath(join(appRoot, 'dev'), url.pathname.slice('/dev'.length))
      : resolveStaticPath(rendererRoot, url.pathname);
    if (!filePath) return new Response('Forbidden', { status: 403 });
    try {
      const body = await readFile(filePath);
      return new Response(body, { headers: { 'content-type': contentTypeFor(filePath) } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function setupCapture(win) {
  const capturePath = process.env.ARGOS_CAPTURE;
  const evalCode = process.env.ARGOS_EVAL;
  if (!capturePath && !evalCode) return;
  win.webContents.once('did-finish-load', () => {
    if (evalCode) {
      setTimeout(() => {
        win.webContents.executeJavaScript(evalCode).catch((err) => console.error('[argos] ARGOS_EVAL', err));
      }, 1500);
    }
    if (capturePath) {
      const delay = Number(process.env.ARGOS_CAPTURE_DELAY ?? 4000);
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        await writeFile(capturePath, image.toPNG());
        // Embedded views (Twitch sign-in) are captured separately.
        const views = win.contentView.children.filter((v) => v.webContents && v.webContents !== win.webContents);
        for (const [i, view] of views.entries()) {
          const viewImage = await view.webContents.capturePage();
          await writeFile(capturePath.replace(/\.png$/i, `.view${i}.png`), viewImage.toPNG());
          console.log('[argos] view', i, JSON.stringify(view.getBounds()), view.webContents.getURL());
        }
        app.quit();
      }, delay);
    }
  });
}

function turnOffPasskeys(ses) {
  ses.webRequest.onHeadersReceived({ urls: ['https://twitch.tv/*', 'https://*.twitch.tv/*'] }, (details, callback) => {
    if (!isTwitchDocument(details)) return callback({});
    callback({ responseHeaders: withoutPasskeys(details.responseHeaders ?? {}) });
  });
}

// Diagnostic: tells whether the Twitch players send the user's session.
function logPlayerAuth(ses) {
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://gql.twitch.tv/*'] }, (details, callback) => {
    console.log('[argos] gql authorization header:', 'Authorization' in details.requestHeaders);
    callback({});
  });
}

function wireSettings(applyLanguage) {
  ipcMain.handle('settings:get', () => ({
    language: settings.language,
    suggested: matchLanguage(app.getPreferredSystemLanguages()),
  }));
  ipcMain.handle('settings:setLanguage', (_event, code) => {
    if (!isSupported(code)) return false;
    settings.language = code;
    saveSettings(settingsFile, settings);
    applyLanguage();
    return true;
  });
}

function wireAuth(win, ses, { afterLogout }) {
  const config = loadConfig(appRoot);
  const store = createTokenStore(join(app.getPath('userData'), 'session.bin'), safeStorage);
  const auth = createAuth({ win, session: ses, clientId: config.clientId, store, fetchImpl: fetch });
  const send = (channel, ...args) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  };
  auth.events.on('stage', (stage) => send('login:stage', stage));
  auth.events.on('lost', () => send('session:lost'));
  auth.events.on('contentHeight', (height) => send('login:contentHeight', height));
  ipcMain.handle('session:get', () => auth.getSession());
  ipcMain.handle('session:renew', () => auth.renewSession());
  // Logging out clears every cookie, Twitch's language one included.
  ipcMain.handle('session:logout', async () => {
    await auth.logout();
    afterLogout();
  });
  ipcMain.handle('config:clientId', () => config.clientId);
  ipcMain.handle('login:start', (_event, bounds) => auth.startLogin(bounds));
  ipcMain.on('login:setBounds', (_event, bounds) => auth.setLoginBounds(bounds));
  ipcMain.on('login:cancel', () => auth.cancelLogin());
}

function wireTwitchPage(win, ses) {
  const page = createTwitchPage({ win, session: ses, openExternal: (url) => shell.openExternal(url) });
  ipcMain.handle('twitchPage:open', (_event, login, bounds) => page.open(login, bounds));
  ipcMain.on('twitchPage:setBounds', (_event, bounds) => page.setBounds(bounds));
  ipcMain.on('twitchPage:close', () => page.close());
}

function applyMode(win, mode, size, stateFile) {
  const { workArea } = screen.getDisplayMatching(win.getBounds());
  const spec = windowModeSpec(mode, size, workArea);
  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();
  win.setResizable(true);
  win.setMinimumSize(spec.minWidth, spec.minHeight);
  if (mode === 'main') {
    // The streams window comes back where the user left it.
    const saved = loadWindowState(stateFile, screen.getAllDisplays().map((d) => d.workArea));
    if (saved.x !== undefined) {
      win.setBounds({ x: saved.x, y: saved.y, width: saved.width, height: saved.height });
    } else {
      win.setContentSize(Math.min(saved.width, spec.width), Math.min(saved.height, spec.height));
      win.center();
    }
    if (saved.maximized) win.maximize();
  } else {
    win.setContentSize(spec.width, spec.height);
    win.center();
  }
  win.setResizable(spec.resizable);
  win.setMaximizable(spec.resizable);
  win.setFullScreenable(spec.resizable);
}

// The window stays hidden until the page says which screen it shows
// (small welcome card or full-size streams), with a safety net.
function wireWindow(win) {
  let shown = false;
  const showOnce = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    win.show();
  };
  setTimeout(showOnce, 4000);
  const send = (channel, ...args) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  };
  const stateFile = join(app.getPath('userData'), 'window-state.json');
  trackWindowState(win, stateFile);
  let currentMode = null;
  ipcMain.handle('window:setMode', (_event, mode, size) => {
    currentMode = mode;
    applyMode(win, mode, size, stateFile);
    showOnce();
  });
  // The Twitch sign-in panel takes the height of the page it shows.
  ipcMain.on('window:fitHeight', (_event, height) => {
    if (currentMode !== 'auth' || !(height > 0)) return;
    const { workArea } = screen.getDisplayMatching(win.getBounds());
    win.setResizable(true);
    win.setBounds(fitHeightBounds(win.getBounds(), height, workArea));
    win.setResizable(false);
  });
  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:toggleMaximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  ipcMain.on('window:close', () => win.close());
  ipcMain.on('window:toggleFullscreen', () => {
    if (win.isFullScreenable()) win.setFullScreen(!win.isFullScreen());
  });
  ipcMain.on('window:exitFullscreen', () => win.setFullScreen(false));
  ipcMain.handle('window:isFullscreen', () => win.isFullScreen());
  ipcMain.handle('window:isMaximized', () => win.isMaximized());
  win.on('maximize', () => send('window:maximized', true));
  win.on('unmaximize', () => send('window:maximized', false));
  watchTopBand({ win, screen, onChange: (visible) => send('topband:visible', visible) });
}

function createWindow(ses) {
  const win = new BrowserWindow({
    frame: false,
    backgroundColor: '#000000',
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 450,
    show: false,
    title: 'Argos',
    webPreferences: {
      session: ses,
      preload: join(here, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      // Streams must keep playing (and autoplay) when the window is behind another one.
      backgroundThrottling: false,
    },
  });
  if (process.env.ARGOS_DEBUG) {
    win.webContents.on('console-message', (event, _level, legacyMessage) => {
      console.log('[renderer]', event.message ?? legacyMessage);
    });
  }
  // Links open in the user's browser; the Argos window itself never leaves the app
  // (a file dropped on it would otherwise replace the app).
  win.webContents.setWindowOpenHandler(({ url }) => {
    const target = externalTarget(url);
    if (target) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, legacyUrl) => {
    if (!isAppUrl(event.url ?? legacyUrl)) event.preventDefault();
  });
  setupCapture(win);
  win.loadURL(DEMO ? `${APP_URL}?demo` : APP_URL);
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow = null;
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  // No hidden default menu: its accelerators (F11, Ctrl+R, Ctrl+W...) would fight Argos' own keys.
  Menu.setApplicationMenu(null);
  app.whenReady().then(() => {
    const ses = session.fromPartition(PARTITION);
    app.userAgentFallback = chromeUserAgent(app.userAgentFallback);
    ses.setUserAgent(chromeUserAgent(ses.getUserAgent()));
    const applyLanguage = keepTwitchLanguage(ses, () => settings.language);
    wireSettings(applyLanguage);
    shareTwitchCookies(ses);
    turnOffPasskeys(ses);
    ses.setPermissionRequestHandler((_wc, permission, callback) => callback(isAllowedPermission(permission)));
    ses.setPermissionCheckHandler((_wc, permission) => isAllowedPermission(permission));
    registerLocalhost(ses);
    if (process.env.ARGOS_DEBUG) logPlayerAuth(ses);
    mainWindow = createWindow(ses);
    wireWindow(mainWindow);
    wireAuth(mainWindow, ses, { afterLogout: applyLanguage });
    wireTwitchPage(mainWindow, ses);
  });
  app.on('window-all-closed', () => app.quit());
}
