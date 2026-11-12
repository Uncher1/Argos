// Demo mode for the real Electron app (npm run demo): real window, real Twitch
// players, but a simulated sign-in and a sample list of channels instead of the
// user's follows. Nothing here talks to the Twitch API.

const SESSION = { token: 'demo', userId: 'demo', login: 'demo' };

const CHANNELS = [
  ['kamet0', 'Kamet0', 'League of Legends', '21779'],
  ['ibai', 'ibai', 'League of Legends', '21779'],
  ['zackrawrr', 'zackrawrr', 'Just Chatting', '509658'],
  ['otplol_', 'OTPLOL_', 'League of Legends', '21779'],
  ['caedrel', 'Caedrel', 'League of Legends', '21779'],
  ['gotaga', 'Gotaga', 'Valorant', '516575'],
  ['squeezie', 'Squeezie', 'Just Chatting', '509658'],
  ['zerator', 'ZeratoR', 'Just Chatting', '509658'],
  ['domingo', 'Domingo', 'Just Chatting', '509658'],
  ['mistermv', 'MisterMV', 'Just Chatting', '509658'],
  ['rivenzi', 'Rivenzi', 'Valorant', '516575'],
  ['aminematue', 'AmineMaTue', 'Just Chatting', '509658'],
];

const CATEGORIES = [
  { id: '516575', name: 'Valorant' },
  { id: '21779', name: 'League of Legends' },
  { id: '509658', name: 'Just Chatting' },
];

const preview = (login) => `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-{width}x{height}.jpg`;
const boxArt = (id) => `https://static-cdn.jtvnw.net/ttv-boxart/${id}-{width}x{height}.jpg`;

const streams = (list) => list.map(([login, name, game, gameId], i) => ({
  user_login: login,
  user_name: name,
  game_name: game,
  game_id: gameId,
  viewer_count: Math.round(42000 / (1 + i * 0.7)),
  title: 'Demo: stream title',
  language: 'en',
  thumbnail_url: preview(login),
}));

function demoFetch(input) {
  const url = new URL(input);
  const q = url.searchParams;
  const query = (q.get('query') ?? '').toLowerCase();
  let body;
  if (url.pathname === '/helix/streams/followed') {
    body = { data: streams(CHANNELS), pagination: {} };
  } else if (url.pathname === '/helix/search/channels') {
    // Like Twitch: live channels also match on their game.
    const liveOnly = q.get('live_only') === 'true';
    body = {
      data: CHANNELS.filter(([login, name, game]) => login.includes(query) || name.toLowerCase().includes(query)
        || (liveOnly && game.toLowerCase().includes(query)))
        .slice(0, Number(q.get('first')))
        .map(([login, name, game]) => ({
          id: `id-${login}`, broadcaster_login: login, display_name: name, is_live: true, game_name: game, title: '',
          thumbnail_url: preview(login).replace('{width}x{height}', '64x64'),
        })),
    };
  } else if (url.pathname === '/helix/channels/followed') {
    body = { data: CHANNELS.slice(0, 6).map(([login, name]) => ({ broadcaster_login: login, broadcaster_id: `id-${login}`, broadcaster_name: name })), pagination: {} };
  } else if (url.pathname === '/helix/users') {
    const logins = q.getAll('login');
    body = { data: CHANNELS.filter(([login]) => logins.includes(login)).map(([login, name]) => ({ id: `id-${login}`, login, display_name: name, profile_image_url: preview(login).replace('{width}x{height}', '64x64') })) };
  } else if (url.pathname === '/helix/streams' && q.has('user_login')) {
    const logins = q.getAll('user_login');
    body = { data: streams(CHANNELS.filter(([login]) => logins.includes(login))), pagination: {} };
  } else if (url.pathname === '/helix/search/categories') {
    body = {
      data: CATEGORIES.filter((c) => c.name.toLowerCase().includes(query))
        .map((c) => ({ id: c.id, name: c.name, box_art_url: boxArt(c.id) })),
    };
  } else if (url.pathname === '/helix/games') {
    const names = q.getAll('name').map((n) => n.toLowerCase());
    body = { data: CATEGORIES.filter((c) => names.includes(c.name.toLowerCase())).map((c) => ({ id: c.id, name: c.name, box_art_url: boxArt(c.id) })) };
  } else if (url.pathname === '/helix/streams') {
    body = { data: streams(CHANNELS.filter((c) => c[3] === q.get('game_id'))), pagination: {} };
  } else {
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  }
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, status: 200, json: async () => body }), 200);
  });
}

