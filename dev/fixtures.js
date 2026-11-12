// Fake Helix answers for the browser test bench.
const COLORS = [
  ['#2b2350', '#141220'], ['#1f3a2e', '#0f1a15'], ['#3a2a1a', '#1a130c'], ['#1c2c44', '#0d1420'],
  ['#44203a', '#1d0d18'], ['#2d3a16', '#141a0a'], ['#1a3a3a', '#0b1a1a'], ['#3a1a1a', '#1a0b0b'],
];

const image = (i, w, h) => {
  const [a, b] = COLORS[i % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const FOLLOWS = [
  ['kameto_like', 'Kameto Like', 'Valorant', 12400, 'Ranked with the team'],
  ['channel_b', 'Channel B', 'Just Chatting', 8100, 'Talking about everything'],
  ['channel_c', 'Channel C', 'League of Legends', 3900, 'Road to Master'],
  ['channel_d', 'Channel D', 'Minecraft', 1200, 'Hardcore day 12'],
  ['channel_e', 'Channel E', 'Fortnite', 980, 'Evening tournament'],
  ['channel_f', 'Channel F', 'Rocket League', 640, 'Ranked 2v2'],
  ['channel_g', 'Channel G', 'Counter-Strike 2', 410, 'Faceit level 10'],
  ['channel_h', 'Channel H', 'Art', 220, 'Live drawing'],
  ['channel_i', 'Channel I', 'Music', 180, 'Lofi and chill'],
  ['channel_j', 'Channel J', 'Valorant', 150, 'Chill unrated'],
  ['offline_k', 'Channel K offline', 'Just Chatting', 120, 'About to go offline'],
  ['gate_l', 'Channel L (mature)', 'Horror', 90, 'Mature content'],
].map(([login, name, game, viewers, title], i) => ({
  user_login: login, user_name: name, game_name: game, game_id: game === 'Valorant' ? '516575' : '1',
  viewer_count: viewers, title, language: 'en', thumbnail_url: image(i, 440, 248),
}));

const CHANNELS = [
  { broadcaster_login: 'valo_pro_fr', display_name: 'valo_pro_fr', is_live: true, game_name: 'Valorant', title: 'Radiant ranked' },
  { broadcaster_login: 'valorant_esport', display_name: 'valorant_esport', is_live: true, game_name: 'Valorant', title: 'Champions' },
  { broadcaster_login: 'valo_offline', display_name: 'valo_offline', is_live: false, game_name: 'Valorant', title: '' },
  ...FOLLOWS.map((f) => ({ broadcaster_login: f.user_login, display_name: f.user_name, is_live: true, game_name: f.game_name, title: f.title })),
].map((c, i) => ({ ...c, id: `id-${c.broadcaster_login}`, thumbnail_url: image(i + 3, 64, 64) }));

const FOLLOWED = new Set(['kameto_like', 'channel_b', 'channel_c', 'valo_pro_fr', 'valo_offline']);

const CATEGORIES = [
  { id: '516575', name: 'Valorant', box_art_url: image(4, 52, 72) },
  { id: '21779', name: 'League of Legends', box_art_url: image(2, 52, 72) },
  { id: '509658', name: 'Just Chatting', box_art_url: image(1, 52, 72) },
];

const gameStreams = (gameId, language) => {
  const total = language === 'en' ? 1204 : 2470;
  return Array.from({ length: total }, (_, i) => ({
    user_login: `streamer_${gameId}_${i}`, user_name: `Streamer ${i + 1}`, game_name: 'Valorant', game_id: gameId,
    viewer_count: Math.max(1, Math.round(15200 / (1 + i * 0.6))), title: `Stream number ${i + 1}`,
    language: language ?? 'en', thumbnail_url: image(i, 440, 248),
  }));
};

const page = (items, after, size = 100) => {
  const start = Number(after ?? 0);
  const data = items.slice(start, start + size);
  const next = start + size < items.length ? String(start + size) : undefined;
  return { data, pagination: next ? { cursor: next } : {} };
};

export function createMockFetch(flags) {
  return async (input) => {
    await new Promise((r) => setTimeout(r, 150));
    const url = new URL(input);
    const q = url.searchParams;
    const query = (q.get('query') ?? '').toLowerCase();
    let body;
    if (url.pathname === '/helix/streams/followed') {
      body = page(flags.has('nofollows') ? [] : FOLLOWS, q.get('after'));
    } else if (url.pathname === '/helix/search/channels') {
      // Like Twitch: live channels also match on their game.
      const liveOnly = q.get('live_only') === 'true';
      const match = (c) => c.broadcaster_login.includes(query) || c.display_name.toLowerCase().includes(query)
        || (liveOnly && c.game_name.toLowerCase().includes(query));
      body = { data: CHANNELS.filter((c) => (!liveOnly || c.is_live) && match(c)).slice(0, Number(q.get('first'))) };
    } else if (url.pathname === '/helix/channels/followed') {
      body = { data: [...FOLLOWED].map((login) => ({ broadcaster_login: login, broadcaster_id: `id-${login}`, broadcaster_name: CHANNELS.find((c) => c.broadcaster_login === login)?.display_name ?? login })), pagination: {} };
    } else if (url.pathname === '/helix/users') {
      const logins = q.getAll('login');
      body = { data: CHANNELS.filter((c) => logins.includes(c.broadcaster_login)).map((c) => ({ id: c.id, login: c.broadcaster_login, display_name: c.display_name, profile_image_url: c.thumbnail_url })) };
    } else if (url.pathname === '/helix/streams' && q.has('user_login')) {
      const logins = q.getAll('user_login');
      const live = CHANNELS.filter((c) => c.is_live).map((c, i) => ({
        user_login: c.broadcaster_login, user_name: c.display_name, game_name: c.game_name, game_id: '1',
        viewer_count: 3000 - i * 100, title: c.title, language: 'en', thumbnail_url: image(i, 440, 248),
      }));
      const all = [...FOLLOWS, ...live].filter((s, i, a) => a.findIndex((x) => x.user_login === s.user_login) === i);
      body = { data: all.filter((s) => logins.includes(s.user_login)), pagination: {} };
    } else if (url.pathname === '/helix/search/categories') {
      body = { data: CATEGORIES.filter((c) => c.name.toLowerCase().includes(query)).slice(0, Number(q.get('first'))) };
    } else if (url.pathname === '/helix/games') {
      const names = q.getAll('name').map((n) => n.toLowerCase());
      body = { data: CATEGORIES.filter((c) => names.includes(c.name.toLowerCase())) };
    } else if (url.pathname === '/helix/streams') {
      body = page(gameStreams(q.get('game_id'), q.get('language')), q.get('after'));
    } else {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => body };
  };
}
