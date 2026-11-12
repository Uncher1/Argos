const HELIX = 'https://api.twitch.tv/helix';

export class TwitchApiError extends Error {
  constructor(status) {
    super(`Twitch answered ${status}`);
    this.name = 'TwitchApiError';
    this.status = status;
  }
}

const toStream = (s) => ({
  login: s.user_login,
  name: s.user_name,
  title: s.title,
  game: s.game_name,
  gameId: s.game_id,
  viewers: s.viewer_count,
  thumbnail: s.thumbnail_url,
  language: s.language,
});

const toChannel = (c) => ({
  id: c.id,
  login: c.broadcaster_login,
  name: c.display_name,
  isLive: c.is_live,
  game: c.game_name,
  title: c.title,
  avatar: c.thumbnail_url,
});

const toCategory = (c) => ({ id: c.id, name: c.name, boxArt: c.box_art_url });

export function createTwitchApi({ clientId, getToken, onUnauthorized, fetchImpl }) {
  const send = (url, token) => fetchImpl(url, {
    headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
  });

  // One renewal and one retry on 401, never more.
  async function request(path, params) {
    const url = new URL(HELIX + path);
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      for (const item of [value].flat()) url.searchParams.append(key, String(item));
    }
    let res = await send(url.toString(), await getToken());
    if (res.status === 401) {
      const fresh = await onUnauthorized();
      if (!fresh) throw new TwitchApiError(401);
      res = await send(url.toString(), fresh);
    }
    if (!res.ok) throw new TwitchApiError(res.status);
    return res.json();
  }

  async function pages(path, params, maxPages = Infinity) {
    const items = [];
    let after = null;
    for (let page = 0; page < maxPages; page += 1) {
      const body = await request(path, { ...params, after });
      items.push(...body.data);
      after = body.pagination?.cursor ?? null;
      if (!after) return { items, capped: false };
    }
    return { items, capped: true };
  }

  return {
    async getFollowedStreams(userId) {
      const { items } = await pages('/streams/followed', { user_id: userId, first: 100 });
      return items.map(toStream).sort((a, b) => b.viewers - a.viewers);
    },

    // Twitch matches live channels on their name and their game, other
    // channels on their name only: both searches are merged, live first.
    async searchChannels(query, first = 8) {
      const [live, all] = await Promise.all([
        request('/search/channels', { query, first, live_only: true }),
        request('/search/channels', { query, first }),
      ]);
      const seen = new Set();
      const channels = [...live.data, ...all.data].map(toChannel).filter((c) => {
        if (seen.has(c.login)) return false;
        seen.add(c.login);
        return true;
      });
      return [...channels.filter((c) => c.isLive), ...channels.filter((c) => !c.isLive)];
    },

    async getStreamsByLogins(logins) {
      if (!logins.length) return [];
      const body = await request('/streams', { user_login: logins.slice(0, 100), first: 100 });
      return body.data.map(toStream).sort((a, b) => b.viewers - a.viewers);
    },

    // Every channel the user follows, live or not.
    async getFollowedChannels(userId) {
      const { items } = await pages('/channels/followed', { user_id: userId, first: 100 });
      return items.map((f) => ({ id: f.broadcaster_id, login: f.broadcaster_login, name: f.broadcaster_name }));
    },

    // Twitch answers for 100 channels at most per request.
    async getUsers(logins) {
      const batches = [];
      for (let i = 0; i < logins.length; i += 100) batches.push(logins.slice(i, i + 100));
      const bodies = await Promise.all(batches.map((batch) => request('/users', { login: batch })));
      return bodies.flatMap((body) => body.data).map((u) => ({ id: u.id, login: u.login, name: u.display_name, avatar: u.profile_image_url }));
    },

    async searchCategories(query, first = 5) {
      const body = await request('/search/categories', { query, first });
      return body.data.map(toCategory);
    },

    // Exact names only: the search does not always put them first.
    async getGamesByName(names) {
      if (!names.length) return [];
      const body = await request('/games', { name: names.slice(0, 100) });
      return body.data.map(toCategory);
    },

    async getStreamsByGame(gameId, language, maxPages = 10) {
      const { items, capped } = await pages('/streams', { game_id: gameId, first: 100, language }, maxPages);
      return { streams: items.map(toStream), capped };
    },
  };
}
