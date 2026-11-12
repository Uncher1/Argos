import { rankByName, similarity, typoQueries } from './fuzzy.js';

const CLOSE = 0.75;
const NEAR = 0.6;

const namesOf = (c) => [c.login, c.name];

// What the query would be as a Twitch login, or null when it cannot be one.
const asLogin = (query) => {
  const login = query.trim().toLowerCase();
  return /^[a-z0-9_]{3,25}$/.test(login) ? login : null;
};

const first = (item, items, key) => (item ? [item, ...items.filter((i) => i[key] !== item[key])] : items);

const unique = (items, key) => {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  });
};

// Twitch's search only finds names that start like what was typed. When
// nothing close comes back (a typo), shorter searches and the user's own
// follows are ranked by how close they are to the query instead.
export function createSearch({ api, getFollowed, getLiveLogins }) {
  const isClose = (query, items, names) => items.some((item) => names(item).some((n) => similarity(query, n) >= CLOSE));

  async function followedMatches(query, threshold, exclude) {
    const followed = await getFollowed().catch(() => []);
    return rankByName(query, followed, namesOf, threshold).filter((f) => !exclude.has(f.login));
  }

  // Followed channels found locally still need an avatar.
  async function asChannels(followed) {
    if (!followed.length) return [];
    const users = await api.getUsers(followed.map((f) => f.login)).catch(() => []);
    const live = getLiveLogins();
    return followed.map((f) => {
      const user = users.find((u) => u.login === f.login);
      return {
        id: user?.id ?? f.id,
        login: f.login,
        name: f.name || user?.name || f.login,
        isLive: live.has(f.login),
        game: '',
        title: '',
        avatar: user?.avatar ?? '',
      };
    });
  }

  // Twitch's search can miss a channel or a game typed exactly: both are
  // looked up by name and put first.
  async function exactChannel(query) {
    const login = asLogin(query);
    if (!login) return null;
    const [users, streams] = await Promise.all([api.getUsers([login]), api.getStreamsByLogins([login])]);
    const user = users[0];
    if (!user) return null;
    const stream = streams[0];
    return {
      id: user.id,
      login: user.login,
      name: user.name,
      isLive: Boolean(stream),
      game: stream?.game ?? '',
      title: stream?.title ?? '',
      avatar: user.avatar,
    };
  }

  async function run(query, { channels: maxChannels = 8, categories: maxCategories = 5 } = {}) {
    const [searched, searchedCategories, exact, exactGames] = await Promise.all([
      api.searchChannels(query, maxChannels),
      api.searchCategories(query, maxCategories),
      exactChannel(query).catch(() => null),
      api.getGamesByName([query.trim()]).catch(() => []),
    ]);
    const top = exact && (searched.find((c) => c.login === exact.login) ?? exact);
    const channels = first(top, searched, 'login');
    const categories = first(exactGames[0], searchedCategories, 'id').slice(0, maxCategories);

    if (isClose(query, channels, namesOf) || isClose(query, categories, (c) => [c.name])) {
      const followed = await asChannels(await followedMatches(query, CLOSE, new Set(channels.map((c) => c.login))));
      return { channels: first(top, [...followed, ...channels], 'login').slice(0, maxChannels), categories, approximate: false };
    }

    const batches = await Promise.all(typoQueries(query).map((q) => Promise.all([
      api.searchChannels(q, 20).catch(() => []),
      api.searchCategories(q, 10).catch(() => []),
    ])));
    const allChannels = unique([...channels, ...batches.flatMap(([c]) => c)], 'login');
    const allCategories = unique([...categories, ...batches.flatMap(([, c]) => c)], 'id');
    const found = rankByName(query, allChannels, namesOf, NEAR);
    const followed = await asChannels(await followedMatches(query, NEAR, new Set(found.map((c) => c.login))));
    return {
      channels: rankByName(query, [...found, ...followed], namesOf, NEAR).slice(0, maxChannels),
      categories: rankByName(query, allCategories, (c) => [c.name], NEAR).slice(0, maxCategories),
      approximate: true,
    };
  }

  return { run };
}

// Sections of the results page (games, live channels, other channels), the
// one holding the name closest to the query first, as Twitch does. Ties keep
// the given order.
export function rankSections(query, groups) {
  const best = (names) => names.reduce((top, name) => Math.max(top, similarity(query, name)), 0);
  return groups
    .map((group, i) => ({ key: group.key, score: best(group.names), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((group) => group.key);
}