const STYLE = `
  .demo-auth { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; padding: 24px; text-align: center; color: #8a8a93; font-size: 13.5px; line-height: 1.5;
    border-top: 1px dashed #3a3a42; }
  .demo-auth b { color: #eee; font-size: 14px; }
  .demo-auth button { border: 0; border-radius: 7px; padding: 9px 18px; background: #2a2a30; color: #fff;
    font-size: 13.5px; cursor: pointer; }
  .demo-auth button:hover { background: #3a3a42; }
  .demo-badge { position: fixed; left: 10px; bottom: 8px; z-index: 300; padding: 3px 9px; border-radius: 6px;
    background: rgba(145, 71, 255, 0.85); color: #fff; font-size: 11.5px; font-weight: 600; pointer-events: none; }
`;

// The Twitch pages cannot be shown without a real Twitch application, so the
// sign-in panel shows what will be there and a button to move on.
function demoStep(slot, title, text, button) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'demo-auth';
    const b = document.createElement('b');
    b.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = button;
    next.addEventListener('click', () => resolve());
    box.append(b, p, next);
    slot.replaceChildren(box);
  });
}

export function installDemo(real) {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const badge = document.createElement('div');
  badge.className = 'demo-badge';
  badge.textContent = 'Demo mode';
  document.body.append(badge);

  // The simulated sign-in lasts until the app closes, like a real session
  // survives a reload (after a language change).
  const DEMO_KEY = 'argos.demo.signedIn';
  const keep = (value) => {
    try {
      if (value) sessionStorage.setItem(DEMO_KEY, '1');
      else sessionStorage.removeItem(DEMO_KEY);
    } catch {}
  };
  let loggedIn = (() => {
    try {
      return sessionStorage.getItem(DEMO_KEY) === '1';
    } catch {
      return false;
    }
  })();
  let cancelLogin = null;
  const stageListeners = new Set();
  const emitStage = (stage) => stageListeners.forEach((cb) => cb(stage));

  const argos = {
    ...real,
    getSession: async () => (loggedIn ? SESSION : null),
    renewSession: async () => SESSION,
    getClientId: async () => 'demo',
    logout: async () => {
      loggedIn = false;
      keep(false);
    },
    login: {
      async start() {
        const slot = document.querySelector('.auth-slot');
        const cancelled = new Promise((resolve) => {
          cancelLogin = () => resolve('cancel');
        });
        emitStage('login');
        const first = await Promise.race([cancelled, demoStep(slot,
          'Here: the real Twitch sign-in page',
          'Username, password, verification code. The official Twitch page shows up in this frame.',
          'Simulate the sign-in')]);
        if (first === 'cancel') return null;
        emitStage('consent');
        const second = await Promise.race([cancelled, demoStep(slot,
          'Here: the Twitch consent page',
          'Twitch asks whether Argos may see the channels you follow. It only shows up at the very first sign-in.',
          'Simulate the consent')]);
        slot.replaceChildren();
        if (second === 'cancel') return null;
        loggedIn = true;
        keep(true);
        return SESSION;
      },
      setBounds: () => {},
      cancel: () => cancelLogin?.(),
      onStage(cb) {
        stageListeners.add(cb);
        return () => stageListeners.delete(cb);
      },
      // No Twitch page in the demo panel, so no page height to follow.
      onContentHeight: () => () => {},
    },
  };

  return { argos, fetchImpl: demoFetch, flags: new Set() };
}
