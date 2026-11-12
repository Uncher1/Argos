import { createMockFetch } from './fixtures.js';
import { createMockPlayer } from './mock-player.js';

// Browser test bench: fakes the Electron bridge (window.argos).
// Flags come from the query string: ?mock&login&noclient&slowlogin...
export function installMocks(flags) {
  document.documentElement.dataset.mock = '1';
  const session = { token: 'mock', userId: '1', login: 'you' };
  const listeners = { stage: new Set(), lost: new Set(), topband: new Set(), maximized: new Set() };
  const emit = (name, ...args) => listeners[name].forEach((cb) => cb(...args));
  const on = (name) => (cb) => {
    listeners[name].add(cb);
    return () => listeners[name].delete(cb);
  };
  let loggedIn = !flags.has('login');
  // ?firstrun shows the language choice of the very first launch.
  let language = flags.has('firstrun') ? null : 'en';
  let pendingLogin = null;

  window.argos = {
    getSession: async () => (loggedIn ? session : null),
    renewSession: async () => (loggedIn ? session : null),
    getClientId: async () => (flags.has('noclient') ? null : 'mock-client'),
    logout: async () => {
      loggedIn = false;
    },
    onSessionLost: on('lost'),
    settings: {
      get: async () => ({ language, suggested: 'en' }),
      setLanguage: async (code) => {
        language = code;
        return true;
      },
    },
    onTopBand: on('topband'),
    twitchPage: { open: async () => true, setBounds: () => {}, close: () => {} },
    window: {
      setMode: async (mode) => {
        document.documentElement.dataset.windowMode = mode;
      },
      fitHeight: () => {},
      minimize: () => {},
      toggleMaximize: () => {},
      close: () => {
        document.documentElement.dataset.closed = '1';
      },
      toggleFullscreen: () => {},
      exitFullscreen: () => {},
      isFullscreen: async () => false,
      isMaximized: async () => false,
      onMaximized: on('maximized'),
    },
    login: {
      start: () => new Promise((resolve) => {
        if (flags.has('noclient')) {
          resolve({ error: 'missing-client-id' });
          return;
        }
        pendingLogin = resolve;
        emit('stage', 'login');
        setTimeout(() => emit('stage', 'consent'), 600);
        if (!flags.has('slowlogin')) {
          setTimeout(() => {
            loggedIn = true;
            pendingLogin = null;
            resolve(session);
          }, 1200);
        }
      }),
      setBounds: () => {},
      cancel: () => {
        pendingLogin?.(null);
        pendingLogin = null;
      },
      onStage: on('stage'),
      onContentHeight: on('contentHeight'),
    },
  };

  // Same rule as the main process: reveal at the top edge, keep near it.
  let bandVisible = false;
  const setBand = (visible) => {
    if (visible === bandVisible) return;
    bandVisible = visible;
    emit('topband', visible);
  };
  addEventListener('mousemove', (e) => setBand(e.clientY < (bandVisible ? 110 : 64)));
  document.documentElement.addEventListener('mouseleave', () => setBand(false));

  window.__ARGOS_TEST__ = { flags, playerFactory: createMockPlayer, fetchImpl: createMockFetch(flags) };
}
