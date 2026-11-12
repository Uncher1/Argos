import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTwitchApi, TwitchApiError } from '../src/renderer/twitch-api.js';

// Returns queued responses in order and records every request.
function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url: new URL(url), headers: init.headers ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request ' + url);
    return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body };
  };
  return { impl, calls };
}

const stream = (login, viewers, extra = {}) => ({
  user_login: login, user_name: login.toUpperCase(), title: 't-' + login, game_name: 'G', game_id: '9',
  viewer_count: viewers, thumbnail_url: 'https://t/' + login + '-{width}x{height}.jpg', language: 'fr', ...extra,
});

const api = (fetchImpl, opts = {}) => createTwitchApi({
  clientId: 'cid',
  getToken: async () => 'tok1',
  onUnauthorized: opts.onUnauthorized ?? (async () => null),
  fetchImpl,
});

test('follows: headers, paging, sorting', async () => {
  const { impl, calls } = fakeFetch([
    { status: 200, body: { data: [stream('a', 5), stream('b', 50)], pagination: { cursor: 'c1' } } },
    { status: 200, body: { data: [stream('c', 20)], pagination: {} } },
  ]);
  const list = await api(impl).getFollowedStreams('42');
  assert.deepEqual(list.map((s) => s.viewers), [50, 20, 5]);
  assert.deepEqual(list[0], {
    login: 'b', name: 'B', title: 't-b', game: 'G', gameId: '9', viewers: 50,
    thumbnail: 'https://t/b-{width}x{height}.jpg', language: 'fr',
  });
  assert.equal(calls[0].url.origin + calls[0].url.pathname, 'https://api.twitch.tv/helix/streams/followed');
  assert.equal(calls[0].url.searchParams.get('user_id'), '42');
  assert.equal(calls[0].url.searchParams.get('first'), '100');
  assert.equal(calls[0].headers['Client-Id'], 'cid');
  assert.equal(calls[0].headers.Authorization, 'Bearer tok1');
  assert.equal(calls[1].url.searchParams.get('after'), 'c1');
});

test('401 then 200: a single renewal', async () => {
  let renewals = 0;
  const { impl, calls } = fakeFetch([
    { status: 401, body: {} },
    { status: 200, body: { data: [], pagination: {} } },
  ]);
  const list = await api(impl, { onUnauthorized: async () => { renewals += 1; return 'tok2'; } }).getFollowedStreams('42');
  assert.deepEqual(list, []);
  assert.equal(renewals, 1);
  assert.equal(calls[1].headers.Authorization, 'Bearer tok2');
});

test('401 then 401: error, no loop', async () => {
  const { impl, calls } = fakeFetch([{ status: 401, body: {} }, { status: 401, body: {} }]);
  await assert.rejects(
    api(impl, { onUnauthorized: async () => 'tok2' }).getFollowedStreams('42'),
    (err) => err instanceof TwitchApiError && err.status === 401,
  );
  assert.equal(calls.length, 2);
});

test('401 without a new token: error 401 without retrying', async () => {
  const { impl, calls } = fakeFetch([{ status: 401, body: {} }]);
  await assert.rejects(api(impl).getFollowedStreams('42'), (err) => err.status === 401);
  assert.equal(calls.length, 1);
});

test('429 : TwitchApiError 429', async () => {
  const { impl } = fakeFetch([{ status: 429, body: {} }]);
  await assert.rejects(api(impl).searchCategories('x'), (err) => err instanceof TwitchApiError && err.status === 429);
});

const ch = (login, live) => ({
  id: 'id-' + login, broadcaster_login: login, display_name: login.toUpperCase(), is_live: live,
  game_name: 'G', title: 'T', thumbnail_url: 'https://a/' + login + '.png',
});

test('channel search: live on this name or game first, then all', async () => {
  const { impl, calls } = fakeFetch([
    { status: 200, body: { data: [ch('livegame1', true), ch('live2', true)] } },
    { status: 200, body: { data: [ch('off1', false), ch('live2', true), ch('live3', true), ch('off2', false)] } },
  ]);
  const list = await api(impl).searchChannels('valo');
  assert.deepEqual(list.map((c) => c.login), ['livegame1', 'live2', 'live3', 'off1', 'off2']);
  assert.deepEqual(list[0], { id: 'id-livegame1', login: 'livegame1', name: 'LIVEGAME1', isLive: true, game: 'G', title: 'T', avatar: 'https://a/livegame1.png' });
  assert.equal(calls[0].url.pathname, '/helix/search/channels');
  assert.equal(calls[0].url.searchParams.get('query'), 'valo');
  assert.equal(calls[0].url.searchParams.get('live_only'), 'true');
  assert.equal(calls[0].url.searchParams.get('first'), '8');
  assert.equal(calls[1].url.searchParams.has('live_only'), false);
});

