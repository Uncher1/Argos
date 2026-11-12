import { showContextMenu } from './context-menu.js';
import { attachDrag } from './drag.js';
import { getLanguage, setLanguage, t } from './i18n/index.js';
import { localeTag } from './i18n/languages.js';
import { chooseLanguage } from './language-picker.js';
import { showLogin } from './login.js';
import { createPicker } from './picker.js';
import { createTwitchPlayer } from './player.js';
import { createStage } from './stage.js';
import {
  addChannel, canFeature, count, createState, feature, removeAt, replaceAt, restoreState, toggleChannel, unfeature,
} from './state.js';
import { createTopBand } from './top-band.js';
import { createTwitchApi } from './twitch-api.js';
import { closeTwitchPage, isTwitchPageOpen, showTwitchPage } from './twitch-page.js';

const ui = document.getElementById('ui');
const stageRoot = document.getElementById('stage');
const FOLLOWS_REFRESH = 120000;
// Streams on screen, kept while the page reloads in another language.
const RESTORE_KEY = 'argos.streams';

function applyLanguage(code) {
  setLanguage(code);
  document.documentElement.lang = localeTag(getLanguage());
}

// Saves the new language and reloads the page in it, streams included.
async function switchLanguage(argos, code, state = null) {
  if (!code) return;
  await argos.settings.setLanguage(code);
  try {
    if (state?.channels.length) sessionStorage.setItem(RESTORE_KEY, JSON.stringify(state));
  } catch {}
  location.reload();
}

function takeSavedStreams() {
  try {
    const saved = restoreState(sessionStorage.getItem(RESTORE_KEY));
    sessionStorage.removeItem(RESTORE_KEY);
    return saved;
  } catch {
    return null;
  }
}

export async function start(deps = {}) {
  const argos = deps.argos ?? window.argos;
  // The language comes first: chosen once, at the very first launch.
  const settings = await argos.settings.get();
  let language = settings.language;
  if (!language) {
    language = await chooseLanguage(ui, argos, { selected: settings.suggested });
    await argos.settings.setLanguage(language);
  }
  applyLanguage(language);

  const clientId = await argos.getClientId();
  let main = null;
  let relogging = false;

  const login = () => showLogin(ui, argos, {
    onChangeLanguage: async () => switchLanguage(argos, await chooseLanguage(ui, argos, { selected: getLanguage() })),
  });

  async function enter(session) {
    await argos.window.setMode('main');
    main = runMain({ argos, session, clientId, deps, onLost: relogin });
  }

  async function relogin() {
    if (relogging) return;
    relogging = true;
    main?.stop();
    main = null;
    const session = await login();
    relogging = false;
    await enter(session);
  }

  argos.onSessionLost(relogin);
  const session = await argos.getSession();
  if (session) await enter(session);
  else await enter(await login());
}

function runMain({ argos, session, clientId, deps, onLost }) {
  const playerFactory = deps.playerFactory ?? createTwitchPlayer;
  let current = session;
  let state = createState();
  let drag = null;
  let picker = null;

  const api = createTwitchApi({
    clientId,
    getToken: async () => current.token,
    onUnauthorized: async () => {
      const renewed = await argos.renewSession();
      if (renewed) {
        current = renewed;
        return renewed.token;
      }
      onLost();
      return null;
    },
    fetchImpl: deps.fetchImpl ?? ((url, init) => fetch(url, init)),
  });

  const setState = (next) => {
    state = next;
    stage.render(state);
    picker?.update();
  };

  // The spotlight only exists from 3 streams on; going back to 4 equal
  // tiles only with 4 streams.
  const streamMenu = (index, x, y) => {
    if (index < 0) return;
    const items = [];
    if (canFeature(state)) {
      if (!state.featured || index !== 0) {
        items.push({ label: t('stream.feature'), onSelect: () => setState(feature(state, index)) });
      } else if (count(state) === 4) {
        items.push({ label: t('stream.unfeature'), onSelect: () => setState(unfeature(state)) });
      }
    }
    items.push({ label: t('stream.remove'), danger: true, onSelect: () => setState(removeAt(state, index)) });
    showContextMenu({ x, y, items });
  };

  const stage = createStage(stageRoot, {
    playerFactory,
    onEmptyClick: () => picker.open('reopen'),
    onStreamContextMenu: streamMenu,
    onStreamPointerDown: (index, event) => drag.onPointerDown(index, event),
    nameOf: (login) => picker?.nameOf(login) ?? login,
  });
  drag = attachDrag({ stage, getState: () => state, setState, overlayRoot: ui });
  picker = createPicker({
    api,
    getUserId: () => current.userId,
    getState: () => state,
    onToggle: (login) => setState(toggleChannel(state, login).state),
    onReplace: (index, login) => setState(replaceAt(state, index, login)),
    onOpenTwitchPage: (login, name) => showTwitchPage({ argos, login, name }),
  });

  const band = createTopBand(ui, {
    argos,
    onOpenPicker: () => picker.open('reopen'),
    onLogout: async () => {
      await argos.logout();
      onLost();
    },
    onLanguage: async () => {
      const code = await chooseLanguage(ui, argos, { selected: getLanguage(), asDialog: true });
      if (code && code !== getLanguage()) await switchLanguage(argos, code, state);
    },
  });
  const stopCount = picker.onCountChange((n) => band.setCount(n));
  const refreshCount = () => picker.refreshFollows().catch(() => {});
  const countTimer = setInterval(refreshCount, FOLLOWS_REFRESH);

  // F11: full screen. Escape closes what is open, innermost first
  // (the right-click menu handles its own Escape).
  const onKey = (event) => {
    if (event.key === 'F11') {
      event.preventDefault();
      argos.window.toggleFullscreen();
      return;
    }
    if (event.key !== 'Escape') return;
    if (isTwitchPageOpen()) closeTwitchPage();
    else if (picker.isReplaceOpen()) picker.closeReplace();
    else if (picker.isOpen()) picker.close();
    else argos.window.exitFullscreen();
  };
  addEventListener('keydown', onKey);

  // Test bench only: ?mock&fill=N starts with N streams already on screen.
  const fill = deps.flags?.has('fill') ? new URLSearchParams(location.search).get('fill') || '4' : null;
  const saved = takeSavedStreams();
  if (fill) {
    const logins = ['a_channel', 'b_channel', 'offline_c', 'gate_d'].slice(0, Number(fill) || 4);
    setState(logins.reduce((s, l) => addChannel(s, l).state, state));
    refreshCount();
  } else if (saved) {
    setState(saved);
    refreshCount();
  } else {
    setState(state);
    picker.open('launch');
  }

  return {
    stop() {
      removeEventListener('keydown', onKey);
      clearInterval(countTimer);
      closeTwitchPage();
      stopCount();
      band.destroy();
      picker.destroy();
      stage.destroy();
    },
  };
}
