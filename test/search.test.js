import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearch } from '../src/renderer/search.js';

const channel = (login, name = login, isLive = true) => ({ id: 'id-' + login, login, name, isLive, game: 'G', title: '', avatar: 'a-' + login });

// Fake Twitch: channels and games whose name starts with the query.
// `users` are accounts that exist without showing up in the search.
function fakeApi({ channels = [], categories = [], users = [], live = [] } = {}) {
  const calls = [];
  const known = [...channels.map((c) => c.login), ...users];
  return {
    calls,
    async searchChannels(q) {
      calls.push(['channels', q]);
      return channels.filter((c) => c.login.startsWith(q.toLowerCase()));
    },
    async searchCategories(q) {
      calls.push(['categories', q]);
      return categories.filter((c) => c.name.toLowerCase().startsWith(q.toLowerCase()));
    },
    async getUsers(logins) {
      calls.push(['users', logins.join(',')]);
      return logins.filter((l) => known.includes(l)).map((login) => ({ id: 'id-' + login, login, name: login.toUpperCase(), avatar: 'u-' + login }));
    },
    async getStreamsByLogins(logins) {
      calls.push(['streams', logins.join(',')]);
      return live.filter((s) => logins.includes(s.login));
    },
    async getGamesByName(names) {
      calls.push(['games', names.join(',')]);
      return categories.filter((c) => names.some((n) => n.toLowerCase() === c.name.toLowerCase()));
    },
  };
}

const search = (api, followed = [], live = new Set()) => createSearch({
  api, getFollowed: async () => followed, getLiveLogins: () => live,
});

test('well typed name: Twitch results, no approximation', async () => {
  const api = fakeApi({ channels: [channel('kameto', 'Kameto')] });
  const r = await search(api).run('kameto');
  assert.equal(r.approximate, false);
  assert.deepEqual(r.channels.map((c) => c.login), ['kameto']);
  assert.equal(api.calls.filter(([k]) => k === 'channels').length, 1);
});

test('typo: finds the closest name', async () => {
  const api = fakeApi({
    channels: [channel('kameto', 'Kameto'), channel('kamilia'), channel('kamet0', 'Kamet0')],
    categories: [{ id: '1', name: 'Valorant', boxArt: '' }],
  });
  const r = await search(api).run('kammeto');
  assert.equal(r.approximate, true);
  assert.deepEqual(r.channels.map((c) => c.login), ['kameto', 'kamet0']);
});

test('typo on a game', async () => {
  const api = fakeApi({ categories: [{ id: '1', name: 'Valorant', boxArt: '' }, { id: '2', name: 'Valheim', boxArt: '' }] });
  const r = await search(api).run('valoarnt');
  assert.equal(r.approximate, true);
  assert.deepEqual(r.categories.map((c) => c.name), ['Valorant']);
});

test('mistyped followed channel: suggested even if Twitch does not find it', async () => {
  const api = fakeApi({ users: ['squeezie'] });
  const r = await search(api, [{ login: 'squeezie', name: 'Squeezie' }], new Set(['squeezie'])).run('squezie');
  assert.equal(r.approximate, true);
  assert.deepEqual(r.channels, [{ id: 'id-squeezie', login: 'squeezie', name: 'Squeezie', isLive: true, game: '', title: '', avatar: 'u-squeezie' }]);
});

test('nothing close: empty lists', async () => {
  const r = await search(fakeApi({ channels: [channel('kameto')] })).run('zzzz');
  assert.deepEqual(r.channels, []);
  assert.deepEqual(r.categories, []);
});

test('exact name: the channel comes first even if Twitch search does not return it', async () => {
  const api = fakeApi({
    channels: [channel('zeratorfan', 'ZeratorFan')],
    users: ['zerator'],
    live: [{ login: 'zerator', name: 'ZeratoR', game: 'Just Chatting', title: 'ZEvent' }],
  });
  const r = await search(api).run('ZeratoR');
  assert.equal(r.approximate, false);
  assert.deepEqual(r.channels[0], { id: 'id-zerator', login: 'zerator', name: 'ZERATOR', isLive: true, game: 'Just Chatting', title: 'ZEvent', avatar: 'u-zerator' });
  assert.deepEqual(r.channels.map((c) => c.login), ['zerator', 'zeratorfan']);
});

test('exact name already found by Twitch: moved first, no duplicate', async () => {
  const api = fakeApi({ channels: [channel('kametofan'), channel('kameto', 'Kameto', false)] });
  const r = await search(api).run('kameto');
  assert.deepEqual(r.channels.map((c) => c.login), ['kameto', 'kametofan']);
  assert.equal(r.channels[0].isLive, false);
});

test('exact game: it comes first among games', async () => {
  const api = fakeApi({ categories: [{ id: '2', name: 'Minecraft Dungeons', boxArt: '' }, { id: '1', name: 'Minecraft', boxArt: '' }] });
  const r = await search(api).run('minecraft');
  assert.deepEqual(r.categories.map((c) => c.name), ['Minecraft', 'Minecraft Dungeons']);
});

test('query that cannot be a username: no exact channel lookup', async () => {
  const api = fakeApi({ categories: [{ id: '1', name: 'Counter-Strike 2', boxArt: '' }] });
  await search(api).run('counter-strike 2');
  assert.equal(api.calls.some(([k]) => k === 'users'), false);
});

test('exact name: stays ahead of a followed channel with a close name', async () => {
  const api = fakeApi({ channels: [channel('kameto', 'Kameto')], users: ['kamet0'] });
  const r = await search(api, [{ login: 'kamet0', name: 'Kamet0' }]).run('kameto');
  assert.deepEqual(r.channels.map((c) => c.login), ['kameto', 'kamet0']);
});

test('results page: the section holding the typed name comes first', async () => {
  const { rankSections } = await import('../src/renderer/search.js');
  const groups = [
    { key: 'games', names: ['Squeeze Box', 'Squeezils'] },
    { key: 'live', names: ['squeeetv', 'SQUEALIE9'] },
    { key: 'channels', names: ['squeezie', 'Squeezie', 'squeezie_fan'] },
  ];
  assert.deepEqual(rankSections('squeezie', groups), ['channels', 'games', 'live']);
  assert.deepEqual(rankSections('valorant', [
    { key: 'games', names: ['Valorant'] }, { key: 'live', names: ['valorant_fr'] }, { key: 'channels', names: [] },
  ]), ['games', 'live', 'channels']);
});

test('results page: on a tie, usual order (games, live, channels)', async () => {
  const { rankSections } = await import('../src/renderer/search.js');
  assert.deepEqual(rankSections('zz', [
    { key: 'games', names: ['abc'] }, { key: 'live', names: ['def'] }, { key: 'channels', names: ['ghi'] },
  ]), ['games', 'live', 'channels']);
});