test('streams of several channels', async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: { data: [stream('a', 9), stream('b', 30)], pagination: {} } }]);
  const list = await api(impl).getStreamsByLogins(['a', 'b']);
  assert.deepEqual(list.map((s) => s.login), ['b', 'a']);
  assert.equal(calls[0].url.pathname, '/helix/streams');
  assert.deepEqual(calls[0].url.searchParams.getAll('user_login'), ['a', 'b']);
  const { impl: none, calls: noCalls } = fakeFetch([]);
  assert.deepEqual(await api(none).getStreamsByLogins([]), []);
  assert.equal(noCalls.length, 0);
});

test('followed channels: every page', async () => {
  const followed = (login) => ({ broadcaster_id: 'id-' + login, broadcaster_login: login, broadcaster_name: login, followed_at: '2026-01-01' });
  const { impl, calls } = fakeFetch([
    { status: 200, body: { data: [followed('a'), followed('b')], pagination: { cursor: 'c1' } } },
    { status: 200, body: { data: [followed('c')], pagination: {} } },
  ]);
  const list = await api(impl).getFollowedChannels('42');
  assert.deepEqual(list.map((c) => c.login), ['a', 'b', 'c']);
  assert.deepEqual(list[0], { id: 'id-a', login: 'a', name: 'a' });
  assert.equal(calls[0].url.pathname, '/helix/channels/followed');
  assert.equal(calls[0].url.searchParams.get('user_id'), '42');
  assert.equal(calls[1].url.searchParams.get('after'), 'c1');
});

test('profiles of several channels', async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: { data: [
    { id: '1', login: 'kameto', display_name: 'Kameto', profile_image_url: 'https://p/k.png' },
  ] } }]);
  assert.deepEqual(await api(impl).getUsers(['kameto']), [{ id: '1', login: 'kameto', name: 'Kameto', avatar: 'https://p/k.png' }]);
  assert.equal(calls[0].url.pathname, '/helix/users');
  assert.deepEqual(calls[0].url.searchParams.getAll('login'), ['kameto']);
  const { impl: none, calls: noCalls } = fakeFetch([]);
  assert.deepEqual(await api(none).getUsers([]), []);
  assert.equal(noCalls.length, 0);
});

test('category search', async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: { data: [{ id: '1', name: 'Valorant', box_art_url: 'https://b/{width}x{height}.jpg' }] } }]);
  assert.deepEqual(await api(impl).searchCategories('valo'), [{ id: '1', name: 'Valorant', boxArt: 'https://b/{width}x{height}.jpg' }]);
  assert.equal(calls[0].url.pathname, '/helix/search/categories');
  assert.equal(calls[0].url.searchParams.get('first'), '5');
});

test('streams of a game, capped', async () => {
  const { impl, calls } = fakeFetch([
    { status: 200, body: { data: [stream('a', 9)], pagination: { cursor: 'p1' } } },
    { status: 200, body: { data: [stream('b', 8)], pagination: { cursor: 'p2' } } },
  ]);
  const res = await api(impl).getStreamsByGame('33', 'fr', 2);
  assert.equal(res.capped, true);
  assert.deepEqual(res.streams.map((s) => s.login), ['a', 'b']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.pathname, '/helix/streams');
  assert.equal(calls[0].url.searchParams.get('game_id'), '33');
  assert.equal(calls[0].url.searchParams.get('language'), 'fr');
  assert.equal(calls[1].url.searchParams.get('after'), 'p1');
});

test('streams of a game without language or cap', async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: { data: [stream('a', 9)], pagination: {} } }]);
  const res = await api(impl).getStreamsByGame('33', null);
  assert.equal(res.capped, false);
  assert.equal(calls[0].url.searchParams.has('language'), false);
});

test('games by exact name', async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: { data: [{ id: '27471', name: 'Minecraft', box_art_url: 'https://b/m-{width}x{height}.jpg' }] } }]);
  assert.deepEqual(await api(impl).getGamesByName(['minecraft']), [{ id: '27471', name: 'Minecraft', boxArt: 'https://b/m-{width}x{height}.jpg' }]);
  assert.equal(calls[0].url.pathname, '/helix/games');
  assert.deepEqual(calls[0].url.searchParams.getAll('name'), ['minecraft']);
  const { impl: none, calls: noCalls } = fakeFetch([]);
  assert.deepEqual(await api(none).getGamesByName([]), []);
  assert.equal(noCalls.length, 0);
});

test('profiles of more than 100 channels: in batches of 100', async () => {
  const logins = Array.from({ length: 150 }, (_, i) => 'c' + i);
  const user = (login) => ({ id: login, login, display_name: login, profile_image_url: '' });
  const { impl, calls } = fakeFetch([
    { status: 200, body: { data: logins.slice(0, 100).map(user) } },
    { status: 200, body: { data: logins.slice(100).map(user) } },
  ]);
  const list = await api(impl).getUsers(logins);
  assert.equal(list.length, 150);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.getAll('login').length, 100);
  assert.deepEqual(calls[1].url.searchParams.getAll('login'), logins.slice(100));
});
